import os

class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "SQLALCHEMY_DATABASE_URI", f"sqlite:///instance/app.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevConfig(BaseConfig):
    DEBUG = True

class TestConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"

class ProdConfig(BaseConfig):
    DEBUG = False

def get_config(name: str | None):
    name = (name or os.environ.get("FLASK_ENV") or "development").lower()
    return {
        "development": DevConfig,
        "testing": TestConfig,
        "production": ProdConfig,
    }.get(name, DevConfig)
