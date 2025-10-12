# Testing and Coverage Summary

This document provides a quick reference for running tests and checking code coverage.

## Quick Start

### Run All Tests

```bash
# Simple test run
pytest

# Or use the test script
./run_tests.sh
```

### Run Tests with Coverage

```bash
# Using pytest directly
pytest --cov=app --cov-report=term-missing

# Using the test script
./run_tests.sh --coverage

# Generate HTML report
./run_tests.sh --html
```

### View Coverage Report

```bash
# After running with --html
open htmlcov/index.html     # macOS
xdg-open htmlcov/index.html # Linux
start htmlcov/index.html    # Windows
```

## Test Script Options

The `run_tests.sh` script provides convenient options:

```bash
./run_tests.sh --help           # Show all options
./run_tests.sh --coverage       # Run with coverage
./run_tests.sh --html           # Generate HTML coverage report
./run_tests.sh --verbose        # Verbose test output
./run_tests.sh --fail-under 80  # Fail if coverage < 80%
./run_tests.sh --test tests/test_models.py  # Run specific test
```

## Code Formatting

Format your code before committing:

```bash
# Sort imports
isort .

# Format code with Black
black .

# Check with linter
ruff check --fix .

# All in one command
isort . && black . && ruff check --fix .
```

## Pre-Commit Workflow

```bash
# 1. Format code
isort . && black .

# 2. Run tests
pytest

# 3. Check coverage (optional, may fail with low coverage)
pytest --cov=app --cov-report=html

# 4. Commit
git add .
git commit -m "Your commit message"
```

## Current Coverage Status

As of the latest run, the coverage is **18.44%**. This is because most of the application routes and utilities are not yet covered by tests.

### Coverage by Module

| Module | Coverage | Status |
|--------|----------|--------|
| `app/extensions.py` | 100% | ✅ Excellent |
| `app/models.py` | 96.25% | ✅ Excellent |
| `app/real_time/timer_manager.py` | 82.94% | ✅ Good |
| `app/config.py` | 77.78% | ⚠️ Good |
| `app/routes/coach.py` | 72.73% | ⚠️ Acceptable |
| `app/real_time/websocket.py` | 32.67% | ❌ Needs Improvement |
| `app/real_time/event_handlers.py` | 29.13% | ❌ Needs Improvement |
| `app/routes/login.py` | 24.56% | ❌ Needs Improvement |
| `app/routes/display.py` | 15.79% | ❌ Needs Improvement |
| `app/utils/scoring.py` | 11.02% | ❌ Needs Improvement |
| `app/routes/timer.py` | 9.68% | ❌ Needs Improvement |
| `app/routes/admin.py` | 8.63% | ❌ Needs Improvement |
| `app/routes/athlete.py` | 5.76% | ❌ Needs Improvement |

### Priority Areas for Testing

1. **Critical Business Logic** (High Priority):
   - `app/utils/scoring.py` - Scoring calculations
   - `app/routes/admin.py` - Admin operations
   - `app/routes/athlete.py` - Athlete operations

2. **Real-time Features** (Medium Priority):
   - `app/real_time/websocket.py`
   - `app/real_time/event_handlers.py`

3. **Display & Login** (Medium Priority):
   - `app/routes/display.py`
   - `app/routes/login.py`

## Improving Coverage

To improve coverage, add tests for:

1. **Route Handlers**: Test API endpoints in `app/routes/`
2. **Business Logic**: Test scoring calculations in `app/utils/scoring.py`
3. **WebSocket Events**: Test real-time event handlers
4. **Error Handling**: Test error conditions and edge cases

Example test structure:

```python
def test_create_athlete_api(client, app):
    """Test creating an athlete via API"""
    with app.app_context():
        response = client.post('/admin/api/athletes', json={
            'first_name': 'John',
            'last_name': 'Doe',
            'gender': 'male',
            'bodyweight': 85.0
        })
        assert response.status_code == 200
```

## Continuous Improvement

**Target Coverage Goals**:
- **Short-term** (1-2 sprints): 40%+ overall
- **Medium-term** (3-6 sprints): 60%+ overall
- **Long-term**: 80%+ overall
- **Critical modules**: 90%+ always

**Tracking Progress**:
- Run coverage before each PR
- Document coverage changes in PR description
- Set coverage requirements in CI/CD

## Resources

- **Detailed Coverage Guide**: [`docs/COVERAGE_TESTING_GUIDE.md`](COVERAGE_TESTING_GUIDE.md)
- **User Guide**: [`docs/USER_GUIDE.md`](USER_GUIDE.md)
- **pytest Documentation**: https://docs.pytest.org/
- **pytest-cov Documentation**: https://pytest-cov.readthedocs.io/

---

**Last Updated**: October 2025
