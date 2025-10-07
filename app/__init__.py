import logging
import os
import sys
from pathlib import Path
from flask import Flask
from .config import get_config
from .extensions import db, migrate, socketio
from app.routes.admin import admin_bp
from app.routes.login import login_bp
from app.routes.display import display_bp
from app.routes.coach import coach_bp
from app.routes.athlete import athlete_bp
from . import models  # Import models so they are registered with SQLAlchemy
from app.real_time.event_handlers import register_all_handlers

class ColoredFormatter(logging.Formatter):
    """Custom formatter with colors for different log levels."""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        # Get the original formatted message
        formatted = super().format(record)
        
        # Add color if outputting to terminal
        if sys.stderr.isatty():
            color = self.COLORS.get(record.levelname, '')
            return f"{color}{formatted}{self.RESET}"
        return formatted


def setup_logging(log_level: str = None) -> None:
    """Setup colored logging with detailed format."""
    # Get log level from environment variable or parameter
    level_name = (
        log_level or 
        os.environ.get('FLASK_LOG_LEVEL', 'INFO')
    ).upper()
    
    # Convert string to logging level
    level = getattr(logging, level_name, logging.WARNING)
    
    # Create formatter with detailed information
    formatter = ColoredFormatter(
        fmt='%(asctime)s - %(name)s:%(lineno)d - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Setup root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Remove existing handlers to avoid duplicates
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    
    # Add handler to root logger
    root_logger.addHandler(console_handler)
    
    logging.info(f"Logging configured at {level_name} level")


logger = logging.getLogger(__name__)

def create_app(config_name: str | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    config = get_config(config_name)
    app.config.from_object(config)

    # Custom logging setup logic:
    # - Only setup custom logging if FLASK_LOG_LEVEL environment variable is set
    # - If no FLASK_LOG_LEVEL, run in production mode with Flask's default minimal logging
    flask_log_level = os.environ.get('FLASK_LOG_LEVEL')
    
    if flask_log_level:
        setup_logging(flask_log_level)
        print(f"🔧 Custom logging enabled with level: {flask_log_level}")
    else:
        print(f"Production mode - using Flask's default logging")
    
    logger.info(f"Starting Flask app with config: {config.__name__}")

    # Init extensions
    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')
    logger.debug("Database and WebSocket extensions initialized")
    
    # Configure logging to suppress noisy timer endpoint
    class TimerEndpointFilter:
        def filter(self, record):
            # Suppress logs for timer endpoint to reduce noise
            if hasattr(record, 'getMessage'):
                message = record.getMessage()
                # Suppress athlete timer endpoint
                if '/athlete/next-attempt-timer' in message and '200' in message:
                    return False
                # Suppress admin timer-state endpoint
                if '/admin/api/timer-state' in message and '200' in message:
                    return False
                # Suppress display rankings endpoint
                if '/display/api/competition/' in message and '/rankings' in message and '200' in message:
                    return False
                # Suppress display state endpoint
                if '/display/api/competition/' in message and '/state' in message and '200' in message:
                    return False
                # Suppress Socket.IO polling endpoints
                if '/socket.io/' in message and 'EIO=4&transport=polling' in message and '200' in message:
                    return False
            return True
    
    # Apply filter to werkzeug logger (handles Flask request logs)
    werkzeug_logger = logging.getLogger('werkzeug')
    werkzeug_logger.addFilter(TimerEndpointFilter())
    
    # Handle database initialization
    with app.app_context():
        _initialize_database(config, app.instance_path)
        _seed_admin_user()

    # Register blueprints
    app.register_blueprint(admin_bp)
    app.register_blueprint(login_bp)
    app.register_blueprint(display_bp)
    app.register_blueprint(coach_bp)
    app.register_blueprint(athlete_bp)
    
    # Add root route that redirects to login
    @app.route('/')
    def index():
        from flask import redirect, url_for
        return redirect(url_for('login.login'))
    
    # Register WebSocket event handlers
    register_all_handlers()
    logger.info("Flask app created successfully")
    return app

def _initialize_database(config, instance_path: str) -> None:
    """Initialize the database if it doesn't exist."""
    try:
        if config.is_sqlite():
            db_path = config.get_db_path(instance_path)
            logger.info(f"Checking database at: {db_path}")

            if config.needs_db_creation(instance_path):
                logger.info(f"Database not found at {db_path}. Creating new database...")
                # Ensure the directory exists
                db_dir = os.path.dirname(db_path)
                if db_dir:
                    Path(db_dir).mkdir(parents=True, exist_ok=True)
                db.create_all()
                logger.info("Database created successfully!")
            else:
                logger.info(f"Database already exists at {db_path}")
        else:
            # For other databases, check if tables exist
            inspector = db.inspect(db.engine)
            if not inspector.get_table_names():
                logger.info("No tables found. Creating database tables...")
                db.create_all()
                logger.info("Database tables created successfully!")
            else:
                logger.info("Database tables already exist")
    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
        logger.error(f"Database URI: {config.SQLALCHEMY_DATABASE_URI}")
        logger.error(f"Instance path: {instance_path}")
        if config.is_sqlite():
            db_path = config.get_db_path(instance_path)
            logger.error(f"Computed DB path: {db_path}")
        raise

def _seed_admin_user() -> None:
    """Create the default admin user if it doesn't exist."""
    try:
        from .models import User, UserRole
        from werkzeug.security import generate_password_hash
        
        # Check if admin user already exists
        admin_user = User.query.filter_by(email="admin@email.com", role=UserRole.ADMIN).first()
        
        if not admin_user:
            logger.info("Creating default admin user...")
            admin_user = User(
                email="admin@email.com",
                password_hash=generate_password_hash("SG-PASSWORD"),
                first_name="Admin",
                last_name="User",
                role=UserRole.ADMIN,
                is_active=True
            )
            db.session.add(admin_user)
            db.session.commit()
            logger.info("Default admin user created successfully!")
        else:
            logger.info("Admin user already exists")
    except Exception as e:
        logger.error(f"Error creating admin user: {e}")
        db.session.rollback()
        raise
