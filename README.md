# 🏋️‍♂️ SmallGoods Competition App

A comprehensive Flask-based web application for managing weightlifting competitions with real-time scoring, timing, and referee management.

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/flask-2.0+-green.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📖 Documentation

- **[User Guide](USER_GUIDE.md)** - Comprehensive guide for all users (athletes, referees, admins)
- **[Violations User Guide](VIOLATIONS_USER_GUIDE.md)** - Technical violations feature guide
- **[Architecture](docs/ARCHITECTURE.md)** - Technical architecture documentation
- **[Contributing](docs/CONTRIBUTING.md)** - Development guidelines

## ✨ Key Features

- 🏆 **Competition Management** - Create and manage multiple competitions with events and flights
- ⏱️ **Real-time Timer** - Synchronized countdown/countup timer with auto-stop functionality
- ✈️ **Flight Management** - Organize athletes with drag-and-drop attempt ordering
- 👨‍⚖️ **Referee System** - Multi-referee decision recording with light indicators
- 📺 **Live Displays** - Scoreboard, attempt tracking, and audience displays
- 👤 **Athlete Portal** - Personal dashboard for competitors
- 🌐 **Network Support** - Multi-device access on local network
- 📊 **Scoring Systems** - Support for Total, Sinclair, and bodyweight scoring

## 🛠️ Tech Stack

- **Backend:** Flask 2.0+, Flask-SQLAlchemy, Flask-Migrate
- **Database:** SQLite (development), PostgreSQL/MySQL ready
- **Frontend:** Jinja2 templates, Vanilla JavaScript, Sortable.js
- **Real-time:** WebSockets for live updates
- **Testing:** pytest with unit, integration, and system tests
- **CI/CD:** GitHub Actions

---

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Git

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/cits5206Group9/SmallGoods-Competition-app.git
cd SmallGoods-Competition-app

# 2. Create & activate a virtual environment
python3 -m venv .venv

# macOS/Linux
source .venv/bin/activate

# Windows
.venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Initialize database
flask db upgrade

# 5. Run the application
./run.sh          # macOS/Linux
run.bat           # Windows

# Visit http://127.0.0.1:5000
```

### Running with Custom Settings

```bash
# Different logging levels
./run.sh INFO     # Standard logging (default)
./run.sh DEBUG    # Verbose logging (for troubleshooting)
./run.sh WARNING  # Minimal logging

# Custom port
python3 run.py --port 5001

# Network access (for multiple devices)
python3 -c "from run import app; app.run(host='0.0.0.0', port=5001, debug=True)"
```

### Accessing on Local Network

To access from tablets, phones, or other computers:

1. Find your computer's IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet "
   
   # Windows
   ipconfig
   ```

2. Access from other devices:
   ```
   http://YOUR_IP_ADDRESS:5001
   ```

**See [User Guide - Network Access](USER_GUIDE.md#accessing-on-local-network) for detailed setup.**
## 🗄️ Database Management

### Migrations

When modifying database schema in `app/models.py`:

```bash
# Check current database version
flask db current

# Create a new migration
flask db migrate -m "describe your changes"

# Apply migrations
flask db upgrade

# View migration history
flask db history

# Rollback one migration
flask db downgrade
```

### Reset Database (Development Only)

```bash
# WARNING: This deletes all data
rm instance/app.db
flask db upgrade
```

## 🧪 Testing

### Quick Test Commands

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test types
pytest -m unit          # Unit tests only (fast)
pytest -m integration   # Integration tests
pytest -m system        # System/E2E tests

# Run specific test files
pytest tests/test_models.py
pytest tests/test_integration.py
pytest tests/test_system.py

# Stop on first failure
pytest -x

# Generate coverage report
pytest --cov=app --cov-report=html
# View: open htmlcov/index.html
```

### Test Structure

- **Unit Tests** (`tests/test_models.py`) - Test individual components
- **Integration Tests** (`tests/test_integration.py`) - Test component interactions
- **System Tests** (`tests/test_system.py`) - Test complete workflows

**See [Testing Guide](USER_GUIDE.md#testing-guide) for detailed information.**

### Writing Tests

This project uses **pytest** with three types of tests:

#### 🔬 **Unit Tests** (`tests/test_models.py`)
Test individual components in isolation.

```python
def test_user_creation(app):
    """Test creating a user with all required fields"""
    with app.app_context():
        user = User(
            email="test@example.com",
            password_hash="hashed_password",
            first_name="John",
            last_name="Doe",
            role=UserRole.ATHLETE
        )
        db.session.add(user)
        db.session.commit()
        
        assert user.id is not None
        assert user.email == "test@example.com"
```

**Guidelines for Unit Tests:**
- Test single functions/methods
- Mock external dependencies
- Fast execution (< 1 second)
- Use `@pytest.mark.unit` decorator
- Test edge cases and error conditions

#### 🔗 **Integration Tests** (`tests/test_integration.py`)
Test multiple components working together.

```python
def test_complete_attempt_workflow(app, competition_setup):
    """Test complete attempt workflow with referee decisions"""
    with app.app_context():
        # Create attempt
        attempt = Attempt(
            athlete_entry=setup['entry1'],
            attempt_number=1,
            requested_weight=100.0
        )
        
        # Create referee decision
        decision = RefereeDecision(
            attempt=attempt,
            referee_assignment=setup['ref_assignment'],
            decision=AttemptResult.GOOD
        )
        
        # Verify workflow
        assert attempt.final_result == AttemptResult.GOOD
```

**Guidelines for Integration Tests:**
- Test component interactions
- Use real database (test instance)
- Medium execution time (1-10 seconds)
- Use `@pytest.mark.integration` decorator
- Test business logic workflows

#### 🌐 **System Tests** (`tests/test_system.py`)
Test the complete application end-to-end.

```python
def test_homepage_loads(client):
    """Test that the homepage loads successfully"""
    response = client.get('/')
    assert response.status_code == 200
    assert b"SmallGoods Competition" in response.data
```

**Guidelines for System Tests:**
- Test complete user workflows
- Use test client for HTTP requests
- Slower execution (10+ seconds)
- Use `@pytest.mark.system` decorator
- Test from user perspective

#### 📝 **Test Structure Best Practices**

1. **File Organization:**
   ```
   tests/
   ├── conftest.py           # Shared fixtures
   ├── test_utils.py         # Test helpers
   ├── test_models.py        # Unit tests
   ├── test_integration.py   # Integration tests
   └── test_system.py        # System tests
   ```

2. **Use Fixtures for Setup:**
   ```python
   @pytest.fixture()
   def competition_setup(app):
       """Create test competition structure"""
       with app.app_context():
           competition = Competition(name="Test")
           # ... setup code
           yield setup_data
   ```

3. **Use Test Markers:**
   ```python
   @pytest.mark.unit
   def test_model_validation():
       pass
   
   @pytest.mark.integration  
   def test_database_workflow():
       pass
   
   @pytest.mark.system
   def test_api_endpoint():
       pass
   ```

4. **Test Data Factory Pattern:**
   ```python
   from tests.test_utils import TestDataFactory
   
   def test_athlete_creation():
       athlete = TestDataFactory.create_athlete("John", "Doe")
       assert athlete.first_name == "John"
   ```

#### 🛠 **Test Utilities**

Use the provided test utilities for consistent test data:

```python
from tests.test_utils import TestDataFactory, CompetitionTestHelper

# Create test data
user = TestDataFactory.create_user(role=UserRole.ADMIN)
competition = TestDataFactory.create_competition("Test Competition")

# Set up complete competition
setup = CompetitionTestHelper.setup_complete_competition()

# Create attempts for testing
attempts = CompetitionTestHelper.create_attempts_for_athlete(
    athlete_entry, weights=[100, 105, 110]
)
```

#### 🚀 **Running Specific Test Scenarios**

```bash
# Test database models only
pytest tests/test_models.py -v

# Test slow/complex scenarios
pytest -m "not slow" 

# Test specific functionality
pytest -k "attempt" -v

# Debug failing tests
pytest --pdb -x

# Generate HTML coverage report
pytest --cov=app --cov-report=html
# View: open htmlcov/index.html
```

---

## 📋 Usage

### User Roles

The application supports multiple user roles:

| Role | Access | Description |
|------|--------|-------------|
| **Admin** | Full access | Manage competitions, flights, athletes, settings |
| **Timekeeper** | Timer control | Manage attempt timer, track lifting order |
| **Referee** | Referee panel | Record attempt decisions |
| **Coach** | Athlete management | Register athletes, submit weight changes |
| **Athlete** | Personal view | View schedule, attempts, results |

### Key Pages

- **Admin Dashboard** - `http://localhost:5000/admin`
- **Timer Control** - `http://localhost:5000/admin/timer`
- **Referee Panel** - `http://localhost:5000/referee`
- **Scoreboard Display** - `http://localhost:5000/display/scoreboard`
- **Athlete Portal** - `http://localhost:5000/athlete`

**📖 See [User Guide](USER_GUIDE.md) for detailed feature documentation.**

---

## 🏗️ Project Structure

```
SmallGoods-Competition-app/
├── app/                      # Main application package
│   ├── models.py            # Database models (SQLAlchemy)
│   ├── routes/              # Route blueprints
│   │   ├── admin.py         # Admin panel routes
│   │   ├── timer.py         # Timer control routes
│   │   ├── athlete.py       # Athlete portal routes
│   │   ├── display.py       # Public display routes
│   │   └── login.py         # Authentication routes
│   ├── templates/           # Jinja2 HTML templates
│   │   ├── admin/           # Admin interface templates
│   │   ├── athlete/         # Athlete portal templates
│   │   ├── display/         # Display screen templates
│   │   └── base.html        # Base template
│   ├── static/              # Static assets
│   │   ├── css/             # Stylesheets
│   │   ├── js/              # JavaScript files
│   │   │   ├── timekeeper.js
│   │   │   ├── admin/flights_management.js
│   │   │   └── athlete.js
│   │   └── images/          # Image assets
│   ├── utils/               # Utility functions
│   │   ├── scoring.py       # Scoring calculations
│   │   └── referee_generator.py
│   └── extensions.py        # Flask extensions initialization
├── tests/                   # Test suite
│   ├── test_models.py       # Unit tests
│   ├── test_integration.py  # Integration tests
│   ├── test_system.py       # System tests
│   ├── conftest.py          # Test fixtures
│   └── test_utils.py        # Test utilities
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md      # Technical architecture
│   └── CONTRIBUTING.md      # Contribution guidelines
├── migrations/              # Database migrations
├── instance/                # Instance-specific files
│   ├── app.db              # SQLite database (auto-created)
│   └── timer_state.json    # Timer state persistence
├── .github/                 # GitHub configuration
│   └── workflows/          # CI/CD workflows
├── USER_GUIDE.md           # Comprehensive user documentation
├── README.md               # This file
├── requirements.txt        # Python dependencies
├── run.py                  # Application entry point
├── run.sh                  # Unix run script
└── run.bat                 # Windows run script
```

---

## 🔀 Development Workflow

### Branch Strategy

- **`main`** - Stable, production-ready code
- **`dev`** - Integration branch for features
- **`feature/*`** - Feature branches (e.g., `feature/timer-improvements`)
- **`fix/*`** - Bug fix branches (e.g., `fix/scoreboard-update`)

### Pull Request Process

1. Create feature branch from `dev`
2. Make changes and commit
3. Push branch and create PR to `dev`
4. Ensure CI tests pass
5. Request code review
6. Merge after approval

**Note:** Only merge `dev` → `main` for releases.

---

## 📚 Quick Reference

### Common Commands

| Task | Command |
|------|---------|
| Start app | `./run.sh` or `run.bat` |
| Run tests | `pytest` |
| Verbose tests | `pytest -v` |
| Test coverage | `pytest --cov=app` |
| Create migration | `flask db migrate -m "description"` |
| Apply migrations | `flask db upgrade` |
| Check DB version | `flask db current` |

### Important URLs

| Page | URL |
|------|-----|
| Admin Dashboard | `http://localhost:5000/admin` |
| Timer Control | `http://localhost:5000/admin/timer` |
| Referee Panel | `http://localhost:5000/referee` |
| Scoreboard | `http://localhost:5000/display/scoreboard` |
| Athlete Portal | `http://localhost:5000/athlete` |
| Login | `http://localhost:5000/login` |

### Default Credentials

**⚠️ Change these immediately in production!**

```
Admin:
Email: admin@example.com
Password: admin123
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `pytest`
5. Commit: `git commit -m "Add amazing feature"`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Follow PEP 8 for Python code
- Use meaningful variable names
- Add comments for complex logic
- Write tests for new features
- Update documentation as needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👏 Acknowledgments

- **CITS5206** - University of Western Australia
- **Group 9** - Development team
- **SmallGoods** - Project sponsor
- **Open Source Community** - Flask, SQLAlchemy, and other dependencies

---

## 📧 Contact & Support

- **Issues:** [GitHub Issues](https://github.com/cits5206Group9/SmallGoods-Competition-app/issues)
- **Documentation:** [User Guide](USER_GUIDE.md)
- **Repository:** [GitHub](https://github.com/cits5206Group9/SmallGoods-Competition-app)

---

**Made with ❤️ by Group 9 for the SmallGoods Community**

