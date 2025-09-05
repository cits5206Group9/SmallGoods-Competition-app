"""
Scoring Service - Handles all scoring calculations and rankings (FR5)
Supports MAX, SUM, and TIME scoring types with extensibility for future scoring systems
"""

from typing import List, Dict, Any, Optional
from sqlalchemy import func, desc
from ..models import (
    Event, Athlete, Attempt, Score, Lift, ScoringType, AttemptResult
)
from ..extensions import db

class ScoringService:
    
    @staticmethod
    def calculate_event_scores(event_id: int) -> List[Dict[str, Any]]:
        """Calculate scores for all athletes in an event (FR5)"""
        event = Event.query.get(event_id)
        if not event:
            raise ValueError("Event not found")
        
        # Clear existing non-final scores for this event
        Score.query.filter_by(event_id=event_id, is_final=False).delete()
        
        results = []
        
        if event.scoring_type == ScoringType.MAX:
            results = ScoringService._calculate_max_scores(event_id)
        elif event.scoring_type == ScoringType.SUM:
            results = ScoringService._calculate_sum_scores(event_id)
        elif event.scoring_type == ScoringType.TIME:
            results = ScoringService._calculate_time_scores(event_id)
        
        # Save scores to database
        for i, result in enumerate(results):
            score = Score(
                athlete_id=result['athlete_id'],
                event_id=event_id,
                value=result['score'],
                rank=i + 1,
                is_final=False  # Will be marked final when event completes
            )
            db.session.add(score)
        
        db.session.commit()
        return results
    
    @staticmethod
    def _calculate_max_scores(event_id: int) -> List[Dict[str, Any]]:
        """Calculate MAX scores (heaviest successful lift)"""
        # Get all successful attempts for this event
        successful_attempts = db.session.query(
            Attempt.athlete_id,
            Athlete.name,
            func.max(Attempt.requested_weight).label('max_weight')
        ).join(Athlete).join(Lift).filter(
            Lift.event_id == event_id,
            Attempt.result == AttemptResult.GOOD_LIFT
        ).group_by(Attempt.athlete_id, Athlete.name).all()
        
        # Sort by max weight (descending)
        results = [
            {
                'athlete_id': attempt.athlete_id,
                'athlete_name': attempt.name,
                'score': float(attempt.max_weight),
                'details': {'max_weight': attempt.max_weight}
            }
            for attempt in sorted(successful_attempts, key=lambda x: x.max_weight, reverse=True)
        ]
        
        return results
    
    @staticmethod
    def _calculate_sum_scores(event_id: int) -> List[Dict[str, Any]]:
        """Calculate SUM scores (total across all lifts)"""
        event = Event.query.get(event_id)
        lifts = Lift.query.filter_by(event_id=event_id).order_by(Lift.order).all()
        
        athlete_scores = {}
        
        # Get best successful attempt for each athlete per lift
        for lift in lifts:
            best_attempts = db.session.query(
                Attempt.athlete_id,
                Athlete.name,
                func.max(Attempt.requested_weight).label('best_weight')
            ).join(Athlete).filter(
                Attempt.lift_id == lift.id,
                Attempt.result == AttemptResult.GOOD_LIFT
            ).group_by(Attempt.athlete_id, Athlete.name).all()
            
            for attempt in best_attempts:
                if attempt.athlete_id not in athlete_scores:
                    athlete_scores[attempt.athlete_id] = {
                        'athlete_name': attempt.name,
                        'total': 0,
                        'lifts': {}
                    }
                
                athlete_scores[attempt.athlete_id]['lifts'][lift.name] = attempt.best_weight
                athlete_scores[attempt.athlete_id]['total'] += attempt.best_weight
        
        # Sort by total (descending)
        results = [
            {
                'athlete_id': athlete_id,
                'athlete_name': data['athlete_name'],
                'score': float(data['total']),
                'details': data['lifts']
            }
            for athlete_id, data in sorted(
                athlete_scores.items(), 
                key=lambda x: x[1]['total'], 
                reverse=True
            )
        ]
        
        return results
    
    @staticmethod
    def _calculate_time_scores(event_id: int) -> List[Dict[str, Any]]:
        """Calculate TIME scores (fastest completion time)"""
        # For time-based events, we look at completion time or reps within time cap
        successful_attempts = db.session.query(
            Attempt.athlete_id,
            Athlete.name,
            Attempt.started_at,
            Attempt.completed_at,
            Attempt.requested_weight  # In time events, this might represent reps or points
        ).join(Athlete).join(Lift).filter(
            Lift.event_id == event_id,
            Attempt.result == AttemptResult.GOOD_LIFT,
            Attempt.started_at.isnot(None),
            Attempt.completed_at.isnot(None)
        ).all()
        
        results = []
        for attempt in successful_attempts:
            # Calculate completion time in seconds
            time_taken = (attempt.completed_at - attempt.started_at).total_seconds()
            
            results.append({
                'athlete_id': attempt.athlete_id,
                'athlete_name': attempt.name,
                'score': time_taken,  # Lower is better for time
                'details': {
                    'time_seconds': time_taken,
                    'reps_or_points': attempt.requested_weight
                }
            })
        
        # Sort by time (ascending - faster is better)
        results.sort(key=lambda x: x['score'])
        
        return results
    
    @staticmethod
    def calculate_lift_scores(lift_id: int) -> List[Dict[str, Any]]:
        """Calculate scores for a specific lift"""
        lift = Lift.query.get(lift_id)
        if not lift:
            raise ValueError("Lift not found")
        
        # Get best attempt for each athlete for this lift
        best_attempts = db.session.query(
            Attempt.athlete_id,
            Athlete.name,
            func.max(Attempt.requested_weight).label('best_weight')
        ).join(Athlete).filter(
            Attempt.lift_id == lift_id,
            Attempt.result == AttemptResult.GOOD_LIFT
        ).group_by(Attempt.athlete_id, Athlete.name).all()
        
        results = [
            {
                'athlete_id': attempt.athlete_id,
                'athlete_name': attempt.name,
                'score': float(attempt.best_weight),
                'lift_name': lift.name
            }
            for attempt in sorted(best_attempts, key=lambda x: x.best_weight, reverse=True)
        ]
        
        # Save lift-specific scores
        for i, result in enumerate(results):
            score = Score(
                athlete_id=result['athlete_id'],
                event_id=lift.event_id,
                lift_id=lift_id,
                value=result['score'],
                rank=i + 1,
                is_final=False
            )
            db.session.add(score)
        
        db.session.commit()
        return results
    
    @staticmethod
    def calculate_event_rankings(event_id: int) -> List[Dict[str, Any]]:
        """Get current rankings for an event"""
        rankings = Score.query.filter_by(
            event_id=event_id,
            lift_id=None  # Overall event scores, not lift-specific
        ).order_by(Score.rank).all()
        
        result = []
        for score in rankings:
            athlete_details = {
                'rank': score.rank,
                'athlete_id': score.athlete_id,
                'athlete_name': score.athlete.name,
                'team': score.athlete.team,
                'score': score.value,
                'bodyweight': score.athlete.bodyweight
            }
            
            # Add lift breakdown for sum events
            lift_scores = Score.query.filter_by(
                athlete_id=score.athlete_id,
                event_id=event_id
            ).filter(Score.lift_id.isnot(None)).all()
            
            athlete_details['lift_scores'] = {
                lift_score.lift.name: lift_score.value 
                for lift_score in lift_scores
            }
            
            result.append(athlete_details)
        
        return result
    
    @staticmethod
    def get_athlete_progress(athlete_id: int, event_id: int) -> Dict[str, Any]:
        """Get detailed progress for an athlete in an event"""
        athlete = Athlete.query.get(athlete_id)
        event = Event.query.get(event_id)
        
        if not athlete or not event:
            raise ValueError("Athlete or event not found")
        
        progress = {
            'athlete': {
                'id': athlete.id,
                'name': athlete.name,
                'team': athlete.team,
                'bodyweight': athlete.bodyweight
            },
            'event': {
                'id': event.id,
                'name': event.name,
                'scoring_type': event.scoring_type.value
            },
            'lifts': [],
            'overall_score': 0,
            'current_rank': None
        }
        
        # Get attempts for each lift
        for lift in event.lifts:
            attempts = Attempt.query.filter_by(
                athlete_id=athlete_id,
                lift_id=lift.id
            ).order_by(Attempt.attempt_number).all()
            
            lift_data = {
                'lift_name': lift.name,
                'attempts': [],
                'best_result': None,
                'next_attempt': None
            }
            
            best_weight = 0
            for attempt in attempts:
                attempt_data = {
                    'attempt_number': attempt.attempt_number,
                    'weight': attempt.requested_weight,
                    'result': attempt.result.value if attempt.result else 'pending',
                    'lifting_order': attempt.lifting_order
                }
                lift_data['attempts'].append(attempt_data)
                
                if attempt.result == AttemptResult.GOOD_LIFT and attempt.requested_weight > best_weight:
                    best_weight = attempt.requested_weight
                    lift_data['best_result'] = attempt.requested_weight
                
                if attempt.result is None:
                    lift_data['next_attempt'] = attempt_data
                    break  # First unfinished attempt
            
            progress['lifts'].append(lift_data)
            if lift_data['best_result']:
                progress['overall_score'] += lift_data['best_result']
        
        # Get current rank
        current_score = Score.query.filter_by(
            athlete_id=athlete_id,
            event_id=event_id,
            lift_id=None
        ).first()
        
        if current_score:
            progress['current_rank'] = current_score.rank
        
        return progress
    
    @staticmethod
    def finalize_event_scores(event_id: int) -> None:
        """Mark all scores for an event as final"""
        Score.query.filter_by(event_id=event_id).update({"is_final": True})
        
        # Mark event as completed
        event = Event.query.get(event_id)
        if event:
            event.is_active = False
        
        db.session.commit()
    
    @staticmethod
    def calculate_improvement_coefficient(athlete_id: int) -> Optional[float]:
        """
        Calculate improvement coefficient for an athlete
        This is an extensible method for the future improvement tracking feature
        """
        # Placeholder for improvement coefficient calculation
        # This would analyze historical performance data
        # considering factors like bodyweight, age, experience, etc.
        
        athlete = Athlete.query.get(athlete_id)
        if not athlete:
            return None
        
        # Simple placeholder calculation
        # In production, this would use machine learning or statistical analysis
        # of historical competition data
        
        return 1.0  # Baseline improvement coefficient
    
    @staticmethod
    def get_records_and_standards(event_id: int) -> Dict[str, Any]:
        """Get competition records and qualifying standards for an event"""
        # Placeholder for records tracking
        # Would integrate with historical database of competition results
        
        return {
            'event_records': [],
            'national_records': [],
            'qualifying_standards': {}
        }
