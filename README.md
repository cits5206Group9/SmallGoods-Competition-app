# Small Goods Competion App

A Flask-based web app.

## Tech Stack

- **Backend:** Flask, Flask-SQLAlchemy, Flask-Migrate
- **Database:** SQLite (dev/testing)
- **Frontend:** Jinja templates + vanilla JS (upgradeable to Tailwind/Bootstrap)
- **Real-time:** WebSockets for live updates
- **Tests:** pytest
- **CI:** GitHub Actions (runs lint & tests on every PR)


## Documentation

- **[User Guide](./USER_GUIDE.md)** - Complete guide for using the application
  - ADMIN 
    - Competition Model
    - Athlete Management
    - Flight Management
    - Timekeeper (Time Control)
    - Referee
    - Scoreboard History
  - Public Display
  - Athlete Dashboard
  - Step-by-step workflows and best practices
  - Troubleshooting common issues

- **[Coverage Testing Guide](docs/COVERAGE_TESTING_GUIDE.md)** - Detailed coverage testing documentation
  - Running coverage tests
  - Understanding coverage reports
  - Best practices and CI/CD integration

- **[Athlete Testing Guide](docs/Athlete_Testing_Guide.md), [Timekeeper Testing Guide](docs/Timekeeper-testing-guide.md)** 
  - Detailed manual testing guide for timekeeper and athlete dashboard.

- **[Local Network Guide](ops/router/Network-Guideline.md)**
  - Detailed setup guide for local network and router.
  - Includes both first time setup and regular use.


##  Key Features

- **Competition Management** - Create and manage multiple competitions with events and flights
- **Real-time Timer** - Synchronized countdown/countup timer
- **Flight Management** - Organise athletes with drag-and-drop attempt ordering
- **Referee System** - Multi-referee decision recording
- **Public Displays** - Scoreboard, attempt tracking, and audience displays
- **Athlete Dashboard** - Personal dashboard for athletes
- **Network Support** - Multi-device access on local network


## Key Pages

- **Admin Dashboard** - `http://127.0.0.1:5000/admin`
- **Timer Control** - `http://127.0.0.1:5000/admin/timer`
- **Referee Panel** - `http://127.0.0.1:5000/referee`
- **Display** - `http://127.0.0.1:5000/display/public-stage`
- **Athlete Portal** - `http://127.0.0.1:5000/athlete`

**See [User Guide](./USER_GUIDE.md) for detailed feature documentation.**


## Project Structure

```
app/              # Flask application package
app/templates/    # Jinja templates
app/static/       # Static assets (css/js)
tests/                # pytest tests
docs/                 # MoM, Accountability forms, Notes
assets/               # Images or design assets
.github/workflows/    # CI
instance/            # db.sqlite (created on first run)
migrations/         # Flask-Migrate files
```

## Quick Start

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Git

### Installation

```bash
# 1. ONLY FOR INITIAL APP RUN - Clone the repository
git clone https://github.com/cits5206Group9/SmallGoods-Competition-app.git
cd SmallGoods-Competition-app

# 2. Create & activate a virtual environment
python3 -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows
.venv\Scripts\activate

# 3. ONLY FOR INITIAL APP RUN - Install dependencies
pip install -r requirements.txt

# 4. ONLY FOR INITIAL APP RUN
# Delete existing database and models. WARNING: This deletes all data
delete /instance/app.db #If exists
delete /migrations #If exists

# Create initial models
flask db init
# Check Database consistency
flask db upgrade

# 5. Run the application
./run.sh          # macOS/Linux
run.bat           # Windows

# 6.
Visit http://127.0.0.1:5000
```

### Accessing on Local Network

**See [User Guide - Network Access](/ops/Network-Guideline.md) for detailed setup.**

### Detailed User Guide for each interface
**See [User Guide](./USER_GUIDE.md) for comprehensive app user guide.**

## Testing

### Quick Test Commands

```bash
# Run all tests
pytest

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

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


## Acknowledgments

- **CITS5206** - University of Western Australia
- **Group 9** - Development team
- **SmallGoods** - Project sponsor
- **Open Source Community** - Flask, SQLAlchemy, and other dependencies
- **Generative AI** - Claude, ChatGPT, GitHub Copilot


## Contact & Support

- **Issues:** [GitHub Issues](https://github.com/cits5206Group9/SmallGoods-Competition-app/issues)
- **Documentation:** [User Guide](USER_GUIDE.md)
- **Repository:** [GitHub](https://github.com/cits5206Group9/SmallGoods-Competition-app)



