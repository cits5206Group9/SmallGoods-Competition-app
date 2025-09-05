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

# 3) Set environment (dev defaults are safe)
cp .env.example .env

# 4) Initialize DB
flask db upgrade  # first run will create SQLite file

# 5) Run the server
flask --app src/app --debug run
# visit http://127.0.0.1:5000

flask --app src/app db current  # check current migration version
falsk --app src/app db history  # view all migrations
```

### Run tests
```bash
pytest -q
```

### Code style (pre-commit optional)
```bash
pre-commit install
pre-commit run --all-files
```

---

## Branch Strategy
- `main` → stable, release-ready
- `dev` → integration branch for features
- feature branches → `feature/<short-description>`

PRs: feature → `dev` (with passing CI). Merge `dev` → `main` only for releases.

---

## Project Structure
```
src/app/              # Flask application package
src/app/templates/    # Jinja templates
src/app/static/       # Static assets (css/js)
tests/                # pytest tests
docs/                 # Notes, architecture, decisions
assets/               # Images or design assets
.github/workflows/    # CI
```
Added by Chenglin as a test contribution.
