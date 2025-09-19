#!/usr/bin/env python3
"""
Database seeder for referee testing
"""
from app import create_app
from app.models import db, Competition, CompetitionDay, SportCategory, Exercise, CompetitionType
from datetime import datetime, date

def seed_test_data():
    """Create test competition data for referee testing"""
    
    app = create_app()
    with app.app_context():
        # Check if data already exists
        existing_comp = Competition.query.filter_by(name='Olympic Weightlifting Championship').first()
        if existing_comp:
            print("Test data already exists!")
            return
        
        # Create a test competition
        competition = Competition(
            name='Olympic Weightlifting Championship',
            description='Test competition for referee interface',
            start_date=date.today(),
            end_date=date.today(),
            is_active=True
        )
        db.session.add(competition)
        db.session.flush()
        
        # Create competition day
        day = CompetitionDay(
            competition=competition,
            day_number=1,
            date=date.today(),
            is_active=True
        )
        db.session.add(day)
        db.session.flush()
        
        # Create sport categories (events)
        events_data = [
            {
                'name': 'Men 73kg Snatch',
                'exercises': [
                    {'name': 'Snatch', 'order': 1, 'time_limit': 60, 'break_time': 120}
                ]
            },
            {
                'name': 'Men 73kg Clean & Jerk',
                'exercises': [
                    {'name': 'Clean & Jerk', 'order': 1, 'time_limit': 60, 'break_time': 120}
                ]
            },
            {
                'name': 'Women 63kg Snatch',
                'exercises': [
                    {'name': 'Snatch', 'order': 1, 'time_limit': 60, 'break_time': 120}
                ]
            }
        ]
        
        for event_data in events_data:
            category = SportCategory(
                competition_day=day,
                name=event_data['name'],
                is_active=True
            )
            db.session.add(category)
            db.session.flush()
            
            for exercise_data in event_data['exercises']:
                exercise = Exercise(
                    sport_category=category,
                    name=exercise_data['name'],
                    order=exercise_data['order'],
                    attempt_time_limit=exercise_data['time_limit'],
                    break_time_default=exercise_data['break_time']
                )
                db.session.add(exercise)
                db.session.flush()
                
                # Create competition type
                comp_type = CompetitionType(
                    exercise=exercise,
                    name='Standard Olympic Weightlifting',
                    is_active=True
                )
                db.session.add(comp_type)
        
        db.session.commit()
        print("Test data created successfully!")
        print(f"Competition ID: {competition.id}")
        print(f"Competition Name: {competition.name}")

if __name__ == '__main__':
    seed_test_data()