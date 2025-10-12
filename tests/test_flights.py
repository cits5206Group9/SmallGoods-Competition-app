# Test the new attempt creation per flight
from app import create_app
from app.models import *
from app.extensions import db

app = create_app()
with app.app_context():
    # Check current flights and their attempts
    flights = Flight.query.all()
    for flight in flights:
        print(f"Flight {flight.id}: {flight.name}")
        attempts = Attempt.query.filter_by(flight_id=flight.id).all()
        print(f"  Has {len(attempts)} attempts")
        for attempt in attempts[:3]:  # Show first 3
            print(
                f"    Attempt {attempt.id}: Athlete {attempt.athlete_id}, Weight {attempt.requested_weight}kg"
            )
        print()
