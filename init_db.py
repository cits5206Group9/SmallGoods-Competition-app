#!/usr/bin/env python3
"""
Database initialization script for Small Goods Competition App
Creates all database tables and sets up initial data
"""

import os
import sys
from datetime import date

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from app import create_app
from app.extensions import db
from app.models import (
    Competition, Event, Lift, Flight, Athlete, AthleteFlight, AthleteEvent,
    Referee, Attempt, Score, Timer, SportType, ScoringType, AttemptResult,
    User, Exercise, Workout, WorkoutExercise
)
from app.services.competition_service import CompetitionService

def initialize_database():
    """Initialize the database with all tables"""
    app = create_app('development')
    
    with app.app_context():
        # Create all tables
        print("Creating database tables...")
        db.create_all()
        
        # Check if we have any competitions already
        if Competition.query.first() is None:
            print("Creating sample competition...")
            create_sample_competition()
        
        print("Database initialization completed successfully!")

def create_sample_competition():
    """Create a comprehensive sample competition for testing"""
    try:
        # Create a sample Olympic Weightlifting competition
        competition = Competition(
            name="2024 National Small Goods Championship",
            sport_type=SportType.OLYMPIC_WEIGHTLIFTING,
            scoring_method=ScoringType.SUM,
            date=date.today(),
            is_active=True,
            config={
                "attempt_time": 60,
                "break_time": 120,
                "wifi_ssid": "SmallGoodsComp",
                "wifi_password": "competition2025"
            }
        )
        
        db.session.add(competition)
        db.session.flush()  # Get the ID
        
        print(f"✅ Created competition: {competition.name}")
        
        # Create lifts for Olympic Weightlifting
        lifts = [
            Lift(competition_id=competition.id, name="Snatch", order=1),
            Lift(competition_id=competition.id, name="Clean & Jerk", order=2)
        ]
        
        for lift in lifts:
            db.session.add(lift)
        
        db.session.flush()
        print(f"✅ Created {len(lifts)} lifts")
        
        # Create events
        events = [
            Event(
                competition_id=competition.id,
                name="Men's 73kg",
                order=1,
                is_active=True
            ),
            Event(
                competition_id=competition.id,
                name="Women's 59kg",
                order=2,
                is_active=False
            ),
            Event(
                competition_id=competition.id,
                name="Men's 81kg",
                order=3,
                is_active=False
            )
        ]
        
        for event in events:
            db.session.add(event)
        
        db.session.flush()
        print(f"✅ Created {len(events)} events")
        
        # Create comprehensive sample athletes
        athletes_data = [
            # Men's 73kg
            {"name": "John Smith", "team": "PowerTeam", "weight_class": 73.0, "bodyweight": 72.5, "event_idx": 0},
            {"name": "Mike Johnson", "team": "StrengthCorp", "weight_class": 73.0, "bodyweight": 71.8, "event_idx": 0},
            {"name": "David Chen", "team": "Elite Lifters", "weight_class": 73.0, "bodyweight": 72.9, "event_idx": 0},
            {"name": "Alex Rodriguez", "team": "PowerTeam", "weight_class": 73.0, "bodyweight": 70.2, "event_idx": 0},
            
            # Women's 59kg
            {"name": "Sarah Williams", "team": "FemForce", "weight_class": 59.0, "bodyweight": 58.3, "event_idx": 1},
            {"name": "Emma Davis", "team": "Strong Sisters", "weight_class": 59.0, "bodyweight": 57.9, "event_idx": 1},
            {"name": "Lisa Zhang", "team": "Elite Lifters", "weight_class": 59.0, "bodyweight": 58.8, "event_idx": 1},
            
            # Men's 81kg
            {"name": "Ryan Martinez", "team": "IronWorks", "weight_class": 81.0, "bodyweight": 79.5, "event_idx": 2},
            {"name": "Chris Anderson", "team": "StrengthCorp", "weight_class": 81.0, "bodyweight": 80.2, "event_idx": 2},
            {"name": "James Wilson", "team": "PowerTeam", "weight_class": 81.0, "bodyweight": 80.8, "event_idx": 2},
        ]
        
        athletes = []
        for athlete_data in athletes_data:
            athlete = Athlete(
                competition_id=competition.id,
                name=athlete_data["name"],
                team=athlete_data["team"],
                weight_class=athlete_data["weight_class"],
                bodyweight=athlete_data["bodyweight"],
                is_active=True
            )
            db.session.add(athlete)
            athletes.append(athlete)
        
        db.session.flush()
        print(f"✅ Created {len(athletes)} athletes")
        
        # Create flights for the active event (Men's 73kg)
        flight_a = Flight(
            event_id=events[0].id,  # Men's 73kg
            name="Flight A",
            start_time=date.today()
        )
        db.session.add(flight_a)
        db.session.flush()
        
        # Add first 4 athletes to Flight A
        for i in range(4):  # First 4 athletes are in Men's 73kg
            athlete_flight = AthleteFlight(
                athlete_id=athletes[i].id,
                flight_id=flight_a.id
            )
            db.session.add(athlete_flight)
        
        print("✅ Created flight assignments")
        
        # Create some sample attempts for demonstration
        john_smith = athletes[0]  # John Smith
        
        # Snatch attempts
        snatch_attempts = [
            {"weight": 100.0, "is_successful": True, "result": AttemptResult.GOOD_LIFT},
            {"weight": 105.0, "is_successful": True, "result": AttemptResult.GOOD_LIFT},
            {"weight": 110.0, "is_successful": False, "result": AttemptResult.NO_LIFT},
        ]
        
        for i, attempt_data in enumerate(snatch_attempts, 1):
            attempt = Attempt(
                athlete_id=john_smith.id,
                lift_id=lifts[0].id,  # Snatch
                attempt_number=i,
                weight=attempt_data["weight"],
                is_successful=attempt_data["is_successful"],
                result=attempt_data["result"]
            )
            db.session.add(attempt)
        
        # Clean & Jerk attempts
        cj_attempts = [
            {"weight": 125.0, "is_successful": True, "result": AttemptResult.GOOD_LIFT},
            {"weight": 130.0, "is_successful": False, "result": AttemptResult.NO_LIFT},
        ]
        
        for i, attempt_data in enumerate(cj_attempts, 1):
            attempt = Attempt(
                athlete_id=john_smith.id,
                lift_id=lifts[1].id,  # Clean & Jerk
                attempt_number=i,
                weight=attempt_data["weight"],
                is_successful=attempt_data["is_successful"],
                result=attempt_data["result"]
            )
            db.session.add(attempt)
        
        print("✅ Created sample attempts")
        
        # Create sample referees
        referees_data = [
            {"name": "Chief Referee Johnson", "role": "Chief Referee"},
            {"name": "Side Referee Smith", "role": "Side Referee"},
            {"name": "Side Referee Davis", "role": "Side Referee"},
        ]
        
        for referee_data in referees_data:
            referee = Referee(
                competition_id=competition.id,
                name=referee_data["name"],
                role=referee_data["role"],
                is_active=True
            )
            db.session.add(referee)
        
        print(f"✅ Created {len(referees_data)} referees")
        
        # Create a sample score for John Smith
        score = Score(
            athlete_id=john_smith.id,
            event_id=events[0].id,  # Men's 73kg
            score=230.0,  # 105 + 125
            rank=1
        )
        db.session.add(score)
        
        # Create a timer for the competition
        timer = Timer(
            competition_id=competition.id,
            duration=60,
            remaining_time=60,
            is_running=False
        )
        db.session.add(timer)
        
        print("✅ Created scores and timer")
        
        # Create sample user for legacy compatibility
        if not User.query.filter_by(username="admin").first():
            user = User(username="admin")
            db.session.add(user)
            print("✅ Created admin user")
        
        db.session.commit()
        
        print(f"\n🎉 Sample competition '{competition.name}' created successfully!")
        print(f"📊 Competition ID: {competition.id}")
        print(f"👥 Athletes: {len(athletes)}")
        print(f"🏆 Events: {len(events)}")
        print(f"🏋️‍♂️ Lifts: {len(lifts)}")
        print(f"👨‍⚖️ Referees: {len(referees_data)}")
        
        print("\n🔗 Access URLs:")
        print(f"   Main Dashboard: http://127.0.0.1:5000/")
        print(f"   Admin Dashboard: http://127.0.0.1:5000/admin/competition/{competition.id}")
        print(f"   Competition Display: http://127.0.0.1:5000/display/{competition.id}")
        print(f"   Referee Interface: http://127.0.0.1:5000/referee/{competition.id}")
        print(f"   Timekeeper Interface: http://127.0.0.1:5000/timekeeper/{competition.id}")
        print(f"   Athlete Dashboard (John Smith): http://127.0.0.1:5000/athlete/{john_smith.id}/dashboard")
        
    except Exception as e:
        print(f"❌ Error creating sample competition: {str(e)}")
        db.session.rollback()
        raise

if __name__ == "__main__":
    initialize_database()
