import pytest
import os
import tempfile
import gc
from app import create_app
from app.extensions import db


def pytest_configure(config):
    """Configure pytest with custom settings."""
    # Suppress resource warnings from coverage tool
    import warnings

    warnings.filterwarnings("ignore", category=ResourceWarning)


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
            "SQLALCHEMY_ENGINE_OPTIONS": {
                "pool_pre_ping": True,
                "pool_recycle": 300,
                "poolclass": None,  # Disable connection pooling for tests
            },
        }
    )

    with app.app_context():
        db.create_all()
        yield app

        # Properly close all database connections
        db.session.close()
        db.session.remove()
        db.drop_all()
        db.engine.dispose()

    # Clean up the temporary database file
    os.close(db_fd)
    os.unlink(db_path)

    # Force garbage collection to clean up any remaining references
    gc.collect()


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
