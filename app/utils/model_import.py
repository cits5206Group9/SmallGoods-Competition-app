from ..models import (
    Competition, CompetitionDay, SportCategory,
    Exercise, CompetitionType, db
)
from datetime import datetime

def import_competition_model(data):
    """
    Import a competition model from JSON data into database.
    Returns (competition, error_message)
    """
    try:
        # Validate required fields
        if not data.get('name'):
            return None, "Competition name is required"
            
        # Create base competition
        competition = Competition(
            name=data['name'],
            description=f"Sport type: {data.get('sport_type', 'Not specified')}",
            start_date=datetime.now().date(),
            end_date=datetime.now().date(),
            is_active=True
        )
        db.session.add(competition)
        db.session.flush()
        
        # Create competition structure
        day = CompetitionDay(
            competition=competition,
            day_number=1,
            date=datetime.now().date()
        )
        db.session.add(day)
        
        # Process events
        for event_idx, event_data in enumerate(data.get('events', []), 1):
            if not event_data.get('name'):
                continue
                
            category = SportCategory(
                competition_day=day,
                name=event_data['name']
            )
            db.session.add(category)
            
            # Process movements
            for mov_idx, movement in enumerate(event_data.get('movements', []), 1):
                if not movement.get('name'):
                    continue
                    
                exercise = Exercise(
                    sport_category=category,
                    name=movement['name'],
                    order=mov_idx,
                    attempt_time_limit=movement.get('timer', {}).get('attempt_seconds', 60),
                    break_time_default=movement.get('timer', {}).get('break_seconds', 120)
                )
                db.session.add(exercise)
                
                # Create competition type
                comp_type = CompetitionType(
                    exercise=exercise,
                    name=movement.get('scoring', {}).get('name', 'Standard')
                )
                db.session.add(comp_type)
        
        db.session.commit()
        return competition, None
        
    except Exception as e:
        db.session.rollback()
        return None, str(e)