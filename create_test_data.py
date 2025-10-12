#!/usr/bin/env python3
"""
Create a simple test competition for testing timer and public-stage display
"""

import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from app.models import Competition, Event, Flight, Athlete, AthleteEntry, Attempt


def create_test_competition():
    with app.app_context():
        # Create a new competition
        comp = Competition(
            name="Timer Test Competition",
            date="2025-10-13",
            location="Test Venue",
            sport_type="weightlifting",
            scoring_type="total",
            breaktime_between_flights=180,  # 3 minutes
            breaktime_between_events=300,  # 5 minutes
        )
        db.session.add(comp)
        db.session.flush()

        print(f"✓ Created competition: {comp.name} (ID: {comp.id})")

        # Create an event (Snatch)
        event = Event(
            competition_id=comp.id,
            name="Snatch",
            order=1,
            max_attempts=3,
            attempt_time_seconds=60,
            break_time_seconds=120,
        )
        db.session.add(event)
        db.session.flush()

        print(f"✓ Created event: {event.name} (ID: {event.id})")

        # Create a flight
        flight = Flight(event_id=event.id, name="Flight A", order=1)
        db.session.add(flight)
        db.session.flush()

        print(f"✓ Created flight: {flight.name} (ID: {flight.id})")

        # Create 3 test athletes
        athletes_data = [
            {
                "first_name": "Test",
                "last_name": "Athlete One",
                "gender": "M",
                "weight": 70.0,
            },
            {
                "first_name": "Test",
                "last_name": "Athlete Two",
                "gender": "F",
                "weight": 60.0,
            },
            {
                "first_name": "Test",
                "last_name": "Athlete Three",
                "gender": "M",
                "weight": 75.0,
            },
        ]

        athletes = []
        for i, data in enumerate(athletes_data):
            athlete = Athlete(
                first_name=data["first_name"],
                last_name=data["last_name"],
                gender=data["gender"],
                birth_date="2000-01-01",
                team="Test Team",
            )
            db.session.add(athlete)
            db.session.flush()
            athletes.append(athlete)
            print(
                f"✓ Created athlete: {athlete.first_name} {athlete.last_name} (ID: {athlete.id})"
            )

            # Create athlete entry for this flight
            entry = AthleteEntry(
                athlete_id=athlete.id,
                event_id=event.id,
                flight_id=flight.id,
                entry_order=i + 1,
                lift_type="snatch",
                attempt_time_limit=60,
                break_time=120,
                opening_weights=int(data["weight"] * 0.8),  # Starting weight
            )
            db.session.add(entry)
            db.session.flush()

            # Create 3 attempts for each athlete (all in waiting state)
            base_weight = data["weight"] * 0.8
            for attempt_num in range(1, 4):
                attempt = Attempt(
                    athlete_entry_id=entry.id,
                    lift_id=event.id,
                    attempt_number=attempt_num,
                    requested_weight=base_weight + (attempt_num - 1) * 2.5,
                    actual_weight=None,
                    final_result=None,  # NULL = waiting
                    started_at=None,
                    completed_at=None,
                )
                db.session.add(attempt)

            print(
                f"  ✓ Created 3 attempts for {athlete.first_name} {athlete.last_name}"
            )

        # Commit all changes
        db.session.commit()

        print("\n" + "=" * 60)
        print("✓ Test competition created successfully!")
        print("=" * 60)
        print(f"\nCompetition ID: {comp.id}")
        print(f"Event ID: {event.id}")
        print(f"Flight ID: {flight.id}")
        print(f"\nTo test, navigate to:")
        print(f"  Timer page: http://localhost:5000/admin/timer?flight_id={flight.id}")
        print(
            f"  Public stage: http://localhost:5000/display/public-stage?competition_id={comp.id}"
        )
        print("\n" + "=" * 60)


if __name__ == "__main__":
    create_test_competition()
