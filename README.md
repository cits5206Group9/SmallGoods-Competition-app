# Small Goods Competion App 🏋️‍♂️

A Flask-based web app.

## Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-Migrate
- **Database:** SQLite (dev/testing), easily switchable to Postgres/MySQL
- **Frontend:** Jinja templates + vanilla JS (upgradeable to Tailwind/Bootstrap)
- **Tests:** pytest
- **CI:** GitHub Actions (runs lint & tests on every PR)

---

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[User Guide](docs/USER_GUIDE.md)** - Complete guide for using the application
  - Competition, Event, Athlete, and Flight Management
  - Step-by-step workflows and best practices
  - Troubleshooting common issues

- **[Coverage Testing Guide](docs/COVERAGE_TESTING_GUIDE.md)** - Detailed coverage testing documentation
  - Running coverage tests
  - Understanding coverage reports
  - Best practices and CI/CD integration

- **[Testing Summary](docs/TESTING_SUMMARY.md)** - Quick reference for testing and formatting
  - Quick start commands
  - Current coverage status
  - Pre-commit workflow

- **[Architecture](docs/ARCHITECTURE.md)** - System architecture and design decisions

- **[Contributing](docs/CONTRIBUTING.md)** - Guidelines for contributors

---

## Getting Started (Local)

```bash
# 1) Create & activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 2) Install dependencies
pip install -r requirements.txt

# 4) Check Database consistency
flask db upgrade  # first run will create SQLite file
flask db current # check current migration version
flask db history # view all migrations

# 5) Run int DEBUG model (very verbose logging)
# INFO level (default)
./run.sh INFO

# DEBUG level (most verbose)
./run.sh DEBUG

# WARNING level (less verbose)
./run.sh WARNING

# 6) Run without DEBUG model
./run.sh

# Windows
run.bat           # Production mode
run.bat INFO      # Custom INFO logging
run.bat DEBUG     # Custom DEBUG logging
# visit http://127.0.0.1:5000
```
## DB migrations

```bash
# If you need to change the database schema: app/models.py
# save the current database version
flask db current
flask db migrate -m "describe changes"
flask db upgrade
```

### Run tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test types
pytest -m unit          # Unit tests only
pytest -m integration   # Integration tests only  
pytest -m system        # System tests only

# Run specific test files
pytest tests/test_models.py
pytest tests/test_integration.py
pytest tests/test_system.py

# Run and stop on first failure
pytest -x

# Run quietly with minimal output
pytest -q
```

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

#### 📊 **Running Tests with Coverage**

This project includes comprehensive code coverage reporting. Coverage measures how much of the codebase is tested.

**Quick Coverage Check:**

```bash
# Run all tests with coverage report
pytest --cov=app --cov-report=term-missing

# Generate HTML coverage report
pytest --cov=app --cov-report=html

# Open HTML report (macOS)
open htmlcov/index.html

# Open HTML report (Linux)
xdg-open htmlcov/index.html

# Open HTML report (Windows)
start htmlcov/index.html
```

**Coverage with Threshold:**

```bash
# Fail if coverage is below 70%
pytest --cov=app --cov-fail-under=70

# Run specific tests with coverage
pytest tests/test_models.py --cov=app.models --cov-report=html
```

**Coverage Report Formats:**

```bash
# Terminal report with missing lines
pytest --cov=app --cov-report=term-missing

# HTML report (interactive, browsable)
pytest --cov=app --cov-report=html

# JSON report (machine-readable)
pytest --cov=app --cov-report=json

# XML report (for CI/CD tools)
pytest --cov=app --cov-report=xml

# Generate all formats at once
pytest --cov=app --cov-report=html --cov-report=term-missing --cov-report=json
```

**Understanding Coverage Output:**

```
---------- coverage: platform darwin, python 3.13.0 -----------
Name                        Stmts   Miss  Cover   Missing
---------------------------------------------------------
app/models.py                 187     12    94%   145-148
app/routes/admin.py           542     87    84%   234, 456-489
app/utils/scoring.py           89      5    94%   67-69
---------------------------------------------------------
TOTAL                        1284    185    86%
```

- **Stmts**: Total statements
- **Miss**: Uncovered statements
- **Cover**: Coverage percentage
- **Missing**: Line numbers not covered

**Coverage Configuration:**

Coverage settings are in `.coveragerc` and `pytest.ini`:
- Minimum coverage: 70%
- Target coverage: 80%+
- Critical modules: 90%+

For detailed coverage testing guide, see: [`docs/COVERAGE_TESTING_GUIDE.md`](docs/COVERAGE_TESTING_GUIDE.md)

---

## Code Formatting

This project uses automated code formatting tools to maintain consistent code style.

### Formatting Tools

**Black** - Python code formatter (opinionated, PEP 8 compliant)

```bash
# Format all Python files
black .

# Format specific file or directory
black app/
black tests/

# Check formatting without making changes
black --check .

# See what would be changed
black --diff .
```

**isort** - Import statement organizer

```bash
# Sort all imports
isort .

# Sort specific file or directory
isort app/
isort tests/

# Check without making changes
isort --check-only .

# Show diff of what would change
isort --diff .
```

**Ruff** - Fast Python linter (alternative to flake8)

```bash
# Lint all files
ruff check .

# Lint and auto-fix issues
ruff check --fix .

# Lint specific directory
ruff check app/

# Show detailed error information
ruff check --verbose .
```

**Flake8** - Python linter (style and error checking)

```bash
# Check all Python files
flake8 .

# Check specific directory
flake8 app/

# Show statistics
flake8 --statistics .

# Generate HTML report
flake8 --format=html --htmldir=flake-report .
```

### Format All Code

Run all formatting tools in sequence:

```bash
# 1. Sort imports
isort .

# 2. Format code
black .

# 3. Check for linting issues
ruff check --fix .

# Or run flake8 (alternative to ruff)
flake8 .
```

**One-liner for all formatting:**

```bash
isort . && black . && ruff check --fix .
```

### Pre-commit Hooks

The project includes pre-commit configuration for automatic formatting.

**Setup pre-commit:**

```bash
# Install pre-commit hooks
pre-commit install

# Run manually on all files
pre-commit run --all-files

# Update hooks to latest versions
pre-commit autoupdate
```

**What pre-commit does:**
- Runs Black on Python files
- Sorts imports with isort
- Checks for trailing whitespace
- Validates YAML, JSON, TOML files
- Checks for large files
- Runs linters (ruff/flake8)

### Formatting Configuration

**Black settings** (in `pyproject.toml` or command line):
```bash
# Line length (default: 88)
black --line-length 88 .

# Python version target
black --target-version py311 .
```

**isort settings** (compatible with Black):
```bash
# Use Black-compatible profile
isort --profile black .
```

**Ruff settings** (in `pyproject.toml` or `ruff.toml`):
```toml
# Example ruff.toml
line-length = 88
target-version = "py311"

[lint]
select = ["E", "F", "W", "C90", "I", "N"]
ignore = ["E501"]  # Line too long (handled by Black)
```

### VS Code Integration

For automatic formatting on save, add to `.vscode/settings.json`:

```json
{
  "python.formatting.provider": "black",
  "python.linting.enabled": true,
  "python.linting.ruffEnabled": true,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

### CI/CD Formatting Checks

GitHub Actions checks formatting on every PR (see `.github/workflows/tests.yml`):

```yaml
- name: Check code formatting
  run: |
    black --check .
    isort --check-only .
    ruff check .
```

### Common Formatting Commands

```bash
# Full formatting workflow
isort . && black .                    # Format code

# Check formatting (CI/CD)
black --check . && isort --check-only . && ruff check .

# Fix common issues
ruff check --fix .                    # Auto-fix linting issues
isort . && black .                    # Fix imports and formatting

# Generate reports
flake8 --statistics .                 # Linting statistics
black --diff . > formatting-diff.txt  # Save formatting changes
```

---

## Running the Application

### Development Mode

```bash
# With INFO logging
./run.sh INFO

# With DEBUG logging (very verbose)
./run.sh DEBUG

# With WARNING logging (less verbose)
./run.sh WARNING

# Default (production mode)
./run.sh
```

### Production Mode

```bash
# Using gunicorn (production server)
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"

# With logging
gunicorn -w 4 -b 0.0.0.0:5000 --access-logfile - --error-logfile - "app:create_app()"
```

---

## Complete Testing Workflow

**Before committing code:**

```bash
# 1. Format code
isort . && black .

# 2. Check linting
ruff check --fix .

# 3. Run tests
pytest

# 4. Run tests with coverage
pytest --cov=app --cov-fail-under=70

# 5. Review coverage report
open htmlcov/index.html
```

**Quick pre-commit check:**

```bash
# All checks in one line
isort . && black . && ruff check --fix . && pytest --cov=app --cov-fail-under=70
```

---

## Additional Documentation

- **User Guide**: [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) - Instructions for using the app (sections, athlete management, flight management)
- **Coverage Testing**: [`docs/COVERAGE_TESTING_GUIDE.md`](docs/COVERAGE_TESTING_GUIDE.md) - Comprehensive guide on coverage testing
- **Architecture**: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - System architecture and design decisions
- **Contributing**: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) - Contribution guidelines

---

## Branch Strategy

- `main` → stable, release-ready
- `dev` → integration branch for features
- feature branches → `feature/<short-description>`

PRs: feature → `dev` (with passing CI). Merge `dev` → `main` only for releases.

---

## Project Structure

```bash
app/              # Flask application package
app/templates/    # Jinja templates
app/static/       # Static assets (css/js)
tests/                # pytest tests
docs/                 # Notes, architecture, decisions
assets/               # Images or design assets
.github/workflows/    # CI
instance/            # db.sqlite (created on first run)
migrations/         # Flask-Migrate files
```