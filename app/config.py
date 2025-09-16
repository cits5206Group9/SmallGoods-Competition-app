import os
import logging
from pathlib import Path

class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "SQLALCHEMY_DATABASE_URI", "sqlite:///app.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    @classmethod
    def get_db_path(cls, instance_path: str) -> str | None:
        """Get the database file path for SQLite databases."""
        db_uri = cls.SQLALCHEMY_DATABASE_URI
        if db_uri.startswith('sqlite:///'):
            # Remove the sqlite:/// prefix to get the relative path
            relative_path = db_uri[10:]  # Remove 'sqlite:///'

            # If it's just a filename (no path separators), put it in instance folder
            if '/' not in relative_path:
                return os.path.join(instance_path, relative_path)
            else:
                # If it has path separators, treat as absolute or relative to project root
                if relative_path.startswith('/'):
                    return relative_path  # Absolute path
                else:
                    # Relative path from project root
                    return os.path.abspath(relative_path)
        return None

    @classmethod
    def needs_db_creation(cls, instance_path: str) -> bool:
        """Check if database needs to be created."""
        db_path = cls.get_db_path(instance_path)
        if db_path:
            return not os.path.exists(db_path)
        return True  # For non-SQLite databases, assume we need to check tables

    @classmethod
    def is_sqlite(cls) -> bool:
        """Check if the configured database is SQLite."""
        return cls.SQLALCHEMY_DATABASE_URI.startswith('sqlite:')

class DevConfig(BaseConfig):
    DEBUG = True

class TestConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///test.db"

class ProdConfig(BaseConfig):
    DEBUG = False

def get_config(name: str | None):
    name = (name or os.environ.get("FLASK_ENV") or "development").lower()
    return {
        "development": DevConfig,
        "testing": TestConfig,
        "production": ProdConfig,
    }.get(name, DevConfig)
