from flask import Blueprint, render_template, request, jsonify
from ..extensions import db
from ..models import Competition, Event, Athlete, AthleteFlight, Flight
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