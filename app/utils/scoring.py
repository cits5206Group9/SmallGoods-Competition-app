from datetime import datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy import func
from app.models import (
    Attempt,
    AttemptResult,
    RefereeDecision,
    Score,
    AthleteEntry,
    ScoringType,
    Event,
    Flight,
)
from app.extensions import db


class ScoringCalculator:
    """Main scoring calculator for competitions"""

    @staticmethod
    def determine_attempt_result(attempt_id: int) -> Optional[AttemptResult]:
        """
        Determine attempt result based on referee decisions.
        Returns None if no decisions have been recorded yet.
        """
        decisions = RefereeDecision.query.filter_by(attempt_id=attempt_id).all()

        if not decisions:
            return None  # ✅ Return None instead of MISSED for pending attempts

        # Count votes
        decision_counts = {}
        for decision in decisions:
            result = decision.decision
            decision_counts[result] = decision_counts.get(result, 0) + 1

        # Majority voting
        total_decisions = len(decisions)
        for result, count in decision_counts.items():
            if count > total_decisions / 2:  # Majority
                return result

        # If no majority (e.g., 1-1-1 with 3 referees), default to NO_LIFT
        return AttemptResult.NO_LIFT

    @staticmethod
    def calculate_attempt_score(attempt: Attempt, scoring_type: ScoringType) -> float:
        # Only count successful attempts
        if attempt.final_result not in [AttemptResult.GOOD_LIFT, None]:
            return 0.0

        # Determine final result if not set
        if attempt.final_result is None:
            attempt.final_result = ScoringCalculator.determine_attempt_result(
                attempt.id
            )
            if attempt.final_result != AttemptResult.GOOD_LIFT:
                return 0.0

        if scoring_type == ScoringType.MAX:
            # For MAX scoring, return the weight lifted
            return float(attempt.actual_weight or attempt.requested_weight or 0)

        elif scoring_type == ScoringType.SUM:
            # For SUM scoring, return weight * reps or just weight
            weight = float(attempt.actual_weight or attempt.requested_weight or 0)
            # Note: If reps are stored somewhere, multiply here
            return weight

        elif scoring_type == ScoringType.MIN:
            # For MIN scoring, return time taken (lower is better)
            if attempt.started_at and attempt.completed_at:
                time_taken = (attempt.completed_at - attempt.started_at).total_seconds()
                return float(time_taken)
            return 0.0

        return 0.0

    @staticmethod
    def calculate_athlete_entry_score(
        athlete_entry_id: int, scoring_type: Optional[ScoringType] = None
    ) -> Dict:
        athlete_entry = AthleteEntry.query.get(athlete_entry_id)
        if not athlete_entry:
            raise ValueError(f"AthleteEntry {athlete_entry_id} not found")

        # Get scoring type from event if not provided
        if scoring_type is None:
            event = Event.query.get(athlete_entry.event_id)
            scoring_type = event.scoring_type if event else ScoringType.MAX

        # Get all attempts for this entry
        attempts = (
            Attempt.query.filter_by(athlete_entry_id=athlete_entry_id)
            .order_by(Attempt.attempt_number)
            .all()
        )

        if not attempts:
            return {
                "best_attempt_weight": 0.0,
                "total_score": 0.0,
                "successful_attempts": 0,
                "scoring_type": scoring_type.value,
                "attempts_breakdown": [],
            }

        # Calculate scores for each attempt
        attempt_scores = []
        successful_count = 0

        for attempt in attempts:
            # Update final result ONLY if there are referee decisions
            if attempt.final_result is None:
                result = ScoringCalculator.determine_attempt_result(attempt.id)
                if result is not None:
                    attempt.final_result = result
                    db.session.add(attempt)

            score = ScoringCalculator.calculate_attempt_score(attempt, scoring_type)

            if attempt.final_result == AttemptResult.GOOD_LIFT:
                successful_count += 1

            attempt_scores.append(
                {
                    "attempt_number": attempt.attempt_number,
                    "weight": float(
                        attempt.actual_weight or attempt.requested_weight or 0
                    ),
                    "result": attempt.final_result.value
                    if attempt.final_result
                    else "pending",
                    "score": score,
                    "started_at": attempt.started_at.isoformat()
                    if attempt.started_at
                    else None,
                    "completed_at": attempt.completed_at.isoformat()
                    if attempt.completed_at
                    else None,
                }
            )

        # Calculate total based on scoring type
        if scoring_type == ScoringType.MAX:
            # Best single attempt
            total_score = max((s["score"] for s in attempt_scores), default=0.0)
            best_weight = total_score

        elif scoring_type == ScoringType.SUM:
            # Sum of all successful attempts
            total_score = sum(s["score"] for s in attempt_scores if s["score"] > 0)
            best_weight = max(
                (s["weight"] for s in attempt_scores if s["score"] > 0), default=0.0
            )

        elif scoring_type == ScoringType.MIN:
            # Best (lowest) time
            valid_scores = [s["score"] for s in attempt_scores if s["score"] > 0]
            total_score = min(valid_scores) if valid_scores else 0.0
            best_weight = total_score  # For time-based, "weight" is actually time

        else:
            total_score = 0.0
            best_weight = 0.0

        db.session.commit()

        return {
            "best_attempt_weight": best_weight,
            "total_score": total_score,
            "successful_attempts": successful_count,
            "scoring_type": scoring_type.value,
            "attempts_breakdown": attempt_scores,
        }

    @staticmethod
    def calculate_and_save_score(athlete_entry_id: int) -> Score:
        score_data = ScoringCalculator.calculate_athlete_entry_score(athlete_entry_id)

        # Check if score already exists
        existing_score = Score.query.filter_by(
            athlete_entry_id=athlete_entry_id
        ).first()

        if existing_score:
            # Update existing score
            existing_score.best_attempt_weight = score_data["best_attempt_weight"]
            existing_score.total_score = score_data["total_score"]
            existing_score.score_type = score_data["scoring_type"]
            existing_score.calculated_at = datetime.utcnow()
            existing_score.is_final = False  # Will be set to True when competition ends
            score = existing_score
        else:
            # Create new score
            score = Score(
                athlete_entry_id=athlete_entry_id,
                best_attempt_weight=score_data["best_attempt_weight"],
                total_score=score_data["total_score"],
                score_type=score_data["scoring_type"],
                calculated_at=datetime.utcnow(),
                is_final=False,
            )
            db.session.add(score)

        db.session.commit()
        return score

    @staticmethod
    def calculate_event_rankings(event_id: int) -> List[Dict]:
        event = Event.query.get(event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")

        # Get all athlete entries for this event
        athlete_entries = AthleteEntry.query.filter_by(event_id=event_id).all()

        # Calculate scores for each athlete
        athlete_scores = []
        for entry in athlete_entries:
            score_data = ScoringCalculator.calculate_athlete_entry_score(
                entry.id, event.scoring_type
            )

            athlete_scores.append(
                {
                    "athlete_entry_id": entry.id,
                    "athlete_id": entry.athlete_id,
                    "athlete_name": f"{entry.athlete.first_name} {entry.athlete.last_name}",
                    "lift_type": entry.lift_type,
                    "total_score": score_data["total_score"],
                    "best_attempt_weight": score_data["best_attempt_weight"],
                    "successful_attempts": score_data["successful_attempts"],
                    "attempts_breakdown": score_data["attempts_breakdown"],
                }
            )

        # Sort based on scoring type
        if event.scoring_type == ScoringType.MIN:
            # For minimum time, lower is better (exclude 0 scores)
            athlete_scores = [s for s in athlete_scores if s["total_score"] > 0]
            athlete_scores.sort(key=lambda x: x["total_score"])
        else:
            # For MAX and SUM, higher is better
            athlete_scores.sort(key=lambda x: x["total_score"], reverse=True)

        # Assign ranks
        for i, athlete_score in enumerate(athlete_scores, 1):
            athlete_score["rank"] = i

        # Update ranks in database
        for athlete_score in athlete_scores:
            score = Score.query.filter_by(
                athlete_entry_id=athlete_score["athlete_entry_id"]
            ).first()

            if score:
                score.rank = athlete_score["rank"]
            else:
                # Create score if it doesn't exist
                score = Score(
                    athlete_entry_id=athlete_score["athlete_entry_id"],
                    best_attempt_weight=athlete_score["best_attempt_weight"],
                    total_score=athlete_score["total_score"],
                    score_type=event.scoring_type.value,
                    rank=athlete_score["rank"],
                    calculated_at=datetime.utcnow(),
                    is_final=False,
                )
                db.session.add(score)

        db.session.commit()

        return athlete_scores

    @staticmethod
    def calculate_flight_rankings(flight_id: int) -> List[Dict]:
        """
        Calculate rankings for all athletes in a flight.

        Args:
            flight_id: ID of the flight

        Returns:
            List of dicts with athlete info and rankings
        """
        flight = Flight.query.get(flight_id)
        if not flight:
            raise ValueError(f"Flight {flight_id} not found")

        event = Event.query.get(flight.event_id)
        if not event:
            raise ValueError(f"Event not found for flight {flight_id}")

        # Get all athlete entries for this flight
        athlete_entries = AthleteEntry.query.filter_by(flight_id=flight_id).all()

        # Calculate scores for each athlete
        athlete_scores = []
        for entry in athlete_entries:
            score_data = ScoringCalculator.calculate_athlete_entry_score(
                entry.id, event.scoring_type
            )

            athlete_scores.append(
                {
                    "athlete_entry_id": entry.id,
                    "athlete_id": entry.athlete_id,
                    "athlete_name": f"{entry.athlete.first_name} {entry.athlete.last_name}",
                    "lift_type": entry.lift_type,
                    "total_score": score_data["total_score"],
                    "best_attempt_weight": score_data["best_attempt_weight"],
                    "successful_attempts": score_data["successful_attempts"],
                    "attempts_breakdown": score_data["attempts_breakdown"],
                }
            )

        # Sort based on scoring type
        if event.scoring_type == ScoringType.MIN:
            athlete_scores = [s for s in athlete_scores if s["total_score"] > 0]
            athlete_scores.sort(key=lambda x: x["total_score"])
        else:
            athlete_scores.sort(key=lambda x: x["total_score"], reverse=True)

        # Assign ranks
        for i, athlete_score in enumerate(athlete_scores, 1):
            athlete_score["rank"] = i

        return athlete_scores

    @staticmethod
    def finalize_event_scores(event_id: int) -> None:
        scores = (
            Score.query.join(AthleteEntry)
            .filter(AthleteEntry.event_id == event_id)
            .all()
        )

        for score in scores:
            score.is_final = True

        db.session.commit()

    @staticmethod
    def get_athlete_total_score(athlete_id: int, event_id: int) -> Dict:
        # Get all entries for this athlete in this event
        entries = AthleteEntry.query.filter_by(
            athlete_id=athlete_id, event_id=event_id
        ).all()

        total_score = 0.0
        movements = []

        for entry in entries:
            score_data = ScoringCalculator.calculate_athlete_entry_score(entry.id)
            total_score += score_data["total_score"]
            movements.append(
                {
                    "lift_type": entry.lift_type,
                    "score": score_data["total_score"],
                    "best_weight": score_data["best_attempt_weight"],
                }
            )

        return {
            "athlete_id": athlete_id,
            "event_id": event_id,
            "total_score": total_score,
            "movements": movements,
        }


class TimerScoring:
    """Utilities for time-based scoring"""

    @staticmethod
    def record_attempt_time(
        attempt_id: int, start_time: datetime, end_time: datetime
    ) -> float:
        attempt = Attempt.query.get(attempt_id)
        if not attempt:
            raise ValueError(f"Attempt {attempt_id} not found")

        attempt.started_at = start_time
        attempt.completed_at = end_time
        db.session.commit()

        time_taken = (end_time - start_time).total_seconds()
        return time_taken

    @staticmethod
    def get_attempt_duration(attempt_id: int) -> Optional[float]:
        attempt = Attempt.query.get(attempt_id)
        if not attempt or not attempt.started_at or not attempt.completed_at:
            return None

        return (attempt.completed_at - attempt.started_at).total_seconds()


def calculate_scores_after_referee_decision(attempt_id: int) -> Dict:
    attempt = Attempt.query.get(attempt_id)
    if not attempt:
        raise ValueError(f"Attempt {attempt_id} not found")

    # Update attempt result based on referee decisions
    attempt.final_result = ScoringCalculator.determine_attempt_result(attempt_id)
    db.session.commit()

    # Calculate and save score for this athlete entry
    score = ScoringCalculator.calculate_and_save_score(attempt.athlete_entry_id)

    # Get updated rankings for the event
    athlete_entry = AthleteEntry.query.get(attempt.athlete_entry_id)
    rankings = ScoringCalculator.calculate_event_rankings(athlete_entry.event_id)

    return {
        "attempt_result": attempt.final_result.value,
        "score": {
            "best_attempt_weight": score.best_attempt_weight,
            "total_score": score.total_score,
            "rank": score.rank,
        },
        "event_rankings": rankings,
    }
