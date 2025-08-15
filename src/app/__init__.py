from flask import Flask
from .config import get_config
from .extensions import db, migrate
from .routes import main_bp

def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(get_config(config_name))

    # Ensure instance folder for SQLite
    try:
        from pathlib import Path
        Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Register blueprints
    app.register_blueprint(main_bp)

    return app
