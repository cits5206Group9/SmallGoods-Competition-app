# Code Coverage Testing Guide

This guide explains how to run tests with coverage analysis and interpret the results.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Running Coverage Tests](#running-coverage-tests)
- [Understanding Coverage Reports](#understanding-coverage-reports)
- [Coverage Configuration](#coverage-configuration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Code coverage measures how much of your code is executed during testing. This project uses `pytest-cov` for coverage analysis.

**Coverage Types:**
- **Statement Coverage**: Percentage of code lines executed
- **Branch Coverage**: Percentage of decision branches taken
- **Function Coverage**: Percentage of functions called
- **Missing Coverage**: Lines not executed during tests

**Coverage Goals:**
- Minimum: 70% overall coverage
- Target: 80%+ for core business logic
- Critical modules: 90%+ coverage

---

## Prerequisites

Ensure `pytest-cov` is installed (already in `requirements.txt`):

```bash
pip install pytest-cov
```

Or install all dependencies:

```bash
pip install -r requirements.txt
```

---

## Running Coverage Tests

### Basic Coverage Run

Generate coverage report with default settings:

```bash
pytest --cov=app
```

This will:
- Run all tests
- Measure coverage for the `app/` package
- Display terminal summary

### Coverage with HTML Report

Generate an interactive HTML report:

```bash
pytest --cov=app --cov-report=html
```

View the report:

```bash
# macOS
open htmlcov/index.html

# Linux
xdg-open htmlcov/index.html

# Windows
start htmlcov/index.html
```

### Coverage with Multiple Report Formats

Generate all report types simultaneously:

```bash
pytest --cov=app --cov-report=html --cov-report=term-missing --cov-report=json
```

This creates:
- **Terminal report**: Immediate feedback with missing lines
- **HTML report**: Interactive browsable report (`htmlcov/index.html`)
- **JSON report**: Machine-readable data (`coverage.json`)

### Coverage for Specific Modules

Test only specific modules:

```bash
# Coverage for models only
pytest --cov=app.models tests/test_models.py

# Coverage for routes
pytest --cov=app.routes tests/

# Coverage for utilities
pytest --cov=app.utils tests/
```

### Coverage with Minimum Threshold

Fail if coverage falls below threshold:

```bash
pytest --cov=app --cov-fail-under=70
```

**Exit codes:**
- `0`: Tests passed, coverage ≥ 70%
- `1`: Tests failed or coverage < 70%

### Exclude Tests from Coverage

Measure only application code, not test code:

```bash
pytest --cov=app --cov-report=html --omit="*/tests/*,*/test_*"
```

### Coverage with Branch Analysis

Include branch coverage (if/else paths):

```bash
pytest --cov=app --cov-branch --cov-report=html
```

---

## Understanding Coverage Reports

### Terminal Report

```
---------- coverage: platform darwin, python 3.13.0-final-0 -----------
Name                              Stmts   Miss  Cover   Missing
---------------------------------------------------------------
app/__init__.py                      45      2    96%   23, 67
app/config.py                        23      0   100%
app/extensions.py                     8      0   100%
app/models.py                       187     12    94%   145-148, 234-237
app/routes/admin.py                 542     87    84%   234, 456-489, ...
app/routes/athlete.py               234     34    85%   123, 234-245
app/routes/coach.py                 156     45    71%   89-95, 134-156
app/utils/scoring.py                 89      5    94%   67-69, 123-124
---------------------------------------------------------------
TOTAL                              1284    185    86%
```

**Columns:**
- **Stmts**: Total statements in file
- **Miss**: Statements not executed
- **Cover**: Coverage percentage
- **Missing**: Line numbers not covered

### HTML Report

The HTML report provides:

1. **Overview Page** (`index.html`)
   - Overall coverage percentage
   - List of all modules with coverage
   - Sortable by name, coverage, statements

2. **Module Details** (click on any file)
   - Color-coded source code:
     - **Green**: Covered lines
     - **Red**: Uncovered lines
     - **Yellow**: Partial branch coverage
   - Line numbers with hit counts
   - Branch coverage indicators

3. **Navigation**
   - Click file names to view details
   - Search functionality
   - Filter by coverage level

### JSON Report

Machine-readable coverage data (`coverage.json`):

```json
{
  "meta": {
    "version": "7.0.0",
    "timestamp": "2025-10-12T10:30:00",
    "branch_coverage": true
  },
  "files": {
    "app/models.py": {
      "executed_lines": [1, 2, 3, 5, 10, 15],
      "missing_lines": [145, 146, 147],
      "summary": {
        "covered_lines": 175,
        "num_statements": 187,
        "percent_covered": 93.58
      }
    }
  },
  "totals": {
    "covered_lines": 1099,
    "num_statements": 1284,
    "percent_covered": 85.59
  }
}
```

---

## Coverage Configuration

### Pytest Configuration (`pytest.ini`)

Current configuration:

```ini
[tool:pytest]
coverage_options = 
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --cov-report=json
    --cov-fail-under=70
```

### Coverage Config File (`.coveragerc`)

Create `.coveragerc` for advanced configuration:

```ini
[run]
# Measure coverage for app package
source = app

# Enable branch coverage
branch = True

# Omit specific files
omit =
    */tests/*
    */test_*.py
    */__pycache__/*
    */venv/*
    */.venv/*
    */migrations/*

[report]
# Precision for coverage percentage
precision = 2

# Show missing lines
show_missing = True

# Fail if coverage below threshold
fail_under = 70

# Exclude lines from coverage
exclude_lines =
    # Standard pragma
    pragma: no cover
    
    # Debug code
    def __repr__
    
    # Defensive programming
    raise AssertionError
    raise NotImplementedError
    
    # Non-runnable code
    if __name__ == .__main__.:
    if TYPE_CHECKING:
    @abstractmethod
    
    # Pass statements
    pass

[html]
# HTML report directory
directory = htmlcov

# Custom title
title = SmallGoods Competition App Coverage Report

[json]
# JSON report file
output = coverage.json
```

---

## Best Practices

### 1. Run Coverage Regularly

```bash
# Before committing
pytest --cov=app --cov-report=term-missing

# Weekly full report
pytest --cov=app --cov-report=html --cov-branch
```

### 2. Focus on Critical Modules

Prioritize coverage for:
- **Models** (`app/models.py`): 90%+ target
- **Scoring Logic** (`app/utils/scoring.py`): 95%+ target
- **API Routes** (`app/routes/*.py`): 80%+ target

```bash
# Check critical module coverage
pytest --cov=app.models --cov=app.utils.scoring --cov-fail-under=90
```

### 3. Identify Gaps

Use HTML report to find:
- Uncovered error handling
- Unused code (consider removing)
- Missing edge case tests

### 4. Exclude Non-Critical Code

Add `# pragma: no cover` for:
- Debug code
- Abstract methods
- Defensive assertions

```python
def debug_only_function():  # pragma: no cover
    """This runs only in debug mode"""
    print("Debug info")
```

### 5. Track Coverage Over Time

```bash
# Save coverage reports by date
pytest --cov=app --cov-report=html:htmlcov-$(date +%Y%m%d)

# Compare with baseline
pytest --cov=app --cov-report=json:coverage-current.json
# Compare JSON files to track changes
```

### 6. Use Coverage in CI/CD

GitHub Actions example (`.github/workflows/tests.yml`):

```yaml
- name: Run tests with coverage
  run: |
    pytest --cov=app --cov-report=xml --cov-report=term-missing --cov-fail-under=70

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage.xml
```

---

## Common Commands Reference

```bash
# Quick coverage check
pytest --cov=app --cov-report=term-missing

# Full HTML report
pytest --cov=app --cov-report=html
open htmlcov/index.html

# Coverage with branch analysis
pytest --cov=app --cov-branch --cov-report=html

# Fail if below 70%
pytest --cov=app --cov-fail-under=70

# Coverage for specific tests
pytest tests/test_models.py --cov=app.models --cov-report=html

# Verbose output with coverage
pytest -v --cov=app --cov-report=term-missing

# Coverage without running tests (if coverage data exists)
coverage report
coverage html
```

---

## Troubleshooting

### Issue: Low Coverage Despite Good Tests

**Cause**: Tests not importing/executing all code paths

**Solution**:
1. Check HTML report for uncovered lines
2. Add tests for missing branches
3. Verify imports in test files

### Issue: Coverage Report Shows Wrong Files

**Cause**: Incorrect source specification

**Solution**:
```bash
# Explicitly specify source
pytest --cov=app --cov-report=html

# Use .coveragerc to set source permanently
```

### Issue: Coverage Data Not Found

**Cause**: Previous coverage data not cleared

**Solution**:
```bash
# Remove old coverage data
rm -rf .coverage htmlcov/ coverage.json

# Run fresh coverage
pytest --cov=app --cov-report=html
```

### Issue: Can't Open HTML Report

**Cause**: Report not generated or wrong path

**Solution**:
```bash
# Verify report exists
ls htmlcov/index.html

# Regenerate if missing
pytest --cov=app --cov-report=html

# Open with full path
open "$(pwd)/htmlcov/index.html"
```

### Issue: Coverage Below Expected

**Steps to diagnose**:

1. **Generate detailed report**:
   ```bash
   pytest --cov=app --cov-report=html --cov-report=term-missing
   ```

2. **Review HTML report**: Identify red/uncovered sections

3. **Add missing tests**:
   - Error handling paths
   - Edge cases
   - Branch conditions

4. **Re-run coverage**:
   ```bash
   pytest --cov=app --cov-report=html
   ```

5. **Compare**: Check improvement

---

## Coverage Metrics Interpretation

### Coverage Percentages

| Coverage | Interpretation | Action |
|----------|---------------|--------|
| 90-100% | Excellent | Maintain, add tests for new code |
| 80-89% | Good | Identify critical gaps |
| 70-79% | Acceptable | Focus on core logic first |
| 60-69% | Needs Improvement | Prioritize testing |
| < 60% | Poor | Immediate action required |

### Module-Specific Targets

| Module | Target Coverage | Reason |
|--------|----------------|--------|
| `app/models.py` | 90%+ | Core data structures |
| `app/utils/scoring.py` | 95%+ | Business logic critical |
| `app/routes/*.py` | 80%+ | API endpoints |
| `app/extensions.py` | 95%+ | App initialization |
| `app/config.py` | 85%+ | Configuration |

---

## Integration with Development Workflow

### Pre-Commit

```bash
# Run before each commit
pytest --cov=app --cov-fail-under=70 -q
```

### Pre-Push

```bash
# Full coverage check before pushing
pytest --cov=app --cov-report=html --cov-report=term-missing --cov-fail-under=70
```

### Code Review

Include coverage in PR description:
- Overall coverage percentage
- Coverage delta (increase/decrease)
- Newly covered modules
- Remaining gaps

---

## Resources

- **pytest-cov documentation**: https://pytest-cov.readthedocs.io/
- **Coverage.py**: https://coverage.readthedocs.io/
- **Project pytest.ini**: See coverage configuration
- **CI/CD**: `.github/workflows/tests.yml`

---

**Version**: 1.0  
**Last Updated**: October 2025
