from flask import Blueprint, render_template, request, jsonify
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta

from ..extensions import db
from ..real_time.timer_manager import timer_manager
from ..models import (
    Athlete,
    AthleteEntry,
    Competition,
    Event,
    Flight,
    Attempt,
    AttemptResult,
    AthleteFlight,
    Score,
    TimerLog,
)

from .admin import (
    get_competitions,
    get_competition_events,
    get_event_flights,
    get_flight_athletes,
)

athlete_bp = Blueprint("athlete", __name__, url_prefix="/athlete")

# Global variable to track the current active event (in a real app, use Redis or database)
_current_active_event_id = None

# Helpers ---------------------------------------------------------------------------


def resolve_current_athlete():
    """
    Resolve the current athlete row from the DB.
    Uses the authenticated athlete ID from session.
    """
    from flask import session

    athlete_id = session.get("athlete_id")
    if not athlete_id:
        return None

    return (
        Athlete.query.options(
            joinedload(Athlete.competition),
            joinedload(Athlete.entries),
            joinedload(Athlete.flights),
        )
        .filter(Athlete.id == athlete_id)
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
            Event.competition_id == competition_id,
        )
        .order_by(Event.id.asc(), Flight.order.asc())
    )

    my_flights = []
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
            joinedload(Attempt.athlete_entry).joinedload(AthleteEntry.event)
        )
        .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
        .filter(
            AthleteEntry.athlete_id == athlete_id,
            Attempt.status != "finished",  # not completed yet
        )
        .order_by(Attempt.started_at.is_(True), Attempt.attempt_number.asc())
        .first()
    )


def attempt_time_remaining(attempt: Attempt) -> int:
    """
    Compute time remaining (seconds) for an attempt. First checks TimerManager for active timers,
    then falls back to attempt.started_at logic.
    """
    # Check if there's an active timer in TimerManager for this attempt
    competition_id = attempt.athlete_entry.event.competition_id
    athlete_id = attempt.athlete_entry.athlete_id
    attempt_timer_id = f"attempt_{attempt.id}"
    break_timer_id = f"break_athlete_{athlete_id}"

    # First check for active attempt timer
    timer_data = timer_manager.get_timer_data(competition_id, attempt_timer_id)
    if timer_data and timer_data.state.value in ["running", "paused"]:
        return timer_data.remaining

    # Check for active athlete-specific break timer
    break_timer_data = timer_manager.get_timer_data(competition_id, break_timer_id)
    if break_timer_data and break_timer_data.state.value in ["running", "paused"]:
        return break_timer_data.remaining

    # Fall back to database-based timing
    if attempt.started_at:
        time_limit = attempt.athlete_entry.attempt_time_limit or 60
        elapsed = (datetime.utcnow() - attempt.started_at).total_seconds()
        remaining = max(0, int(time_limit - elapsed))
        return remaining

    # No active timer - return None to indicate inactive
    return None


def normalize_movement_name(name):
    """
    Normalize movement name for comparison.
    """
    if not name:
        return ""
    # Convert to lowercase, replace spaces and special chars with underscore
    normalized = name.lower()
    normalized = normalized.replace(" & ", "_")
    normalized = normalized.replace("&", "_")
    normalized = normalized.replace(" ", "_")
    normalized = normalized.replace("-", "_")
    # Remove any duplicate underscores
    while "__" in normalized:
        normalized = normalized.replace("__", "_")
    normalized = normalized.strip("_")

    # Handle common variations
    # "bench_press" -> "bench"
    if normalized == "bench_press":
        normalized = "bench"
    # "clean_and_jerk" -> "clean_jerk"
    if normalized == "clean_and_jerk":
        normalized = "clean_jerk"

    return normalized


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
        if (
            isinstance(block, dict)
            and block.get("id") == event.id
            and block.get("movements")
        ):
            return list(block["movements"])

    # Name match
    ename = (event.name or "").strip().lower()
    for block in events_cfg:
        if not isinstance(block, dict):
            continue
        if (block.get("name") or "").strip().lower() == ename and block.get(
            "movements"
        ):
            return list(block["movements"])

    # Fallback: first movements block
    for block in events_cfg:
        if isinstance(block, dict) and block.get("movements"):
            return list(block["movements"])

    return []


def ensure_athlete_entries_for_event(
    athlete_id: int, event_id: int, flight_id: int = None, entry_order: int = None
):
    """
    Create one AthleteEntry per movement for (athlete_id, event_id, flight_id).
    Only creates entries for movements that match the flight's movement_type.
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
            AthleteFlight.query.join(Flight, AthleteFlight.flight_id == Flight.id)
            .filter(AthleteFlight.athlete_id == athlete_id, Flight.event_id == event_id)
            .first()
        )

        if not athlete_flight:
            raise ValueError(
                f"Athlete {athlete_id} is not assigned to any flight for event {event_id}"
            )

        flight_id = athlete_flight.flight_id
        entry_order = athlete_flight.order

    # Get the flight's movement_type to filter which movements to create
    flight = Flight.query.get(flight_id)
    flight_movement_type = flight.movement_type if flight else None

    # Normalize flight movement type for comparison
    normalized_flight_movement = (
        normalize_movement_name(flight_movement_type) if flight_movement_type else None
    )

    movements = extract_movements_for_event(event)
    created = []

    # Gather existing lift_types for this athlete+event+flight combination
    existing = {
        ae.lift_type
        for ae in AthleteEntry.query.filter_by(
            athlete_id=athlete_id, event_id=event_id, flight_id=flight_id
        ).all()
    }

    for mv in movements or []:
        mv_name = (mv.get("name") or "").strip()

        # Skip if already exists
        if not mv_name or mv_name in existing:
            continue

        # Normalize movement name for comparison
        normalized_mv_name = normalize_movement_name(mv_name)

        # Only create entry if movement matches flight's movement_type
        if (
            normalized_flight_movement
            and normalized_mv_name != normalized_flight_movement
        ):
            continue

        timer = mv.get("timer") or {}
        attempt_seconds = int(timer.get("attempt_seconds", 60))

        reps_data = mv.get("reps")

        ae = AthleteEntry(
            athlete_id=athlete_id,
            event_id=event_id,
            flight_id=flight_id,
            entry_order=entry_order,
            lift_type=mv_name,
            attempt_time_limit=attempt_seconds,
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
            # Get the flight's movement_type
            flight = Flight.query.get(flight_id)
            movement_type = flight.movement_type if flight else None

            # Determine number of attempts based on reps array length
            num_attempts = (
                len(ae.default_reps) if ae.default_reps else 3
            )  # Default to 3 attempts

            for attempt_num in range(1, num_attempts + 1):
                # Check if attempt already exists for this athlete+flight+movement+attempt_number
                existing_attempt = Attempt.query.filter_by(
                    athlete_id=athlete_id,
                    flight_id=flight_id,
                    movement_type=movement_type,
                    attempt_number=attempt_num,
                ).first()

                if not existing_attempt:
                    attempt = Attempt(
                        athlete_id=athlete_id,
                        athlete_entry_id=ae.id,
                        flight_id=flight_id,
                        movement_type=movement_type,
                        attempt_number=attempt_num,
                        requested_weight=0.0,
                        final_result=None,
                    )
                    db.session.add(attempt)

        db.session.commit()

    return created


# Views / API ---------------------------------------------------------------------------


@athlete_bp.route("/")
def athlete_dashboard():
    """Athlete dashboard - requires authentication"""
    from flask import session, redirect, url_for

    # Check if athlete is logged in
    if "athlete_id" not in session or "user_id" not in session:
        return redirect(url_for("login.login"))

    athlete_row = resolve_current_athlete()

    # If athlete not found despite session, clear session and redirect
    if not athlete_row:
        session.clear()
        return redirect(url_for("login.login"))

    # Format athlete data with configuration, providing defaults if no athlete found
    athlete_config = {
        "id": None,
        "profile": {
            "first_name": "Demo",
            "last_name": "Athlete",
            "team": "—",
            "gender": "—",
            "bodyweight": None,
            "age": None,
            "email": None,
            "phone": None,
        },
        "competition_state": {"current_attempt_number": None, "is_active": False},
        "entries": [],
    }

    if athlete_row:
        # Build full athlete configuration
        athlete_config = {
            "id": athlete_row.id,
            "profile": {
                "first_name": athlete_row.first_name,
                "last_name": athlete_row.last_name,
                "team": athlete_row.team,
                "gender": athlete_row.gender,
                "bodyweight": athlete_row.bodyweight,
                "age": athlete_row.age,
                "email": athlete_row.email,
                "phone": athlete_row.phone,
            },
            "competition_state": {"is_active": athlete_row.is_active},
            "entries": [],
        }

        # Load entries with relationships
        athlete_entries = (
            AthleteEntry.query.options(
                joinedload(AthleteEntry.event), joinedload(AthleteEntry.attempts)
            )
            .filter(AthleteEntry.athlete_id == athlete_row.id)
            .filter(AthleteEntry.is_active == True)
            .all()
        )

        # Add entry configurations
        for entry in athlete_entries:
            entry_config = {
                "id": entry.id,
                "event": {
                    "id": entry.event.id,
                    "name": entry.event.name,
                    "weight_category": entry.event.weight_category,
                    "gender": entry.event.gender,
                    "sport_type": entry.event.sport_type,
                },
                "lift_type": entry.lift_type,
                "movement_name": entry.movement_name,
                "time_limits": {"attempt": entry.attempt_time_limit},
                "opening_weights": entry.opening_weights or 0,
                # Use default_reps as maximum and reps as current athlete preference
                "reps": entry.reps or entry.default_reps,  # Current athlete preference
                "reps_display": str(entry.reps or entry.default_reps).replace(
                    " ", ""
                ),  # Clean format for display
                "reps_max": entry.default_reps,  # Maximum from competition config
                "reps_max_display": str(entry.default_reps).replace(" ", ""),
                "config": entry.entry_config or {},
                "attempts": [],
                "scores": [],
            }

            # Add attempts, include lift_name
            for attempt in sorted(entry.attempts, key=lambda x: x.attempt_number):
                entry_config["attempts"].append(
                    {
                        "id": attempt.id,
                        "attempt_number": attempt.attempt_number,
                        "requested_weight": attempt.requested_weight,
                        "actual_weight": attempt.actual_weight,
                        "status": attempt.status or "waiting",
                        "final_result": attempt.final_result,
                        "result": attempt.final_result.value
                        if attempt.final_result
                        else None,
                        "lifting_order": attempt.lifting_order,
                        "lift_name": entry.movement_name,
                    }
                )

            athlete_config["entries"].append(entry_config)

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
                "id": competition.id,
                "name": competition.name,
                "description": competition.description,
                "start_date": competition.start_date.strftime("%Y-%m-%d"),
                "is_active": competition.is_active,
                "rankings": [],  # Will populate with per-event ranking and total_score
            }

            # Populate athlete-specific rankings for the competition
            try:
                if athlete_row:
                    rankings = []
                    # Use athlete_entries loaded earlier if available
                    for entry in athlete_entries:
                        # Only consider entries that belong to this competition
                        if entry.event and entry.event.competition_id == competition.id:
                            score = Score.query.filter_by(
                                athlete_entry_id=entry.id
                            ).first()
                            # Prefer movement_name or lift_type for display
                            movement_label = (
                                entry.movement_name
                                or entry.lift_type
                                or (entry.event.name if entry.event else "Event")
                            )
                            rankings.append(
                                {
                                    "movement": movement_label,
                                    "rank": score.rank
                                    if score and score.rank is not None
                                    else None,
                                    "total_score": score.total_score
                                    if score and score.total_score is not None
                                    else 0,
                                }
                            )
                    competition_meta["rankings"] = rankings
            except Exception:
                # Fail gracefully - leave rankings empty
                competition_meta["rankings"] = competition_meta.get("rankings", [])

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
            "sport_type": event.sport_type.value if event.sport_type else None,
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
            return jsonify(
                {"success": False, "error": "Invalid event ID or weight format"}
            ), 400

        if weight <= 0:
            return jsonify({"success": False, "error": "Weight must be positive"}), 400

        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"success": False, "error": "Athlete not found"}), 404

        entry = AthleteEntry.query.filter_by(
            athlete_id=athlete.id, event_id=event_id, lift_type=lift_key
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

        # Server-side restriction: cannot update opening weight after any attempt in this event has been completed
        try:
            event = Event.query.get(event_id)
            if event:
                has_completed = (
                    db.session.query(Attempt)
                    .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
                    .filter(
                        AthleteEntry.event_id == event_id,
                        Attempt.status.in_(["in-progress", "finished"]),
                    )
                    .first()
                    is not None
                )

                if has_completed:
                    return (
                        jsonify(
                            {
                                "success": False,
                                "error": "Cannot update opening weight after event has started",
                            }
                        ),
                        403,
                    )
        except Exception:
            # On any error, allow the update to proceed (fail-open)
            pass

        entry.opening_weights = int(weight) if weight is not None else 0

        # Update the first attempt's requested weight if not yet completed
        first_attempt = next(
            (
                a
                for a in entry.attempts
                if a.attempt_number == 1 and a.status != "finished"
            ),
            None,
        )
        if first_attempt:
            first_attempt.requested_weight = weight

        db.session.commit()

        # Return updated entry configuration
        entry_config = {
            "id": entry.id,
            "opening_weights": entry.opening_weights or 0,
            "attempts": [
                {
                    "id": attempt.id,
                    "attempt_number": attempt.attempt_number,
                    "requested_weight": attempt.requested_weight,
                    "actual_weight": attempt.actual_weight,
                    "result": attempt.final_result.value
                    if attempt.final_result
                    else None,
                    "lift_name": entry.movement_name,
                    "lifting_order": attempt.lifting_order,
                }
                for attempt in sorted(entry.attempts, key=lambda x: x.attempt_number)
            ],
        }

        return jsonify({"success": True, "entry": entry_config})
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
            return jsonify(
                {"success": False, "error": "Invalid attempt ID or weight format"}
            ), 400

        if new_weight <= 0:
            return jsonify({"success": False, "error": "Weight must be positive"}), 400

        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify({"success": False, "error": "Athlete not found"}), 404

        # Load attempt with all needed relationships
        attempt = Attempt.query.options(
            joinedload(Attempt.athlete_entry).joinedload(AthleteEntry.athlete)
        ).get(attempt_id)

        if not attempt:
            return jsonify({"success": False, "error": "Attempt not found"}), 404

        # Authorize: the attempt must belong to our athlete
        if attempt.athlete_entry.athlete_id != athlete.id:
            return jsonify({"success": False, "error": "Unauthorized access"}), 403

        # Attempt must not be finalized - prioritize status field over legacy fields
        if attempt.status and attempt.status.strip():
            # Use the current status field as the authoritative source
            if attempt.status.lower() in ["finished", "success", "failed"]:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": "Cannot update a completed attempt",
                        }
                    ),
                    400,
                )
        else:
            # Fallback to legacy fields only if status field is missing or empty
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

        # Server-side timing validation
        remaining = attempt_time_remaining(attempt)
        if remaining is not None and remaining <= 180:
            minutes = remaining // 60
            seconds = remaining % 60
            return jsonify(
                {
                    "success": False,
                    "error": f"Cannot update weight with less than 3 minutes remaining. Time remaining: {minutes}:{seconds:02d}",
                }
            ), 403

        # Update weight
        attempt.requested_weight = new_weight
        db.session.commit()

        # Return updated attempt configuration
        attempt_config = {
            "id": attempt.id,
            "attempt_number": attempt.attempt_number,
            "requested_weight": attempt.requested_weight,
            "actual_weight": attempt.actual_weight,
            "result": attempt.final_result.value if attempt.final_result else None,
            "lifting_order": attempt.lifting_order,
            "entry": {"id": attempt.athlete_entry.id},
        }

        return jsonify({"success": True, "attempt": attempt_config})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 400


@athlete_bp.route("/set-active-event/<int:event_id>", methods=["POST"])
def set_active_event(event_id):
    """Set the current active event being managed by timekeeper"""
    global _current_active_event_id
    event = Event.query.get_or_404(event_id)
    _current_active_event_id = event_id

    return jsonify(
        {
            "success": True,
            "active_event": {
                "id": event.id,
                "name": event.name,
                "sport_type": event.sport_type.value if event.sport_type else None,
            },
        }
    )


@athlete_bp.route("/get-active-event")
def get_active_event():
    """Get the current active event being managed by timekeeper"""
    global _current_active_event_id

    if _current_active_event_id:
        event = Event.query.get(_current_active_event_id)
        if event:
            return jsonify(
                {
                    "active_event": {
                        "id": event.id,
                        "name": event.name,
                        "sport_type": event.sport_type.value
                        if event.sport_type
                        else None,
                    }
                }
            )

    return jsonify({"active_event": None})


def check_event_has_in_progress_attempts(event_id: int) -> bool:
    """Check if any attempt in the event is currently in-progress"""
    try:
        return (
            db.session.query(Attempt)
            .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
            .filter(AthleteEntry.event_id == event_id, Attempt.status == "in-progress")
            .first()
            is not None
        )
    except Exception:
        return False


_simple_estimate_cache = {}


def calculate_estimated_time(
    target_attempt: Attempt, competition_id: int, sport_type=None
) -> int:
    """
    Calculate estimated time until target_attempt is up.

    SIMPLIFIED LOGIC:
    1. If target attempt is currently in-progress -> return 0 (you're up now)
    2. If there's another attempt in-progress -> add its remaining time
    3. Add time for all waiting attempts that come before target in lifting order
    4. Each attempt = time_limit + 15s buffer
    5. Add break time when transitioning between flights
    """
    # print(f"\n[ESTIMATE] === Starting Calculation ===")
    # print(f"[ESTIMATE] Target: Athlete {target_attempt.athlete_entry.athlete_id}, Attempt #{target_attempt.attempt_number}, Flight {target_attempt.flight_id}")

    # Quick check: if target attempt is already in-progress, return 0
    if target_attempt.status == "in-progress":
        return 0

    if target_attempt.status == "finished":
        return 0

    if target_attempt.status != "waiting":
        return 0

    total_seconds = 0
    competition = Competition.query.get(competition_id)
    breaktime_between_flights = (
        competition.breaktime_between_flights if competition else 180
    )
    target_flight_id = target_attempt.flight_id

    # 1. CHECK FOR CURRENT IN-PROGRESS ATTEMPT
    current_attempt = get_current_in_progress_attempt(competition_id, sport_type)

    if current_attempt:
        # Add remaining time for current attempt
        remaining = attempt_time_remaining(current_attempt)
        if remaining and remaining > 0:
            total_seconds += remaining
        else:
            time_limit = current_attempt.athlete_entry.attempt_time_limit or 60
            total_seconds += time_limit

    # Get all waiting attempts for this competition
    all_waiting_attempts = get_waiting_attempts_in_order(competition_id, sport_type)
    # print(f"[ESTIMATE] Total waiting attempts found: {len(all_waiting_attempts)}")

    # Find attempts that come before target in the proper lifting order
    attempts_ahead = []
    target_found = False

    for attempt in all_waiting_attempts:
        if attempt.id == target_attempt.id:
            target_found = True
            break

        # Only include attempts from earlier flights OR same flight but before target in lifting order
        if attempt.flight_id < target_flight_id:
            # All attempts from earlier flights come first
            attempts_ahead.append(attempt)
        elif attempt.flight_id == target_flight_id:
            # Same flight - only include if it comes before target in lifting order
            attempts_ahead.append(attempt)

    if not target_found:
        print(f"[ESTIMATE] ERROR: Target attempt not found in waiting attempts!")
        print(f"[ESTIMATE] Available attempts:")
        for attempt in all_waiting_attempts:
            print(
                f"[ESTIMATE]   - Athlete {attempt.athlete_entry.athlete_id}, Attempt #{attempt.attempt_number}, Flight {attempt.flight_id}, Status: {attempt.status}"
            )
        return 0

    # 2. ADD TIME FOR ALL ATTEMPTS AHEAD
    for attempt in attempts_ahead:
        time_limit = attempt.athlete_entry.attempt_time_limit or 60
        buffer = 15
        attempt_time = time_limit + buffer
        total_seconds += attempt_time

    # 3. CACHE AND RETURN RESULT
    now = datetime.utcnow()
    cache_key = f"{competition_id}_{target_attempt.id}"
    result = max(0, int(total_seconds))

    # print(f"[ESTIMATE] Target: Athlete {target_attempt.athlete_entry.athlete_id}, Attempt #{target_attempt.attempt_number}, Flight {target_attempt.flight_id} → {len(attempts_ahead)} ahead, {result}s ({result//60}:{result%60:02d})")

    # Cache result (5 second TTL)
    _simple_estimate_cache[cache_key] = (result, now)

    # Clean old cache entries
    for key in list(_simple_estimate_cache.keys()):
        _, cache_time = _simple_estimate_cache[key]
        if (now - cache_time).total_seconds() > 10:
            del _simple_estimate_cache[key]

    return result


def get_current_in_progress_attempt(competition_id: int, sport_type=None):
    """
    Find the currently in-progress attempt for the competition.
    Optionally filter by sport_type.
    """
    query = (
        Attempt.query.join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
        .join(Event, AthleteEntry.event_id == Event.id)
        .filter(Event.competition_id == competition_id, Attempt.status == "in-progress")
    )

    if sport_type:
        query = query.filter(Event.sport_type == sport_type)

    return query.first()


def get_waiting_attempts_in_order(
    competition_id: int, sport_type=None, movement_type: str = None
):
    """
    Get all waiting attempts for a competition in lifting order.
    Optionally filter by sport_type and/or movement_type.
    """
    query = (
        Attempt.query.options(
            joinedload(Attempt.athlete_entry).joinedload(AthleteEntry.event),
            joinedload(Attempt.athlete),
        )
        .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
        .join(Event, AthleteEntry.event_id == Event.id)
        .filter(Event.competition_id == competition_id, Attempt.status == "waiting")
    )

    if sport_type:
        query = query.filter(Event.sport_type == sport_type)

    if movement_type:
        query = query.filter(Attempt.movement_type == movement_type)

    # Order by lifting_order (weight-based), then attempt number
    result = query.order_by(
        Attempt.lifting_order.asc().nullslast(),
        Attempt.requested_weight.asc(),
        Attempt.attempt_number.asc(),
    ).all()

    return result


def is_athlete_first_in_queue(attempt_id: int, athlete_id: int) -> bool:
    """
    Return True if the given attempt is currently first in the remaining queue.
    """
    try:
        attempt = Attempt.query.options(joinedload(Attempt.athlete_entry)).get(
            attempt_id
        )
        if not attempt or not attempt.athlete_entry:
            return False

        event_id = attempt.athlete_entry.event_id
        flight_id = attempt.athlete_entry.flight_id

        # Get remaining attempts in THIS FLIGHT (waiting or in-progress)
        remaining = (
            Attempt.query.join(
                AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id
            )
            .filter(
                AthleteEntry.event_id == event_id,
                AthleteEntry.flight_id == flight_id,  # Same flight only
                Attempt.status.in_(["waiting", "in-progress"]),
            )
            .order_by(
                Attempt.lifting_order.asc().nullslast(),
                Attempt.requested_weight.asc(),
                Attempt.attempt_number.asc(),
            )
            .all()
        )

        if not remaining:
            return False

        # First attempt in the queue
        first_attempt = remaining[0]

        # If there's an in-progress attempt, target must be it
        if first_attempt.status == "in-progress":
            return first_attempt.id == attempt_id

        # Otherwise, target must be the first waiting attempt
        return first_attempt.id == attempt_id

    except Exception as e:
        print(f"[ERROR] is_athlete_first_in_queue: {e}")
        return False


def find_next_attempt_for_athlete(
    athlete_id: int, sport_type=None, prefer_movement: str = None
):
    """
    Find the next pending attempt for this athlete.
    Priority:
    1. In-progress attempt (return immediately - "You are up")
    2. Next waiting attempt in preferred_movement
    3. Next waiting attempt in any movement (same sport_type)
    """
    # Check for in-progress attempt first
    in_progress = (
        Attempt.query.options(
            joinedload(Attempt.athlete_entry).joinedload(AthleteEntry.event)
        )
        .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
        .join(Event, AthleteEntry.event_id == Event.id)
        .filter(AthleteEntry.athlete_id == athlete_id, Attempt.status == "in-progress")
    )

    if sport_type:
        in_progress = in_progress.filter(Event.sport_type == sport_type)

    attempt = in_progress.first()
    if attempt:
        return attempt, "in-progress"

    # Look for waiting attempts
    waiting_query = (
        Attempt.query.options(
            joinedload(Attempt.athlete_entry).joinedload(AthleteEntry.event)
        )
        .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
        .join(Event, AthleteEntry.event_id == Event.id)
        .filter(AthleteEntry.athlete_id == athlete_id, Attempt.status == "waiting")
    )

    if sport_type:
        waiting_query = waiting_query.filter(Event.sport_type == sport_type)

    # Try preferred movement first
    if prefer_movement:
        same_movement = (
            waiting_query.filter(Attempt.movement_type == prefer_movement)
            .order_by(Attempt.attempt_number.asc())
            .first()
        )

        if same_movement:
            return same_movement, "waiting-same-movement"

    # Fallback to any waiting attempt
    any_waiting = waiting_query.order_by(Attempt.attempt_number.asc()).first()
    if any_waiting:
        return any_waiting, "waiting-other-movement"

    return None, "none"


@athlete_bp.route("/next-attempt-timer")
def get_next_attempt_timer():
    """
    Return timer information for athlete's next attempt.

    - Shows countdown for first attempt of flight (even if first in queue)
    - After countdown expires, transitions to "YOU ARE UP"
    - For subsequent attempts, shows "YOU ARE UP" immediately when first in queue
    """
    try:
        athlete = resolve_current_athlete()
        if not athlete:
            return jsonify(
                {
                    "error": "Athlete not found",
                    "no_attempts": True,
                    "message": "No athlete logged in",
                    "time": None,
                    "timer_active": False,
                    "timer_type": "inactive",
                }
            ), 404

        # Get current context
        current_event_id = request.args.get("event_id", type=int)
        current_sport_type = None
        competition_id = None

        if not current_event_id:
            global _current_active_event_id
            current_event_id = _current_active_event_id

        if current_event_id:
            current_event = Event.query.get(current_event_id)
            if current_event:
                current_sport_type = current_event.sport_type
                competition_id = current_event.competition_id

        if not competition_id and athlete.competition_id:
            competition_id = athlete.competition_id

        # Determine preferred movement
        prefer_movement = None
        most_recent = (
            Attempt.query.join(
                AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id
            )
            .filter(
                AthleteEntry.athlete_id == athlete.id,
                Attempt.status.in_(["in-progress", "finished"]),
            )
            .order_by(
                Attempt.started_at.desc().nullslast(),
                Attempt.completed_at.desc().nullslast(),
                Attempt.id.desc(),
            )
            .first()
        )

        if most_recent:
            prefer_movement = most_recent.movement_type

        # Find athlete's next attempt
        next_attempt, attempt_status = find_next_attempt_for_athlete(
            athlete.id, current_sport_type, prefer_movement
        )

        # PRIORITY CHECK: Active event break timer (check even if no attempts left)
        # If there's an active event break timer running, show it regardless of other conditions
        try:
            import json
            from pathlib import Path

            state_file = (
                Path(__file__).parent.parent.parent / "instance" / "timer_state.json"
            )
            if state_file.exists():
                with open(state_file, "r") as f:
                    timer_state = json.load(f)

                # Check if there's an active break timer (both flight and event breaks)
                break_running = timer_state.get("break_timer_running", False)
                break_seconds = timer_state.get("break_timer_seconds", 0)
                break_type = timer_state.get("break_timer_type", "")

                # Show both flight and event break timers explicitly
                if break_running and break_seconds > 0:
                    if break_type == "Event Break":
                        timer_type = "break_between_events"
                        lift_type_display = "Event Break"
                    elif break_type == "Flight Break":
                        timer_type = "break_between_flights"
                        lift_type_display = "Flight Break"
                    else:
                        # Fallback for other break types
                        timer_type = "break_between_flights"
                        lift_type_display = "Break"

                    # Create a base response for break timer (no attempt info needed)
                    base_response = {
                        "attempt_id": None,
                        "status": "waiting",
                        "event": None,
                        "lift_type": lift_type_display,
                        "order": None,
                        "weight": None,
                        "sport_type": current_sport_type.value
                        if current_sport_type
                        else None,
                        "is_first_in_queue": False,
                        "is_first_of_flight": False,
                        "has_completed_attempts": False,
                        "has_in_progress_attempts": False,
                        "no_attempts": False,
                        "time": int(break_seconds),
                        "timer_active": True,
                        "timer_type": timer_type,
                    }
                    return jsonify(base_response)
        except Exception as e:
            print(f"[DEBUG] Error checking break timer state: {e}")

        if not next_attempt:
            message = f"No attempts left"
            if current_sport_type:
                message += f" for {current_sport_type.value}"

            return jsonify(
                {
                    "no_attempts": True,
                    "message": message,
                    "time": None,
                    "timer_active": False,
                    "timer_type": "inactive",
                    "sport_type": current_sport_type.value
                    if current_sport_type
                    else None,
                }
            )

        # Get event and movement info
        event = next_attempt.athlete_entry.event
        movement_name = next_attempt.athlete_entry.movement_name

        # Check if first in FLIGHT queue
        try:
            is_first = is_athlete_first_in_queue(next_attempt.id, athlete.id)
        except Exception:
            is_first = False

        # Check if this is the first attempt of the flight
        try:
            is_first_of_flight = is_first_attempt_of_flight(next_attempt)
        except Exception:
            is_first_of_flight = False

        # Check for completed/in-progress attempts
        try:
            has_completed = (
                db.session.query(Attempt)
                .join(AthleteEntry, Attempt.athlete_entry_id == AthleteEntry.id)
                .filter(AthleteEntry.event_id == event.id, Attempt.status == "finished")
                .first()
                is not None
            )
        except Exception:
            has_completed = False

        try:
            has_in_progress = check_event_has_in_progress_attempts(event.id)
        except Exception:
            has_in_progress = False

        # Build base response
        base_response = {
            "attempt_id": next_attempt.id,
            "status": attempt_status,
            "event": {
                "id": event.id,
                "name": event.name,
                "sport_type": event.sport_type.value if event.sport_type else None,
                "category": event.weight_category,
                "gender": event.gender,
            },
            "lift_type": movement_name,
            "order": next_attempt.attempt_number,
            "weight": next_attempt.requested_weight,
            "sport_type": current_sport_type.value if current_sport_type else None,
            "is_first_in_queue": is_first,
            "is_first_of_flight": is_first_of_flight,
            "has_completed_attempts": has_completed,
            "has_in_progress_attempts": has_in_progress,
            "no_attempts": False,
        }

        # PRIORITY 1: In-progress attempt -> YOU ARE UP
        if attempt_status == "in-progress":
            base_response.update(
                {"time": 0, "timer_active": True, "timer_type": "you-are-up"}
            )
            return jsonify(base_response)

        # PRIORITY 2: First in queue -> YOU ARE UP
        if is_first:
            base_response.update(
                {"time": 0, "timer_active": True, "timer_type": "you-are-up"}
            )
            return jsonify(base_response)

        # PRIORITY 3: Calculate estimate for waiting attempt
        estimated_seconds = calculate_estimated_time(
            next_attempt, competition_id, current_sport_type
        )

        # If estimate is 0, athlete is up next
        if estimated_seconds == 0:
            base_response.update(
                {"time": 0, "timer_active": True, "timer_type": "you-are-up"}
            )
            return jsonify(base_response)

        # Return countdown estimate
        base_response.update(
            {"time": estimated_seconds, "timer_active": True, "timer_type": "estimate"}
        )
        return jsonify(base_response)

    except Exception as e:
        print(f"[ERROR] next_attempt_timer: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify(
            {
                "error": str(e),
                "no_attempts": True,
                "message": "Error fetching attempt details",
                "time": None,
                "timer_active": False,
                "timer_type": "error",
            }
        ), 500


def is_last_attempt_in_flight(attempt: Attempt, competition_id: int) -> bool:
    """
    Check if this attempt is the last remaining attempt in its flight.
    This means after this attempt finishes, the flight is complete.
    """
    try:
        flight_id = attempt.flight_id

        # Count how many attempts are still waiting in this flight
        # Don't count in-progress or finished attempts
        remaining_waiting = Attempt.query.filter(
            Attempt.flight_id == flight_id, Attempt.status == "waiting"
        ).count()

        # If no waiting attempts remain, this in-progress attempt is the last
        return remaining_waiting == 0

    except Exception as e:
        print(f"[ERROR] is_last_attempt_in_flight: {e}")
        return False


def is_first_attempt_of_flight(attempt: Attempt) -> bool:
    """
    Check if this attempt is the first attempt in its flight.
    Returns True if:
    1. No attempts in this flight have been completed yet, OR
    2. No attempts in the entire competition have been completed (very first attempt)
    """
    try:
        flight_id = attempt.flight_id

        # Check if any attempts in THIS flight have been completed
        completed_in_flight = Attempt.query.filter(
            Attempt.flight_id == flight_id, Attempt.status == "finished"
        ).count()

        # If no completed attempts in this flight, it's the first attempt of this flight
        if completed_in_flight == 0:
            return True

        return False

    except Exception as e:
        print(f"[ERROR] is_first_attempt_of_flight: {e}")
        return False


@athlete_bp.route("/timer/start-attempt/<int:attempt_id>", methods=["POST"])
def start_attempt_timer(attempt_id):
    """
    Start an attempt timer (called by timekeeper)
    """
    try:
        attempt = Attempt.query.options(
            joinedload(Attempt.athlete_entry).joinedload(AthleteEntry.event)
        ).get_or_404(attempt_id)

        competition_id = attempt.athlete_entry.event.competition_id
        time_limit = attempt.athlete_entry.attempt_time_limit or 60

        # Create/start timer in TimerManager
        timer_id = f"attempt_{attempt_id}"

        def timer_callback(timer_data):
            from ..real_time.websocket import competition_realtime

            competition_realtime.broadcast_timer_update(
                competition_id,
                {
                    "timer_id": timer_data.timer_id,
                    "remaining": timer_data.remaining,
                    "state": timer_data.state.value,
                    "type": timer_data.type,
                },
            )

        timer_manager.create_timer(
            competition_id, timer_id, time_limit, "attempt", timer_callback
        )
        timer_manager.start_timer(competition_id, timer_id)

        # Also update attempt.started_at for database consistency
        attempt.started_at = datetime.utcnow()
        db.session.commit()

        return jsonify({"success": True, "timer_id": timer_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@athlete_bp.route("/timer/control/<int:competition_id>/<timer_id>", methods=["POST"])
def control_timer(competition_id, timer_id):
    """
    Control timer (pause/resume/stop/reset)
    """
    try:
        data = request.get_json() or {}
        action = data.get("action")  # pause, resume, stop, reset

        success = False
        if action == "pause":
            success = timer_manager.pause_timer(competition_id, timer_id)
        elif action == "resume":
            success = timer_manager.start_timer(
                competition_id, timer_id
            )  # start also resumes
        elif action == "stop":
            success = timer_manager.stop_timer(competition_id, timer_id)
        elif action == "reset":
            new_duration = data.get("duration")
            success = timer_manager.reset_timer(competition_id, timer_id, new_duration)

        if success:
            # Broadcast update
            timer_data = timer_manager.get_timer_data(competition_id, timer_id)
            if timer_data:
                from ..real_time.websocket import competition_realtime

                competition_realtime.broadcast_timer_update(
                    competition_id,
                    {
                        "timer_id": timer_data.timer_id,
                        "remaining": timer_data.remaining,
                        "state": timer_data.state.value,
                        "type": timer_data.type,
                    },
                )

        return jsonify({"success": success, "action": action})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
