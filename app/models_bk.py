from datetime import datetime
from enum import Enum
from .extensions import db

# Competition-specific models for Small Goods Competition App


class SportType(Enum):
    OLYMPIC_WEIGHTLIFTING = "olympic_weightlifting"
    POWERLIFTING = "powerlifting"
    CROSSFIT = "crossfit"
    HYROX = "hyrox"


class ScoringType(Enum):
    MAX = "max"  # Heaviest weight
    SUM = "sum"  # Total weight/reps
    TIME = "time"  # Fastest completion


class AttemptResult(Enum):
    GOOD_LIFT = "good_lift"
    NO_LIFT = "no_lift"
    NOT_TO_DEPTH = "not_to_depth"
    MISSED = "missed"
    DNF = "dnf"  # Did Not Finish


class AthleteEvent(db.Model):
    """Association table for athletes and events"""

    __tablename__ = "athlete_event"

    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    athlete = db.relationship(
        "Athlete", backref=db.backref("athlete_events", lazy=True)
    )
    event = db.relationship("Event", backref=db.backref("athlete_events", lazy=True))


class Competition(db.Model):
    """Main competition entity - defines the overall event"""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    sport_type = db.Column(db.Enum(SportType), nullable=False)
    date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

    # Competition configuration (stored as JSON)
    config = db.Column(db.JSON)  # Scoring rules, timer settings, etc.

    # Relationships
    events = db.relationship(
        "Event", backref="competition", lazy=True, cascade="all, delete-orphan"
    )
    athletes = db.relationship(
        "Athlete", backref="competition", lazy=True, cascade="all, delete-orphan"
    )
    referees = db.relationship(
        "Referee", backref="competition", lazy=True, cascade="all, delete-orphan"
    )


class Event(db.Model):
    """Specific events within a competition (e.g., Men's 73kg, Women's 63kg)"""

    id = db.Column(db.Integer, primary_key=True)
    competition_id = db.Column(
        db.Integer, db.ForeignKey("competition.id"), nullable=False
    )
    name = db.Column(db.String(150), nullable=False)
    weight_category = db.Column(db.String(50))
    gender = db.Column(db.String(10))
    scoring_type = db.Column(db.Enum(ScoringType), nullable=False)
    is_active = db.Column(db.Boolean, default=False)
    current_lift_id = db.Column(db.Integer, db.ForeignKey("lift.id"))

    # Relationships
    lifts = db.relationship(
        "Lift",
        backref="event",
        lazy=True,
        cascade="all, delete-orphan",
        foreign_keys="[Lift.event_id]",
    )
    flights = db.relationship(
        "Flight", backref="event", lazy=True, cascade="all, delete-orphan"
    )
    current_lift = db.relationship(
        "Lift", foreign_keys=[current_lift_id], post_update=True
    )


class Lift(db.Model):
    """Types of lifts in an event (e.g., Snatch, Clean & Jerk for OLY)"""

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    name = db.Column(
        db.String(100), nullable=False
    )  # "Snatch", "Clean & Jerk", "Squat", etc.
    order = db.Column(db.Integer, nullable=False)  # Order within event
    max_attempts = db.Column(db.Integer, default=3)

    # Timer configuration
    attempt_time_seconds = db.Column(db.Integer, default=60)
    break_time_seconds = db.Column(db.Integer, default=120)

    # Relationships
    attempts = db.relationship(
        "Attempt", backref="lift", lazy=True, foreign_keys="[Attempt.lift_id]"
    )


class Flight(db.Model):
    """Groups of athletes competing together"""

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    name = db.Column(db.String(50), nullable=False)  # "Flight A", "Flight B"
    order = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=False)

    # Relationships
    athlete_flights = db.relationship("AthleteFlight", backref="flight", lazy=True)


class Athlete(db.Model):
    """Competition participants"""

    id = db.Column(db.Integer, primary_key=True)
    competition_id = db.Column(
        db.Integer, db.ForeignKey("competition.id"), nullable=False
    )
    name = db.Column(db.String(150), nullable=False)
    gender = db.Column(db.String(10))
    bodyweight = db.Column(db.Float)
    age = db.Column(db.Integer)
    team = db.Column(db.String(100))

    # Contact info for notifications
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))

    # Competition status
    is_active = db.Column(db.Boolean, default=True)
    current_attempt_number = db.Column(db.Integer, default=1)

    # Relationships
    flights = db.relationship("AthleteFlight", backref="athlete", lazy=True)
    attempts = db.relationship("Attempt", backref="athlete", lazy=True)


class AthleteFlight(db.Model):
    """Many-to-many relationship between athletes and flights"""

    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    flight_id = db.Column(db.Integer, db.ForeignKey("flight.id"), nullable=False)
    lot_number = db.Column(db.Integer)  # Order within flight


class Referee(db.Model):
    """Competition judges/referees"""

    id = db.Column(db.Integer, primary_key=True)
    competition_id = db.Column(
        db.Integer, db.ForeignKey("competition.id"), nullable=False
    )
    name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(50))  # "Head Referee", "Side Referee", etc.
    is_active = db.Column(db.Boolean, default=True)


class Attempt(db.Model):
    """Individual lift attempts by athletes"""

    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    lift_id = db.Column(db.Integer, db.ForeignKey("lift.id"), nullable=False)
    attempt_number = db.Column(db.Integer, nullable=False)  # 1, 2, 3

    # Attempt details
    requested_weight = db.Column(db.Float, nullable=False)
    actual_weight = db.Column(db.Float)
    result = db.Column(db.Enum(AttemptResult))

    # Timing
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)

    # Referee decisions (for sports requiring multiple judges)
    referee_decisions = db.Column(
        db.JSON
    )  # {"referee_1": "good_lift", "referee_2": "no_lift", ...}

    # Order tracking
    lifting_order = db.Column(db.Integer)  # Current position in lifting order


class Score(db.Model):
    """Calculated scores for athletes in events"""

    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    lift_id = db.Column(
        db.Integer, db.ForeignKey("lift.id")
    )  # Null for overall event score

    value = db.Column(db.Float, nullable=False)
    rank = db.Column(db.Integer)
    is_final = db.Column(db.Boolean, default=False)

    calculated_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    athlete = db.relationship("Athlete", backref="scores", foreign_keys=[athlete_id])
    event = db.relationship("Event", backref="scores", foreign_keys=[event_id])
    lift = db.relationship("Lift", foreign_keys=[lift_id])


class Timer(db.Model):
    """Timer state management"""

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    lift_id = db.Column(db.Integer, db.ForeignKey("lift.id"))

    # Timer state
    duration_seconds = db.Column(db.Integer, nullable=False)
    remaining_seconds = db.Column(db.Integer, nullable=False)
    is_running = db.Column(db.Boolean, default=False)
    is_break = db.Column(db.Boolean, default=False)

    # Timing
    started_at = db.Column(db.DateTime)
    paused_at = db.Column(db.DateTime)

    # Current attempt context
    current_attempt_id = db.Column(db.Integer, db.ForeignKey("attempt.id"))

    # Relationships
    event = db.relationship("Event", foreign_keys=[event_id])
    lift = db.relationship("Lift", foreign_keys=[lift_id])
    current_attempt = db.relationship("Attempt", foreign_keys=[current_attempt_id])


# Legacy models (keeping for backward compatibility during transition)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    muscle_group = db.Column(db.String(80))
