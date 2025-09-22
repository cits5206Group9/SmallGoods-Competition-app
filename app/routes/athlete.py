from flask import Blueprint, render_template, request, jsonify
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta

from ..extensions import db
from ..models import (
    Athlete,
    AthleteEntry,
    Competition,
    Event,
    Flight,
    Attempt,
    AttemptResult,
    CompetitionType,
    Exercise,
    SportCategory,
    Lift,
    AthleteFlight,
)

from .admin import (
    get_competitions,
    get_competition_model,
    get_competition_events,
    get_event_flights,
    get_flight_athletes,
)

athlete_bp = Blueprint("athlete", __name__, url_prefix="/athlete")

# Helpers ---------------------------------------------------------------------------

# NOTE: Only user detail uses mock data for now.
MOCK_USER_ID = 1  # replace with real auth when available


def resolve_current_athlete():
    """
    Resolve the current athlete row from the DB.
    This would use the authenticated user's email.
    """
    # Mock user login data - in production this would come from session/auth
    mock_user_email = "amy@email.com"
    
    return (
        Athlete.query.options(
            joinedload(Athlete.competition),
            joinedload(Athlete.entries).joinedload(AthleteEntry.competition_type),
            joinedload(Athlete.flights)
        )
        .filter(
            Athlete.email == mock_user_email # In production, this would use the authenticated user's ID.
        )
        .first()
    )


def get_my_flights(athlete_id, competition_id):
    """
    Return a list of flights (with event/competition info) the athlete is assigned to,
    using admin.py's endpoints to keep JSON shapes consistent.
    """
    my_flights = []

    # 1) List all events for this competition via admin helper
    comp_events_resp = get_competition_events(competition_id)
    comp_events = comp_events_resp.get_json() if hasattr(comp_events_resp, "get_json") else []

    for ev in comp_events or []:
        event_id = ev["id"]

        # 2) For each event, fetch its flights (admin helper)
        flights_resp = get_event_flights(event_id)
        flights = flights_resp.get_json() if hasattr(flights_resp, "get_json") else []

        # 3) For each flight, fetch its athletes (admin helper) and see if we're in it
        for f in flights or []:
            fa_resp = get_flight_athletes(f["id"])
            fa = fa_resp.get_json() if hasattr(fa_resp, "get_json") else {}
            athlete_rows = (fa or {}).get("athletes", [])
            if any(a["id"] == athlete_id for a in athlete_rows):
                # normalize a compact record for the dashboard
                my_flights.append(
                    {
                        "flight_id": f["id"],
                        "flight_name": f["name"],
                        "flight_order": f.get("order"),
                        "event_id": event_id,
                        "event_name": ev["name"],
                    }
                )

    # Fallback: if admin endpoints above are unavailable for any reason,
    # read from DB directly.
    if not my_flights:
        q = (
            db.session.query(Flight, Event)
            .join(Event, Flight.event_id == Event.id)
            .join(AthleteFlight, AthleteFlight.flight_id == Flight.id)
            .filter(AthleteFlight.athlete_id == athlete_id)
            .order_by(Event.id.asc(), Flight.order.asc())
        )
        for flight, event in q.all():
            my_flights.append(
                {
                    "flight_id": flight.id,
                    "flight_name": flight.name,
                    "flight_order": flight.order,
                    "event_id": event.id,
                    "event_name": event.name,
                }
            )

    return my_flights


def next_pending_attempt(athlete_id):
    """
    Find the athlete's next pending attempt across all entries.
    Returns an Attempt row with relationships loaded, or None.
    """
    return (
        Attempt.query.options(
            joinedload(Attempt.athlete_entry)
            .joinedload(AthleteEntry.competition_type)
            .joinedload(CompetitionType.exercise)
            .joinedload(Exercise.sport_category),
            joinedload(Attempt.lift),
        )
        .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
        .filter(
            AthleteEntry.athlete_id == athlete_id,
            Attempt.final_result.is_(None),  # not completed yet
        )
        .order_by(Attempt.started_at.is_(True), Attempt.attempt_number.asc())
        .first()
    )


def attempt_time_remaining(attempt: Attempt) -> int:
    """
    Compute time remaining (seconds) for an attempt based on the exercise's attempt_time_limit
    and when the attempt started (if started_at is set). If not started, return the full limit.
    """
    # Default to the exercise's configured time limit; fall back to 60s
    try:
        time_limit = (
            attempt.athlete_entry.competition_type.exercise.attempt_time_limit or 60
        )
    except Exception:
        time_limit = 60

    if attempt.started_at:
        elapsed = (datetime.utcnow() - attempt.started_at).total_seconds()
        remaining = max(0, int(time_limit - elapsed))
    else:
        remaining = int(time_limit)

    return remaining


# Views / API ---------------------------------------------------------------------------

@athlete_bp.route("/")
def athlete_dashboard():
    """
    Athlete dashboard.
    - Athlete details: mock-based user data + DB athlete row if present.
    - Competition/event/flight: pulled through admin.py helpers.
    """
    athlete_row = resolve_current_athlete()

    # Format athlete data with configuration, providing defaults if no athlete found
    athlete_config = {
        'id': None,
        'profile': {
            'first_name': 'Demo',
            'last_name': 'Athlete',
            'team': '—',
            'gender': '—',
            'bodyweight': None,
            'age': None,
            'email': None,
            'phone': None
        },
        'competition_state': {
            'current_attempt_number': None,
            'is_active': False
        },
        'entries': []
    }

    if athlete_row:
        # Build full athlete configuration
        athlete_config = {
            'id': athlete_row.id,
            'profile': {
                'first_name': athlete_row.first_name,
                'last_name': athlete_row.last_name,
                'team': athlete_row.team,
                'gender': athlete_row.gender,
                'bodyweight': athlete_row.bodyweight,
                'age': athlete_row.age,
                'email': athlete_row.email,
                'phone': athlete_row.phone
            },
            'competition_state': {
                'current_attempt_number': athlete_row.current_attempt_number,
                'is_active': athlete_row.is_active
            },
            'entries': []
        }

        # Add entry configurations
        for entry in athlete_row.entries:
            entry_config = {
                'id': entry.id,
                'competition_type': {
                    'id': entry.competition_type.id,
                    'name': entry.competition_type.name,
                    'exercise': {
                        'name': entry.competition_type.exercise.name,
                        'sport_category': {
                            'name': entry.competition_type.exercise.sport_category.name
                        }
                    }
                },
                'opening_weights': entry.opening_weights or {},
                'attempts': [],
                'scores': []
            }

            # Add attempts
            for attempt in sorted(entry.attempts, key=lambda x: x.attempt_number):
                entry_config['attempts'].append({
                    'id': attempt.id,
                    'number': attempt.attempt_number,
                    'requested_weight': attempt.requested_weight,
                    'actual_weight': attempt.actual_weight,
                    'result': attempt.final_result.value if attempt.final_result else None,
                    'lift_name': attempt.lift.name if attempt.lift else None,
                    'lifting_order': attempt.lifting_order
                })

            athlete_config['entries'].append(entry_config)

    # Decide which competition to show
    competition_id = None
    competition_meta = None

    if athlete_row and athlete_row.competition_id:
        competition_id = athlete_row.competition_id
    else:
        # fallback to the most recent competition from admin helper
        comps_resp = get_competitions()
        comps = comps_resp.get_json() if hasattr(comps_resp, "get_json") else []
        if comps:
            # naive pick: last item (you may switch to active competition if you track that)
            competition_id = comps[-1]["id"]

    if competition_id:
        comp_resp = get_competition_model(competition_id)
        competition_meta = comp_resp.get_json() if hasattr(comp_resp, "get_json") else None

    # My flights (joins events and flights using admin helpers)
    my_flights = []
    if competition_id and athlete_row:
        my_flights = get_my_flights(athlete_row.id, competition_id)

    # Next attempt preview
    next_attempt = next_pending_attempt(athlete_row.id) if athlete_row else None
    next_attempt_view = None
    if next_attempt:
        # Extract names defensively
        try:
            event_type = (
                next_attempt.athlete_entry.competition_type.exercise.sport_category.name
            )
        except Exception:
            event_type = None
        try:
            exercise_name = next_attempt.athlete_entry.competition_type.exercise.name
        except Exception:
            exercise_name = None

        next_attempt_view = {
            "attempt_id": next_attempt.id,
            "attempt_number": next_attempt.attempt_number,
            "requested_weight": next_attempt.requested_weight,
            "event_type": event_type,
            "exercise": exercise_name,
            "time_remaining": attempt_time_remaining(next_attempt),
        }

    return render_template(
        "athlete/athlete.html",
        athlete=athlete_config,
        competition=competition_meta,
        my_flights=my_flights,
        next_attempt=next_attempt_view,
    )


@athlete_bp.route("/update-opening-weight", methods=["POST"])
def update_opening_weight():
    """
    Update opening weight for the athlete for a given lift/exercise.
    Uses AthleteEntry.opening_weights JSON column keyed by lift name or type.
    Expected form/body:
      - competition_type_id (int)
      - lift_key (str)  e.g., "snatch", "clean_and_jerk", "squat", "bench", "deadlift"
      - weight (float)
    """
    try:
        competition_type_id = int(request.form.get("competition_type_id"))
        lift_key = (request.form.get("lift_key") or "").strip()
        weight = float(request.form.get("weight"))

        # Input validation
        if not lift_key:
            return jsonify({"success": False, "error": "Lift key is required"}), 400
        if weight <= 0:
            return jsonify({"success": False, "error": "Weight must be positive"}), 400

        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"success": False, "error": "Athlete not found"}), 404

        # Find entry with relationships loaded
        entry = AthleteEntry.query.options(
            joinedload(AthleteEntry.competition_type)
            .joinedload(CompetitionType.exercise)
            .joinedload(Exercise.sport_category)
        ).filter_by(
            competition_type_id=competition_type_id, 
            athlete_id=athlete.id
        ).first()

        if not entry:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Athlete is not entered in this competition type",
                    }
                ),
                404,
            )

        # Update opening weights
        opening = dict(entry.opening_weights or {})
        opening[lift_key] = weight
        entry.opening_weights = opening
        
        # Also update first attempt if it exists and hasn't been completed
        first_attempt = next(
            (a for a in entry.attempts 
             if a.attempt_number == 1 and 
             a.lift and a.lift.name.lower() == lift_key.lower() and
             a.final_result is None),
            None
        )
        if first_attempt:
            first_attempt.requested_weight = weight

        db.session.commit()

        # Return updated entry configuration
        entry_config = {
            'id': entry.id,
            'competition_type': {
                'id': entry.competition_type.id,
                'name': entry.competition_type.name,
                'exercise': {
                    'name': entry.competition_type.exercise.name,
                    'sport_category': {
                        'name': entry.competition_type.exercise.sport_category.name
                    }
                }
            },
            'opening_weights': entry.opening_weights,
            'attempts': [
                {
                    'id': attempt.id,
                    'number': attempt.attempt_number,
                    'requested_weight': attempt.requested_weight,
                    'actual_weight': attempt.actual_weight,
                    'result': attempt.final_result.value if attempt.final_result else None,
                    'lift_name': attempt.lift.name if attempt.lift else None,
                    'lifting_order': attempt.lifting_order
                }
                for attempt in sorted(entry.attempts, key=lambda x: x.attempt_number)
            ]
        }

        return jsonify({
            "success": True, 
            "entry": entry_config
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 400


@athlete_bp.route("/update-attempt-weight", methods=["POST"])
def update_attempt_weight():
    """
    Update the requested_weight of a specific attempt, if it isn't completed yet.
    Expected form/body:
      - attempt_id (int)
      - weight (float)
    Returns updated attempt configuration with full context.
    """
    try:
        attempt_id = int(request.form.get("attempt_id"))
        new_weight = float(request.form.get("weight"))

        # Input validation
        if new_weight <= 0:
            return jsonify({"success": False, "error": "Weight must be positive"}), 400

        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"success": False, "error": "Athlete not found"}), 404

        # Load attempt with all needed relationships
        attempt = Attempt.query.options(
            joinedload(Attempt.athlete_entry)
            .joinedload(AthleteEntry.athlete),
            joinedload(Attempt.athlete_entry)
            .joinedload(AthleteEntry.competition_type)
            .joinedload(CompetitionType.exercise)
            .joinedload(Exercise.sport_category),
            joinedload(Attempt.lift)
        ).get(attempt_id)

        if not attempt:
            return jsonify({"success": False, "error": "Attempt not found"}), 404

        # Authorize: the attempt must belong to our athlete
        if attempt.athlete_entry.athlete_id != athlete.id:
            return jsonify({"success": False, "error": "Unauthorized access"}), 403

        # Attempt must not be finalized
        if attempt.final_result is not None:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Cannot update a completed attempt",
                    }
                ),
                400,
            )

        # Update weight
        attempt.requested_weight = new_weight
        db.session.commit()

        # Return updated attempt configuration
        attempt_config = {
            'id': attempt.id,
            'number': attempt.attempt_number,
            'requested_weight': attempt.requested_weight,
            'actual_weight': attempt.actual_weight,
            'result': attempt.final_result.value if attempt.final_result else None,
            'lift_name': attempt.lift.name if attempt.lift else None,
            'lifting_order': attempt.lifting_order,
            'time_remaining': attempt_time_remaining(attempt),
            'entry': {
                'id': attempt.athlete_entry.id,
                'competition_type': {
                    'id': attempt.athlete_entry.competition_type.id,
                    'name': attempt.athlete_entry.competition_type.name,
                    'exercise': {
                        'name': attempt.athlete_entry.competition_type.exercise.name,
                        'sport_category': {
                            'name': attempt.athlete_entry.competition_type.exercise.sport_category.name
                        }
                    }
                }
            }
        }

        return jsonify({
            "success": True,
            "attempt": attempt_config
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 400


@athlete_bp.route("/next-attempt-timer")
def get_next_attempt_timer():
    """
    Return the timer information for the athlete's next pending attempt.
    """
    try:
        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"error": "Athlete not found"}), 404

        na = next_pending_attempt(athlete.id)
        if not na:
            return jsonify({"error": "No next attempt found"}), 404

        # event type and names are loaded via joins in next_pending_attempt
        event_type = None
        try:
            event_type = na.athlete_entry.competition_type.exercise.sport_category.name
        except Exception:
            pass

        lift_type = None
        try:
            lift_type = na.lift.name if na.lift else None
        except Exception:
            pass

        return jsonify(
            {
                "attempt_id": na.id,
                "time": attempt_time_remaining(na),
                "event_type": event_type,
                "lift_type": lift_type,
                "order": na.attempt_number,
                "weight": na.requested_weight,
            }
        )
    except Exception as e:
        return jsonify({"error": "Error fetching timer data", "detail": str(e)}), 500
