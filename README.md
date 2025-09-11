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

# 4) Initialize DB
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

### Run tests

```bash
pytest -q
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