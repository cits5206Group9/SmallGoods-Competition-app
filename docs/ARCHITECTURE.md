# Architecture Overview

- Flask app factory pattern
- Blueprints for modular routes
- SQLAlchemy ORM models:
  - User
  - Exercise
  - Workout (a session, date, notes)
  - WorkoutExercise (association with sets/reps/weight)
- Service/DAO kept simple for MVP
