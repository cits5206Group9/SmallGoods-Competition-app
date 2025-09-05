import os
from pathlib import Path

# Get the absolute path to the project root
BASE_DIR = Path(__file__).parent.parent.parent
INSTANCE_DIR = BASE_DIR / "src" / "instance"

# Ensure instance directory exists
INSTANCE_DIR.mkdir(exist_ok=True)

class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "SQLALCHEMY_DATABASE_URI", 
        f"sqlite:///{str(INSTANCE_DIR / 'smallgoods_competition.db').replace(chr(92), '/')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "SQLALCHEMY_DATABASE_URI", 
        f"sqlite:///{str(INSTANCE_DIR / 'smallgoods_dev.db').replace(chr(92), '/')}"
    )

class TestConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"  # In-memory database for testing

class ProdConfig(BaseConfig):
    DEBUG = False
    # In production, you'd use PostgreSQL or MySQL
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", 
        f"sqlite:///{str(INSTANCE_DIR / 'smallgoods_production.db').replace(chr(92), '/')}"
    )

def get_config(name: str | None):
    name = (name or os.environ.get("FLASK_ENV") or "development").lower()
    return {
        "development": DevConfig,
        "testing": TestConfig,
        "production": ProdConfig,
    }.get(name, DevConfig)
