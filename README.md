# Small Goods Competion App 🏋️‍♂️

A Flask-based web app.

## Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-Migrate
- **Database:** SQLite (dev/testing), easily switchable to Postgres/MySQL
- **Frontend:** Jinja templates + vanilla JS (upgradeable to Tailwind/Bootstrap)
- **Tests:** pytest
- **CI:** GitHub Actions (runs lint & tests on every PR)

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