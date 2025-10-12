import pytest
import os
import tempfile
from app import create_app
from app.extensions import db


@pytest.fixture()
def app():
    """Create and configure a new app instance for each test."""
    # Create a temporary file for the test database
    db_fd, db_path = tempfile.mkstemp()

    app = create_app("testing")
    app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
            "WTF_CSRF_ENABLED": False,  # Disable CSRF for testing
        }
    )

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

    # Clean up the temporary database file
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture()
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture()
def runner(app):
    """A test runner for the app's Click commands."""
    return app.test_cli_runner()


@pytest.fixture()
def auth(client):
    """Authentication helper for tests."""

    class AuthActions:
        def __init__(self, client):
            self._client = client

        def login(self, email="test@example.com", password="test"):
            return self._client.post(
                "/auth/login", data={"email": email, "password": password}
            )

        def logout(self):
            return self._client.get("/auth/logout")

    return AuthActions(client)
