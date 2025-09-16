from datetime import datetime
from enum import Enum
from .extensions import db


# User and Role System
class UserRole(Enum):
    ADMIN = 1
    REFEREE = 2
    TIMEKEEPER = 3
    ATHLETE = 4
    COACH = 5

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
    end_date = db.Column(db.Date, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    days = db.relationship("CompetitionDay", backref="competition", lazy=True, cascade="all, delete-orphan")

class CompetitionDay(db.Model):
    """Each day of the competition (day1, day2, etc.)"""
    id = db.Column(db.Integer, primary_key=True)
    competition_id = db.Column(db.Integer, db.ForeignKey("competition.id"), nullable=False)
    day_number = db.Column(db.Integer, nullable=False)  # 1, 2, 3, etc.
    date = db.Column(db.Date, nullable=False)
    is_active = db.Column(db.Boolean, default=False)

    # Relationships
    sport_categories = db.relationship("SportCategory", backref="competition_day", lazy=True, cascade="all, delete-orphan")

class SportCategory(db.Model):
    """Olympic or PowerLifting"""
    id = db.Column(db.Integer, primary_key=True)
    competition_day_id = db.Column(db.Integer, db.ForeignKey("competition_day.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # "Olympic", "PowerLifting"
    is_active = db.Column(db.Boolean, default=False)

    # Relationships
    exercises = db.relationship("Exercise", backref="sport_category", lazy=True, cascade="all, delete-orphan")

class Exercise(db.Model):
    """Specific exercises (snatch, clean & jerk, squat, bench, deadlift)"""
    id = db.Column(db.Integer, primary_key=True)
    sport_category_id = db.Column(db.Integer, db.ForeignKey("sport_category.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # "snatch", "clean & jerk", "squat", "bench", "deadlift"
    order = db.Column(db.Integer, nullable=False)  # Order within sport category

    # Timer configuration
    attempt_time_limit = db.Column(db.Integer, default=60)  # seconds
    break_time_default = db.Column(db.Integer, default=120)  # seconds

    # Relationships
    competition_types = db.relationship("CompetitionType", backref="exercise", lazy=True, cascade="all, delete-orphan")

class CompetitionType(db.Model):
    """Oly/PowerLift vs SuperTotal"""
    id = db.Column(db.Integer, primary_key=True)
    exercise_id = db.Column(db.Integer, db.ForeignKey("exercise.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)  # "Oly", "PowerLift", "SuperTotal"
    is_active = db.Column(db.Boolean, default=False)

    # Relationships
    athlete_entries = db.relationship("AthleteEntry", backref="competition_type", lazy=True, cascade="all, delete-orphan")

class AthleteEntry(db.Model):
    """Athletes entered in specific competition types"""
    id = db.Column(db.Integer, primary_key=True)
    competition_type_id = db.Column(db.Integer, db.ForeignKey("competition_type.id"), nullable=False)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    entry_order = db.Column(db.Integer)  # Order within competition type
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    attempts = db.relationship("Attempt", backref="athlete_entry", lazy=True, cascade="all, delete-orphan")

class Athlete(db.Model):
    """Competition participants"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)  # May not have user account
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))

    # Competition details
    team = db.Column(db.String(100))
    gender = db.Column(db.String(10))

    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    entries = db.relationship("AthleteEntry", backref="athlete", lazy=True)

# Attempt and Referee System
class AttemptResult(Enum):
    GOOD = "good"
    BAD = "bad"
    DISQUALIFIED = "disqualified"
    NOT_ATTEMPTED = "not_attempted"

class Attempt(db.Model):
    """Individual lift attempts"""
    id = db.Column(db.Integer, primary_key=True)
    athlete_entry_id = db.Column(db.Integer, db.ForeignKey("athlete_entry.id"), nullable=False)
    attempt_number = db.Column(db.Integer, nullable=False)  # 1, 2, 3

    # Weight and result
    requested_weight = db.Column(db.Float, nullable=False)
    actual_weight = db.Column(db.Float)
    final_result = db.Column(db.Enum(AttemptResult), default=AttemptResult.NOT_ATTEMPTED)

    # Timing
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    duration_seconds = db.Column(db.Integer)

    # Order in competition
    lifting_order = db.Column(db.Integer)

    # Relationships
    referee_decisions = db.relationship("RefereeDecision", backref="attempt", lazy=True, cascade="all, delete-orphan")

class RefereeAssignment(db.Model):
    """Assigns referees to specific competition types"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    competition_type_id = db.Column(db.Integer, db.ForeignKey("competition_type.id"), nullable=False)
    referee_position = db.Column(db.String(20))  # "head", "side_1", "side_2"
    is_active = db.Column(db.Boolean, default=True)

class RefereeDecision(db.Model):
    """Individual referee decisions on attempts"""
    id = db.Column(db.Integer, primary_key=True)
    attempt_id = db.Column(db.Integer, db.ForeignKey("attempt.id"), nullable=False)
    referee_assignment_id = db.Column(db.Integer, db.ForeignKey("referee_assignment.id"), nullable=False)
    decision = db.Column(db.Enum(AttemptResult), nullable=False)
    decision_time = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)

    # Relationships
    referee_assignment = db.relationship("RefereeAssignment", backref="decisions")

# Timer and Scoring System
class Timer(db.Model):
    """Timer for attempts and breaks"""
    id = db.Column(db.Integer, primary_key=True)
    competition_type_id = db.Column(db.Integer, db.ForeignKey("competition_type.id"), nullable=False)

    # Timer state
    timer_type = db.Column(db.String(20), nullable=False)  # "attempt", "break"
    duration_seconds = db.Column(db.Integer, nullable=False)
    remaining_seconds = db.Column(db.Integer, nullable=False)
    is_running = db.Column(db.Boolean, default=False)
    is_paused = db.Column(db.Boolean, default=False)

    # Timing
    started_at = db.Column(db.DateTime)
    paused_at = db.Column(db.DateTime)

    # Current context
    current_attempt_id = db.Column(db.Integer, db.ForeignKey("attempt.id"), nullable=True)
    current_athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=True)

    # Relationships
    competition_type = db.relationship("CompetitionType", backref="timers")
    current_attempt = db.relationship("Attempt", foreign_keys=[current_attempt_id])
    current_athlete = db.relationship("Athlete", foreign_keys=[current_athlete_id])

class Score(db.Model):
    """Calculated scores and rankings"""
    id = db.Column(db.Integer, primary_key=True)
    athlete_entry_id = db.Column(db.Integer, db.ForeignKey("athlete_entry.id"), nullable=False)

    # Score details
    best_attempt_weight = db.Column(db.Float)
    total_score = db.Column(db.Float)
    rank = db.Column(db.Integer)

    # Score type (individual exercise or total)
    score_type = db.Column(db.String(50))  # "exercise", "total"

    # Calculation metadata
    calculated_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_final = db.Column(db.Boolean, default=False)

    # Relationships
    athlete_entry = db.relationship("AthleteEntry", backref="scores")

# Legacy models for backward compatibility
class Workout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)
    notes = db.Column(db.Text)

    user = db.relationship("User", backref=db.backref("workouts", lazy=True))

class WorkoutExercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    workout_id = db.Column(db.Integer, db.ForeignKey("workout.id"), nullable=False)
    sets = db.Column(db.Integer, default=3)
    reps = db.Column(db.Integer, default=10)
    weight = db.Column(db.Float, default=0.0)

    workout = db.relationship("Workout", backref=db.backref("items", lazy=True))

class CoachAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    coach_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    athlete_id = db.Column(db.Integer, db.ForeignKey("athlete.id"), nullable=False)
    is_primary = db.Column(db.Boolean, default=False)
    can_respond = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)

    coach = db.relationship("User", backref=db.backref("coach_assignments", lazy=True), foreign_keys=[coach_user_id])
    athlete = db.relationship("Athlete", backref=db.backref("coach_assignments", lazy=True))