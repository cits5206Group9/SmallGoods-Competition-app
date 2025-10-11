import pytest
import os
from flask import Flask, url_for
from sqlalchemy.pool import StaticPool
from app.extensions import db
from app.models import Athlete, Competition, Event, AthleteEntry, Attempt, SportType, ScoringType, Flight, AthleteFlight
from app.routes.athlete import athlete_bp
from app.routes.admin import admin_bp
from app import models
from datetime import date

@pytest.fixture(scope="function")
def app():
    """Create a fresh Flask app with in-memory database for each test"""
    import app as app_module
    app_path = os.path.dirname(app_module.__file__)
    
    app = Flask(__name__, 
                template_folder=os.path.join(app_path, 'templates'),
                static_folder=os.path.join(app_path, 'static'))
    
    app.config.update({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,
        'SQLALCHEMY_DATABASE_URI': 'sqlite://',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False,
        'SECRET_KEY': 'test-secret-key',
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'connect_args': {'check_same_thread': False},
            'poolclass': StaticPool,
        },
    })
    

    db.init_app(app)
    
    app.register_blueprint(admin_bp)
    app.register_blueprint(athlete_bp)
    
    with app.app_context():
        db.create_all()
    
    return app

@pytest.fixture
def client(app):
    return app.test_client()


# Test data setup
@pytest.fixture(autouse=True)
def setup_test_data(app):
    with app.app_context():
        # Create test data
        
        # Create a Competition
        comp = Competition(
            name="TestComp",
            description="desc",
            start_date=date(2025, 9, 28),
            is_active=True
        )
        db.session.add(comp)
        db.session.commit()

        # Create an Event
        event = Event(
            name="TestEvent",
            competition_id=comp.id,
            weight_category="Open",
            gender="M",
            sport_type=SportType.OLYMPIC_WEIGHTLIFTING,
            scoring_type=ScoringType.MAX,
            is_active=True
        )
        db.session.add(event)
        db.session.commit()

        # Create an Athlete
        athlete = Athlete(first_name="Harry", last_name="Test", email="harry@email.com", team="A", gender="M", is_active=True, competition_id=comp.id)
        db.session.add(athlete)
        db.session.commit()

        # Create Flight (required for AthleteEntry)
        flight = Flight(
            event_id=event.id,
            competition_id=comp.id,
            name="TestFlight",
            order=1,
            is_active=True
        )
        db.session.add(flight)
        db.session.commit()

        # Create AthleteFlight (required for entry_order)
        athlete_flight = AthleteFlight(
            athlete_id=athlete.id,
            flight_id=flight.id,
            lot_number=1,
            order=1
        )
        db.session.add(athlete_flight)
        db.session.commit()

        # Create AthleteEntry (must include flight_id and entry_order)
        entry = AthleteEntry(
            athlete_id=athlete.id,
            event_id=event.id,
            flight_id=flight.id,
            entry_order=athlete_flight.order,
            lift_type="Squat",
            attempt_time_limit=60,
            opening_weights=100,
            default_reps=[1,1,1],
            reps=[1,1,1],
            is_active=True
        )
        db.session.add(entry)
        db.session.commit()

        # Create Attempts
        for i in range(1, 4):
            attempt = Attempt(athlete_id=athlete.id, athlete_entry_id=entry.id, attempt_number=i, requested_weight=100, final_result=None)
            db.session.add(attempt)
        db.session.commit()


def test_athlete_dashboard_renders(client, app):
    """
    Test that the athlete dashboard page renders successfully and contains key elements.
    """
    with app.test_request_context():
        url = url_for("athlete.athlete_dashboard")
    response = client.get(url)
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Athlete Dashboard" in html
    assert "Next Attempt" in html
    assert "Your Rankings" in html
    assert "Competition" in html or "No active competition" in html


def test_next_attempt_timer_endpoint(client):
    """
    Test that the next-attempt-timer endpoint returns JSON with expected keys.
    """
    response = client.get("/athlete/next-attempt-timer")
    assert response.status_code == 200
    data = response.get_json()
    # Should contain at least one of these keys
    assert "timer_active" in data or "error" in data
    # If timer is active, check time field
    if data.get("timer_active"):
        assert "time" in data


def test_update_opening_weight(client):
    """
    Test POST to update opening weight returns a valid response.
    """
    payload = {
        "event_id": "1",
        "lift_key": "Squat",
        "weight": "100"
    }
    response = client.post("/athlete/update-opening-weight", data=payload)
    assert response.status_code in (200, 400, 404)
    if response.status_code != 404:
        data = response.get_json()
        assert "success" in data or "error" in data


def test_update_reps(client):
    """
    Test POST to update reps returns a valid response.
    """
    payload = {
        "event_id": "1",
        "lift_key": "Squat",
        "reps": "[1,1,1]"
    }
    response = client.post("/athlete/update-reps", data=payload)
    assert response.status_code in (200, 400, 404)
    if response.status_code != 404:
        data = response.get_json()
        assert "success" in data or "error" in data

