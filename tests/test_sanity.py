"""
Basic sanity tests to verify the test setup works
"""
import pytest
from app.models import User, UserRole
from app.extensions import db


@pytest.mark.unit
def test_app_context(app):
    """Test that app context works"""
    assert app is not None
    assert app.config['TESTING'] is True


@pytest.mark.unit
def test_database_connection(app):
    """Test database connection works"""
    with app.app_context():
        result = db.session.execute(db.text("SELECT 1")).scalar()
        assert result == 1


@pytest.mark.unit
def test_simple_user_creation(app):
    """Test basic user creation"""
    with app.app_context():
        user = User(
            email="sanity@test.com",
            password_hash="test_hash",
            first_name="Sanity",
            last_name="Test",
            role=UserRole.ATHLETE
        )
        db.session.add(user)
        db.session.commit()
        
        assert user.id is not None
        assert user.email == "sanity@test.com"


@pytest.mark.integration
def test_client_works(client):
    """Test that test client works"""
    response = client.get('/')
    assert response.status_code == 200


def test_pytest_marks():
    """Test that pytest markers work"""
    # This test verifies that our marker system is working
    assert True
