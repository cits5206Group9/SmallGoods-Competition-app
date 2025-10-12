from flask import Blueprint, render_template, request, jsonify
from ..extensions import db
from ..models import (
    Competition,
    Event,
    Athlete,
    AthleteFlight,
    Flight,
    Attempt,
    AthleteEntry,
    Score,
)
from sqlalchemy.orm import joinedload

display_bp = Blueprint("display", __name__, url_prefix="/display")


@display_bp.route("/")
def display_index():
    return render_template("display/selection.html")


@display_bp.route("/competition")
def display_competition():
    # Get competition data
    competitions = Competition.query.filter_by(is_active=True).all()
    selected_competition_id = request.args.get("competition_id")

    competition = None
    events = []
    athletes = []
    show_error = False

    if selected_competition_id:
        competition = Competition.query.get(selected_competition_id)
        if competition:
            events = Event.query.filter_by(competition_id=competition.id).all()
            athletes_query = Athlete.query.filter_by(
                competition_id=competition.id, is_active=True
            ).all()
            # Convert athletes to dictionaries for JSON serialization
            athletes = []
            for athlete in athletes_query:
                athletes.append(
                    {
                        "id": athlete.id,
                        "name": f"{athlete.first_name} {athlete.last_name}".strip(),
                        "team": getattr(athlete, "team", ""),
                        "weight_class": getattr(athlete, "weight_class", ""),
                        "is_active": athlete.is_active,
                    }
                )
        else:
            # Competition with specified ID not found
            show_error = True
    elif competitions:
        # Default to first active competition
        competition = competitions[0]
        events = Event.query.filter_by(competition_id=competition.id).all()
        athletes_query = Athlete.query.filter_by(
            competition_id=competition.id, is_active=True
        ).all()
        # Convert athletes to dictionaries for JSON serialization
        athletes = []
        for athlete in athletes_query:
            athletes.append(
                {
                    "id": athlete.id,
                    "name": f"{athlete.first_name} {athlete.last_name}".strip(),
                    "team": getattr(athlete, "team", ""),
                    "weight_class": getattr(athlete, "weight_class", ""),
                    "is_active": athlete.is_active,
                }
            )

    return render_template(
        "display/competition.html",
        competition=competition,
        competitions=competitions,
        events=events,
        athletes=athletes,
        show_error=show_error,
    )


@display_bp.route("/datatable")
def display_datatable():
    return render_template("display/datatable.html")


@display_bp.route("/debug")
def debug_report():
    competition_id = request.args.get("competition_id", "Unknown")
    error_type = request.args.get("error", "Unknown error")

    debug_info = {
        "competition_id": competition_id,
        "error_type": error_type,
        "timestamp": request.args.get("timestamp", "Not provided"),
        "user_agent": request.headers.get("User-Agent", "Not available"),
        "referrer": request.referrer or "Direct access",
        "available_competitions": Competition.query.filter_by(is_active=True).count(),
    }

    return render_template("display/debug.html", debug_info=debug_info)


@display_bp.route("/api/competition/<int:competition_id>/info")
def get_competition_info(competition_id):
    """API endpoint to get competition information with events and athletes"""
    competition = Competition.query.get(competition_id)

    if not competition:
        return jsonify(
            {
                "success": False,
                "error": "Competition not found",
                "competition_id": competition_id,
            }
        ), 404

    # Get events for this competition
    events = Event.query.filter_by(competition_id=competition_id).all()

    # Get athletes for this competition
    athletes_query = Athlete.query.filter_by(
        competition_id=competition_id, is_active=True
    ).all()

    # Prepare response data
    response_data = {
        "success": True,
        "competition": {
            "id": competition.id,
            "name": competition.name,
            "is_active": competition.is_active,
        },
        "events": [{"id": event.id, "name": event.name} for event in events],
        "athletes": [
            {
                "id": athlete.id,
                "name": f"{athlete.first_name} {athlete.last_name}".strip(),
                "team": getattr(athlete, "team", ""),
                "is_active": athlete.is_active,
            }
            for athlete in athletes_query
        ],
        "summary": {
            "events_count": len(events),
            "athletes_count": len(athletes_query),
            "has_events": len(events) > 0,
            "has_athletes": len(athletes_query) > 0,
        },
    }

    return jsonify(response_data)


@display_bp.route("/api/competition/state")
def get_default_competition_state():
    """API endpoint to get competition state for first active competition"""
    try:
        # Get first active competition
        competition = Competition.query.filter_by(is_active=True).first()
        if not competition:
            return jsonify(
                {"success": False, "error": "No active competitions found"}
            ), 404

        return get_competition_state(competition.id)
    except Exception as e:
        return jsonify(
            {
                "success": False,
                "error": f"Failed to get default competition state: {str(e)}",
            }
        ), 500


@display_bp.route("/api/competition/<int:competition_id>/state")
def get_competition_state(competition_id):
    """API endpoint to get current competition state with in-progress and waiting attempts"""
    from ..models import Attempt, AthleteEntry

    try:
        competition = Competition.query.get(competition_id)
        if not competition:
            return jsonify({"success": False, "error": "Competition not found"}), 404

        # Get current in-progress attempt
        current_attempt_query = (
            db.session.query(Attempt)
            .join(AthleteEntry)
            .join(Athlete)
            .filter(
                Athlete.competition_id == competition_id,
                Attempt.status == "in-progress",
            )
            .options(joinedload(Attempt.athlete), joinedload(Attempt.athlete_entry))
            .first()
        )

        current_attempt_data = None
        if current_attempt_query:
            current_attempt_data = {
                "id": current_attempt_query.id,
                "athlete": {
                    "id": current_attempt_query.athlete.id,
                    "name": f"{current_attempt_query.athlete.first_name} {current_attempt_query.athlete.last_name}".strip(),
                    "team": current_attempt_query.athlete.team or "No Team",
                },
                "weight": current_attempt_query.requested_weight,
                "attempt_number": current_attempt_query.attempt_number,
                "movement": current_attempt_query.movement_type or "Unknown Movement",
                "lift_type": current_attempt_query.athlete_entry.lift_type
                if current_attempt_query.athlete_entry
                else "Unknown",
            }

        # Get waiting attempts, prioritizing same movement type
        waiting_attempts_query = (
            db.session.query(Attempt)
            .join(AthleteEntry)
            .join(Athlete)
            .filter(
                Athlete.competition_id == competition_id, Attempt.status == "waiting"
            )
            .options(joinedload(Attempt.athlete), joinedload(Attempt.athlete_entry))
            .order_by(Attempt.lifting_order.asc())
            .all()
        )

        # Organize waiting attempts by movement type
        current_movement = (
            current_attempt_data["movement"] if current_attempt_data else None
        )
        same_movement_attempts = []
        other_movement_attempts = []

        for attempt in waiting_attempts_query:
            attempt_data = {
                "id": attempt.id,
                "athlete": {
                    "id": attempt.athlete.id,
                    "name": f"{attempt.athlete.first_name} {attempt.athlete.last_name}".strip(),
                    "team": attempt.athlete.team or "No Team",
                },
                "weight": attempt.requested_weight,
                "attempt_number": attempt.attempt_number,
                "movement": attempt.movement_type or "Unknown Movement",
                "lift_type": attempt.athlete_entry.lift_type
                if attempt.athlete_entry
                else "Unknown",
                "lifting_order": attempt.lifting_order or 0,
            }

            if current_movement and attempt.movement_type == current_movement:
                same_movement_attempts.append(attempt_data)
            else:
                other_movement_attempts.append(attempt_data)

        # Combine with priority: same movement first, then others
        next_attempts = same_movement_attempts + other_movement_attempts

        # Get total athlete count for this competition
        athlete_count = Athlete.query.filter_by(
            competition_id=competition_id, is_active=True
        ).count()

        return jsonify(
            {
                "success": True,
                "current_attempt": current_attempt_data,
                "next_attempts": next_attempts[:10],  # Limit to 10 for display
                "waiting_attempts": next_attempts,  # All waiting attempts
                "athlete_count": athlete_count,
                "has_current_attempt": current_attempt_data is not None,
                "waiting_count": len(next_attempts),
            }
        )

    except Exception as e:
        return jsonify(
            {"success": False, "error": f"Failed to get competition state: {str(e)}"}
        ), 500


@display_bp.route("/api/competition/<int:competition_id>/rankings")
def get_competition_rankings(competition_id):
    """API endpoint to get current rankings for competition"""
    from ..models import Score, AthleteEntry

    try:
        competition = Competition.query.get(competition_id)
        if not competition:
            return jsonify({"success": False, "error": "Competition not found"}), 404

        # Get rankings from Score table or calculate from attempts
        rankings_query = (
            db.session.query(Score)
            .join(AthleteEntry)
            .join(Athlete)
            .filter(Athlete.competition_id == competition_id)
            .options(joinedload(Score.athlete_entry).joinedload(AthleteEntry.athlete))
            .order_by(Score.rank.asc(), Score.total_score.desc())
            .all()
        )

        rankings_data = []
        for i, score in enumerate(rankings_query):
            rankings_data.append(
                {
                    "rank": score.rank or (i + 1),
                    "athlete": {
                        "id": score.athlete_entry.athlete.id,
                        "name": f"{score.athlete_entry.athlete.first_name} {score.athlete_entry.athlete.last_name}".strip(),
                        "team": score.athlete_entry.athlete.team or "No Team",
                    },
                    "total_score": score.total_score or 0,
                    "best_attempt_weight": score.best_attempt_weight or 0,
                }
            )

        # If no scores available, create basic ranking from athletes
        if not rankings_data:
            athletes = Athlete.query.filter_by(
                competition_id=competition_id, is_active=True
            ).all()
            for i, athlete in enumerate(athletes[:10]):  # Limit to top 10
                rankings_data.append(
                    {
                        "rank": i + 1,
                        "athlete": {
                            "id": athlete.id,
                            "name": f"{athlete.first_name} {athlete.last_name}".strip(),
                            "team": athlete.team or "No Team",
                        },
                        "total_score": 0,
                        "best_attempt_weight": 0,
                    }
                )

        return jsonify(
            {
                "success": True,
                "rankings": rankings_data[:10],  # Top 10 for display
            }
        )

    except Exception as e:
        return jsonify(
            {"success": False, "error": f"Failed to get rankings: {str(e)}"}
        ), 500
