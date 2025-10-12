"""
Create a complete weightlifting competition test with all movement types
包含所有举重动作类型的完整测试比赛数据
"""
import sys
from datetime import date, datetime
from app import create_app, db
from app.models import (
    Competition, Event, Flight, Athlete, AthleteEntry,
    AthleteFlight, Attempt, SportType, ScoringType, AttemptResult
)

def create_weightlifting_competition():
    """Create a complete weightlifting competition with multiple events and athletes"""

    app = create_app()
    with app.app_context():
        print("Creating Weightlifting Competition Test...")

        # 1. Create Competition
        competition = Competition(
            name="Weightlifting Competition Test",
            description="Complete weightlifting competition with all movement types - 包含所有举重动作类型的完整测试比赛",
            start_date=date.today(),
            is_active=True
        )
        db.session.add(competition)
        db.session.flush()
        print(f"✓ Created competition: {competition.name} (ID: {competition.id})")

        # 2. Define movement types
        movements = [
            {"name": "Snatch", "type": "snatch"},
            {"name": "Clean & Jerk", "type": "clean_jerk"},
            {"name": "Squat", "type": "squat"},
            {"name": "Bench Press", "type": "bench"},
            {"name": "Deadlift", "type": "deadlift"}
        ]

        # 3. Create Events for each movement
        events = []
        for movement in movements:
            event = Event(
                competition_id=competition.id,
                name=movement["name"],
                sport_type=SportType.OLYMPIC_WEIGHTLIFTING,
                scoring_type=ScoringType.MAX,
                is_active=True
            )
            db.session.add(event)
            db.session.flush()
            events.append({"event": event, "movement_type": movement["type"], "movement_name": movement["name"]})
            print(f"✓ Created event: {event.name} (ID: {event.id})")

        # 4. Create Athletes (20 athletes, 10 male + 10 female)
        athletes_data = [
            # Male athletes
            {"first_name": "John", "last_name": "Smith", "gender": "M", "bodyweight": 73.5, "team": "Team Alpha"},
            {"first_name": "Michael", "last_name": "Johnson", "gender": "M", "bodyweight": 81.2, "team": "Team Alpha"},
            {"first_name": "David", "last_name": "Williams", "gender": "M", "bodyweight": 67.8, "team": "Team Beta"},
            {"first_name": "James", "last_name": "Brown", "gender": "M", "bodyweight": 89.5, "team": "Team Beta"},
            {"first_name": "Robert", "last_name": "Davis", "gender": "M", "bodyweight": 96.3, "team": "Team Gamma"},
            {"first_name": "Daniel", "last_name": "Miller", "gender": "M", "bodyweight": 61.0, "team": "Team Gamma"},
            {"first_name": "Matthew", "last_name": "Wilson", "gender": "M", "bodyweight": 73.0, "team": "Team Delta"},
            {"first_name": "Christopher", "last_name": "Moore", "gender": "M", "bodyweight": 81.0, "team": "Team Delta"},
            {"first_name": "Andrew", "last_name": "Taylor", "gender": "M", "bodyweight": 102.5, "team": "Team Epsilon"},
            {"first_name": "Joseph", "last_name": "Anderson", "gender": "M", "bodyweight": 89.0, "team": "Team Epsilon"},

            # Female athletes
            {"first_name": "Sarah", "last_name": "Thompson", "gender": "F", "bodyweight": 55.2, "team": "Team Alpha"},
            {"first_name": "Emily", "last_name": "White", "gender": "F", "bodyweight": 59.5, "team": "Team Alpha"},
            {"first_name": "Jessica", "last_name": "Harris", "gender": "F", "bodyweight": 64.3, "team": "Team Beta"},
            {"first_name": "Ashley", "last_name": "Martin", "gender": "F", "bodyweight": 71.0, "team": "Team Beta"},
            {"first_name": "Amanda", "last_name": "Garcia", "gender": "F", "bodyweight": 76.5, "team": "Team Gamma"},
            {"first_name": "Jennifer", "last_name": "Martinez", "gender": "F", "bodyweight": 49.0, "team": "Team Gamma"},
            {"first_name": "Melissa", "last_name": "Robinson", "gender": "F", "bodyweight": 55.0, "team": "Team Delta"},
            {"first_name": "Michelle", "last_name": "Clark", "gender": "F", "bodyweight": 59.0, "team": "Team Delta"},
            {"first_name": "Stephanie", "last_name": "Rodriguez", "gender": "F", "bodyweight": 81.5, "team": "Team Epsilon"},
            {"first_name": "Laura", "last_name": "Lewis", "gender": "F", "bodyweight": 64.0, "team": "Team Epsilon"}
        ]

        athletes = []
        for athlete_data in athletes_data:
            athlete = Athlete(
                competition_id=competition.id,
                first_name=athlete_data["first_name"],
                last_name=athlete_data["last_name"],
                gender=athlete_data["gender"],
                bodyweight=athlete_data["bodyweight"],
                team=athlete_data["team"],
                age=25,
                is_active=True
            )
            db.session.add(athlete)
            db.session.flush()
            athletes.append(athlete)
            print(f"✓ Created athlete: {athlete.first_name} {athlete.last_name} ({athlete.gender}, {athlete.bodyweight}kg)")

        # 5. Create Flights for each movement (separate male/female flights)
        flights_created = []
        for event_data in events:
            event = event_data["event"]
            movement_type = event_data["movement_type"]
            movement_name = event_data["movement_name"]

            # Flight 1: Male athletes (Flight A)
            flight_male = Flight(
                event_id=event.id,
                competition_id=competition.id,
                name=f"Flight A - {movement_name}",
                order=1,
                is_active=True,
                movement_type=movement_type
            )
            db.session.add(flight_male)
            db.session.flush()

            # Flight 2: Female athletes (Flight B)
            flight_female = Flight(
                event_id=event.id,
                competition_id=competition.id,
                name=f"Flight B - {movement_name}",
                order=2,
                is_active=True,
                movement_type=movement_type
            )
            db.session.add(flight_female)
            db.session.flush()

            flights_created.append({
                "event": event,
                "movement_type": movement_type,
                "movement_name": movement_name,
                "male_flight": flight_male,
                "female_flight": flight_female
            })

            print(f"✓ Created flights for {movement_name}: {flight_male.name}, {flight_female.name}")

        # 6. Assign athletes to flights and create entries
        for flight_data in flights_created:
            movement_type = flight_data["movement_type"]
            movement_name = flight_data["movement_name"]
            male_flight = flight_data["male_flight"]
            female_flight = flight_data["female_flight"]
            event = flight_data["event"]

            # Assign male athletes to male flight
            male_athletes = [a for a in athletes if a.gender == "M"]
            for idx, athlete in enumerate(male_athletes):
                # Create AthleteFlight relationship
                athlete_flight = AthleteFlight(
                    athlete_id=athlete.id,
                    flight_id=male_flight.id,
                    lot_number=idx + 1,
                    order=idx + 1
                )
                db.session.add(athlete_flight)
                db.session.flush()

                # Create AthleteEntry
                entry = AthleteEntry(
                    athlete_id=athlete.id,
                    event_id=event.id,
                    flight_id=male_flight.id,
                    entry_order=idx + 1,
                    lift_type=movement_type,
                    is_active=True
                )
                db.session.add(entry)
                db.session.flush()

                # Create 3 attempts for each athlete
                base_weights = get_base_weight(movement_type, "M", athlete.bodyweight)
                for attempt_num in range(1, 4):
                    weight = base_weights[attempt_num - 1]
                    # Simulate some successful and failed attempts
                    result = get_attempt_result(attempt_num, idx)

                    attempt = Attempt(
                        athlete_id=athlete.id,
                        athlete_entry_id=entry.id,
                        flight_id=male_flight.id,
                        movement_type=movement_type,
                        attempt_number=attempt_num,
                        requested_weight=weight,
                        actual_weight=weight,
                        final_result=result,
                        status='finished',
                        lifting_order=(idx * 3) + attempt_num
                    )
                    db.session.add(attempt)

            # Assign female athletes to female flight
            female_athletes = [a for a in athletes if a.gender == "F"]
            for idx, athlete in enumerate(female_athletes):
                # Create AthleteFlight relationship
                athlete_flight = AthleteFlight(
                    athlete_id=athlete.id,
                    flight_id=female_flight.id,
                    lot_number=idx + 1,
                    order=idx + 1
                )
                db.session.add(athlete_flight)
                db.session.flush()

                # Create AthleteEntry
                entry = AthleteEntry(
                    athlete_id=athlete.id,
                    event_id=event.id,
                    flight_id=female_flight.id,
                    entry_order=idx + 1,
                    lift_type=movement_type,
                    is_active=True
                )
                db.session.add(entry)
                db.session.flush()

                # Create 3 attempts for each athlete
                base_weights = get_base_weight(movement_type, "F", athlete.bodyweight)
                for attempt_num in range(1, 4):
                    weight = base_weights[attempt_num - 1]
                    # Simulate some successful and failed attempts
                    result = get_attempt_result(attempt_num, idx)

                    attempt = Attempt(
                        athlete_id=athlete.id,
                        athlete_entry_id=entry.id,
                        flight_id=female_flight.id,
                        movement_type=movement_type,
                        attempt_number=attempt_num,
                        requested_weight=weight,
                        actual_weight=weight,
                        final_result=result,
                        status='finished',
                        lifting_order=(idx * 3) + attempt_num
                    )
                    db.session.add(attempt)

            print(f"✓ Created entries and attempts for {movement_name}")

        # Commit all changes
        db.session.commit()
        print("\n" + "="*60)
        print("✓ Competition created successfully!")
        print("="*60)
        print(f"Competition ID: {competition.id}")
        print(f"Competition Name: {competition.name}")
        print(f"Events: {len(events)}")
        print(f"Athletes: {len(athletes)}")
        print(f"Flights: {len(flights_created) * 2}")
        print(f"\nView at: http://localhost:5000/display/public-stage?competition_id={competition.id}")
        print("="*60)

        return competition.id


def get_base_weight(movement_type, gender, bodyweight):
    """Calculate base weights for attempts based on movement type and athlete stats"""
    # Weight ratios based on typical lifting standards
    ratios = {
        "snatch": {
            "M": 0.9,  # 90% of bodyweight for first attempt
            "F": 0.7   # 70% of bodyweight for first attempt
        },
        "clean_jerk": {
            "M": 1.1,  # 110% of bodyweight
            "F": 0.85
        },
        "squat": {
            "M": 1.5,  # 150% of bodyweight
            "F": 1.2
        },
        "bench": {
            "M": 1.0,
            "F": 0.6
        },
        "deadlift": {
            "M": 1.8,
            "F": 1.3
        }
    }

    ratio = ratios.get(movement_type, {}).get(gender, 1.0)
    base = bodyweight * ratio

    # Three progressive attempts: base, +5kg, +7.5kg
    return [
        round(base, 1),
        round(base + 5, 1),
        round(base + 7.5, 1)
    ]


def get_attempt_result(attempt_num, athlete_idx):
    """Simulate attempt results - mix of success and failure"""
    # First attempts: mostly successful
    if attempt_num == 1:
        return AttemptResult.GOOD_LIFT if athlete_idx % 10 != 0 else AttemptResult.NO_LIFT
    # Second attempts: some failures
    elif attempt_num == 2:
        return AttemptResult.GOOD_LIFT if athlete_idx % 3 != 0 else AttemptResult.NO_LIFT
    # Third attempts: more challenging
    else:
        if athlete_idx % 2 == 0:
            return AttemptResult.GOOD_LIFT
        elif athlete_idx % 5 == 0:
            return AttemptResult.MISSED
        else:
            return AttemptResult.NO_LIFT


if __name__ == "__main__":
    try:
        competition_id = create_weightlifting_competition()
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error creating competition: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
