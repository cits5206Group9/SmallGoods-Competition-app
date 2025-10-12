import json
from pathlib import Path
from flask import Blueprint, render_template, request, jsonify, current_app
from ..extensions import db
from ..models import Competition, Event, Athlete, AthleteFlight, Flight, Attempt, AthleteEntry, Score, AttemptResult
from sqlalchemy.orm import joinedload

display_bp = Blueprint('display', __name__, url_prefix='/display' )


@display_bp.route('/')
def display_index():
    return render_template('display/selection.html')

@display_bp.route('/competition')
def display_competition():
    # Get competition data
    competitions = Competition.query.filter_by(is_active=True).all()
    selected_competition_id = request.args.get('competition_id')

    competition = None
    events = []
    athletes = []
    show_error = False

    if selected_competition_id:
        competition = Competition.query.get(selected_competition_id)
        if competition:
            events = Event.query.filter_by(competition_id=competition.id).all()
            athletes_query = Athlete.query.filter_by(competition_id=competition.id, is_active=True).all()
            # Convert athletes to dictionaries for JSON serialization
            athletes = []
            for athlete in athletes_query:
                athletes.append({
                    'id': athlete.id,
                    'name': f"{athlete.first_name} {athlete.last_name}".strip(),
                    'team': getattr(athlete, 'team', ''),
                    'weight_class': getattr(athlete, 'weight_class', ''),
                    'is_active': athlete.is_active
                })
        else:
            # Competition with specified ID not found
            show_error = True
    elif competitions:
        # Default to first active competition
        competition = competitions[0]
        events = Event.query.filter_by(competition_id=competition.id).all()
        athletes_query = Athlete.query.filter_by(competition_id=competition.id, is_active=True).all()
        # Convert athletes to dictionaries for JSON serialization
        athletes = []
        for athlete in athletes_query:
            athletes.append({
                'id': athlete.id,
                'name': f"{athlete.first_name} {athlete.last_name}".strip(),
                'team': getattr(athlete, 'team', ''),
                'weight_class': getattr(athlete, 'weight_class', ''),
                'is_active': athlete.is_active
            })

    return render_template('display/competition.html',
                         competition=competition,
                         competitions=competitions,
                         events=events,
                         athletes=athletes,
                         show_error=show_error)

@display_bp.route('/datatable')
def display_datatable():
    return render_template('display/datatable.html')

@display_bp.route('/api/competitions')
def get_competitions_list():
    """API endpoint to get list of all active competitions"""
    try:
        competitions = Competition.query.filter_by(is_active=True).order_by(Competition.id).all()
        return jsonify({
            'success': True,
            'competitions': [{'id': c.id, 'name': c.name} for c in competitions]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get competitions: {str(e)}'
        }), 500

@display_bp.route('/public-stage')
def display_public_stage():
    """Public stage display for competition"""
    competition_id = request.args.get('competition_id', type=int)
    # If no competition_id provided, get the first active competition
    if competition_id is None:
        first_competition = Competition.query.filter_by(is_active=True).first()
        competition_id = first_competition.id if first_competition else 1
    return render_template('display/public_stage.html', competition_id=competition_id)


@display_bp.route('/api/timer-state')
def get_public_timer_state():
    """
    Expose the shared timer state for public displays.
    Mirrors /admin/api/timer-state GET without requiring admin session.
    """
    try:
        state_file = Path(current_app.instance_path) / 'timer_state.json'
        if state_file.exists():
            with state_file.open('r') as f:
                state = json.load(f)
                state.setdefault('break_timer_seconds', 0)
                state.setdefault('break_timer_running', False)
                state.setdefault('break_timer_type', '')
                state.setdefault('break_timer_message', '')
        else:
            state = {
                'athlete_name': '',
                'athlete_id': '',
                'attempt_number': '',
                'timer_seconds': 60,
                'timer_running': False,
                'timer_mode': 'attempt',
                'competition': '',
                'event': '',
                'flight': '',
                'flight_id': '',
                'team': '',
                'current_lift': '',
                'attempt_weight': '',
                'break_timer_seconds': 0,
                'break_timer_running': False,
                'break_timer_type': '',
                'break_timer_message': '',
                'timestamp': 0
            }
        return jsonify(state)
    except Exception as exc:
        current_app.logger.warning(f"Failed to load timer state for public display: {exc}")
        return jsonify({
            'athlete_name': '',
            'athlete_id': '',
            'attempt_number': '',
            'timer_seconds': 0,
            'timer_running': False,
            'timer_mode': 'attempt',
            'competition': '',
            'event': '',
            'flight': '',
            'flight_id': '',
            'team': '',
            'current_lift': '',
            'attempt_weight': '',
            'timestamp': 0,
            'error': 'unavailable'
        }), 500

@display_bp.route('/debug')
def debug_report():
    competition_id = request.args.get('competition_id', 'Unknown')
    error_type = request.args.get('error', 'Unknown error')

    debug_info = {
        'competition_id': competition_id,
        'error_type': error_type,
        'timestamp': request.args.get('timestamp', 'Not provided'),
        'user_agent': request.headers.get('User-Agent', 'Not available'),
        'referrer': request.referrer or 'Direct access',
        'available_competitions': Competition.query.filter_by(is_active=True).count()
    }

    return render_template('display/debug.html', debug_info=debug_info)

@display_bp.route('/api/competition/<int:competition_id>/info')
def get_competition_info(competition_id):
    """API endpoint to get competition information with events and athletes"""
    competition = Competition.query.get(competition_id)

    if not competition:
        return jsonify({
            'success': False,
            'error': 'Competition not found',
            'competition_id': competition_id
        }), 404

    # Get events for this competition
    events = Event.query.filter_by(competition_id=competition_id).all()

    # Get athletes for this competition
    athletes_query = Athlete.query.filter_by(competition_id=competition_id, is_active=True).all()

    # Prepare response data
    response_data = {
        'success': True,
        'competition': {
            'id': competition.id,
            'name': competition.name,
            'is_active': competition.is_active
        },
        'events': [{'id': event.id, 'name': event.name} for event in events],
        'athletes': [
            {
                'id': athlete.id,
                'name': f"{athlete.first_name} {athlete.last_name}".strip(),
                'team': getattr(athlete, 'team', ''),
                'is_active': athlete.is_active
            } for athlete in athletes_query
        ],
        'summary': {
            'events_count': len(events),
            'athletes_count': len(athletes_query),
            'has_events': len(events) > 0,
            'has_athletes': len(athletes_query) > 0
        }
    }

    return jsonify(response_data)

@display_bp.route('/api/competition/state')
def get_default_competition_state():
    """API endpoint to get competition state for first active competition"""
    try:
        # Get first active competition
        competition = Competition.query.filter_by(is_active=True).first()
        if not competition:
            return jsonify({
                'success': False,
                'error': 'No active competitions found'
            }), 404
        
        return get_competition_state(competition.id)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get default competition state: {str(e)}'
        }), 500

@display_bp.route('/api/competition/<int:competition_id>/state')
def get_competition_state(competition_id):
    """API endpoint to get current competition state with in-progress and waiting attempts"""
    from ..models import Attempt, AthleteEntry
    
    try:
        competition = Competition.query.get(competition_id)
        if not competition:
            return jsonify({
                'success': False,
                'error': 'Competition not found'
            }), 404

        # Get current in-progress attempt
        current_attempt_query = db.session.query(Attempt).join(AthleteEntry).join(Athlete).filter(
            Athlete.competition_id == competition_id,
            Attempt.status == 'in-progress'
        ).options(
            joinedload(Attempt.athlete),
            joinedload(Attempt.athlete_entry)
        ).first()

        current_attempt_data = None
        if current_attempt_query:
            current_attempt_data = {
                'id': current_attempt_query.id,
                'athlete': {
                    'id': current_attempt_query.athlete.id,
                    'name': f"{current_attempt_query.athlete.first_name} {current_attempt_query.athlete.last_name}".strip(),
                    'team': current_attempt_query.athlete.team or 'No Team'
                },
                'weight': current_attempt_query.requested_weight,
                'attempt_number': current_attempt_query.attempt_number,
                'movement': current_attempt_query.movement_type or 'Unknown Movement',
                'lift_type': current_attempt_query.athlete_entry.lift_type if current_attempt_query.athlete_entry else 'Unknown'
            }

        # Get waiting attempts, prioritizing same movement type
        waiting_attempts_query = db.session.query(Attempt).join(AthleteEntry).join(Athlete).filter(
            Athlete.competition_id == competition_id,
            Attempt.status == 'waiting'
        ).options(
            joinedload(Attempt.athlete),
            joinedload(Attempt.athlete_entry)
        ).order_by(Attempt.lifting_order.asc()).all()

        # Organize waiting attempts by movement type
        current_movement = current_attempt_data['movement'] if current_attempt_data else None
        same_movement_attempts = []
        other_movement_attempts = []

        for attempt in waiting_attempts_query:
            attempt_data = {
                'id': attempt.id,
                'athlete': {
                    'id': attempt.athlete.id,
                    'name': f"{attempt.athlete.first_name} {attempt.athlete.last_name}".strip(),
                    'team': attempt.athlete.team or 'No Team'
                },
                'weight': attempt.requested_weight,
                'attempt_number': attempt.attempt_number,
                'movement': attempt.movement_type or 'Unknown Movement',
                'lift_type': attempt.athlete_entry.lift_type if attempt.athlete_entry else 'Unknown',
                'lifting_order': attempt.lifting_order or 0
            }
            
            if current_movement and attempt.movement_type == current_movement:
                same_movement_attempts.append(attempt_data)
            else:
                other_movement_attempts.append(attempt_data)

        # Combine with priority: same movement first, then others
        next_attempts = same_movement_attempts + other_movement_attempts

        # Get total athlete count for this competition
        athlete_count = Athlete.query.filter_by(competition_id=competition_id, is_active=True).count()

        return jsonify({
            'success': True,
            'current_attempt': current_attempt_data,
            'next_attempts': next_attempts[:10],  # Limit to 10 for display
            'waiting_attempts': next_attempts,  # All waiting attempts
            'athlete_count': athlete_count,
            'has_current_attempt': current_attempt_data is not None,
            'waiting_count': len(next_attempts)
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get competition state: {str(e)}'
        }), 500

@display_bp.route('/api/competition/<int:competition_id>/rankings')
def get_competition_rankings(competition_id):
    """API endpoint to get current rankings for competition"""
    from ..models import Score, AthleteEntry
    
    try:
        competition = Competition.query.get(competition_id)
        if not competition:
            return jsonify({
                'success': False,
                'error': 'Competition not found'
            }), 404

        # Get rankings from Score table or calculate from attempts
        rankings_query = db.session.query(Score).join(AthleteEntry).join(Athlete).filter(
            Athlete.competition_id == competition_id
        ).options(
            joinedload(Score.athlete_entry).joinedload(AthleteEntry.athlete)
        ).order_by(Score.rank.asc(), Score.total_score.desc()).all()

        rankings_data = []
        for i, score in enumerate(rankings_query):
            rankings_data.append({
                'rank': score.rank or (i + 1),
                'athlete': {
                    'id': score.athlete_entry.athlete.id,
                    'name': f"{score.athlete_entry.athlete.first_name} {score.athlete_entry.athlete.last_name}".strip(),
                    'team': score.athlete_entry.athlete.team or 'No Team'
                },
                'total_score': score.total_score or 0,
                'best_attempt_weight': score.best_attempt_weight or 0
            })

        # If no scores available, create basic ranking from athletes
        if not rankings_data:
            athletes = Athlete.query.filter_by(competition_id=competition_id, is_active=True).all()
            for i, athlete in enumerate(athletes[:10]):  # Limit to top 10
                rankings_data.append({
                    'rank': i + 1,
                    'athlete': {
                        'id': athlete.id,
                        'name': f"{athlete.first_name} {athlete.last_name}".strip(),
                        'team': athlete.team or 'No Team'
                    },
                    'total_score': 0,
                    'best_attempt_weight': 0
                })

        return jsonify({
            'success': True,
            'rankings': rankings_data[:10]  # Top 10 for display
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get rankings: {str(e)}'
        }), 500


@display_bp.route('/api/competition/<int:competition_id>/flights-data')
def get_flights_data(competition_id):
    """
    API endpoint to get complete flights table data for public stage display.
    Returns nested structure: competition > events > flights > athletes > attempts
    """
    try:
        competition = Competition.query.get(competition_id)
        if not competition:
            return jsonify({
                'success': False,
                'error': 'Competition not found'
            }), 404

        # Get all flights for this competition with their events
        flights = Flight.query.filter_by(competition_id=competition_id).options(joinedload(Flight.event)).order_by(Flight.id).all()

        events_dict = {}

        for flight in flights:
            # Get all athlete entries in this flight
            entries = (
                AthleteEntry.query.filter_by(flight_id=flight.id)
                .options(joinedload(AthleteEntry.athlete))
                .order_by(AthleteEntry.id)
                .all()
            )

            # Prefetch score data for these entries to avoid N+1 queries
            entry_ids = [entry.id for entry in entries]
            scores_by_entry = {}
            if entry_ids:
                scores = Score.query.filter(Score.athlete_entry_id.in_(entry_ids)).all()
                scores_by_entry = {score.athlete_entry_id: score for score in scores}

            # Get event name from the event relationship or fall back to movement_type
            event_name = None
            if flight.event_id and flight.event:
                event_name = flight.event.name
            elif flight.movement_type:
                event_name = flight.movement_type
            else:
                event_name = f"Event {flight.id}"

            # Group by event name to create events
            event_key = event_name

            if event_key not in events_dict:
                events_dict[event_key] = {
                    'name': event_name,
                    'flights': []
                }

            athletes_data = []
            for entry in entries:
                athlete = entry.athlete

                # Get all attempts for this entry
                attempts = Attempt.query.filter_by(athlete_entry_id=entry.id).order_by(Attempt.attempt_number).all()

                # Build attempts array
                attempts_data = []
                best_weight_attempt = 0
                for attempt in attempts:
                    # Convert AttemptResult enum to 'success'/'fail' string
                    result_str = None
                    if attempt.final_result:
                        if attempt.final_result == AttemptResult.GOOD_LIFT:
                            result_str = 'success'
                        elif attempt.final_result in [AttemptResult.NO_LIFT, AttemptResult.NOT_TO_DEPTH, AttemptResult.MISSED, AttemptResult.DNF]:
                            result_str = 'fail'
                    
                    attempt_info = {
                        'number': attempt.attempt_number,
                        'weight': attempt.requested_weight,
                        'result': result_str,  # 'success', 'fail', or None
                        'reps': None
                    }

                    # Update best weight if successful
                    if result_str == 'success' and attempt.requested_weight > best_weight_attempt:
                        best_weight_attempt = attempt.requested_weight

                    attempts_data.append(attempt_info)

                # Ensure we have 3 attempts (pad with null if needed)
                while len(attempts_data) < 3:
                    attempts_data.append({
                        'number': len(attempts_data) + 1,
                        'weight': None,
                        'result': None,
                        'reps': None
                    })

                # Get reps from entry if available
                reps_value = None
                if entry.reps:
                    import json
                    try:
                        reps_data = json.loads(entry.reps) if isinstance(entry.reps, str) else entry.reps
                        reps_value = reps_data.get('value') if isinstance(reps_data, dict) else reps_data
                    except:
                        reps_value = entry.reps

                # Determine category (gender + weight class approximation)
                weight_class = ""
                if athlete.bodyweight:
                    # Simple weight class approximation
                    if athlete.gender == 'M':
                        if athlete.bodyweight <= 61:
                            weight_class = "61kg"
                        elif athlete.bodyweight <= 67:
                            weight_class = "67kg"
                        elif athlete.bodyweight <= 73:
                            weight_class = "73kg"
                        elif athlete.bodyweight <= 81:
                            weight_class = "81kg"
                        elif athlete.bodyweight <= 89:
                            weight_class = "89kg"
                        elif athlete.bodyweight <= 96:
                            weight_class = "96kg"
                        elif athlete.bodyweight <= 102:
                            weight_class = "102kg"
                        else:
                            weight_class = "102+kg"
                    else:
                        if athlete.bodyweight <= 49:
                            weight_class = "49kg"
                        elif athlete.bodyweight <= 55:
                            weight_class = "55kg"
                        elif athlete.bodyweight <= 59:
                            weight_class = "59kg"
                        elif athlete.bodyweight <= 64:
                            weight_class = "64kg"
                        elif athlete.bodyweight <= 71:
                            weight_class = "71kg"
                        elif athlete.bodyweight <= 76:
                            weight_class = "76kg"
                        elif athlete.bodyweight <= 81:
                            weight_class = "81kg"
                        else:
                            weight_class = "81+kg"

                category = f"{athlete.gender}'s {weight_class}" if weight_class else athlete.gender

                # Check if this athlete is currently lifting
                is_current = False
                if hasattr(competition, 'current_athlete_entry_id'):
                    is_current = (entry.id == competition.current_athlete_entry_id)

                # Pull score model data for competition results
                score_record = scores_by_entry.get(entry.id)
                score_best = None
                score_total = None
                if score_record:
                    if score_record.best_attempt_weight is not None:
                        score_best = score_record.best_attempt_weight
                    if score_record.total_score is not None:
                        score_total = score_record.total_score

                # Prefer score model values; fall back to attempt-derived data
                final_best = score_best if score_best is not None else (best_weight_attempt if best_weight_attempt > 0 else None)
                final_total = score_total if score_total is not None else (final_best if final_best is not None else 0)

                athlete_info = {
                    'id': athlete.id,
                    'name': f"{athlete.first_name} {athlete.last_name}",
                    'class': weight_class,
                    'category': category,
                    'gender': athlete.gender,
                    'attempts': attempts_data,
                    'best': final_best,
                    'reps': reps_value,
                    'total': final_total,
                    'is_current': is_current
                }

                athletes_data.append(athlete_info)

            flight_info = {
                'id': flight.id,
                'name': flight.name,
                'athletes': athletes_data
            }

            events_dict[event_key]['flights'].append(flight_info)

        # Convert events dict to list
        events_list = list(events_dict.values())

        response = {
            'success': True,
            'competition': {
                'id': competition.id,
                'name': competition.name
            },
            'events': events_list
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get flights data: {str(e)}'
        }), 500
