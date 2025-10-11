from ..models import (
    Competition,
    Event,
    Flight,
    SportType,
    ScoringType,
    db,
)
from datetime import datetime


def import_competition_model(data):
    """
    Import a competition model from JSON data into database.
    Returns (competition, error_message)
    """
    try:
        # Validate required fields
        if not data.get("name"):
            return None, "Competition name is required"

        # Create base competition
        competition = Competition(
            name=data["name"],
            description=data.get("description", ""),
            start_date=datetime.now().date(),
            is_active=True,
        )
        db.session.add(competition)
        db.session.flush()

        # Process events
        for event_idx, event_data in enumerate(data.get("events", []), 1):
            if not event_data.get("name"):
                continue

            # Create event
            event = Event(
                competition_id=competition.id,
                name=event_data["name"],
                weight_category=event_data.get("weight_category", "Open"),
                gender=event_data.get("gender", "M"),
                sport_type=SportType.OLYMPIC_WEIGHTLIFTING,  # Default
                scoring_type=ScoringType.MAX,  # Default
                is_active=True,
            )
            db.session.add(event)
            db.session.flush()

            # Process movements/flights
            for mov_idx, movement in enumerate(event_data.get("movements", []), 1):
                if not movement.get("name"):
                    continue

                flight = Flight(
                    event_id=event.id,
                    competition_id=competition.id,
                    name=movement["name"],
                    order=mov_idx,
                    is_active=True,
                    movement_type=movement.get("name", "").lower(),
                )
                db.session.add(flight)

        db.session.commit()
        return competition, None

    except Exception as e:
        db.session.rollback()
        return None, str(e)
