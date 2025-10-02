from datetime import datetime
from enum import Enum
from .extensions import db

# Enums
class UserRole(Enum):
    ADMIN = 1
    REFEREE = 2
    TIMEKEEPER = 3
    ATHLETE = 4
    COACH = 5

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

# User Models
class User(db.Model):
    """User accounts with different roles"""
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.ATHLETE)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    referee_assignments = db.relationship("RefereeAssignment", backref="user", lazy=True)

# Competition Structure
class Competition(db.Model):
    """Main competition entity"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_date = db.Column(db.Date, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    config = db.Column(db.JSON)

    # Relationships
    events = db.relationship("Event", backref="competition", lazy=True, cascade="all, delete-orphan")
    athletes = db.relationship("Athlete", backref="competition", lazy=True, cascade="all, delete-orphan")

class Event(db.Model):
    """Specific events within a competition"""
    id = db.Column(db.Integer, primary_key=True)
    competition_id = db.Column(db.Integer, db.ForeignKey("competition.id"), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    weight_category = db.Column(db.String(50))
    gender = db.Column(db.String(10))
    sport_type = db.Column(db.Enum(SportType), nullable=False)
    scoring_type = db.Column(db.Enum(ScoringType), nullable=False, default=ScoringType.MAX)
    is_active = db.Column(db.Boolean, default=False)

    # Relationships
    flights = db.relationship("Flight", backref="event", lazy=True, cascade="all, delete-orphan")

class Flight(db.Model):
    """Groups of athletes competing together"""
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=True)
    competition_id = db.Column(db.Integer, db.ForeignKey("competition.id"), nullable=True)
    name = db.Column(db.String(50), nullable=False)
    order = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=False)
    
    # Relationships
    athlete_flights = db.relationship("AthleteFlight", backref="flight", lazy=True)
    competition = db.relationship("Competition", backref="flights", lazy=True)

class Athlete(db.Model):
    """Competition participants"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    competition_id = db.Column(db.Integer, db.ForeignKey("competition.id"), nullable=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    gender = db.Column(db.String(10))
    bodyweight = db.Column(db.Float)
    age = db.Column(db.Integer)
    team = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))
    is_active = db.Column(db.Boolean, default=True)
    current_attempt_number = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Relationships
    flights = db.relationship("AthleteFlight", backref="athlete", lazy=True)
    entries = db.relationship("AthleteEntry", backref="athlete", lazy=True)
    
    @property
    def attempts(self):
        """Get all attempts for this athlete across all entries"""
        all_attempts = []
        for entry in self.entries:
            all_attempts.extend(entry.attempts)
        return all_attempts

class AthleteEntry(db.Model):
    """Athletes entered in specific competition types"""
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("event.id"), nullable=False)
    flight_id = db.Column(db.Integer, db.ForeignKey("flight.id"), nullable=False)
    entry_order = db.Column(db.Integer, db.ForeignKey("athlete_flight.order"), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    lift_type = db.Column(db.String(50), nullable=False) # e.g., "snatch", "clean_jerk"
    attempt_time_limit = db.Column(db.Integer, default=60)  # seconds
    break_time = db.Column(db.Integer, default=120)  # seconds
    default_reps = db.Column(db.JSON)
    reps = db.Column(db.JSON)

    opening_weights = db.Column(db.Integer)
    entry_config = db.Column(db.JSON, default=dict)

    # Relationships
    attempts = db.relationship("Attempt", backref="athlete_entry", lazy=True, cascade="all, delete-orphan")
    event = db.relationship("Event", backref="athlete_entries")
    
    # Prevent duplicate (athlete, event, lift_type)
    __table_args__ = (
        db.UniqueConstraint("athlete_id", "event_id", "lift_type", name="uq_athlete_event_lift"),
    )

    @property
    def movement_name(self):
        """Human-readable movement name; we persist this into lift_type, so return it."""
        return self.lift_type or "Unknown"

class AthleteFlight(db.Model):
    """Many-to-many relationship between athletes and flights"""
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    flight_id = db.Column(db.Integer, db.ForeignKey("flight.id"), nullable=False)
    lot_number = db.Column(db.Integer)
    order = db.Column(db.Integer, default=0)  # Order within the flight for attempts

# Attempt and Referee System
class Attempt(db.Model):
    """Individual lift attempts"""
    id = db.Column(db.Integer, primary_key=True)
    athlete_id = db.Column(
        db.Integer, 
        db.ForeignKey("athlete.id", name="fk_attempt_athlete_id"), 
        nullable=False
    )
    athlete_entry_id = db.Column(
        db.Integer, 
        db.ForeignKey("athlete_entry.id", name="fk_attempt_athlete_entry_id"), 
        nullable=False
    )
    attempt_number = db.Column(db.Integer, nullable=False)
    requested_weight = db.Column(db.Float, nullable=False)
    actual_weight = db.Column(db.Float)
    final_result = db.Column(db.Enum(AttemptResult), default=None)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    lifting_order = db.Column(db.Integer)

    # Relationships
    athlete = db.relationship("Athlete", backref="attempts")
    referee_decisions = db.relationship("RefereeDecision", backref="attempt", lazy=True, cascade="all, delete-orphan")
    
class RefereeAssignment(db.Model):
    """Referee assignments"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    referee_position = db.Column(db.String(20))
    is_active = db.Column(db.Boolean, default=True)

class RefereeDecision(db.Model):
    """Individual referee decisions"""
    id = db.Column(db.Integer, primary_key=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey("attempt.id"), nullable=False)
    referee_assignment_id = db.Column(db.Integer, db.ForeignKey("referee_assignment.id"), nullable=False)
    decision = db.Column(db.Enum(AttemptResult), nullable=False)
    decision_time = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)

    # Relationships
    referee_assignment = db.relationship("RefereeAssignment", backref="decisions")

# Timer and Scoring
class Timer(db.Model):
    """Timer management"""
    id = db.Column(db.Integer, primary_key=True)
    timer_type = db.Column(db.String(20), nullable=False)
    duration_seconds = db.Column(db.Integer, nullable=False)
    remaining_seconds = db.Column(db.Integer, nullable=False)
    is_running = db.Column(db.Boolean, default=False)
    is_paused = db.Column(db.Boolean, default=False)
    started_at = db.Column(db.DateTime)
    paused_at = db.Column(db.DateTime)
    current_attempt_id = db.Column(db.Integer, db.ForeignKey("attempt.id"))
    current_athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"))

    # Relationships
    current_attempt = db.relationship("Attempt", foreign_keys=[current_attempt_id])
    current_athlete = db.relationship("Athlete", foreign_keys=[current_athlete_id])

class Score(db.Model):
    """Score tracking"""
    id = db.Column(db.Integer, primary_key=True)
    athlete_entry_id = db.Column(db.Integer, db.ForeignKey("athlete_entry.id"), nullable=False)
    best_attempt_weight = db.Column(db.Float)
    total_score = db.Column(db.Float)
    rank = db.Column(db.Integer)
    score_type = db.Column(db.String(50))
    calculated_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_final = db.Column(db.Boolean, default=False)

    # Relationships
    athlete_entry = db.relationship("AthleteEntry", backref="scores")

# Coach Assignment
class CoachAssignment(db.Model):
    """Coach to athlete assignments"""
    id = db.Column(db.Integer, primary_key=True)
    coach_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)
    can_respond = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)

    # Relationships
    coach = db.relationship("User", backref="coach_assignments", foreign_keys=[coach_user_id])

    athlete = db.relationship("Athlete", backref="coach_assignments")

# Referee Management
class Referee(db.Model):
    """Referee accounts and credentials for individual referee pages"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)  # Plain text for admin viewing
    position = db.Column(db.String(50))  # e.g., "Head Referee", "Side Referee"
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    competition_id = db.Column(db.Integer, db.ForeignKey('competition.id'))  # Link to competition
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    notes = db.Column(db.Text)

    # Relationships
    competition = db.relationship('Competition', backref='referees')

    def __repr__(self):
        return f'<Referee {self.name} ({self.username})>'


## Timer Log table - Timekeeper view - ##
class TimerLog(db.Model):
    __tablename__ = "timer_log"
    id = db.Column(db.Integer, primary_key=True)

    competition_id = db.Column(db.Integer, db.ForeignKey("competition.id"), nullable=True)
    event_id       = db.Column(db.Integer, db.ForeignKey("event.id"),       nullable=True)
    flight_id      = db.Column(db.Integer, db.ForeignKey("flight.id"),      nullable=True)

    athlete        = db.Column(db.String(120), nullable=True)  # free text
    action         = db.Column(db.String(32),  nullable=False) # "Attempt", "Break", etc.

    start_ts       = db.Column(db.DateTime(timezone=True), nullable=True)
    stop_ts        = db.Column(db.DateTime(timezone=True),  nullable=True)
    duration_sec   = db.Column(db.Integer, nullable=True)

    created_at     = db.Column(db.DateTime(timezone=True), server_default=db.func.now(), nullable=False)
    meta_json      = db.Column(db.JSON, nullable=True)  # optional: store extras (mode, notes)
