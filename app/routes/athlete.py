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
    AthleteFlight
)

from .admin import (
    get_competitions,
    get_competition_events,
    get_event_flights,
    get_flight_athletes,
)

athlete_bp = Blueprint("athlete", __name__, url_prefix="/athlete")

# Helpers ---------------------------------------------------------------------------

def resolve_current_athlete():
    """
    Resolve the current athlete row from the DB.
    This would use the authenticated user's email.
    """
    # Mock user login data - in production this would come from session/auth
    mock_user_email = "harry@email.com"
    
    return (
        Athlete.query.options(
            joinedload(Athlete.competition),
            joinedload(Athlete.entries),
            joinedload(Athlete.flights)
        )
        .filter(Athlete.email == mock_user_email)
        .first()
    )


def get_my_flights(athlete_id, competition_id):
    """
    Return a list of flights (with event/competition info) the athlete is assigned to
    """
    # Direct database query is more efficient than multiple API calls
    q = (
        db.session.query(Flight, Event)
        .join(Event, Flight.event_id == Event.id)
        .join(AthleteFlight, AthleteFlight.flight_id == Flight.id)
        .filter(
            AthleteFlight.athlete_id == athlete_id,
            Event.competition_id == competition_id
        )
        .order_by(Event.id.asc(), Flight.order.asc())
    )
    
    my_flights = []
    for flight, event in q.all():
        my_flights.append({
            "flight_id": flight.id,
            "flight_name": flight.name,
            "flight_order": flight.order,
            "event_id": event.id,
            "event_name": event.name,
        })

    return my_flights


def next_pending_attempt(athlete_id):
    """
    Find the athlete's next pending attempt across all entries.
    Returns an Attempt row with relationships loaded, or None.
    """
    return (
        Attempt.query.options(
            joinedload(Attempt.athlete_entry).joinedload(AthleteEntry.event)
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
    Compute time remaining (seconds) for an attempt based on the entry's attempt_time_limit
    and when the attempt started (if started_at is set). If not started, return the full limit.
    """
    # Get time limit from athlete entry
    time_limit = attempt.athlete_entry.attempt_time_limit or 60

    if attempt.started_at:
        elapsed = (datetime.utcnow() - attempt.started_at).total_seconds()
        remaining = max(0, int(time_limit - elapsed))
    else:
        remaining = int(time_limit)

    return remaining

def extract_movements_for_event(event):
    """
    Extract movement definitions for the given event from event.competition.config.
    """
    comp = event.competition
    if not comp or not isinstance(getattr(comp, "config", None), dict):
        return []

    cfg = comp.config or {}
    events_cfg = cfg.get("events") or []
    if not isinstance(events_cfg, list):
        return []

    # ID match
    for block in events_cfg:
        if isinstance(block, dict) and block.get("id") == event.id and block.get("movements"):
            return list(block["movements"])

    # Name match
    ename = (event.name or "").strip().lower()
    for block in events_cfg:
        if not isinstance(block, dict):
            continue
        if (block.get("name") or "").strip().lower() == ename and block.get("movements"):
            return list(block["movements"])

    # Fallback: first movements block
    for block in events_cfg:
        if isinstance(block, dict) and block.get("movements"):
            return list(block["movements"])

    return []


def ensure_athlete_entries_for_event(athlete_id: int, event_id: int, flight_id: int = None, entry_order: int = None):
    """
    Create one AthleteEntry per movement for (athlete_id, event_id).
    """

    event = (
        Event.query.options(joinedload(Event.competition))
        .filter_by(id=event_id)
        .first()
    )
    if not event:
        raise ValueError(f"Event {event_id} not found")

    # If flight info not provided, try to find it
    if flight_id is None or entry_order is None:
        # Find the athlete's flight assignment for this event
        athlete_flight = (
            AthleteFlight.query
            .join(Flight, AthleteFlight.flight_id == Flight.id)
            .filter(
                AthleteFlight.athlete_id == athlete_id,
                Flight.event_id == event_id
            )
            .first()
        )
        
        if not athlete_flight:
            raise ValueError(f"Athlete {athlete_id} is not assigned to any flight for event {event_id}")
        
        flight_id = athlete_flight.flight_id
        entry_order = athlete_flight.order

    movements = extract_movements_for_event(event)
    created = []

    # Gather existing lift_types for this athlete+event
    existing = {
        ae.lift_type
        for ae in AthleteEntry.query.filter_by(athlete_id=athlete_id, event_id=event_id).all()
    }

    for mv in movements or []:
        mv_name = (mv.get("name") or "").strip()
        if not mv_name or mv_name in existing:
            continue
        timer = mv.get("timer") or {}
        attempt_seconds = int(timer.get("attempt_seconds", 60))
        break_seconds = int(timer.get("break_seconds", 120))
        
        reps_data = mv.get("reps")

        ae = AthleteEntry(
            athlete_id=athlete_id,
            event_id=event_id,
            flight_id=flight_id,
            entry_order=entry_order,
            lift_type=mv_name,
            attempt_time_limit=attempt_seconds,
            break_time=break_seconds,
            default_reps=reps_data,  # Store default reps directly
            reps=reps_data,
            entry_config=mv,
        )
        db.session.add(ae)
        created.append(ae)

    if created:
        db.session.commit()
        
        # Create Attempt records for each AthleteEntry
        for ae in created:
            # Determine number of attempts based on reps array length
            num_attempts = len(ae.default_reps)
            
            for attempt_num in range(1, num_attempts + 1):
                attempt = Attempt(
                    athlete_id=athlete_id,
                    athlete_entry_id=ae.id,
                    attempt_number=attempt_num,
                    requested_weight=0.0,
                    final_result=None
                )
                db.session.add(attempt)
        
        db.session.commit()

    return created

# Views / API ---------------------------------------------------------------------------

@athlete_bp.route("/")
def athlete_dashboard():

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
                # 'current_attempt_number': athlete_row.current_attempt_number,   # NEED TO CHANGE: GET FROM ATTEMPT TABLE
                'is_active': athlete_row.is_active
            },
            'entries': []
        }

        # Load entries with relationships
        athlete_entries = (
            AthleteEntry.query
            .options(
                joinedload(AthleteEntry.event),
                joinedload(AthleteEntry.attempts)
            )
            .filter(AthleteEntry.athlete_id == athlete_row.id)
            .filter(AthleteEntry.is_active == True)
            .all()
        )

        # Add entry configurations
        for entry in athlete_entries:
            entry_config = {
                'id': entry.id,
                'event': {
                    'id': entry.event.id,
                    'name': entry.event.name,
                    'weight_category': entry.event.weight_category,
                    'gender': entry.event.gender
                },
                'lift_type': entry.lift_type,
                'movement_name': entry.movement_name,
                'time_limits': {
                    'attempt': entry.attempt_time_limit,
                    'break': entry.break_time
                },
                'opening_weights': entry.opening_weights or 0,
                # Use default_reps as maximum and reps as current athlete preference
                'reps': entry.reps or entry.default_reps,  # Current athlete preference
                'reps_display': str(entry.reps or entry.default_reps).replace(' ', ''),  # Clean format for display
                'reps_max': entry.default_reps,  # Maximum from competition config
                'reps_max_display': str(entry.default_reps).replace(' ', ''),
                'config': entry.entry_config or {},
                'attempts': [],
                'scores': []
            }

            # Add attempts, include lift_name
            for attempt in sorted(entry.attempts, key=lambda x: x.attempt_number):
                entry_config['attempts'].append({
                    'id': attempt.id,
                    'number': attempt.attempt_number,
                    'requested_weight': attempt.requested_weight,
                    'actual_weight': attempt.actual_weight,
                    'result': attempt.final_result.value if attempt.final_result else None,
                    'lifting_order': attempt.lifting_order,
                    'lift_name': entry.movement_name
                })

            athlete_config['entries'].append(entry_config)

    # Decide which competition to show
    competition_id = None
    competition_meta = None

    if athlete_row and athlete_row.competition_id:
        competition_id = athlete_row.competition_id
    else:
        # Fallback to the most recent competition
        comps_resp = get_competitions()
        comps = comps_resp.get_json() if hasattr(comps_resp, "get_json") else []
        if comps:
            competition_id = comps[-1]["id"]

    if competition_id:
        # Load competition directly from database
        competition = Competition.query.get(competition_id)
        if competition:
            competition_meta = {
                'id': competition.id,
                'name': competition.name,
                'description': competition.description,
                'start_date': competition.start_date.strftime('%Y-%m-%d'),
                'sport_type': competition.sport_type.value if competition.sport_type else None,
                'is_active': competition.is_active,
                'rankings': []  # Add rankings if needed
            }


    my_flights = []
    if competition_id and athlete_row:
        my_flights = get_my_flights(athlete_row.id, competition_id)

    # Next attempt preview
    next_attempt = next_pending_attempt(athlete_row.id) if athlete_row else None
    next_attempt_view = None
    if next_attempt:
        entry = next_attempt.athlete_entry
        event = entry.event
        next_attempt_view = {
            "attempt_id": next_attempt.id,
            "attempt_number": next_attempt.attempt_number,
            "requested_weight": next_attempt.requested_weight,
            "event_name": event.name,
            "event_category": event.weight_category,
            "event_gender": event.gender,
            "lift_type": entry.lift_type,
            "time": attempt_time_remaining(next_attempt),

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
    Expected form/body: event_id, lift_key, weight
    """
    try:
        # Get and validate form data
        event_id_str = request.form.get("event_id")
        lift_key = (request.form.get("lift_key") or "").strip()
        weight_str = request.form.get("weight")

        # Input validation
        if not event_id_str:
            return jsonify({"success": False, "error": "Event ID is required"}), 400
        if not lift_key:
            return jsonify({"success": False, "error": "Lift key is required"}), 400
        if not weight_str:
            return jsonify({"success": False, "error": "Weight is required"}), 400

        try:
            event_id = int(event_id_str)
            weight = float(weight_str)
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Invalid event ID or weight format"}), 400

        if weight <= 0:
            return jsonify({"success": False, "error": "Weight must be positive"}), 400

        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"success": False, "error": "Athlete not found"}), 404

        entry = AthleteEntry.query.filter_by(
            athlete_id=athlete.id,
            event_id=event_id,
            lift_type=lift_key
        ).first()

        if not entry:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": f"Athlete is not entered in this event for lift type '{lift_key}'",
                    }
                ),
                404,
            )

        entry.opening_weights = int(weight) if weight is not None else 0

        # Update the first attempt's requested weight if not yet completed
        first_attempt = next(
            (a for a in entry.attempts 
             if a.attempt_number == 1 and a.final_result is None),
            None
        )
        if first_attempt:
            first_attempt.requested_weight = weight

        db.session.commit()

        # Return updated entry configuration
        entry_config = {
            'id': entry.id,
            'opening_weights': entry.opening_weights or 0,
            'attempts': [
                {
                    'id': attempt.id,
                    'number': attempt.attempt_number,
                    'requested_weight': attempt.requested_weight,
                    'actual_weight': attempt.actual_weight,
                    'result': attempt.final_result.value if attempt.final_result else None,
                    'lift_name': entry.movement_name,
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


@athlete_bp.route("/update-reps", methods=["POST"])
def update_reps():
    """
    Update reps preference for the athlete for a given lift/exercise.
    Expected form/body: event_id, lift_key, reps (as JSON array string like '[1,1,1]')
    """
    try:
        import json
        
        event_id = int(request.form.get("event_id"))
        lift_key = (request.form.get("lift_key") or "").strip()
        reps_input = (request.form.get("reps") or "").strip()

        # Input validation
        if not lift_key:
            return jsonify({"success": False, "error": "Lift key is required"}), 400
        if not reps_input:
            return jsonify({"success": False, "error": "Reps input is required"}), 400

        # Parse reps array from string input
        try:
            # Handle both array format [1,1,1] and comma-separated format 1,1,1
            if reps_input.startswith('[') and reps_input.endswith(']'):
                reps_array = json.loads(reps_input)
            else:
                # Parse comma-separated values
                reps_array = [int(x.strip()) for x in reps_input.split(',')]
        except (json.JSONDecodeError, ValueError) as e:
            return jsonify({"success": False, "error": "Invalid reps format. Use [1,1,1] or 1,1,1"}), 400

        # Validate reps array
        if not isinstance(reps_array, list) or len(reps_array) == 0:
            return jsonify({"success": False, "error": "Reps must be a non-empty array"}), 400
        
        if not all(isinstance(x, int) and x > 0 for x in reps_array):
            return jsonify({"success": False, "error": "All reps must be positive integers"}), 400

        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"success": False, "error": "Athlete not found"}), 404

        # Find entry by event_id and lift_type (which should match lift_key)
        entry = AthleteEntry.query.filter_by(
            athlete_id=athlete.id,
            event_id=event_id,
            lift_type=lift_key
        ).first()

        if not entry:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": f"Athlete is not entered in this event for lift type '{lift_key}'",
                    }
                ),
                404,
            )

        # Get maximum reps from the default_reps field (from competition config)
        max_reps = entry.default_reps
        
        # Validate against the pre-defined reps structure
        if len(reps_array) != len(max_reps):
            return jsonify({
                "success": False, 
                "error": f"Must specify {len(max_reps)} attempts"
            }), 400
            
        # Validate each attempt doesn't exceed the pre-defined maximum
        for i, (requested, max_allowed) in enumerate(zip(reps_array, max_reps)):
            if requested > max_allowed:
                return jsonify({
                    "success": False,
                    "error": f"Attempt {i+1}: requested {requested} reps exceeds maximum {max_allowed}"
                }), 400

        entry.reps = reps_array
        db.session.commit()

        # Return updated entry configuration
        entry_config = {
            'id': entry.id,
            'reps': entry.reps,
            'reps_display': str(entry.reps).replace(' ', ''),
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
    Update the requested_weight of a specific attempt
    """
    try:
        # Get and validate form data
        attempt_id_str = request.form.get("attempt_id")
        weight_str = request.form.get("weight")

        # Input validation
        if not attempt_id_str:
            return jsonify({"success": False, "error": "Attempt ID is required"}), 400
        if not weight_str:
            return jsonify({"success": False, "error": "Weight is required"}), 400

        try:
            attempt_id = int(attempt_id_str)
            new_weight = float(weight_str)
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Invalid attempt ID or weight format"}), 400

        if new_weight <= 0:
            return jsonify({"success": False, "error": "Weight must be positive"}), 400

        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"success": False, "error": "Athlete not found"}), 404

        # Load attempt with all needed relationships
        attempt = Attempt.query.options(
            joinedload(Attempt.athlete_entry)
            .joinedload(AthleteEntry.athlete)
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
            'lifting_order': attempt.lifting_order,
            # 'time_remaining': attempt_time_remaining(attempt), #CHANGE THIS: REFER FROM TIMEKEEPER
            'entry': {
                'id': attempt.athlete_entry.id
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

        # Get event and lift information from the athlete entry
        try:
            event = na.athlete_entry.event
            movement_name = na.athlete_entry.movement_name
        except Exception:
            event = None
            movement_name = 'Unknown'

        return jsonify({
            "attempt_id": na.id,
            "time": attempt_time_remaining(na),
            "event": {
                "name": event.name,
                "category": event.weight_category,
                "gender": event.gender
            } if event else None,
            "lift_type": movement_name,
            "order": na.attempt_number,
            "weight": na.requested_weight,
        })
    except Exception as e:
        return jsonify({"error": "Error fetching timer data", "detail": str(e)}), 500