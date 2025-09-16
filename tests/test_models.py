"""
Unit tests for database models
"""
import pytest
from datetime import datetime, date
from app.models import (
    User, UserRole, Competition, CompetitionDay, SportCategory, 
    Exercise, CompetitionType, Athlete, AthleteEntry, Attempt, 
    AttemptResult, RefereeAssignment, RefereeDecision, Timer, Score
)
from app.extensions import db


class TestUserModel:
    """Test User model and UserRole enum"""
    
    def test_create_user(self, app):
        """Test creating a user with all required fields"""
        with app.app_context():
            user = User(
                email="test@example.com",
                password_hash="hashed_password",
                first_name="John",
                last_name="Doe",
                role=UserRole.ATHLETE
            )
            db.session.add(user)
            db.session.commit()
            
            assert user.id is not None
            assert user.email == "test@example.com"
            assert user.first_name == "John"
            assert user.last_name == "Doe"
            assert user.role == UserRole.ATHLETE
            assert user.is_active is True
            assert isinstance(user.created_at, datetime)

    def test_user_roles(self, app):
        """Test all user roles are available"""
        assert UserRole.ADMIN.value == 1
        assert UserRole.REFEREE.value == 2
        assert UserRole.TIMEKEEPER.value == 3
        assert UserRole.ATHLETE.value == 4

    def test_user_email_unique(self, app):
        """Test that email must be unique"""
        with app.app_context():
            user1 = User(
                email="test@example.com",
                password_hash="hash1",
                first_name="John",
                last_name="Doe"
            )
            user2 = User(
                email="test@example.com",
                password_hash="hash2",
                first_name="Jane",
                last_name="Smith"
            )
            
            db.session.add(user1)
            db.session.commit()
            
            db.session.add(user2)
            with pytest.raises(Exception):  # Should raise integrity error
                db.session.commit()


class TestCompetitionHierarchy:
    """Test the competition hierarchy models"""
    
    def test_competition_creation(self, app):
        """Test creating a competition"""
        with app.app_context():
            competition = Competition(
                name="National Championships 2025",
                description="Annual national weightlifting championship",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 3)
            )
            db.session.add(competition)
            db.session.commit()
            
            assert competition.id is not None
            assert competition.name == "National Championships 2025"
            assert competition.is_active is True
            assert isinstance(competition.created_at, datetime)

    def test_competition_day_relationship(self, app):
        """Test competition -> competition_day relationship"""
        with app.app_context():
            competition = Competition(
                name="Test Competition",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 2)
            )
            db.session.add(competition)
            db.session.commit()
            
            day1 = CompetitionDay(
                competition_id=competition.id,
                day_number=1,
                date=date(2025, 6, 1)
            )
            day2 = CompetitionDay(
                competition_id=competition.id,
                day_number=2,
                date=date(2025, 6, 2)
            )
            db.session.add_all([day1, day2])
            db.session.commit()
            
            assert len(competition.days) == 2
            assert competition.days[0].day_number == 1
            assert competition.days[1].day_number == 2

    def test_full_hierarchy(self, app):
        """Test complete competition hierarchy creation"""
        with app.app_context():
            # Create competition
            competition = Competition(
                name="Test Competition",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 1)
            )
            db.session.add(competition)
            db.session.commit()
            
            # Create day
            day = CompetitionDay(
                competition_id=competition.id,
                day_number=1,
                date=date(2025, 6, 1)
            )
            db.session.add(day)
            db.session.commit()
            
            # Create sport category
            olympic = SportCategory(
                competition_day_id=day.id,
                name="Olympic"
            )
            db.session.add(olympic)
            db.session.commit()
            
            # Create exercise
            snatch = Exercise(
                sport_category_id=olympic.id,
                name="snatch",
                order=1
            )
            db.session.add(snatch)
            db.session.commit()
            
            # Create competition type
            oly_type = CompetitionType(
                exercise_id=snatch.id,
                name="Oly"
            )
            db.session.add(oly_type)
            db.session.commit()
            
            # Verify relationships
            assert competition.days[0].sport_categories[0].name == "Olympic"
            assert olympic.exercises[0].name == "snatch"
            assert snatch.competition_types[0].name == "Oly"


class TestAthleteAndAttempts:
    """Test athlete and attempt models"""
    
    def test_athlete_creation(self, app):
        """Test creating an athlete"""
        with app.app_context():
            athlete = Athlete(
                first_name="John",
                last_name="Lifter",
                email="john@example.com",
                weight_category="73kg",
                bodyweight=72.5,
                age=25,
                gender="M"
            )
            db.session.add(athlete)
            db.session.commit()
            
            assert athlete.id is not None
            assert athlete.first_name == "John"
            assert athlete.last_name == "Lifter"
            assert athlete.bodyweight == 72.5

    def test_attempt_result_enum(self, app):
        """Test attempt result enum values"""
        assert AttemptResult.GOOD.value == "good"
        assert AttemptResult.BAD.value == "bad"
        assert AttemptResult.DISQUALIFIED.value == "disqualified"
        assert AttemptResult.NOT_ATTEMPTED.value == "not_attempted"

    def test_attempt_creation(self, app):
        """Test creating an attempt"""
        with app.app_context():
            # Create necessary hierarchy
            competition = Competition(
                name="Test", start_date=date(2025, 6, 1), end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(competition=competition, day_number=1, date=date(2025, 6, 1))
            category = SportCategory(competition_day=day, name="Olympic")
            exercise = Exercise(sport_category=category, name="snatch", order=1)
            comp_type = CompetitionType(exercise=exercise, name="Oly")
            
            athlete = Athlete(first_name="John", last_name="Doe")
            entry = AthleteEntry(competition_type=comp_type, athlete=athlete)
            
            db.session.add_all([competition, day, category, exercise, comp_type, athlete, entry])
            db.session.commit()
            
            # Create attempt
            attempt = Attempt(
                athlete_entry_id=entry.id,
                attempt_number=1,
                requested_weight=100.0,
                actual_weight=100.0,
                final_result=AttemptResult.GOOD
            )
            db.session.add(attempt)
            db.session.commit()
            
            assert attempt.id is not None
            assert attempt.attempt_number == 1
            assert attempt.requested_weight == 100.0
            assert attempt.final_result == AttemptResult.GOOD


class TestTimerModel:
    """Test timer functionality"""
    
    def test_timer_creation(self, app):
        """Test creating a timer"""
        with app.app_context():
            # Create minimal hierarchy
            competition = Competition(
                name="Test", start_date=date(2025, 6, 1), end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(competition=competition, day_number=1, date=date(2025, 6, 1))
            category = SportCategory(competition_day=day, name="Olympic")
            exercise = Exercise(sport_category=category, name="snatch", order=1)
            comp_type = CompetitionType(exercise=exercise, name="Oly")
            
            db.session.add_all([competition, day, category, exercise, comp_type])
            db.session.commit()
            
            # Create timer
            timer = Timer(
                competition_type_id=comp_type.id,
                timer_type="attempt",
                duration_seconds=60,
                remaining_seconds=60
            )
            db.session.add(timer)
            db.session.commit()
            
            assert timer.id is not None
            assert timer.timer_type == "attempt"
            assert timer.duration_seconds == 60
            assert timer.is_running is False


class TestRefereeSystem:
    """Test referee and decision models"""
    
    def test_referee_assignment(self, app):
        """Test creating referee assignments"""
        with app.app_context():
            # Create user and competition structure
            user = User(
                email="ref@example.com",
                password_hash="hash",
                first_name="Referee",
                last_name="One",
                role=UserRole.REFEREE
            )
            
            competition = Competition(
                name="Test", start_date=date(2025, 6, 1), end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(competition=competition, day_number=1, date=date(2025, 6, 1))
            category = SportCategory(competition_day=day, name="Olympic")
            exercise = Exercise(sport_category=category, name="snatch", order=1)
            comp_type = CompetitionType(exercise=exercise, name="Oly")
            
            db.session.add_all([user, competition, day, category, exercise, comp_type])
            db.session.commit()
            
            # Create referee assignment
            assignment = RefereeAssignment(
                user_id=user.id,
                competition_type_id=comp_type.id,
                referee_position="head"
            )
            db.session.add(assignment)
            db.session.commit()
            
            assert assignment.id is not None
            assert assignment.referee_position == "head"
            assert assignment.user.role == UserRole.REFEREE


class TestScoreModel:
    """Test scoring system"""
    
    def test_score_creation(self, app):
        """Test creating scores"""
        with app.app_context():
            # Create minimal structure
            competition = Competition(
                name="Test", start_date=date(2025, 6, 1), end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(competition=competition, day_number=1, date=date(2025, 6, 1))
            category = SportCategory(competition_day=day, name="Olympic")
            exercise = Exercise(sport_category=category, name="snatch", order=1)
            comp_type = CompetitionType(exercise=exercise, name="Oly")
            
            athlete = Athlete(first_name="John", last_name="Doe")
            entry = AthleteEntry(competition_type=comp_type, athlete=athlete)
            
            db.session.add_all([competition, day, category, exercise, comp_type, athlete, entry])
            db.session.commit()
            
            # Create score
            score = Score(
                athlete_entry_id=entry.id,
                best_attempt_weight=120.0,
                total_score=250.0,
                rank=1,
                score_type="total"
            )
            db.session.add(score)
            db.session.commit()
            
            assert score.id is not None
            assert score.best_attempt_weight == 120.0
            assert score.rank == 1
            assert score.is_final is False
