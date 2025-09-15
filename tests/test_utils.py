"""
Test utilities and helper functions
"""
from datetime import date, datetime
from app.models import (
    User, UserRole, Competition, CompetitionDay, SportCategory,
    Exercise, CompetitionType, Athlete, AthleteEntry, Attempt,
    AttemptResult, RefereeAssignment, Timer, Score
)
from app.extensions import db


class TestDataFactory:
    """Factory class for creating test data"""
    
    @staticmethod
    def create_user(email="test@example.com", role=UserRole.ATHLETE, **kwargs):
        """Create a test user"""
        defaults = {
            "email": email,
            "password_hash": "test_hash",
            "first_name": "Test",
            "last_name": "User",
            "role": role
        }
        defaults.update(kwargs)
        return User(**defaults)
    
    @staticmethod
    def create_competition(name="Test Competition", **kwargs):
        """Create a test competition"""
        defaults = {
            "name": name,
            "start_date": date(2025, 6, 1),
            "end_date": date(2025, 6, 1)
        }
        defaults.update(kwargs)
        return Competition(**defaults)
    
    @staticmethod
    def create_full_competition_structure():
        """Create a complete competition structure for testing"""
        competition = TestDataFactory.create_competition()
        
        day = CompetitionDay(
            competition=competition,
            day_number=1,
            date=date(2025, 6, 1)
        )
        
        category = SportCategory(
            competition_day=day,
            name="Olympic"
        )
        
        exercise = Exercise(
            sport_category=category,
            name="snatch",
            order=1
        )
        
        comp_type = CompetitionType(
            exercise=exercise,
            name="Oly"
        )
        
        return {
            'competition': competition,
            'day': day,
            'category': category,
            'exercise': exercise,
            'comp_type': comp_type
        }
    
    @staticmethod
    def create_athlete(first_name="Test", last_name="Athlete", **kwargs):
        """Create a test athlete"""
        defaults = {
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}@example.com"
        }
        defaults.update(kwargs)
        return Athlete(**defaults)
    
    @staticmethod
    def create_attempt(athlete_entry, attempt_number=1, weight=100.0, result=AttemptResult.GOOD):
        """Create a test attempt"""
        return Attempt(
            athlete_entry=athlete_entry,
            attempt_number=attempt_number,
            requested_weight=weight,
            actual_weight=weight,
            final_result=result
        )


class CompetitionTestHelper:
    """Helper class for competition-specific test operations"""
    
    @staticmethod
    def setup_complete_competition(session=None):
        """Set up a complete competition with athletes and attempts"""
        if session is None:
            session = db.session
        
        # Create structure
        structure = TestDataFactory.create_full_competition_structure()
        
        # Create athletes
        athlete1 = TestDataFactory.create_athlete("John", "Lifter")
        athlete2 = TestDataFactory.create_athlete("Jane", "Strong")
        
        entry1 = AthleteEntry(
            competition_type=structure['comp_type'],
            athlete=athlete1,
            entry_order=1
        )
        entry2 = AthleteEntry(
            competition_type=structure['comp_type'],
            athlete=athlete2,
            entry_order=2
        )
        
        # Add all to session
        session.add_all([
            structure['competition'], structure['day'], structure['category'],
            structure['exercise'], structure['comp_type'],
            athlete1, athlete2, entry1, entry2
        ])
        session.commit()
        
        return {
            **structure,
            'athlete1': athlete1,
            'athlete2': athlete2,
            'entry1': entry1,
            'entry2': entry2
        }
    
    @staticmethod
    def create_attempts_for_athlete(athlete_entry, weights=[100, 105, 110], results=None):
        """Create three attempts for an athlete"""
        if results is None:
            results = [AttemptResult.GOOD, AttemptResult.GOOD, AttemptResult.BAD]
        
        attempts = []
        for i, (weight, result) in enumerate(zip(weights, results), 1):
            attempt = TestDataFactory.create_attempt(
                athlete_entry=athlete_entry,
                attempt_number=i,
                weight=weight,
                result=result
            )
            attempts.append(attempt)
        
        return attempts
    
    @staticmethod
    def calculate_best_attempt(attempts):
        """Calculate best successful attempt weight"""
        good_attempts = [a for a in attempts if a.final_result == AttemptResult.GOOD]
        if not good_attempts:
            return 0.0
        return max(a.actual_weight for a in good_attempts)


class AssertionHelpers:
    """Custom assertion helpers for testing"""
    
    @staticmethod
    def assert_competition_structure_valid(competition):
        """Assert that a competition structure is valid"""
        assert competition.id is not None
        assert len(competition.days) > 0
        
        for day in competition.days:
            assert day.competition_id == competition.id
            assert len(day.sport_categories) > 0
            
            for category in day.sport_categories:
                assert category.competition_day_id == day.id
                
                for exercise in category.exercises:
                    assert exercise.sport_category_id == category.id
                    
                    for comp_type in exercise.competition_types:
                        assert comp_type.exercise_id == exercise.id
    
    @staticmethod
    def assert_athlete_attempts_valid(athlete_entry, expected_count=3):
        """Assert that athlete attempts are valid"""
        attempts = athlete_entry.attempts
        assert len(attempts) == expected_count
        
        for i, attempt in enumerate(attempts, 1):
            assert attempt.attempt_number == i
            assert attempt.athlete_entry_id == athlete_entry.id
            assert attempt.requested_weight > 0
    
    @staticmethod
    def assert_timer_state_valid(timer):
        """Assert that timer state is valid"""
        assert timer.duration_seconds > 0
        assert timer.remaining_seconds >= 0
        assert timer.remaining_seconds <= timer.duration_seconds
        
        if timer.is_running:
            assert timer.started_at is not None
        
        if timer.is_paused:
            assert timer.paused_at is not None


class MockHelpers:
    """Helper functions for mocking in tests"""
    
    @staticmethod
    def mock_datetime_now(mock_datetime, fixed_time):
        """Mock datetime.utcnow() to return a fixed time"""
        mock_datetime.utcnow.return_value = fixed_time
        return mock_datetime
    
    @staticmethod
    def create_mock_request_data(data):
        """Create mock request data for testing API endpoints"""
        return {
            'json': data,
            'method': 'POST',
            'headers': {'Content-Type': 'application/json'}
        }


# Test data constants
TEST_COMPETITION_DATA = {
    'name': 'Test Championship 2025',
    'start_date': date(2025, 6, 1),
    'end_date': date(2025, 6, 3),
    'description': 'Annual test championship'
}

TEST_ATHLETE_DATA = {
    'first_name': 'Test',
    'last_name': 'Athlete',
    'email': 'test.athlete@example.com',
    'weight_category': '73kg',
    'bodyweight': 72.5,
    'age': 25,
    'gender': 'M'
}

TEST_EXERCISE_DATA = {
    'snatch': {'name': 'snatch', 'order': 1},
    'clean_jerk': {'name': 'clean & jerk', 'order': 2},
    'squat': {'name': 'squat', 'order': 1},
    'bench': {'name': 'bench', 'order': 2},
    'deadlift': {'name': 'deadlift', 'order': 3}
}
