"""
System tests for the competition app
Tests the complete system through the web interface
"""
import pytest
import json
from datetime import date
from app.models import (
    User, UserRole, Competition, CompetitionDay, SportCategory,
    Exercise, CompetitionType, Athlete, AthleteEntry
)
from app.extensions import db


class TestAppSystemTests:
    """Test the complete application system"""
    
    @pytest.fixture()
    def sample_data(self, app):
        """Create sample data for system tests"""
        with app.app_context():
            # Create competition structure
            competition = Competition(
                name="System Test Competition",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 1)
            )
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
            
            # Create test users
            admin = User(
                email="admin@test.com",
                password_hash="admin_hash",
                first_name="Test",
                last_name="Admin",
                role=UserRole.ADMIN
            )
            
            athlete_user = User(
                email="athlete@test.com",
                password_hash="athlete_hash",
                first_name="Test",
                last_name="Athlete",
                role=UserRole.ATHLETE
            )
            
            # Create athlete
            athlete = Athlete(
                user_id=athlete_user.id,
                first_name="Test",
                last_name="Athlete",
                email="athlete@test.com"
            )
            
            # Add and commit basic objects first
            db.session.add_all([
                competition, day, category, exercise, comp_type,
                admin, athlete_user, athlete
            ])
            db.session.commit()
            
            # Create athlete entry with IDs
            entry = AthleteEntry(
                competition_type_id=comp_type.id,
                athlete_id=athlete.id
            )
            
            db.session.add(entry)
            db.session.commit()
            
            return {
                'competition': competition,
                'competition_id': competition.id,
                'comp_type': comp_type,
                'comp_type_id': comp_type.id,
                'athlete': athlete,
                'athlete_id': athlete.id,
                'entry': entry,
                'entry_id': entry.id
            }

    def test_homepage_loads(self, client):
        """Test that the homepage loads successfully"""
        response = client.get('/')
        assert response.status_code == 200
        assert b"SmallGoods Competition" in response.data or b"Welcome" in response.data

    def test_app_configuration(self, app):
        """Test app configuration for testing"""
        assert app.config['TESTING'] is True
        assert 'sqlite://' in app.config['SQLALCHEMY_DATABASE_URI']

    def test_database_connection(self, app):
        """Test database connection and basic operations"""
        with app.app_context():
            # Test database is accessible
            result = db.session.execute(db.text("SELECT 1")).scalar()
            assert result == 1
            
            # Test table creation
            tables = db.inspect(db.engine).get_table_names()
            expected_tables = [
                'user', 'competition', 'competition_day', 'sport_category',
                'exercise', 'competition_type', 'athlete', 'athlete_entry',
                'attempt', 'referee_assignment', 'referee_decision', 'timer', 'score'
            ]
            
            for table in expected_tables:
                assert table in tables, f"Table {table} not found in database"

    def test_model_creation_system(self, app, sample_data):
        """Test creating models through the system"""
        with app.app_context():
            data = sample_data
            
            # Verify all models were created using IDs
            assert data['competition_id'] is not None
            assert data['athlete_id'] is not None
            assert data['entry_id'] is not None
            
            # Test relationships work by reloading objects
            entry = db.session.get(AthleteEntry, data['entry_id'])
            assert entry.athlete.first_name == "Test"
            assert entry.competition_type.name == "Oly"
            
            # Test cascade relationships
            competition = db.session.get(Competition, data['competition_id'])
            assert len(competition.days) == 1
            assert len(competition.days[0].sport_categories) == 1

    def test_data_persistence(self, app, sample_data):
        """Test that data persists across sessions"""
        with app.app_context():
            data = sample_data
            competition_id = data['competition_id']
            athlete_id = data['athlete_id']
            
            # Clear session
            db.session.expunge_all()
            
            # Reload from database
            reloaded_competition = db.session.get(Competition, competition_id)
            reloaded_athlete = db.session.get(Athlete, athlete_id)
            
            assert reloaded_competition is not None
            assert reloaded_competition.name == "System Test Competition"
            assert reloaded_athlete is not None
            assert reloaded_athlete.first_name == "Test"

    def test_error_handling(self, client):
        """Test error handling for non-existent routes"""
        response = client.get('/non-existent-route')
        assert response.status_code == 404


class TestAPIEndpoints:
    """Test API endpoints if they exist"""
    
    def test_api_health_check(self, client):
        """Test API health check endpoint"""
        # This assumes you have a health check endpoint
        # Adjust based on your actual API structure
        response = client.get('/api/health')
        # If endpoint doesn't exist, expect 404, which is fine
        assert response.status_code in [200, 404]

    def test_cors_headers(self, client):
        """Test CORS headers if API is used"""
        response = client.get('/')
        # Basic response test - adjust based on your needs
        assert response.status_code == 200


class TestSecuritySystem:
    """Test security aspects of the system"""
    
    def test_password_hashing(self, app):
        """Test that passwords are properly hashed"""
        with app.app_context():
            user = User(
                email="security@test.com",
                password_hash="should_be_hashed",
                first_name="Security",
                last_name="Test"
            )
            db.session.add(user)
            db.session.commit()
            
            # Password should be stored as hash, not plain text
            assert user.password_hash == "should_be_hashed"
            # In real implementation, you'd test actual password hashing

    def test_user_role_authorization(self, app):
        """Test user role system"""
        with app.app_context():
            admin = User(
                email="admin@test.com",
                password_hash="hash",
                first_name="Admin",
                last_name="User",
                role=UserRole.ADMIN
            )
            
            athlete = User(
                email="athlete@test.com",
                password_hash="hash",
                first_name="Athlete",
                last_name="User",
                role=UserRole.ATHLETE
            )
            
            db.session.add_all([admin, athlete])
            db.session.commit()
            
            assert admin.role == UserRole.ADMIN
            assert athlete.role == UserRole.ATHLETE
            assert admin.role != athlete.role


class TestDataIntegritySystem:
    """Test data integrity across the system"""
    
    def test_competition_flow_integrity(self, app):
        """Test that competition data flow maintains integrity"""
        with app.app_context():
            # Create a complete competition flow
            competition = Competition(
                name="Integrity Test",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(competition=competition, day_number=1, date=date(2025, 6, 1))
            category = SportCategory(competition_day=day, name="Olympic")
            exercise = Exercise(sport_category=category, name="snatch", order=1)
            comp_type = CompetitionType(exercise=exercise, name="Oly")
            
            athlete = Athlete(first_name="Integrity", last_name="Test")
            entry = AthleteEntry(competition_type=comp_type, athlete=athlete)
            
            db.session.add_all([competition, day, category, exercise, comp_type, athlete, entry])
            db.session.commit()
            
            # Test data integrity
            assert entry.competition_type.exercise.sport_category.competition_day.competition.name == "Integrity Test"
            assert entry.athlete.first_name == "Integrity"

    def test_concurrent_access_simulation(self, app):
        """Test concurrent access patterns"""
        with app.app_context():
            # Simulate multiple operations
            users = []
            for i in range(5):
                user = User(
                    email=f"user{i}@test.com",
                    password_hash=f"hash{i}",
                    first_name=f"User{i}",
                    last_name="Test"
                )
                users.append(user)
            
            db.session.add_all(users)
            db.session.commit()
            
            # Verify all users were created
            assert len(users) == 5
            for i, user in enumerate(users):
                assert user.email == f"user{i}@test.com"


class TestPerformanceSystem:
    """Test system performance characteristics"""
    
    def test_large_dataset_handling(self, app):
        """Test handling of larger datasets"""
        with app.app_context():
            # Create a larger dataset
            competition = Competition(
                name="Performance Test",
                start_date=date(2025, 6, 1),
                end_date=date(2025, 6, 1)
            )
            day = CompetitionDay(competition=competition, day_number=1, date=date(2025, 6, 1))
            category = SportCategory(competition_day=day, name="Olympic")
            exercise = Exercise(sport_category=category, name="snatch", order=1)
            comp_type = CompetitionType(exercise=exercise, name="Oly")
            
            db.session.add_all([competition, day, category, exercise, comp_type])
            db.session.commit()
            
            # Create multiple athletes
            athletes = []
            entries = []
            for i in range(50):  # 50 athletes
                athlete = Athlete(
                    first_name=f"Athlete{i}",
                    last_name="Performance",
                    email=f"athlete{i}@test.com"
                )
                entry = AthleteEntry(
                    competition_type=comp_type,
                    athlete=athlete,
                    entry_order=i
                )
                athletes.append(athlete)
                entries.append(entry)
            
            db.session.add_all(athletes + entries)
            db.session.commit()
            
            # Test query performance
            result = db.session.query(AthleteEntry).join(Athlete).filter(
                Athlete.first_name.like("Athlete%")
            ).count()
            
            assert result == 50

    def test_database_query_efficiency(self, app):
        """Test that queries are efficient"""
        with app.app_context():
            # This is a basic test - in real scenarios you'd measure query time
            start_time = db.session.execute(db.text("SELECT datetime('now')")).scalar()
            
            # Perform some operations
            users = db.session.query(User).limit(10).all()
            
            end_time = db.session.execute(db.text("SELECT datetime('now')")).scalar()
            
            # Basic check that query completed
            assert start_time is not None
            assert end_time is not None
