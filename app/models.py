from datetime import datetime
from .extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Exercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    muscle_group = db.Column(db.String(80))

class Workout(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    date = db.Column(db.Date, default=datetime.utcnow)
    notes = db.Column(db.Text)

    user = db.relationship("User", backref=db.backref("workouts", lazy=True))

class WorkoutExercise(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    workout_id = db.Column(db.Integer, db.ForeignKey("workout.id"), nullable=False)
    exercise_id = db.Column(db.Integer, db.ForeignKey("exercise.id"), nullable=False)
    sets = db.Column(db.Integer, default=3)
    reps = db.Column(db.Integer, default=10)
    weight = db.Column(db.Float, default=0.0)

    workout = db.relationship("Workout", backref=db.backref("items", lazy=True))
    exercise = db.relationship("Exercise")
