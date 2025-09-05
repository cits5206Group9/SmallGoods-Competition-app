"""
Competition Service - Business logic for competition management
Handles competition setup, athlete ordering, and event flow
"""

from typing import List, Dict, Any
from datetime import datetime
from ..models import (
    Competition, Event, Lift, Flight, Athlete, AthleteFlight, 
    Attempt, SportType, ScoringType, AttemptResult
)
from ..extensions import db

class CompetitionService:
    
    @staticmethod
    def create_default_events(competition: Competition) -> None:
        """Create default events and lifts based on sport type (FR1)"""
        
        if competition.sport_type == SportType.OLYMPIC_WEIGHTLIFTING:
            CompetitionService._create_weightlifting_events(competition)
        elif competition.sport_type == SportType.POWERLIFTING:
            CompetitionService._create_powerlifting_events(competition)
        elif competition.sport_type == SportType.CROSSFIT:
            CompetitionService._create_crossfit_events(competition)
        elif competition.sport_type == SportType.HYROX:
            CompetitionService._create_hyrox_events(competition)
    
    @staticmethod
    def _create_weightlifting_events(competition: Competition) -> None:
        """Create Olympic Weightlifting events"""
        weight_categories = {
            'Men': ['55kg', '61kg', '67kg', '73kg', '81kg', '89kg', '96kg', '102kg', '109kg', '+109kg'],
            'Women': ['45kg', '49kg', '55kg', '59kg', '64kg', '71kg', '76kg', '81kg', '87kg', '+87kg']
        }
        
        for gender, categories in weight_categories.items():
            for category in categories:
                event = Event(
                    competition_id=competition.id,
                    name=f"{gender} {category}",
                    weight_category=category,
                    gender=gender,
                    scoring_type=ScoringType.SUM  # Total of Snatch + Clean & Jerk
                )
                db.session.add(event)
                db.session.flush()
                
                # Add lifts
                snatch = Lift(
                    event_id=event.id,
                    name="Snatch",
                    order=1,
                    max_attempts=3,
                    attempt_time_seconds=60,
                    break_time_seconds=120
                )
                
                clean_jerk = Lift(
                    event_id=event.id,
                    name="Clean & Jerk",
                    order=2,
                    max_attempts=3,
                    attempt_time_seconds=60,
                    break_time_seconds=120
                )
                
                db.session.add_all([snatch, clean_jerk])
    
    @staticmethod
    def _create_powerlifting_events(competition: Competition) -> None:
        """Create Powerlifting events"""
        weight_categories = {
            'Men': ['53kg', '59kg', '66kg', '74kg', '83kg', '93kg', '105kg', '120kg', '+120kg'],
            'Women': ['43kg', '47kg', '52kg', '57kg', '63kg', '69kg', '76kg', '84kg', '+84kg']
        }
        
        for gender, categories in weight_categories.items():
            for category in categories:
                event = Event(
                    competition_id=competition.id,
                    name=f"{gender} {category}",
                    weight_category=category,
                    gender=gender,
                    scoring_type=ScoringType.SUM  # Total of Squat + Bench + Deadlift
                )
                db.session.add(event)
                db.session.flush()
                
                # Add lifts
                squat = Lift(
                    event_id=event.id,
                    name="Squat",
                    order=1,
                    max_attempts=3,
                    attempt_time_seconds=60,
                    break_time_seconds=300  # 5 minutes for powerlifting
                )
                
                bench = Lift(
                    event_id=event.id,
                    name="Bench Press",
                    order=2,
                    max_attempts=3,
                    attempt_time_seconds=60,
                    break_time_seconds=300
                )
                
                deadlift = Lift(
                    event_id=event.id,
                    name="Deadlift",
                    order=3,
                    max_attempts=3,
                    attempt_time_seconds=60,
                    break_time_seconds=300
                )
                
                db.session.add_all([squat, bench, deadlift])
    
    @staticmethod
    def _create_crossfit_events(competition: Competition) -> None:
        """Create CrossFit events (extensible format)"""
        # Example CrossFit event structure
        event = Event(
            competition_id=competition.id,
            name="CrossFit Open",
            weight_category="RX",
            gender="Mixed",
            scoring_type=ScoringType.TIME  # Fastest completion or max reps
        )
        db.session.add(event)
        db.session.flush()
        
        # CrossFit workout (example)
        workout = Lift(
            event_id=event.id,
            name="21.1 - Wall Balls & Double Unders",
            order=1,
            max_attempts=1,  # One attempt per workout
            attempt_time_seconds=900,  # 15 minutes cap
            break_time_seconds=600   # 10 minutes rest
        )
        
        db.session.add(workout)
    
    @staticmethod
    def _create_hyrox_events(competition: Competition) -> None:
        """Create HYROX events (extensible format)"""
        event = Event(
            competition_id=competition.id,
            name="HYROX Individual",
            weight_category="Standard",
            gender="Mixed",
            scoring_type=ScoringType.TIME  # Total completion time
        )
        db.session.add(event)
    
    @staticmethod
    def setup_athlete_attempts(athlete_id: int, event_id: int, opening_weights: Dict[str, float]) -> None:
        """Create initial attempts for an athlete in an event"""
        event = Event.query.get(event_id)
        if not event:
            raise ValueError("Event not found")
        
        for lift in event.lifts:
            weight = opening_weights.get(lift.name, 0)
            
            # Create 3 attempts for each lift
            for attempt_num in range(1, lift.max_attempts + 1):
                attempt = Attempt(
                    athlete_id=athlete_id,
                    lift_id=lift.id,
                    attempt_number=attempt_num,
                    requested_weight=weight if attempt_num == 1 else 0  # Only first attempt has opening weight
                )
                db.session.add(attempt)
    
    @staticmethod
    def calculate_lifting_order(event_id: int, lift_id: int) -> List[Attempt]:
        """Calculate and update lifting order for a specific lift (FR6)"""
        attempts = Attempt.query.join(Athlete).filter(
            Athlete.competition.has(events=Event.query.filter_by(id=event_id)),
            Attempt.lift_id == lift_id,
            Attempt.result.is_(None)  # Only unfinished attempts
        ).all()
        
        # Sort by: attempt number (1st attempts first), then by weight (lightest first)
        attempts.sort(key=lambda a: (a.attempt_number, a.requested_weight))
        
        # Update lifting order
        for i, attempt in enumerate(attempts):
            attempt.lifting_order = i + 1
        
        db.session.commit()
        return attempts
    
    @staticmethod
    def get_next_lifter(event_id: int) -> Attempt:
        """Get the next athlete to lift"""
        return Attempt.query.join(Athlete).filter(
            Athlete.competition.has(events=Event.query.filter_by(id=event_id)),
            Attempt.result.is_(None)
        ).order_by(Attempt.lifting_order).first()
    
    @staticmethod
    def process_attempt_result(attempt_id: int, result: AttemptResult, referee_decisions: Dict = None) -> None:
        """Process an attempt result and update athlete status"""
        attempt = Attempt.query.get(attempt_id)
        if not attempt:
            raise ValueError("Attempt not found")
        
        attempt.result = result
        attempt.completed_at = datetime.utcnow()
        
        if referee_decisions:
            attempt.referee_decisions = referee_decisions
        
        # If this was the athlete's last attempt for this lift, mark them as completed
        athlete = attempt.athlete
        lift = attempt.lift
        
        # Check if athlete has more attempts for this lift
        remaining_attempts = Attempt.query.filter_by(
            athlete_id=athlete.id,
            lift_id=lift.id,
            result=None
        ).count()
        
        if remaining_attempts == 0:
            # Move to next lift or mark athlete as finished
            next_lift = Lift.query.filter_by(
                event_id=lift.event_id
            ).filter(Lift.order > lift.order).order_by(Lift.order).first()
            
            if next_lift:
                # Create attempts for next lift if they don't exist
                existing_attempts = Attempt.query.filter_by(
                    athlete_id=athlete.id,
                    lift_id=next_lift.id
                ).count()
                
                if existing_attempts == 0:
                    for i in range(1, next_lift.max_attempts + 1):
                        next_attempt = Attempt(
                            athlete_id=athlete.id,
                            lift_id=next_lift.id,
                            attempt_number=i,
                            requested_weight=0  # To be set by athlete/coach
                        )
                        db.session.add(next_attempt)
        
        db.session.commit()
    
    @staticmethod
    def create_flights(event_id: int, max_athletes_per_flight: int = 12) -> List[Flight]:
        """Organize athletes into flights for better competition flow"""
        event = Event.query.get(event_id)
        athletes = Athlete.query.filter_by(competition_id=event.competition_id).all()
        
        # Clear existing flights
        Flight.query.filter_by(event_id=event_id).delete()
        AthleteFlight.query.join(Flight).filter(Flight.event_id == event_id).delete()
        
        flights = []
        flight_number = 1
        
        for i in range(0, len(athletes), max_athletes_per_flight):
            flight = Flight(
                event_id=event_id,
                name=f"Flight {chr(64 + flight_number)}",  # Flight A, B, C, etc.
                order=flight_number
            )
            db.session.add(flight)
            db.session.flush()
            
            # Add athletes to flight
            flight_athletes = athletes[i:i + max_athletes_per_flight]
            for lot_number, athlete in enumerate(flight_athletes, 1):
                athlete_flight = AthleteFlight(
                    athlete_id=athlete.id,
                    flight_id=flight.id,
                    lot_number=lot_number
                )
                db.session.add(athlete_flight)
            
            flights.append(flight)
            flight_number += 1
        
        db.session.commit()
        return flights
    
    @staticmethod
    def start_event(event_id: int) -> None:
        """Start an event - activate it and set up initial lifting order"""
        event = Event.query.get(event_id)
        if not event:
            raise ValueError("Event not found")
        
        # Deactivate other events in the same competition
        Event.query.filter_by(competition_id=event.competition_id).update({"is_active": False})
        
        # Activate this event
        event.is_active = True
        
        # Set first lift as active
        first_lift = Lift.query.filter_by(event_id=event_id).order_by(Lift.order).first()
        if first_lift:
            event.current_lift_id = first_lift.id
            
            # Calculate initial lifting order
            CompetitionService.calculate_lifting_order(event_id, first_lift.id)
        
        db.session.commit()
    
    @staticmethod
    def get_competition_summary(competition_id: int) -> Dict[str, Any]:
        """Get comprehensive competition summary for display"""
        competition = Competition.query.get(competition_id)
        
        summary = {
            "competition": {
                "id": competition.id,
                "name": competition.name,
                "sport_type": competition.sport_type.value,
                "date": competition.date.isoformat()
            },
            "events": [],
            "total_athletes": Athlete.query.filter_by(competition_id=competition_id).count(),
            "total_referees": len(competition.referees)
        }
        
        for event in competition.events:
            event_data = {
                "id": event.id,
                "name": event.name,
                "is_active": event.is_active,
                "lifts": [{"id": lift.id, "name": lift.name, "order": lift.order} for lift in event.lifts],
                "flights": [{"id": flight.id, "name": flight.name} for flight in event.flights]
            }
            summary["events"].append(event_data)
        
        return summary
