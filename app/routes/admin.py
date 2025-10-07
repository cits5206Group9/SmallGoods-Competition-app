from asyncio.log import logger
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash
from ..extensions import db
from ..models import (Competition, Athlete, Flight, Event, SportType, AthleteFlight, ScoringType, Referee,TimerLog,Attempt, AttemptResult, AthleteEntry, User, UserRole, CoachAssignment, Timer, RefereeDecision, RefereeAssignment, Score)
from ..utils.referee_generator import generate_sample_referee_data, generate_random_username, generate_random_password
from ..utils.scoring import ScoringCalculator, calculate_scores_after_referee_decision, TimerScoring
from datetime import datetime,timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from werkzeug.security import generate_password_hash

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# Referee-accessible routes (whitelist)
REFEREE_ALLOWED_ROUTES = [
    'admin.referee_login',
    'admin.referee_interface', 
    'admin.referee_logout',
    'admin.individual_referee_page',
    'admin.referee_login_api',
    'admin.submit_referee_decision',
    'admin.get_current_attempt',
    'admin.clear_current_attempt',
    'admin.api_referee_decision'
]

@admin_bp.before_request
def check_access():
    """Check access permissions before each request"""
    # Allow referee-accessible routes
    if request.endpoint in REFEREE_ALLOWED_ROUTES:
        return None
    
    # Block referees from accessing other admin pages
    if session.get('is_referee'):
        flash('Access denied. Referees can only access their individual interface.', 'error')
        return redirect(url_for('admin.referee_interface'))
    
    # For all other routes, require admin authentication
    if not session.get('is_admin') or not session.get('user_id'):
        return redirect(url_for('login.login'))
    
    return None

def require_admin_auth():
    """Check if user is authenticated as admin (not referee)"""
    # Block referees from accessing admin pages
    if session.get('is_referee'):
        flash('Referees cannot access admin pages', 'error')
        return redirect(url_for('admin.referee_interface'))
    
    # Check admin authentication
    if not session.get('is_admin') or not session.get('user_id'):
        return redirect(url_for('login.login'))
    return None

@admin_bp.route('/')
def admin_dashboard():
    auth_check = require_admin_auth()
    if auth_check:
        return auth_check
    return render_template('admin/admin.html')

@admin_bp.route('/competition-model')
def competition_model():
    return render_template('admin/competition_model.html')

@admin_bp.route('/competition-model/create')
def competition_create():
    return render_template('admin/competition_create.html')

@admin_bp.route('/competition-model/edit')
def competition_edit():
    competitions = Competition.query.all()
    return render_template('admin/competition_edit.html', competitions=competitions)

@admin_bp.route('/live-event')
def live_event():
    competitions = Competition.query.all()
    return render_template('admin/live_event.html', competitions=competitions)

@admin_bp.route('/real-time-dashboard')
def real_time_dashboard():
    competitions = Competition.query.all()
    current_time = datetime.now().strftime('%H:%M:%S')
    return render_template('admin/real_time_dashboard.html',
                         competitions=competitions,
                         current_time=current_time)

@admin_bp.route('/data')
def data():
    return render_template('admin/data.html')

#@admin_bp.route('/timer')
#def timer():
    #return render_template('admin/timer.html')

@admin_bp.route('/referee')
def referee():
    return render_template('admin/referee.html')

@admin_bp.route('/referee-decisions')
def referee_decisions_page():
    """Display referee decisions page with filtering"""
    auth_check = require_admin_auth()
    if auth_check:
        return auth_check
    competitions = Competition.query.all()
    return render_template('admin/referee_decisions.html', competitions=competitions)

@admin_bp.route('/results')
def results_dashboard():
    return render_template('admin/results_dashboard.html')

@admin_bp.route('/display')
def display():
    competitions = Competition.query.filter_by(is_active=True).all()
    current_competition = competitions[0] if competitions else None
    
    # Redirect to the display competition page
    if current_competition:
        return redirect(url_for('display.display_competition', competition_id=current_competition.id))
    else:
        return redirect(url_for('display.display_competition'))

# API Routes below
@admin_bp.route('/competition-model/get/<int:id>')
def get_competition_model(id):
    competition = Competition.query.options(
        db.joinedload(Competition.events).joinedload(Event.flights)
    ).get_or_404(id)
    
    # Get existing events and flights data
    events_data = [{
        'id': event.id,
        'name': event.name,
        'gender': event.gender,
        'sport_type': event.sport_type.value if event.sport_type else None,
        'flights': [{
            'id': flight.id,
            'name': flight.name,
            'order': flight.order
        } for flight in event.flights]
    } for event in competition.events]
    
    return jsonify({
        'id': competition.id,
        'name': competition.name,
        'start_date': competition.start_date.isoformat() if competition.start_date else None,
        'description': competition.description,
        'events': events_data,  # Include the actual events data
        'config': competition.config or {
            'name': competition.name,
            'comp_date': competition.start_date.isoformat() if competition.start_date else None,
            'features': {
                'allowAthleteInput': True,
                'allowCoachAssignment': True,
                'enableAttemptOrdering': True
            },
            'events': []
        },
        'is_active': competition.is_active
    })

@admin_bp.route('/competition-model/save', methods=['POST'])
def save_competition_model():
    try:
        data = request.get_json()
        print("\n=== Competition Save Debug ===")
        print("Received data:", data)

        # Start a database transaction
        db.session.begin_nested()
        
        competition_id = data.get('id')
        print(f"Processing competition ID: {competition_id}")
        
        if competition_id:
            competition = Competition.query.get_or_404(competition_id)
            print("Existing competition found")
            print("Current events:", [(e.id, e.name) for e in competition.events])
            print("Current flights:", [(f.id, f.name, f.event_id) for f in Flight.query.filter_by(competition_id=competition_id).all()])

        # Create new competition or update existing one
        competition_id = data.get('id')
        if competition_id:
            competition = Competition.query.get_or_404(competition_id)
            # Keep track of existing events for cleanup
            existing_event_ids = {event.id for event in competition.events}
        else:
            competition = Competition()
            existing_event_ids = set()
            db.session.add(competition)

        # Update basic fields
        competition.name = data['name']
        competition.start_date = datetime.strptime(data['comp_date'], '%Y-%m-%d').date()
        competition.description = data.get('description', '')

        competition.start_date = datetime.now().date()

        competition.is_active = True
        
        # Store the complete configuration
        competition.config = {
            'name': data['name'],
            'comp_date': data['comp_date'],
            'features': data.get('features', {
                'allowAthleteInput': True,
                'allowCoachAssignment': True,
                'enableAttemptOrdering': True
            }),
            'events': data.get('events', [])
        }

        # Get all existing event and flight IDs for this competition
        existing_event_ids = {event.id for event in competition.events}
        existing_flight_ids = {flight.id for flight in Flight.query.filter_by(competition_id=competition.id).all()}
        
        print("Existing event IDs:", existing_event_ids)
        print("Existing flight IDs:", existing_flight_ids)
        
        # Track current IDs to determine what to keep
        current_event_ids = set()
        current_flight_ids = set()
        
        print("Processing events from config:", competition.config.get('events', []))
        
        for event_data in competition.config['events']:
            event_id = event_data.get('id')
            
            if event_id:
                # Update existing event
                event = Event.query.get(event_id)
                if event and event.competition_id == competition.id:
                    event.name = event_data['name']
                    event.gender = event_data.get('gender')
                    event.sport_type = SportType(event_data['sport_type']) if event_data.get('sport_type') else SportType.OLYMPIC_WEIGHTLIFTING
                    if not hasattr(event, 'scoring_type') or event.scoring_type is None:
                        event.scoring_type = ScoringType.MAX
                    event.is_active = True
                    current_event_ids.add(event.id)
            else:
                # Create new event
                event = Event(
                    competition=competition,
                    name=event_data['name'],
                    gender=event_data.get('gender'),
                    sport_type=SportType(event_data['sport_type']) if event_data.get('sport_type') else SportType.OLYMPIC_WEIGHTLIFTING,
                    scoring_type=ScoringType.MAX,  # Default scoring type
                    is_active=True
                )
                db.session.add(event)
                db.session.flush()  # Get the new event ID
                current_event_ids.add(event.id)

            # Process flights for this event
            print(f"\nProcessing event {event.id} - {event.name}")
            if 'groups' in event_data:
                print("Found groups:", event_data['groups'])
                for flight_data in event_data['groups']:
                    flight_id = flight_data.get('id')
                    print(f"Processing flight data: {flight_data}")
                    if flight_id:
                        # Update existing flight
                        flight = Flight.query.get(flight_id)
                        print(f"Found existing flight: {flight.id if flight else None}")
                        if flight and flight.competition_id == competition.id:
                            flight.name = flight_data['name']
                            flight.order = flight_data.get('order', 1)
                            flight.is_active = flight_data.get('is_active', True)
                            flight.event_id = event.id  # Update event association
                            current_flight_ids.add(flight.id)
                            print(f"Updated flight {flight.id} - {flight.name} for event {event.id}")
                    else:
                        # Create new flight
                        flight = Flight(
                            event_id=event.id,
                            competition_id=competition.id,
                            name=flight_data['name'],
                            order=flight_data.get('order', 1),
                            is_active=flight_data.get('is_active', True)
                        )
                        db.session.add(flight)
                        db.session.flush()  # Get the new flight ID
                        current_flight_ids.add(flight.id)

        # Print final tracking sets
        print("\nFinal tracking sets:")
        print("Current event IDs:", current_event_ids)
        print("Current flight IDs:", current_flight_ids)
        
        # Remove events and flights that no longer exist in the configuration
        events_to_delete = existing_event_ids - current_event_ids
        if events_to_delete:
            print(f"Deleting events: {events_to_delete}")
            Event.query.filter(Event.id.in_(events_to_delete)).delete(synchronize_session='fetch')

        # Remove any flights not in current_flight_ids
        flights_to_delete = existing_flight_ids - current_flight_ids
        if flights_to_delete:
            print(f"Deleting flights: {flights_to_delete}")
            Flight.query.filter(Flight.id.in_(flights_to_delete)).delete(synchronize_session='fetch')
            
        # Print final state
        print("\nFinal state after save:")
        print("Events:", [(e.id, e.name) for e in competition.events])
        print("Flights:", [(f.id, f.name, f.event_id) for f in Flight.query.filter_by(competition_id=competition.id).all()])

        # Remove events that no longer exist in the configuration
        events_to_delete = existing_event_ids - current_event_ids
        if events_to_delete:
            Event.query.filter(Event.id.in_(events_to_delete)).delete(synchronize_session='fetch')

        # Immediately sync AthleteEntry records with updated competition config
        if competition.events:
            from .athlete import extract_movements_for_event
            
            # Get all athlete entries for this competition
            athlete_entries = (
                AthleteEntry.query
                .join(Event, AthleteEntry.event_id == Event.id)
                .filter(Event.competition_id == competition.id)
                .all()
            )
            
            updated_count = 0
            for entry in athlete_entries:
                movements = extract_movements_for_event(entry.event)
                
                for mv in movements:
                    if (mv.get("name") or "").strip() == entry.lift_type:
                        new_default_reps = mv.get("reps")
                        if new_default_reps != entry.default_reps:
                            print(f"Updating entry {entry.id}: {entry.lift_type} reps from {entry.default_reps} to {new_default_reps}")
                            entry.default_reps = new_default_reps
                            
                            # Reset athlete's reps to match new default_reps when config changes
                            entry.reps = new_default_reps
                            print(f"  Reset athlete reps to {new_default_reps}")
                            
                            # Update timer settings
                            timer = mv.get("timer") or {}
                            entry.attempt_time_limit = int(timer.get("attempt_seconds", 60))
                            entry.break_time = int(timer.get("break_seconds", 120))
                            entry.entry_config = mv
                            updated_count += 1
                        break
            
            if updated_count > 0:
                print(f"Updated {updated_count} AthleteEntry records with new competition config")

        # Commit all changes
        db.session.commit()

        logger.info("Saved competition: %d with %d events", competition.id, len(current_event_ids))

        return jsonify({
            'status': 'success',
            'competition_id': competition.id,
            'message': 'Competition model saved successfully',
            'events_created': len(current_event_ids - existing_event_ids),
            'events_updated': len(current_event_ids & existing_event_ids),
            'events_deleted': len(events_to_delete)
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error("Error saving competition: %s", str(e))  # Debug log
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400
        
        
        
# ensure /admin/timer gets registered on admin_bp
from . import timer
@admin_bp.route('/atheletes-management')
def atheletes_management():
    auth_check = require_admin_auth()
    if auth_check:
        return auth_check
    # Get pagination parameters
    page = request.args.get('page', 1, type=int)
    per_page = 10
    
    # Get filter parameters
    competition_id = request.args.get('competition_id', type=int)
    search = request.args.get('search', '').strip()
    gender = request.args.get('gender', '').strip()
    status = request.args.get('status', '').strip()
    
    # Get all competitions for the filter dropdown
    competitions = Competition.query.all()
    
    # Build query with filters
    athletes_query = Athlete.query.options(db.joinedload(Athlete.competition))
    
    # Apply filters
    if competition_id:
        athletes_query = athletes_query.filter(Athlete.competition_id == competition_id)
    
    if search:
        search_filter = db.or_(
            Athlete.first_name.ilike(f'%{search}%'),
            Athlete.last_name.ilike(f'%{search}%'),
            Athlete.email.ilike(f'%{search}%'),
            Athlete.team.ilike(f'%{search}%')
        )
        athletes_query = athletes_query.filter(search_filter)
    
    if gender:
        athletes_query = athletes_query.filter(Athlete.gender == gender)
    
    if status:
        is_active = status == 'active'
        athletes_query = athletes_query.filter(Athlete.is_active == is_active)
    
    # Get paginated results
    athletes = athletes_query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/atheletes_management.html', 
                         athletes=athletes.items,
                         competitions=competitions,
                         pagination=athletes,
                         page=page,
                         per_page=per_page,
                         total=athletes.total,
                         current_competition_id=competition_id,
                         current_search=search,
                         current_gender=gender,
                         current_status=status)

@admin_bp.route('/flights-management')
def flights_management():
    try:
        
        # Get all competitions with their events
        competitions = Competition.query.options(
            db.joinedload(Competition.events)
        ).all()
        
        # Get all events with competition information
        events = Event.query.options(
            db.joinedload(Event.competition)
        ).all()
        
        # Get all athletes with competition information
        athletes = Athlete.query.options(
            db.joinedload(Athlete.competition)
        ).all()
        
        # Get all flights with their relationships
        flights = Flight.query.options(
            db.joinedload(Flight.event).joinedload(Event.competition),
            db.joinedload(Flight.athlete_flights).joinedload(AthleteFlight.athlete),
            db.joinedload(Flight.competition)  # Direct competition relationship
        ).order_by(Flight.order).all()
        
        # Build hierarchical competition data structure
        competitions_data = []
        for comp in competitions:
            # Get events for this competition
            comp_events = []
            for event in comp.events:
                # Get flights for this event
                event_flights = []
                for flight in event.flights:
                    if flight.event_id == event.id:
                        # Get athletes for this flight
                        flight_athletes = []
                        if hasattr(flight, 'athlete_flights') and flight.athlete_flights:
                            for af in flight.athlete_flights:
                                if hasattr(af, 'athlete') and af.athlete:
                                    flight_athletes.append({
                                        'id': af.athlete.id,
                                        'name': f"{af.athlete.first_name} {af.athlete.last_name}",
                                        'first_name': af.athlete.first_name,
                                        'last_name': af.athlete.last_name,
                                        'order': getattr(af, 'order', 0) or 0
                                    })
                        
                        event_flights.append({
                            'id': flight.id,
                            'name': flight.name,
                            'order': flight.order,
                            'is_active': flight.is_active,
                            'event_id': flight.event_id,
                            'competition_id': event.competition_id,
                            'athlete_count': len(flight_athletes),
                            'athletes': flight_athletes
                        })
                
                comp_events.append({
                    'id': event.id,
                    'name': event.name,
                    'competition_id': comp.id,
                    'flights': event_flights
                })
            
            # Get flights directly associated with this competition (not through events)
            direct_flights = []
            for flight in flights:
                if hasattr(flight, 'competition_id') and flight.competition_id == comp.id and not flight.event_id:
                    # Get athletes for this flight
                    flight_athletes = []
                    if hasattr(flight, 'athlete_flights') and flight.athlete_flights:
                        for af in flight.athlete_flights:
                            if hasattr(af, 'athlete') and af.athlete:
                                flight_athletes.append({
                                    'id': af.athlete.id,
                                    'name': f"{af.athlete.first_name} {af.athlete.last_name}",
                                    'first_name': af.athlete.first_name,
                                    'last_name': af.athlete.last_name,
                                    'order': getattr(af, 'order', 0) or 0
                                })
                    
                    direct_flights.append({
                        'id': flight.id,
                        'name': flight.name,
                        'order': flight.order,
                        'is_active': flight.is_active,
                        'event_id': None,
                        'competition_id': comp.id,
                        'athlete_count': len(flight_athletes),
                        'athletes': flight_athletes
                    })
            
            competitions_data.append({
                'id': comp.id,
                'name': comp.name,
                'config': comp.config,
                'events': comp_events,
                'flights': direct_flights  # Flights directly under competition
            })
        
        # Flat events data for easy access
        events_data = []
        for event in events:
            events_data.append({
                'id': event.id,
                'name': event.name,
                'competition_id': event.competition_id,
                'competition_name': event.competition.name if event.competition else None
            })
        
        # Flat athletes data for easy access
        athletes_data = []
        for athlete in athletes:
            athletes_data.append({
                'id': athlete.id,
                'first_name': athlete.first_name,
                'last_name': athlete.last_name,
                'full_name': f"{athlete.first_name} {athlete.last_name}",
                'email': athlete.email,
                'phone': athlete.phone,
                'team': athlete.team,
                'gender': athlete.gender,
                'age': athlete.age,
                'bodyweight': athlete.bodyweight,
                'competition_id': athlete.competition_id,
                'competition_name': athlete.competition.name if athlete.competition else None,
                'is_active': athlete.is_active
            })
        (f"Prepared {len(athletes_data)} athletes data")
        
        # Flat flights data with proper competition/event relationships
        flights_data = []
        for flight in flights:
            # Get athlete count and athletes list safely
            athlete_count = 0
            athletes_list = []
            
            if hasattr(flight, 'athlete_flights') and flight.athlete_flights:
                athlete_count = len(flight.athlete_flights)
                for af in flight.athlete_flights:
                    if hasattr(af, 'athlete') and af.athlete:
                        athletes_list.append({
                            'id': af.athlete.id,
                            'name': f"{af.athlete.first_name} {af.athlete.last_name}",
                            'first_name': af.athlete.first_name,
                            'last_name': af.athlete.last_name,
                            'order': getattr(af, 'order', 0) or 0
                        })
            
            # Determine competition info - check both direct competition and event-based competition
            competition_id = None
            competition_name = None
            event_name = None
            
            # First check if flight has direct competition relationship
            if hasattr(flight, 'competition_id') and flight.competition_id:
                competition_id = flight.competition_id
                # Find competition name from our competitions data
                competition = next((c for c in competitions if c.id == competition_id), None)
                if competition:
                    competition_name = competition.name
            
            # Then check if flight has event relationship
            if flight.event:
                event_name = flight.event.name
                if flight.event.competition:
                    # Event-based competition takes precedence if both exist
                    competition_id = flight.event.competition_id
                    competition_name = flight.event.competition.name
            
            flight_data = {
                'id': flight.id,
                'name': flight.name,
                'order': flight.order,
                'is_active': flight.is_active,
                'movement_type': flight.movement_type,
                'event_id': flight.event_id,
                'event_name': event_name,
                'competition_id': competition_id,
                'competition_name': competition_name,
                'athlete_count': athlete_count,
                'athletes': athletes_list
            }
            flights_data.append(flight_data)

        return render_template('admin/flights_management.html',
                             competitions=competitions_data,
                             events=events_data,
                             athletes=athletes_data,
                             flights=flights_data)
                             
    except Exception as e:
        logger.error(f"Error in flights_management: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Return empty data on error but still render the template
        return render_template('admin/flights_management.html',
                             competitions=[],
                             events=[],
                             athletes=[],
                             flights=[])

# Athlete API Routes
@admin_bp.route('/athletes', methods=['POST'])
def create_athlete():
    """Create a new athlete"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('first_name') or not data.get('last_name'):
            return jsonify({
                'status': 'error',
                'message': 'First name and last name are required'
            }), 400
        
        # Create new athlete
        athlete = Athlete(
            first_name=data.get('first_name', '').strip(),
            last_name=data.get('last_name', '').strip(),
            email=data.get('email', '').strip() if data.get('email') else None,
            phone=data.get('phone', '').strip() if data.get('phone') else None,
            team=data.get('team', '').strip() if data.get('team') else None,
            gender=data.get('gender'),
            age=int(data.get('age')) if data.get('age') else None,
            bodyweight=float(data.get('bodyweight')) if data.get('bodyweight') else None,
            competition_id=int(data.get('competition_id')) if data.get('competition_id') else None,
            is_active=bool(data.get('is_active', True))
        )
        
        db.session.add(athlete)
        db.session.commit()
        
        # Reload with competition relationship
        athlete = Athlete.query.options(joinedload(Athlete.competition)).get(athlete.id)
        
        return jsonify({
            'status': 'success',
            'message': 'Athlete created successfully',
            'athlete': {
                'id': athlete.id,
                'first_name': athlete.first_name,
                'last_name': athlete.last_name,
                'email': athlete.email,
                'phone': athlete.phone,
                'team': athlete.team,
                'gender': athlete.gender,
                'age': athlete.age,
                'bodyweight': athlete.bodyweight,
                'competition_id': athlete.competition_id,
                'competition_name': athlete.competition.name if athlete.competition else None,
                'is_active': athlete.is_active,
                'has_user_account': athlete.user_id is not None
            }
        }), 201
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Invalid data format: ' + str(e)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to create athlete: ' + str(e)
        }), 500

@admin_bp.route('/athletes/<int:athlete_id>', methods=['GET'])
def get_athlete(athlete_id):
    """Get athlete details by ID"""
    try:
        athlete = Athlete.query.options(joinedload(Athlete.competition)).get(athlete_id)
        
        if not athlete:
            return jsonify({
                'status': 'error',
                'message': 'Athlete not found'
            }), 404
        
        return jsonify({
            'id': athlete.id,
            'first_name': athlete.first_name,
            'last_name': athlete.last_name,
            'email': athlete.email,
            'phone': athlete.phone,
            'team': athlete.team,
            'gender': athlete.gender,
            'age': athlete.age,
            'bodyweight': athlete.bodyweight,
            'competition_id': athlete.competition_id,
            'competition_name': athlete.competition.name if athlete.competition else None,
            'is_active': athlete.is_active,
            'has_user_account': athlete.user_id is not None
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve athlete: ' + str(e)
        }), 500

@admin_bp.route('/athletes/<int:athlete_id>', methods=['PUT'])
def update_athlete(athlete_id):
    """Update athlete details"""
    try:
        athlete = Athlete.query.get(athlete_id)
        
        if not athlete:
            return jsonify({
                'status': 'error',
                'message': 'Athlete not found'
            }), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'first_name' in data:
            athlete.first_name = data['first_name'].strip()
        if 'last_name' in data:
            athlete.last_name = data['last_name'].strip()
        if 'email' in data:
            athlete.email = data['email'].strip() if data['email'] else None
        if 'phone' in data:
            athlete.phone = data['phone'].strip() if data['phone'] else None
        if 'team' in data:
            athlete.team = data['team'].strip() if data['team'] else None
        if 'gender' in data:
            athlete.gender = data['gender']
        if 'age' in data:
            athlete.age = int(data['age']) if data['age'] else None
        if 'bodyweight' in data:
            athlete.bodyweight = float(data['bodyweight']) if data['bodyweight'] else None
        if 'competition_id' in data:
            athlete.competition_id = int(data['competition_id']) if data['competition_id'] else None
        if 'is_active' in data:
            athlete.is_active = bool(data['is_active'])
        
        db.session.commit()
        
        # Reload with competition relationship
        db.session.refresh(athlete)
        athlete = Athlete.query.options(joinedload(Athlete.competition)).get(athlete.id)
        
        return jsonify({
            'status': 'success',
            'message': 'Athlete updated successfully',
            'athlete': {
                'id': athlete.id,
                'first_name': athlete.first_name,
                'last_name': athlete.last_name,
                'email': athlete.email,
                'phone': athlete.phone,
                'team': athlete.team,
                'gender': athlete.gender,
                'age': athlete.age,
                'bodyweight': athlete.bodyweight,
                'competition_id': athlete.competition_id,
                'competition_name': athlete.competition.name if athlete.competition else None,
                'is_active': athlete.is_active,
                'has_user_account': athlete.user_id is not None
            }
        }), 200
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Invalid data format: ' + str(e)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to update athlete: ' + str(e)
        }), 500

@admin_bp.route('/athletes/<int:athlete_id>', methods=['DELETE'])
def delete_athlete(athlete_id):
    """Delete an athlete and all associated records"""
    try:
        athlete = Athlete.query.get(athlete_id)
        
        if not athlete:
            return jsonify({
                'status': 'error',
                'message': 'Athlete not found'
            }), 404
        
        # Get the associated user record if it exists
        user_record = None
        if athlete.user_id:
            user_record = User.query.get(athlete.user_id)
        
        # Delete all related records in correct order (deepest dependencies first)
        
        # 1. Delete Attempts (references athlete_id and athlete_entry_id)
        attempts = Attempt.query.filter_by(athlete_id=athlete_id).all()
        for attempt in attempts:
            db.session.delete(attempt)
        print(f"Deleted {len(attempts)} attempts for athlete {athlete_id}")
        
        # 2. Delete Coach Assignments (references athlete_id)
        coach_assignments = CoachAssignment.query.filter_by(athlete_id=athlete_id).all()
        for assignment in coach_assignments:
            db.session.delete(assignment)
        print(f"Deleted {len(coach_assignments)} coach assignments for athlete {athlete_id}")
        
        # 3. Delete Athlete Entries (references athlete_id)
        athlete_entries = AthleteEntry.query.filter_by(athlete_id=athlete_id).all()
        for entry in athlete_entries:
            db.session.delete(entry)
        print(f"Deleted {len(athlete_entries)} athlete entries for athlete {athlete_id}")
        
        # 4. Delete Athlete Flights (references athlete_id)
        athlete_flights = AthleteFlight.query.filter_by(athlete_id=athlete_id).all()
        for flight in athlete_flights:
            db.session.delete(flight)
        print(f"Deleted {len(athlete_flights)} athlete flights for athlete {athlete_id}")
        
        # 5. Update any Timer records that reference this athlete (set to null instead of delete)
        timers = Timer.query.filter_by(current_athlete_id=athlete_id).all()
        for timer in timers:
            timer.current_athlete_id = None
        print(f"Updated {len(timers)} timer references for athlete {athlete_id}")
        
        # 6. Finally delete the athlete record
        db.session.delete(athlete)
        
        # 7. Delete the associated user record if it exists
        if user_record:
            db.session.delete(user_record)
            print(f"Deleted user account for athlete: {user_record.email}")
        
        db.session.commit()
        
        message = 'Athlete deleted successfully'
        
        return jsonify({
            'status': 'success',
            'message': message
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting athlete {athlete_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to delete athlete: ' + str(e)
        }), 500

@admin_bp.route('/athletes/<int:athlete_id>/create-user', methods=['POST'])
def create_user_for_athlete(athlete_id):
    """Create a user account for an athlete"""
    try:
        from ..models import User, UserRole
        from werkzeug.security import generate_password_hash
        
        athlete = Athlete.query.get(athlete_id)
        
        if not athlete:
            return jsonify({
                'status': 'error',
                'message': 'Athlete not found'
            }), 404
        
        if not athlete.email:
            return jsonify({
                'status': 'error',
                'message': 'Athlete must have an email address to create user account'
            }), 400
        
        # Check if athlete already has a user account
        if athlete.user_id:
            existing_user = User.query.get(athlete.user_id)
            if existing_user:
                return jsonify({
                    'status': 'error',
                    'message': 'Athlete already has a user account'
                }), 400
        
        # Check if user with this email already exists
        existing_user = User.query.filter_by(email=athlete.email).first()
        if existing_user:
            return jsonify({
                'status': 'error',
                'message': 'A user account with this email already exists'
            }), 400
        
        # Create new user account (no password needed for athletes as per requirement)
        user = User(
            email=athlete.email,
            password_hash=generate_password_hash(''),  # Empty password - athletes login with email only
            first_name=athlete.first_name,
            last_name=athlete.last_name,
            role=UserRole.ATHLETE,
            is_active=True
        )
        
        db.session.add(user)
        db.session.flush()  # Get the user ID
        
        # Link the athlete to the user
        athlete.user_id = user.id
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'User account created successfully for {athlete.first_name} {athlete.last_name}',
            'user': {
                'id': user.id,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role.name
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to create user account: ' + str(e)
        }), 500

# Competition API Routes
@admin_bp.route('/competitions', methods=['GET'])
def get_competitions_basic():
    try:
        competitions = Competition.query.all()
        return jsonify([{
            'id': comp.id,
            'name': comp.name,
            'start_date': comp.start_date.isoformat() if comp.start_date else None,
        } for comp in competitions])
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400


@admin_bp.route('/api/competitions', methods=['GET'])
def get_competitions():
    try:
        competitions = Competition.query.all()
        return jsonify([
            {
                'id': comp.id,
                'name': comp.name,
                'is_active': comp.is_active,
                'start_date': comp.start_date.isoformat() if comp.start_date else None
            }
            for comp in competitions
        ])
    except Exception as e:
        print("Error fetching competitions:", str(e))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

@admin_bp.route('/api/competitions/<int:competition_id>', methods=['GET'])
def get_competition_details(competition_id):
    try:
        competition = Competition.query.get_or_404(competition_id)
        
        # Extract events from config if available
        events = []
        if competition.config and 'events' in competition.config:
            events = competition.config['events']
        
        return jsonify({
            'id': competition.id,
            'name': competition.name,
            'description': competition.description,
            'is_active': competition.is_active,
            'start_date': competition.start_date.isoformat() if competition.start_date else None,
            'events': events,
            'config': competition.config
        })
    except Exception as e:
        print("Error fetching competition details:", str(e))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

@admin_bp.route('/api/competitions/<int:competition_id>/referee-config', methods=['GET'])
def get_referee_config(competition_id):
    """Get referee configuration for a specific competition"""
    try:
        competition = Competition.query.get_or_404(competition_id)
        
        referee_config = {
            'number_of_referees': 3,  # Default
            'decision_options': [
                {'label': 'Good Lift', 'color': 'green', 'value': True},
                {'label': 'No Lift', 'color': 'red', 'value': False}
            ]
        }
        
        # Extract referee config from competition config if available
        if competition.config and 'events' in competition.config:
            for event in competition.config['events']:
                # Check groups for referee config (new format)
                if 'groups' in event:
                    for group in event['groups']:
                        if 'referee' in group:
                            ref_config = group['referee']
                            
                            # Parse number of referees
                            if 'n' in ref_config:
                                referee_config['number_of_referees'] = int(ref_config['n'])
                            
                            # Parse decision options (new format with objects)
                            if 'options' in ref_config and isinstance(ref_config['options'], list):
                                decision_options = []
                                for option in ref_config['options']:
                                    if isinstance(option, dict) and 'label' in option and 'color' in option and 'value' in option:
                                        decision_options.append({
                                            'label': str(option['label']),
                                            'color': str(option['color']),
                                            'value': bool(option['value'])
                                        })
                                
                                if decision_options:
                                    referee_config['decision_options'] = decision_options
                            
                            # Use the first group's referee config found
                            print(f"Found referee config in group: {ref_config}")
                            break
                    else:
                        continue
                    break
                
                # Also check movements for legacy format
                if 'movements' in event:
                    for movement in event['movements']:
                        if 'referee' in movement:
                            ref_config = movement['referee']
                            
                            # Parse number of referees (legacy format)
                            if 'ref_n' in ref_config:
                                referee_config['number_of_referees'] = int(ref_config['ref_n'])
                            
                            # Parse decision options from text format (legacy)
                            if 'ref_options' in ref_config and ref_config['ref_options']:
                                decision_options = []
                                lines = str(ref_config['ref_options']).strip().split('\n')
                                for line in lines:
                                    if line.strip():
                                        parts = [part.strip() for part in line.split(',')]
                                        if len(parts) >= 3:
                                            decision_options.append({
                                                'label': parts[0],
                                                'color': parts[1],
                                                'value': parts[2].lower() == 'true'
                                            })
                                
                                if decision_options:
                                    referee_config['decision_options'] = decision_options
                            
                            print(f"Found referee config in movement: {ref_config}")
                            break
                    else:
                        continue
                    break
        
        print(f"Final referee config for competition {competition_id}: {referee_config}")
        return jsonify(referee_config)
        
    except Exception as e:
        print("Error fetching referee config:", str(e))
        return jsonify({
            'number_of_referees': 3,
            'decision_options': [
                {'label': 'Good Lift', 'color': 'green', 'value': True},
                {'label': 'No Lift', 'color': 'red', 'value': False}
            ]
        }), 200  # Return 200 with defaults instead of error

# Referee Settings Routes
@admin_bp.route('/referee-settings')
def referee_settings():
    """Referee settings page"""
    return render_template('admin/referee_settings.html')

@admin_bp.route('/api/referees', methods=['GET'])
def get_referees():
    """Get referees, optionally filtered by competition"""
    try:
        competition_id = request.args.get('competition_id')
        
        if competition_id:
            referees = Referee.query.filter_by(competition_id=int(competition_id)).all()
        else:
            referees = Referee.query.all()
            
        return jsonify([{
            'id': ref.id,
            'name': ref.name,
            'username': ref.username,
            'password': ref.password,  # Showing plain text for admin
            'position': ref.position,
            'email': ref.email,
            'phone': ref.phone,
            'competition_id': ref.competition_id,
            'competition_name': ref.competition.name if ref.competition else 'Unassigned',
            'is_active': ref.is_active,
            'created_at': ref.created_at.isoformat() if ref.created_at else None,
            'last_login': ref.last_login.isoformat() if ref.last_login else None,
            'notes': ref.notes
        } for ref in referees])
    except Exception as e:
        print("Error fetching referees:", str(e))
        return jsonify([])

@admin_bp.route('/api/referees', methods=['POST'])
def create_referee():
    """Create a new referee"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name') or not data.get('username') or not data.get('password'):
            return jsonify({'message': 'Name, username, and password are required'}), 400
        
        # Check if username already exists
        existing = Referee.query.filter_by(username=data['username']).first()
        if existing:
            return jsonify({'message': 'Username already exists'}), 400
        
        referee = Referee(
            name=data['name'],
            username=data['username'],
            password=data['password'],
            position=data.get('position'),
            email=data.get('email'),
            phone=data.get('phone'),
            is_active=data.get('is_active', True),
            notes=data.get('notes')
        )
        
        db.session.add(referee)
        db.session.commit()
        
        return jsonify({
            'message': 'Referee created successfully',
            'id': referee.id
        })
        
    except Exception as e:
        db.session.rollback()
        print("Error creating referee:", str(e))
        return jsonify({'message': 'Error creating referee'}), 500

@admin_bp.route('/api/referees/<int:referee_id>', methods=['PUT'])
def update_referee(referee_id):
    """Update an existing referee"""
    try:
        referee = Referee.query.get_or_404(referee_id)
        data = request.get_json()
        
        # Check if username already exists (excluding current referee)
        if data.get('username') != referee.username:
            existing = Referee.query.filter_by(username=data['username']).first()
            if existing:
                return jsonify({'message': 'Username already exists'}), 400
        
        referee.name = data.get('name', referee.name)
        referee.username = data.get('username', referee.username)
        referee.password = data.get('password', referee.password)
        referee.position = data.get('position', referee.position)
        referee.email = data.get('email', referee.email)
        referee.phone = data.get('phone', referee.phone)
        referee.is_active = data.get('is_active', referee.is_active)
        referee.notes = data.get('notes', referee.notes)
        
        db.session.commit()
        
        return jsonify({'message': 'Referee updated successfully'})
        
    except Exception as e:
        db.session.rollback()
        print("Error updating referee:", str(e))
        return jsonify({'message': 'Error updating referee'}), 500

@admin_bp.route('/api/referees/<int:referee_id>', methods=['DELETE'])
def delete_referee(referee_id):
    """Delete a referee"""
    try:
        referee = Referee.query.get_or_404(referee_id)
        db.session.delete(referee)
        db.session.commit()
        
        return jsonify({'message': 'Referee deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        print("Error deleting referee:", str(e))
        return jsonify({'message': 'Error deleting referee'}), 500

# Individual Referee Pages with Authentication
@admin_bp.route('/referee/individual/<int:referee_id>')
def individual_referee_page(referee_id):
    """Individual referee page with authentication"""
    # Check if referee is logged in
    if session.get('referee_id') != referee_id:
        return redirect(url_for('admin.referee_login_page', referee_id=referee_id))
    
    referee = Referee.query.get_or_404(referee_id)
    return render_template('admin/individual_referee.html', 
                         referee_id=referee_id, 
                         referee=referee)

@admin_bp.route('/referee/login/<int:referee_id>')
def referee_login_page(referee_id):
    """Login page for individual referee"""
    referee = Referee.query.get_or_404(referee_id)
    return render_template('admin/referee_login.html', 
                         referee_id=referee_id, 
                         referee=referee)

@admin_bp.route('/referee/login')
def general_referee_login():
    """General referee login page for any referee"""
    return render_template('admin/referee_login.html', referee=None)

@admin_bp.route('/api/referee/login', methods=['POST'])
def referee_login():
    """Handle referee login"""
    try:
        data = request.get_json()
        referee_id = data.get('referee_id')  # Optional
        username = data.get('username')
        password = data.get('password')
        
        # Find referee by username if referee_id not provided
        if referee_id:
            referee = Referee.query.get_or_404(referee_id)
        else:
            referee = Referee.query.filter_by(username=username).first()
            if not referee:
                return jsonify({
                    'success': False,
                    'message': 'Invalid username or password'
                }), 401
        
        if referee.username == username and referee.password == password and referee.is_active:
            session['referee_id'] = referee.id
            referee.last_login = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'redirect': url_for('admin.individual_referee_page', referee_id=referee.id)
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid credentials or account inactive'
            }), 401
            
    except Exception as e:
        print("Error during referee login:", str(e))
        return jsonify({
            'success': False,
            'message': 'Login error'
        }), 500

@admin_bp.route('/api/referee/logout', methods=['POST'])
def referee_logout():
    """Handle referee logout"""
    session.pop('referee_id', None)
    return jsonify({'success': True, 'message': 'Logged out successfully'})

@admin_bp.route('/referee/logout')
def referee_logout_page():
    """Logout page for referees"""
    session.pop('referee_id', None)
    return redirect(url_for('admin.referee'))

@admin_bp.route('/api/referee-decision', methods=['POST'])
def submit_referee_decision():
    """Submit a referee decision and store in database"""
    """
    Submit a referee decision for an attempt.
    This endpoint now properly creates RefereeDecision records and calculates scores.
    If attempt_id is not provided, it will try to get the current attempt from timer state.
    """
    try:
        from ..models import RefereeDecisionLog
        import json
        from pathlib import Path
        
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        referee_id = data.get('referee_id')
        competition_id = data.get('competition_id')
        attempt_id = data.get('attempt_id')
        decision = data.get('decision')  # Should be decision value like 'good_lift', 'no_lift'
        timestamp = data.get('timestamp')
        notes = data.get('notes', '')
        
        # Handle decision being passed as an object (legacy support)
        if isinstance(decision, dict):
            decision_label = decision.get('label', 'Unknown')
            decision_value = decision.get('value')
            # Convert boolean to string format
            if isinstance(decision_value, bool):
                decision = 'good_lift' if decision_value else 'no_lift'
            elif isinstance(decision_value, str):
                decision = decision_value
            else:
                decision = decision_label.lower().replace(' ', '_')
            notes = notes or f"Decision: {decision_label}"
        
        # Validate required fields
        if not all([referee_id, competition_id, decision]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        # If attempt_id is not provided, try to get it from current timer state
        if not attempt_id:
            import json
            from pathlib import Path
            
            state_file = Path(__file__).parent.parent.parent / 'instance' / 'timer_state.json'
            
            if state_file.exists():
                try:
                    with open(state_file, 'r') as f:
                        timer_state = json.load(f)
                    
                    athlete_id = timer_state.get('athlete_id')
                    attempt_number = timer_state.get('attempt_number')
                    flight_id = timer_state.get('flight_id')
                    
                    if athlete_id and attempt_number and flight_id:
                        # Find the attempt
                        attempt = Attempt.query.filter_by(
                            athlete_id=int(athlete_id),
                            attempt_number=int(attempt_number),
                            flight_id=int(flight_id)
                        ).first()
                        
                        if attempt:
                            attempt_id = attempt.id
                except Exception as e:
                    pass  # Timer state not available
        
        # Verify referee exists and belongs to the competition
        referee = Referee.query.filter_by(id=referee_id, competition_id=competition_id).first()
        if not referee:
            return jsonify({'success': False, 'message': 'Invalid referee or competition'}), 404
        
        # Get or create referee assignment
        # Note: Using a large offset (1000000) to avoid collision with actual User IDs
        # This maps Referee.id to a virtual user_id for RefereeAssignment
        virtual_user_id = 1000000 + referee_id
        
        referee_assignment = RefereeAssignment.query.filter_by(
            user_id=virtual_user_id,
            referee_position=referee.position
        ).first()
        
        if not referee_assignment:
            # Create a referee assignment for this referee
            referee_assignment = RefereeAssignment(
                user_id=virtual_user_id,
                referee_position=referee.position or 'Referee',
                is_active=True
            )
            db.session.add(referee_assignment)
            db.session.flush()
        
        # If we have an attempt_id (either provided or found from timer state), create proper RefereeDecision
        if attempt_id:
            attempt = Attempt.query.get(attempt_id)
            if not attempt:
                return jsonify({'success': False, 'message': f'Invalid attempt ID: {attempt_id}'}), 404
            
            # Parse decision value to AttemptResult enum
            try:
                decision_enum = AttemptResult[decision.upper().replace(' ', '_')]
            except (KeyError, AttributeError):
                # Default mapping for common decision labels
                decision_map = {
                    'good_lift': AttemptResult.GOOD_LIFT,
                    'good': AttemptResult.GOOD_LIFT,
                    'no_lift': AttemptResult.NO_LIFT,
                    'no': AttemptResult.NO_LIFT,
                    'not_to_depth': AttemptResult.NOT_TO_DEPTH,
                    'missed': AttemptResult.MISSED,
                    'dnf': AttemptResult.DNF
                }
                decision_enum = decision_map.get(decision.lower(), AttemptResult.NO_LIFT)
            
            # Create or update referee decision
            existing_decision = RefereeDecision.query.filter_by(
                attempt_id=attempt_id,
                referee_assignment_id=referee_assignment.id
            ).first()
            
            if existing_decision:
                existing_decision.decision = decision_enum
                existing_decision.decision_time = datetime.utcnow()
                existing_decision.notes = notes
                referee_decision = existing_decision
                action = "updated"
            else:
                referee_decision = RefereeDecision(
                    attempt_id=attempt_id,
                    referee_assignment_id=referee_assignment.id,
                    decision=decision_enum,
                    decision_time=datetime.utcnow(),
                    notes=notes
                )
                db.session.add(referee_decision)
                action = "created"
            
            # Also log in referee notes for audit trail
            decision_info = f"Decision at {timestamp}: {decision} for attempt {attempt_id}"
            if referee.notes:
                referee.notes += f"\n{decision_info}"
            else:
                referee.notes = decision_info
            
            db.session.commit()
            
            # Calculate scores after decision is submitted
            try:
                score_results = calculate_scores_after_referee_decision(attempt_id)
                
                return jsonify({
                    'success': True,
                    'message': f'Decision {action} successfully',
                    'referee_id': referee_id,
                    'attempt_id': attempt_id,
                    'decision': decision,
                    'decision_enum': decision_enum.value,
                    'attempt_result': score_results['attempt_result'],
                    'score': score_results['score'],
                    'rankings_updated': True
                })
            except Exception as score_error:
                # Still return success for decision submission even if score calculation fails
                return jsonify({
                    'success': True,
                    'message': f'Decision {action} successfully (score calculation pending)',
                    'referee_id': referee_id,
                    'attempt_id': attempt_id,
                    'decision': decision,
                    'decision_enum': decision_enum.value
                })
        
        else:
            # No attempt_id found - store in notes only
            warning_msg = "Warning: No attempt_id provided or found in timer state. Decision logged in notes only."
            
            decision_info = f"Decision at {timestamp}: {decision} (NO ATTEMPT LINKED)"
            
            if referee.notes:
                referee.notes += f"\n{decision_info}"
            else:
                referee.notes = decision_info
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': warning_msg,
                'referee_id': referee_id,
                'decision': decision,
                'warning': 'Decision not linked to attempt - stored in notes only'
            })
        
    except Exception as e:
        db.session.rollback()
        print("Error submitting referee decision:", str(e))
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Error submitting decision: {str(e)}'}), 500

@admin_bp.route('/api/referee-decisions/<int:competition_id>', methods=['GET'])
def get_referee_decisions(competition_id):
    """Get all referee decisions for current attempt in a competition"""
    try:
        # Get decisions from in-memory store
        if not hasattr(submit_referee_decision, 'decisions'):
            return jsonify({'success': True, 'decisions': {}})
        
        comp_key = f"comp_{competition_id}"
        decisions = submit_referee_decision.decisions.get(comp_key, {})
        
        return jsonify({
            'success': True,
            'decisions': decisions
        })
        
    except Exception as e:
        print("Error fetching referee decisions:", str(e))
        return jsonify({'success': False, 'message': 'Error fetching decisions'}), 500

@admin_bp.route('/api/referee-decisions/<int:competition_id>/clear', methods=['POST'])
def clear_referee_decisions(competition_id):
    """Clear all referee decisions for a competition (for next attempt)"""
    try:
        if hasattr(submit_referee_decision, 'decisions'):
            comp_key = f"comp_{competition_id}"
            if comp_key in submit_referee_decision.decisions:
                submit_referee_decision.decisions[comp_key] = {}
        
        return jsonify({'success': True, 'message': 'Decisions cleared'})
        
    except Exception as e:
        print("Error clearing referee decisions:", str(e))
        return jsonify({'success': False, 'message': 'Error clearing decisions'}), 500

@admin_bp.route('/api/current-attempt', methods=['GET'])
def get_current_attempt():
    """Get current attempt data for referees"""
    # For now, return a waiting state since we don't have real-time competition data
    # In a real implementation, this would connect to live competition data
    return jsonify({
        'status': 'waiting',
        'message': 'No active attempt'
    })

@admin_bp.route('/api/decision-results', methods=['GET'])
def get_decision_results():
    """Get referee decisions with filtering"""
    try:
        from ..models import RefereeDecisionLog
        
        competition_id = request.args.get('competition_id', type=int)
        event = request.args.get('event')
        flight = request.args.get('flight')
        athlete = request.args.get('athlete')
        
        query = RefereeDecisionLog.query.options(
            db.joinedload(RefereeDecisionLog.referee),
            db.joinedload(RefereeDecisionLog.competition)
        )
        
        if competition_id:
            query = query.filter_by(competition_id=competition_id)
        
        if event:
            query = query.filter_by(event_name=event)
        
        if flight:
            query = query.filter_by(flight_name=flight)
        
        if athlete:
            query = query.filter_by(athlete_name=athlete)
        
        decisions = query.order_by(RefereeDecisionLog.timestamp.desc()).all()
        
        return jsonify({
            'success': True,
            'decisions': [d.to_dict() for d in decisions]
        }), 200
        
    except Exception as e:
        print(f"Error fetching decision results: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/api/decision-filters/<int:competition_id>', methods=['GET'])
def get_decision_filters(competition_id):
    """Get available filter values for a competition"""
    try:
        from ..models import RefereeDecisionLog
        
        # Get unique events
        events = db.session.query(RefereeDecisionLog.event_name)\
            .filter_by(competition_id=competition_id)\
            .filter(RefereeDecisionLog.event_name.isnot(None))\
            .distinct()\
            .all()
        
        # Get unique flights
        flights = db.session.query(RefereeDecisionLog.flight_name)\
            .filter_by(competition_id=competition_id)\
            .filter(RefereeDecisionLog.flight_name.isnot(None))\
            .distinct()\
            .all()
        
        # Get unique athlete names
        athletes = db.session.query(RefereeDecisionLog.athlete_name)\
            .filter_by(competition_id=competition_id)\
            .filter(RefereeDecisionLog.athlete_name.isnot(None))\
            .distinct()\
            .order_by(RefereeDecisionLog.athlete_name)\
            .all()
        
        return jsonify({
            'success': True,
            'events': [e[0] for e in events if e[0]],
            'flights': [f[0] for f in flights if f[0]],
            'athletes': [a[0] for a in athletes if a[0]]
        }), 200
        
    except Exception as e:
        print(f"Error fetching filters: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/api/decision-results/<int:decision_id>', methods=['PUT'])
def update_decision_result(decision_id):
    """Update a decision result"""
    try:
        from ..models import RefereeDecisionLog
        
        decision = RefereeDecisionLog.query.get_or_404(decision_id)
        data = request.get_json()
        
        # Update allowed fields
        if 'athlete_name' in data:
            decision.athlete_name = data['athlete_name']
        if 'event_name' in data:
            decision.event_name = data['event_name']
        if 'flight_name' in data:
            decision.flight_name = data['flight_name']
        if 'weight_class' in data:
            decision.weight_class = data['weight_class']
        if 'team' in data:
            decision.team = data['team']
        if 'current_lift' in data:
            decision.current_lift = data['current_lift']
        if 'attempt_number' in data:
            decision.attempt_number = int(data['attempt_number'])
        if 'attempt_weight' in data:
            decision.attempt_weight = float(data['attempt_weight'])
        if 'decision_label' in data:
            decision.decision_label = data['decision_label']
        if 'decision_value' in data:
            decision.decision_value = bool(data['decision_value'])
        if 'decision_color' in data:
            decision.decision_color = data['decision_color']
        if 'violations' in data:
            # Handle violations as array or string
            if isinstance(data['violations'], list):
                decision.violations = ', '.join(data['violations']) if data['violations'] else None
            else:
                decision.violations = data['violations']
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Decision updated successfully',
            'decision': decision.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating decision result: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/api/decision-results/<int:decision_id>', methods=['DELETE'])
def delete_decision_result(decision_id):
    """Delete a decision result"""
    try:
        from ..models import RefereeDecisionLog
        
        decision = RefereeDecisionLog.query.get_or_404(decision_id)
        
        db.session.delete(decision)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Decision deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting decision result: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/referee/dashboard/<int:referee_id>')
def referee_dashboard_page(referee_id):
    """Individual referee dashboard"""
    if 'referee_id' not in session or session['referee_id'] != referee_id:
        return redirect(url_for('admin.referee_login_page', referee_id=referee_id))
    
    referee = Referee.query.get_or_404(referee_id)
    return render_template('admin/referee_dashboard.html', referee=referee)

@admin_bp.route('/api/participants')
def api_participants():
    """Get all participants for referee scoring"""
    # Sample data - in production this would come from database
    participants = [
        {'id': 1, 'name': 'John Smith', 'category': 'Powerlifting - Men 73kg'},
        {'id': 2, 'name': 'Sarah Johnson', 'category': 'Powerlifting - Women 63kg'},
        {'id': 3, 'name': 'Mike Chen', 'category': 'Powerlifting - Men 81kg'},
        {'id': 4, 'name': 'Emma Wilson', 'category': 'Powerlifting - Women 58kg'},
        {'id': 5, 'name': 'David Rodriguez', 'category': 'Powerlifting - Men 89kg'}
    ]
    return jsonify({'success': True, 'participants': participants})

@admin_bp.route('/api/referee/activity')
def api_referee_activity():
    """Get referee activity log"""
    # Sample data - in production this would come from database
    activities = [
        {
            'timestamp': datetime.now().isoformat(),
            'action': 'Score Submitted',
            'participant': 'John Smith',
            'score': '8.5'
        },
        {
            'timestamp': datetime.now().isoformat(),
            'action': 'Score Submitted',
            'participant': 'Sarah Johnson',
            'score': '9.0'
        }
    ]
    return jsonify({'success': True, 'activities': activities})

@admin_bp.route('/api/scores', methods=['POST'])
def api_submit_score():
    """Submit a score from referee dashboard"""
    try:
        data = request.get_json()
        # In production, save to database
        # For now, just return success
        return jsonify({
            'success': True,
            'message': 'Score submitted successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# Scoreboard History Routes
@admin_bp.route('/scoreboard-history')
def scoreboard_history():
    """Scoreboard history page"""
    return render_template('admin/scoreboard_history.html')

@admin_bp.route('/api/scores', methods=['GET'])
def get_all_scores():
    """Get all scores with athlete and event information"""
    try:
        scores = Score.query.order_by(Score.calculated_at.desc()).all()
        
        scores_data = []
        for score in scores:
            athlete_entry = score.athlete_entry
            athlete = athlete_entry.athlete
            event = athlete_entry.event
            competition = event.competition if event else None
            flight = Flight.query.get(athlete_entry.flight_id) if athlete_entry.flight_id else None
            
            scores_data.append({
                'id': score.id,
                'athlete_entry_id': score.athlete_entry_id,
                'athlete_name': f"{athlete.first_name} {athlete.last_name}",
                'athlete_id': athlete.id,
                'event_name': event.name if event else 'N/A',
                'event_id': event.id if event else None,
                'competition_id': competition.id if competition else None,
                'competition_name': competition.name if competition else 'N/A',
                'flight_id': athlete_entry.flight_id,
                'flight_name': flight.name if flight else 'N/A',
                'lift_type': athlete_entry.lift_type or 'N/A',
                'best_attempt_weight': score.best_attempt_weight,
                'total_score': score.total_score,
                'rank': score.rank,
                'score_type': score.score_type,
                'calculated_at': score.calculated_at.isoformat() if score.calculated_at else None,
                'is_final': score.is_final
            })
        
        return jsonify(scores_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/scores/<int:score_id>', methods=['PUT'])
def update_score(score_id):
    """Update a score"""
    try:
        score = Score.query.get_or_404(score_id)
        data = request.get_json()
        
        # Update fields
        if 'best_attempt_weight' in data:
            score.best_attempt_weight = data['best_attempt_weight']
        if 'total_score' in data:
            score.total_score = data['total_score']
        if 'rank' in data:
            score.rank = data['rank']
        if 'is_final' in data:
            score.is_final = data['is_final']
        
        score.calculated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Score updated successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/scores/<int:score_id>', methods=['DELETE'])
def delete_score(score_id):
    """Delete a score"""
    try:
        score = Score.query.get_or_404(score_id)
        db.session.delete(score)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Score deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@admin_bp.route('/api/scores/export')
def export_scores():
    """Export scores to CSV"""
    try:
        import io
        import csv
        from flask import make_response
        
        competition_id = request.args.get('competition_id')
        
        query = Score.query
        if competition_id:
            query = query.join(AthleteEntry).join(Event).filter(Event.competition_id == competition_id)
        
        scores = query.order_by(Score.calculated_at.desc()).all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow([
            'Rank', 'Athlete', 'Event', 'Flight', 'Lift Type', 'Best Weight (kg)', 
            'Total Score', 'Status', 'Calculated At'
        ])
        
        # Data
        for score in scores:
            athlete_entry = score.athlete_entry
            athlete = athlete_entry.athlete
            event = athlete_entry.event
            flight = Flight.query.get(athlete_entry.flight_id) if athlete_entry.flight_id else None
            
            writer.writerow([
                score.rank or '-',
                f"{athlete.first_name} {athlete.last_name}",
                event.name if event else 'N/A',
                flight.name if flight else 'N/A',
                athlete_entry.lift_type or '-',
                score.best_attempt_weight or '-',
                score.total_score or '-',
                'FINAL' if score.is_final else 'PROVISIONAL',
                score.calculated_at.strftime('%Y-%m-%d %H:%M:%S') if score.calculated_at else '-'
            ])
        
        # Create response
        output.seek(0)
        response = make_response(output.getvalue())
        response.headers['Content-Disposition'] = 'attachment; filename=scores_export.csv'
        response.headers['Content-Type'] = 'text/csv'
        
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/api/referees/auto-generate/<int:competition_id>', methods=['POST'])
def auto_generate_referees(competition_id):
    """Auto-generate referees based on competition referee configuration"""
    try:
        competition = Competition.query.get_or_404(competition_id)
        
        # Get referee config for this competition
        referee_config = {
            'number_of_referees': 3,  # Default
            'decision_options': []
        }
        
        # Extract referee config from competition config
        if competition.config and 'events' in competition.config:
            for event in competition.config['events']:
                # Check groups for referee config
                if 'groups' in event:
                    for group in event['groups']:
                        if 'referee' in group:
                            ref_config = group['referee']
                            if 'n' in ref_config:
                                referee_config['number_of_referees'] = int(ref_config['n'])
                            break
                    else:
                        continue
                    break
                
                # Check movements for legacy format
                if 'movements' in event:
                    for movement in event['movements']:
                        if 'referee' in movement:
                            ref_config = movement['referee']
                            if 'ref_n' in ref_config:
                                referee_config['number_of_referees'] = int(ref_config['ref_n'])
                            break
                    else:
                        continue
                    break
        
        # Clear existing referees for this competition (optional)
        clear_existing = request.get_json().get('clear_existing', False) if request.get_json() else False
        if clear_existing:
            Referee.query.filter_by(competition_id=competition_id).delete()
        
        # Check if referees already exist
        existing_count = Referee.query.filter_by(competition_id=competition_id).count()
        needed_count = referee_config['number_of_referees'] - existing_count
        
        if needed_count <= 0:
            # Get existing referees to show their credentials
            existing_referees = Referee.query.filter_by(competition_id=competition_id).all()
            referee_credentials = []
            for referee in existing_referees:
                referee_credentials.append({
                    'id': referee.id,
                    'name': referee.name,
                    'username': referee.username,
                    'password': referee.password,  # Show current password
                    'position': referee.position,
                    'email': referee.email,
                    'phone': referee.phone
                })
            
            return jsonify({
                'success': True,
                'message': f'Competition already has {existing_count} referees (required: {referee_config["number_of_referees"]}). Showing existing referee credentials.',
                'referees_created': 0,
                'total_referees': existing_count,
                'new_referees': referee_credentials,  # Include existing referees as "new_referees" for display
                'competition_name': competition.name,
                'referee_config': referee_config
            })
        
        # Generate referee data
        referee_data_list = generate_sample_referee_data(needed_count, competition.name)
        
        # Create referee records
        created_referees = []
        for referee_data in referee_data_list:
            referee = Referee(
                name=referee_data['name'],  # Add the name field
                username=referee_data['username'],
                password=referee_data['password'],  # In production, hash this
                position=referee_data['position'],
                email=referee_data['email'],
                phone=referee_data['phone'],
                is_active=referee_data['is_active'],
                competition_id=competition_id
            )
            db.session.add(referee)
            db.session.flush()  # Flush to get the ID
            created_referees.append({
                'id': referee.id,
                'name': referee.name,
                'username': referee.username,
                'password': referee.password,  # Return for initial setup
                'position': referee.position,
                'email': referee.email,
                'phone': referee.phone
            })
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Successfully created {len(created_referees)} referees for {competition.name}',
            'referees_created': len(created_referees),
            'total_referees': existing_count + len(created_referees),
            'new_referees': created_referees,
            'competition_name': competition.name,
            'referee_config': referee_config
        })
        
    except Exception as e:
        db.session.rollback()
        print("Error auto-generating referees:", str(e))
        return jsonify({
            'success': False,
            'message': f'Error generating referees: {str(e)}'
        }), 500

@admin_bp.route('/api/referees/regenerate-credentials/<int:referee_id>', methods=['POST'])
def regenerate_referee_credentials(referee_id):
    """Regenerate username and password for a specific referee"""
    try:
        referee = Referee.query.get_or_404(referee_id)
        
        # Generate new credentials
        new_username = generate_random_username("ref", 6)
        new_password = generate_random_password(8)
        
        # Ensure username is unique
        while Referee.query.filter_by(username=new_username).first():
            new_username = generate_random_username("ref", 6)
        
        # Update referee
        old_username = referee.username
        referee.username = new_username
        referee.password = new_password  # In production, hash this
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Credentials regenerated for {referee.position}',
            'referee': {
                'id': referee.id,
                'old_username': old_username,
                'new_username': new_username,
                'new_password': new_password,
                'position': referee.position
            }
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Error regenerating credentials: {str(e)}'
        }), 500

# Flight API Routes
@admin_bp.route('/flights', methods=['POST'])
def create_flight():
    """Create a new flight"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name'):
            return jsonify({
                'status': 'error',
                'message': 'Flight name is required'
            }), 400
        
        # Check if event exists (if provided)
        event_id = data.get('event_id')
        
        # Handle empty string as None
        if event_id == '' or event_id == 'null':

            event_id = None
        
        # Get competition_id 
        competition_id = data.get('competition_id')
        if competition_id == '' or competition_id == 'null':
            competition_id = None
        
        # If event is provided, validate it and get competition from event
        if event_id:
            try:
                event_id = int(event_id)
                event = Event.query.get(event_id)
                if not event:
                    return jsonify({
                        'status': 'error',
                        'message': 'Event not found'
                    }), 404
                # Set competition_id from event if not provided
                if not competition_id:
                    competition_id = event.competition_id
            except (ValueError, TypeError):
                return jsonify({
                    'status': 'error', 
                    'message': 'Invalid event ID format'
                }), 400
        
        # If competition_id is provided, validate it
        if competition_id:
            try:
                competition_id = int(competition_id)
                competition = Competition.query.get(competition_id)
                if not competition:
                    return jsonify({
                        'status': 'error',
                        'message': 'Competition not found'
                    }), 404
            except (ValueError, TypeError):
                return jsonify({
                    'status': 'error',
                    'message': 'Invalid competition ID format'
                }), 400
        
        # Create new flight
        flight = Flight(
            event_id=event_id,
            competition_id=competition_id,
            name=data.get('name', '').strip(),
            order=int(data.get('order', 1)),
            is_active=bool(data.get('is_active', False)),
            movement_type=data.get('movement_type', '').strip() or None
        )
        
        db.session.add(flight)
        db.session.commit()
        
        # Reload with relationships
        flight = Flight.query.options(
            db.joinedload(Flight.event).joinedload(Event.competition),
            db.joinedload(Flight.competition)
        ).get(flight.id)
        
        return jsonify({
            'status': 'success',
            'message': 'Flight created successfully',
            'flight': {
                'id': flight.id,
                'name': flight.name,
                'order': flight.order,
                'is_active': flight.is_active,
                'movement_type': flight.movement_type,
                'event_id': flight.event_id,
                'event_name': flight.event.name if flight.event else None,
                'competition_id': flight.competition_id or (flight.event.competition_id if flight.event and flight.event.competition else None),
                'competition_name': (flight.competition.name if flight.competition 
                                   else (flight.event.competition.name if flight.event and flight.event.competition else None)),
                'athlete_count': 0
            }
        }), 201
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Invalid data format: ' + str(e)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to create flight: ' + str(e)
        }), 500

@admin_bp.route('/flights/reorder', methods=['POST'])
def reorder_flights():
    """Update flight order"""
    try:
        data = request.get_json()
        updates = data.get('updates', [])
        
        for update in updates:
            flight_id = update.get('id')
            new_order = update.get('order')
            
            flight = Flight.query.get(flight_id)
            if flight:
                flight.order = new_order
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Flight order updated successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to update flight order: ' + str(e)
        }), 500



@admin_bp.route('/flights/<int:flight_id>', methods=['GET'])
def get_flight(flight_id):
    """Get flight details by ID"""
    try:
        flight = Flight.query.options(
            joinedload(Flight.event).joinedload(Event.competition),
            joinedload(Flight.competition)
        ).get(flight_id)
        
        if not flight:
            return jsonify({
                'status': 'error',
                'message': 'Flight not found'
            }), 404
        
        # Determine competition info - check both direct competition and event-based competition
        competition_id = None
        competition_name = None
        event_name = None
        
        # First check if flight has direct competition relationship
        if hasattr(flight, 'competition_id') and flight.competition_id:
            competition_id = flight.competition_id
            if hasattr(flight, 'competition') and flight.competition:
                competition_name = flight.competition.name
        
        # Then check if flight has event relationship
        if flight.event:
            event_name = flight.event.name
            if flight.event.competition:
                # Event-based competition takes precedence if both exist
                competition_id = flight.event.competition_id
                competition_name = flight.event.competition.name

        return jsonify({
            'id': flight.id,
            'name': flight.name,
            'order': flight.order,
            'is_active': flight.is_active,
            'movement_type': flight.movement_type,
            'event_id': flight.event_id,
            'event_name': event_name,
            'competition_id': competition_id,
            'competition_name': competition_name
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve flight: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>', methods=['PUT'])
def update_flight(flight_id):
    """Update flight details"""
    try:
        flight = Flight.query.get(flight_id)
        
        if not flight:
            return jsonify({
                'status': 'error',
                'message': 'Flight not found'
            }), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'name' in data:
            flight.name = data['name'].strip()
        if 'order' in data:
            flight.order = int(data['order'])
        if 'is_active' in data:
            flight.is_active = bool(data['is_active'])
        if 'movement_type' in data:
            flight.movement_type = data['movement_type'].strip() or None
        if 'movement_type' in data:
            flight.movement_type = data['movement_type'].strip() or None
        if 'competition_id' in data:
            competition_id = data['competition_id']
            if competition_id:
                # Check if competition exists
                competition = Competition.query.get(int(competition_id))
                if not competition:
                    return jsonify({
                        'status': 'error',
                        'message': 'Competition not found'
                    }), 404
                flight.competition_id = int(competition_id)
            else:
                flight.competition_id = None
        if 'event_id' in data:
            event_id = data['event_id']
            if event_id:
                # Check if new event exists
                event = Event.query.get(int(event_id))
                if not event:
                    return jsonify({
                        'status': 'error',
                        'message': 'Event not found'
                    }), 404
                flight.event_id = int(event_id)
                # Update competition_id from event if not explicitly set
                if 'competition_id' not in data:
                    flight.competition_id = event.competition_id
            else:
                # Allow setting event_id to None
                flight.event_id = None
        
        db.session.commit()
        
        # Reload with relationships
        flight = Flight.query.options(
            db.joinedload(Flight.event).joinedload(Event.competition),
            db.joinedload(Flight.competition),
            db.joinedload(Flight.athlete_flights)
        ).get(flight_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Flight updated successfully',
            'flight': {
                'id': flight.id,
                'name': flight.name,
                'order': flight.order,
                'is_active': flight.is_active,
                'movement_type': flight.movement_type,
                'event_id': flight.event_id,
                'event_name': flight.event.name if flight.event else None,
                'competition_id': flight.competition_id or (flight.event.competition_id if flight.event and flight.event.competition else None),
                'competition_name': (flight.competition.name if flight.competition 
                                   else (flight.event.competition.name if flight.event and flight.event.competition else None)),
                'athlete_count': len(flight.athlete_flights) if flight.athlete_flights else 0
            }
        }), 200
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Invalid data format: ' + str(e)
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to update flight: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>', methods=['DELETE'])
def delete_flight(flight_id):
    """Delete a flight"""
    try:
        flight = Flight.query.get(flight_id)
        
        if not flight:
            return jsonify({
                'status': 'error',
                'message': 'Flight not found'
            }), 404
        
        db.session.delete(flight)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Flight deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to delete flight: ' + str(e)
        }), 500

@admin_bp.route('/events/<int:event_id>/flights', methods=['GET'])
def get_event_flights(event_id):
    """Get all flights for a specific event"""
    try:
        event = Event.query.get(event_id)
        if not event:
            return jsonify({
                'status': 'error',
                'message': 'Event not found'
            }), 404
        
        flights = Flight.query.filter_by(event_id=event_id).order_by(Flight.order).all()
        
        return jsonify([{
            'id': flight.id,
            'event_id': flight.event_id,
            'name': flight.name,
            'order': flight.order,
            'is_active': flight.is_active,
            'athlete_count': len(flight.athlete_flights)
        } for flight in flights]), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve flights: ' + str(e)
        }), 500

# @admin_bp.route('/flights/reorder', methods=['POST'])
# def reorder_flights():
#     """Update flight order"""
#     try:
#         data = request.get_json()
#         updates = data.get('updates', [])
        
#         for update in updates:
#             flight_id = update.get('id')
#             new_order = update.get('order')
            
#             flight = Flight.query.get(flight_id)
#             if flight:
#                 flight.order = new_order
        
#         db.session.commit()
        
#         return jsonify({
#             'status': 'success',
#             'message': 'Flight order updated successfully'
#         }), 200
        
#     except Exception as e:
#         db.session.rollback()
#         return jsonify({
#             'status': 'error',
#             'message': 'Failed to update flight order: ' + str(e)
#         }), 500

@admin_bp.route('/flights/all', methods=['GET'])
def get_all_flights():
    """Get all flights across all events"""
    try:
        flights = Flight.query.options(
            joinedload(Flight.event).joinedload(Event.competition)
        ).order_by(Flight.order).all()
        
        return jsonify([{
            'id': flight.id,
            'event_id': flight.event_id,
            'event_name': flight.event.name if flight.event else 'No Event',
            'competition_name': flight.event.competition.name if flight.event and flight.event.competition else 'No Competition',
            'name': flight.name,
            'order': flight.order,
            'is_active': flight.is_active,
            'athlete_count': len(flight.athlete_flights)
        } for flight in flights]), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve flights: ' + str(e)
        }), 500

@admin_bp.route('/competitions/<int:competition_id>/events', methods=['GET'])
def get_competition_events(competition_id):
    """Get all events for a specific competition"""
    try:
        competition = Competition.query.get(competition_id)
        if not competition:
            return jsonify({
                'status': 'error',
                'message': 'Competition not found'
            }), 404
        
        events = Event.query.filter_by(competition_id=competition_id).all()
        
        return jsonify([{
            'id': event.id,
            'name': event.name,
            'competition_id': event.competition_id
        } for event in events]), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve events: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>/available-athletes', methods=['GET'])
def get_available_athletes_for_flight(flight_id):
    """Get all athletes that can be assigned to a specific flight"""
    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '', type=str)
        
        flight = Flight.query.options(
            joinedload(Flight.event).joinedload(Event.competition)
        ).get(flight_id)
        
        if not flight:
            return jsonify({
                'status': 'error',
                'message': 'Flight not found'
            }), 404
        
        # Get the competition ID for this flight
        competition_id = None
        if flight.event and flight.event.competition:
            competition_id = flight.event.competition_id
        elif flight.event:
            # Flight might be associated with a competition directly
            event = Event.query.get(flight.event_id)
            if event:
                competition_id = event.competition_id
        
        # If no competition found, get all athletes not in this specific flight
        if not competition_id:
            subquery = db.session.query(AthleteFlight.athlete_id).filter(
                AthleteFlight.flight_id == flight_id
            ).subquery()
            available_athletes_query = db.session.query(Athlete).filter(
                ~Athlete.id.in_(subquery),
                Athlete.is_active == True
            )
        else:
            # Get athletes in the same competition who are not in this specific flight
            subquery = db.session.query(AthleteFlight.athlete_id).filter(
                AthleteFlight.flight_id == flight_id
            ).subquery()
            available_athletes_query = db.session.query(Athlete).filter(
                Athlete.competition_id == competition_id,
                ~Athlete.id.in_(subquery),
                Athlete.is_active == True
            )
        
        # Add search filter if provided
        if search:
            search_filter = f"%{search}%"
            available_athletes_query = available_athletes_query.filter(
                db.or_(
                    Athlete.first_name.ilike(search_filter),
                    Athlete.last_name.ilike(search_filter),
                    Athlete.team.ilike(search_filter),
                    Athlete.email.ilike(search_filter)
                )
            )
        
        # Apply pagination
        paginated_athletes = available_athletes_query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'flight': {
                'id': flight.id,
                'name': flight.name,
                'event_id': flight.event_id,
                'event_name': flight.event.name if flight.event else None,
                'competition_id': competition_id,
                'competition_name': flight.event.competition.name if flight.event and flight.event.competition else None
            },
            'athletes': [{
                'id': athlete.id,
                'first_name': athlete.first_name,
                'last_name': athlete.last_name,
                'full_name': f"{athlete.first_name} {athlete.last_name}",
                'email': athlete.email,
                'team': athlete.team,
                'bodyweight': athlete.bodyweight,
                'gender': athlete.gender,
                'age': athlete.age,
                'competition_id': athlete.competition_id,
                'competition_name': athlete.competition.name if athlete.competition else None
            } for athlete in paginated_athletes.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': paginated_athletes.total,
                'pages': paginated_athletes.pages,
                'has_prev': paginated_athletes.has_prev,
                'has_next': paginated_athletes.has_next
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve available athletes: ' + str(e)
        }), 500

@admin_bp.route('/events/<int:event_id>/available-athletes', methods=['GET'])
def get_available_athletes(event_id):
    """Get all athletes that can be assigned to flights for this event"""
    try:
        from ..models import AthleteFlight
        
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)  # Default 50 athletes per page
        search = request.args.get('search', '', type=str)
        
        event = Event.query.get(event_id)
        if not event:
            return jsonify({
                'status': 'error',
                'message': 'Event not found'
            }), 404
        
        # Get all athletes in this event's competition
        # Filter out those already in flights for this event
        subquery = db.session.query(AthleteFlight.athlete_id).join(Flight).filter(Flight.event_id == event_id).subquery()
        
        available_athletes_query = db.session.query(Athlete).filter(
            Athlete.competition_id == event.competition_id,
            ~Athlete.id.in_(subquery),
            Athlete.is_active == True
        )
        
        # Add search filter if provided
        if search:
            search_filter = f"%{search}%"
            available_athletes_query = available_athletes_query.filter(
                db.or_(
                    Athlete.first_name.ilike(search_filter),
                    Athlete.last_name.ilike(search_filter),
                    Athlete.team.ilike(search_filter)
                )
            )
        
        # Apply pagination
        paginated_athletes = available_athletes_query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'athletes': [{
                'id': athlete.id,
                'first_name': athlete.first_name,
                'last_name': athlete.last_name,
                'email': athlete.email,
                'team': athlete.team,
                'bodyweight': athlete.bodyweight,
                'gender': athlete.gender,
                'age': athlete.age,
                'competition_name': athlete.competition.name if athlete.competition else None
            } for athlete in paginated_athletes.items],
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': paginated_athletes.total,
                'pages': paginated_athletes.pages,
                'has_prev': paginated_athletes.has_prev,
                'has_next': paginated_athletes.has_next
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve available athletes: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>/athletes', methods=['GET'])
def get_flight_athletes(flight_id):
    """Get all athletes assigned to a specific flight"""
    try:
        flight = Flight.query.options(
            joinedload(Flight.event).joinedload(Event.competition)
        ).get(flight_id)
        
        if not flight:
            return jsonify({
                'status': 'error',
                'message': 'Flight not found'
            }), 404
        
        # Get athletes with their flight order
        flight_athletes_query = db.session.query(Athlete, AthleteFlight).join(
            AthleteFlight, Athlete.id == AthleteFlight.athlete_id
        ).filter(
            AthleteFlight.flight_id == flight_id
        ).options(
            joinedload(Athlete.competition)
        ).order_by(AthleteFlight.order)
        
        flight_athletes = flight_athletes_query.all()
        
        return jsonify({
            'flight': {
                'id': flight.id,
                'name': flight.name,
                'event_id': flight.event_id,
                'order': flight.order,
                'event_name': flight.event.name if flight.event else None,
                'competition_id': flight.event.competition_id if flight.event and flight.event.competition else None,
                'competition_name': flight.event.competition.name if flight.event and flight.event.competition else None
            },
            'athletes': [{
                'id': athlete.id,
                'first_name': athlete.first_name,
                'last_name': athlete.last_name,
                'full_name': f"{athlete.first_name} {athlete.last_name}",
                'email': athlete.email,
                'team': athlete.team,
                'bodyweight': athlete.bodyweight,
                'gender': athlete.gender,
                'age': athlete.age,
                'competition_id': athlete.competition_id,
                'competition_name': athlete.competition.name if athlete.competition else None,
                'order': athlete_flight.order
            } for athlete, athlete_flight in flight_athletes]
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve flight athletes: ' + str(e)
        }), 500

@admin_bp.route('/athletes/<int:athlete_id>/attempts', methods=['GET'])
def get_athlete_attempts(athlete_id):
    """Get attempts for a specific athlete, optionally filtered by flight (for timekeeper attempt dropdown)"""
    try:
        athlete = Athlete.query.get(athlete_id)
        if not athlete:
            return jsonify({
                'status': 'error',
                'message': 'Athlete not found'
            }), 404
        
        # Check if flight_id is provided as query parameter for filtering
        flight_id = request.args.get('flight_id', type=int)
        
        # Get athlete entries with their attempts, optionally filtered by flight
        entries_query = AthleteEntry.query.options(
            joinedload(AthleteEntry.attempts),
            joinedload(AthleteEntry.event)
        ).filter_by(athlete_id=athlete_id)
        
        if flight_id:
            # Filter by specific flight if provided
            entries_query = entries_query.filter_by(flight_id=flight_id)
        
        entries = entries_query.all()
        
        attempts_data = []
        for entry in entries:
            for attempt in sorted(entry.attempts, key=lambda x: x.attempt_number):
                attempts_data.append({
                    'id': attempt.id,
                    'attempt_number': attempt.attempt_number,
                    'movement_type': attempt.movement_type,
                    'lift_type': entry.lift_type,
                    'movement_name': entry.movement_name,
                    'requested_weight': attempt.requested_weight,
                    'status': attempt.status or 'waiting',
                    'event_name': entry.event.name if entry.event else None,
                    'sport_type': entry.event.sport_type.value if entry.event and entry.event.sport_type else None
                })
        
        # Get unique attempt numbers for dropdown
        attempt_numbers = sorted(set(attempt['attempt_number'] for attempt in attempts_data))
        
        return jsonify({
            'athlete_id': athlete_id,
            'athlete_name': f"{athlete.first_name} {athlete.last_name}",
            'attempt_numbers': attempt_numbers,
            'attempts': attempts_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve athlete attempts: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>/athletes/<int:athlete_id>', methods=['POST'])
def add_athlete_to_flight(flight_id, athlete_id):
    """Add an athlete to a flight"""
    try:
        flight = Flight.query.options(
            joinedload(Flight.event).joinedload(Event.competition)
        ).get(flight_id)
        athlete = Athlete.query.get(athlete_id)
        
        if not flight or not athlete:
            return jsonify({
                'status': 'error',
                'message': 'Flight or athlete not found'
            }), 404
        
        # Check if athlete is already in this flight
        existing = AthleteFlight.query.filter_by(flight_id=flight_id, athlete_id=athlete_id).first()
        if existing:
            return jsonify({
                'status': 'error',
                'message': 'Athlete is already in this flight'
            }), 400
        
        # Get the next order number for this flight
        max_order = db.session.query(db.func.max(AthleteFlight.order)).filter(
            AthleteFlight.flight_id == flight_id
        ).scalar() or 0
        next_order = max_order + 1
        
        # Update athlete's competition_id if the flight is associated with a competition
        if flight.event and flight.event.competition:
            competition_id = flight.event.competition_id
            if athlete.competition_id != competition_id:
                athlete.competition_id = competition_id
        
        # Add athlete to flight
        athlete_flight = AthleteFlight(
            flight_id=flight_id, 
            athlete_id=athlete_id,
            order=next_order
        )
        db.session.add(athlete_flight)
        
        # Auto-create AthleteEntry records for this event's movements
        if flight.event:
            from ..routes.athlete import ensure_athlete_entries_for_event
            ensure_athlete_entries_for_event(athlete_id, flight.event.id, flight_id, next_order)
        
        db.session.commit()
        
        # Return updated athlete information
        athlete_data = {
            'id': athlete.id,
            'first_name': athlete.first_name,
            'last_name': athlete.last_name,
            'full_name': f"{athlete.first_name} {athlete.last_name}",
            'email': athlete.email,
            'team': athlete.team,
            'bodyweight': athlete.bodyweight,
            'gender': athlete.gender,
            'age': athlete.age,
            'competition_id': athlete.competition_id,
            'competition_name': athlete.competition.name if athlete.competition else None,
            'order': next_order
        }
        
        return jsonify({
            'status': 'success',
            'message': 'Athlete added to flight successfully',
            'athlete': athlete_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to add athlete to flight: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>/athletes/<int:athlete_id>', methods=['DELETE'])
def remove_athlete_from_flight(flight_id, athlete_id):
    """Remove an athlete from a flight"""
    try:
        athlete_flight = AthleteFlight.query.filter_by(flight_id=flight_id, athlete_id=athlete_id).first()
        
        if not athlete_flight:
            return jsonify({
                'status': 'error',
                'message': 'Athlete not found in this flight'
            }), 404
        
        # Get flight and athlete info before deletion
        flight = Flight.query.get(flight_id)
        athlete = Athlete.query.get(athlete_id)
        
        # Remove related AthleteEntry records for this athlete and specific flight
        if flight and flight.event:
            athlete_entries = AthleteEntry.query.filter_by(
                athlete_id=athlete_id,
                event_id=flight.event.id,
                flight_id=flight_id  # Only remove entries for this specific flight
            ).all()
            
            for entry in athlete_entries:
                # Also remove related attempts for this specific flight
                attempts = Attempt.query.filter_by(
                    athlete_id=athlete_id,
                    athlete_entry_id=entry.id,
                    flight_id=flight_id
                ).all()
                
                for attempt in attempts:
                    db.session.delete(attempt)
                    
                db.session.delete(entry)
        
        db.session.delete(athlete_flight)
        db.session.commit()
        
        # Return the removed athlete data for frontend updates
        athlete_data = {
            'id': athlete.id,
            'first_name': athlete.first_name,
            'last_name': athlete.last_name,
            'full_name': f"{athlete.first_name} {athlete.last_name}",
            'email': athlete.email,
            'team': athlete.team,
            'bodyweight': athlete.bodyweight,
            'gender': athlete.gender,
            'age': athlete.age,
            'competition_id': athlete.competition_id,
            'competition_name': athlete.competition.name if athlete.competition else None
        } if athlete else None
        
        return jsonify({
            'status': 'success',
            'message': 'Athlete removed from flight successfully',
            'athlete': athlete_data
        }), 200

        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to remove athlete from flight: ' + str(e)
        }), 500

@admin_bp.route('/api/competitions/<int:competition_id>/referees-status')
def get_competition_referees_status(competition_id):
    """Get referee status for a competition"""
    try:
        competition = Competition.query.get_or_404(competition_id)
        
        # Get required number of referees from config
        required_referees = 3  # Default
        if competition.config and 'events' in competition.config:
            for event in competition.config['events']:
                if 'groups' in event:
                    for group in event['groups']:
                        if 'referee' in group and 'n' in group['referee']:
                            required_referees = int(group['referee']['n'])
                            break
                    else:
                        continue
                    break
                if 'movements' in event:
                    for movement in event['movements']:
                        if 'referee' in movement and 'ref_n' in movement['referee']:
                            required_referees = int(movement['referee']['ref_n'])
                            break
                    else:
                        continue
                    break
        
        # Get existing referees
        existing_referees = Referee.query.filter_by(competition_id=competition_id).all()
        
        return jsonify({
            'success': True,
            'competition_name': competition.name,
            'required_referees': required_referees,
            'existing_referees': len(existing_referees),
            'referees_needed': max(0, required_referees - len(existing_referees)),
            'can_auto_generate': required_referees > len(existing_referees),
            'referees': [{
                'id': ref.id,
                'username': ref.username,
                'position': ref.position,
                'email': ref.email,
                'phone': ref.phone,
                'is_active': ref.is_active,
                'last_login': ref.last_login.isoformat() if ref.last_login else None
            } for ref in existing_referees]
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting referee status: {str(e)}'
        }), 500

@admin_bp.route('/flights/<int:flight_id>/athletes/reorder', methods=['POST'])
def reorder_flight_athletes(flight_id):
    """Update the order of athletes within a flight"""
    try:
        data = request.get_json()
        athlete_orders = data.get('athlete_orders', [])
        
        if not athlete_orders:
            return jsonify({
                'status': 'error',
                'message': 'No athlete order data provided'
            }), 400
        
        # Get flight info to find the event
        flight = Flight.query.get(flight_id)
        if not flight:
            return jsonify({
                'status': 'error',
                'message': 'Flight not found'
            }), 404
        
        # Update each athlete's order in both AthleteFlight and AthleteEntry
        for item in athlete_orders:
            athlete_id = item.get('athlete_id')
            new_order = item.get('order')
            
            if athlete_id is None or new_order is None:
                continue
                
            # Update AthleteFlight order
            athlete_flight = AthleteFlight.query.filter_by(
                flight_id=flight_id, 
                athlete_id=athlete_id
            ).first()
            
            if athlete_flight:
                athlete_flight.order = new_order
                
                # Update corresponding AthleteEntry entry_order for this athlete and event
                if flight.event:
                    athlete_entries = AthleteEntry.query.filter_by(
                        athlete_id=athlete_id,
                        event_id=flight.event.id,
                        flight_id=flight_id
                    ).all()
                    
                    for entry in athlete_entries:
                        entry.entry_order = new_order
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Athletes reordered successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to reorder athletes: ' + str(e)
        }), 500
        
        
        
@admin_bp.post("/timer/log")
def create_timer_log():
    data = request.get_json(force=True) or {}
    # expected keys (send what you have):
    # competition_id, event_id, flight_id, athlete, action, start, stop, duration_sec

    # parse times if you post ISO strings; optional:
    def parse_ts(s):
        if not s: return None
        return datetime.fromisoformat(s.replace("Z","+00:00"))
    row = TimerLog(
        competition_id = data.get("competition_id"),
        event_id       = data.get("event_id"),
        flight_id      = data.get("flight_id"),
        athlete        = (data.get("athlete") or "")[:120],
        action         = data.get("action") or "Attempt",
        start_ts       = parse_ts(data.get("start_iso")),
        stop_ts        = parse_ts(data.get("stop_iso")),
        duration_sec   = data.get("duration_sec"),
        meta_json      = data.get("meta") or {},
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({"ok": True, "id": row.id})


@admin_bp.get("/timer/log")
def list_timer_log():
    q = TimerLog.query
    flight_id = request.args.get("flight_id")
    athlete   = request.args.get("athlete")
    if flight_id:
        q = q.filter(TimerLog.flight_id == int(flight_id))
    if athlete:
        q = q.filter(TimerLog.athlete.ilike(f"%{athlete}%"))
    q = q.order_by(TimerLog.created_at.desc()).limit(200)
    rows = [{
        "id": r.id,
        "athlete": r.athlete,
        "action": r.action,
        "start_iso": r.start_ts.isoformat() if r.start_ts else None,
        "stop_iso":  r.stop_ts.isoformat()  if r.stop_ts  else None,
        "duration_sec": r.duration_sec,
        "competition_id": r.competition_id,
        "event_id": r.event_id,
        "flight_id": r.flight_id,
    } for r in q.all()]
    return jsonify(rows)


def _to_seconds(val):
    """Accepts int, float, 'MM:SS', 'HH:MM:SS', or numeric strings."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(val)
    s = str(val).strip()
    if not s:
        return None
    if ":" in s:
        parts = [int(p or 0) for p in s.split(":")]
        if len(parts) == 3:
            return parts[0]*3600 + parts[1]*60 + parts[2]
        if len(parts) == 2:
            return parts[0]*60 + parts[1]
    try:
        return int(float(s))
    except Exception:
        return None

def _extract_times_from_event_dict(edict):
    """Search a single event dict for attempt/break time fields (top, movements, groups)."""
    attempt_sec = None
    break_sec = None

    def scan_obj(obj):
        nonlocal attempt_sec, break_sec
        if not isinstance(obj, dict):
            return
        for k, v in obj.items():
            kl = str(k).lower()
            if attempt_sec is None and ("attempt" in kl and "time" in kl):
                attempt_sec = _to_seconds(v)
            if break_sec is None and ("break" in kl and "time" in kl):
                break_sec = _to_seconds(v)

    if isinstance(edict, dict):
        scan_obj(edict)
        for mv in (edict.get("movements") or []):
            scan_obj(mv)
        for grp in (edict.get("groups") or []):
            scan_obj(grp)

    return attempt_sec, break_sec

# --- TIMER LOG API (already in your file) ---
# def create_timer_log(): ...
# def list_timer_log(): ...

# === NEW: Timer defaults API (reads Competition.config to return attempt/break seconds) ===
@admin_bp.get("/api/timer-defaults")
def api_timer_defaults():
    """
    Returns the attempt_seconds and break_seconds for the selected flight,
    derived from the Competition.config JSON (set in the model editor).
    Query params: comp_id, event_id, flight_id (any 1 is fine; flight_id preferred)
    """
    from sqlalchemy.orm import joinedload
    comp_id  = request.args.get("comp_id", type=int)
    event_id = request.args.get("event_id", type=int)
    flight_id = request.args.get("flight_id", type=int)

    # If we have a flight_id but not comp/event IDs, derive them.
    if flight_id and not (comp_id and event_id):
        fl = Flight.query.options(
            joinedload(Flight.event).joinedload(Event.competition),
            joinedload(Flight.competition)
        ).get(flight_id)
        if not fl:
            return jsonify({"attempt_seconds": None, "break_seconds": None}), 404
        if not event_id and fl.event:
            event_id = fl.event.id
        if not comp_id:
            comp_id = (fl.event.competition_id if fl.event and fl.event.competition else None) or fl.competition_id

    if not comp_id:
        return jsonify({"attempt_seconds": None, "break_seconds": None})

    comp = Competition.query.get(comp_id)
    attempt = None
    brk = None

    # Try to match the event by name (ids in config may not exist)
    event_name = None
    if event_id:
        ev = Event.query.get(event_id)
        event_name = ev.name if ev else None

    if comp and comp.config:
        for ev_cfg in (comp.config.get("events") or []):
            if event_name and ev_cfg.get("name") != event_name:
                continue

            # Prefer movement-level timers if present
            for mv in (ev_cfg.get("movements") or []):
                t = (mv.get("timer") or {})
                if attempt is None and t.get("attempt_seconds") is not None:
                    attempt = int(t["attempt_seconds"])
                if brk is None and t.get("break_seconds") is not None:
                    brk = int(t["break_seconds"])
                if attempt is not None or brk is not None:
                    break

            # Optional: if you later add group-level overrides
            for grp in (ev_cfg.get("groups") or []):
                t = (grp.get("timer") or {})
                if attempt is None and t.get("attempt_seconds") is not None:
                    attempt = int(t["attempt_seconds"])
                if brk is None and t.get("break_seconds") is not None:
                    brk = int(t["break_seconds"])

            if event_name:
                break

    return jsonify({
        "attempt_seconds": attempt,
        "break_seconds": brk,
        "comp_id": comp_id,
        "event_id": event_id,
        "flight_id": flight_id
    })

# Lifting Order Management Routes
@admin_bp.route('/flights/<int:flight_id>/attempts/order', methods=['GET'])
def get_flight_attempts_order(flight_id):
    """Get attempts ordered by lifting_order for a flight"""
    try:
        flight = Flight.query.get_or_404(flight_id)
        
        # Get all attempts for this specific flight, ordered by lifting_order
        attempts = db.session.query(Attempt).filter(
            Attempt.flight_id == flight_id
        ).order_by(
            Attempt.lifting_order.asc().nulls_last(),
            Attempt.id.asc()  # Secondary sort for consistent ordering
        ).all()
        
        # Initialize lifting_order for attempts that don't have it set
        order_counter = 1
        needs_commit = False
        for attempt in attempts:
            if attempt.lifting_order is None:
                attempt.lifting_order = order_counter
                needs_commit = True
            order_counter += 1
        
        if needs_commit:
            db.session.commit()
            # Re-query to get updated data
            attempts = db.session.query(Attempt).filter(
                Attempt.flight_id == flight_id
            ).order_by(
                Attempt.lifting_order.asc(),
                Attempt.id.asc()
            ).all()
        
        attempts_data = []
        for attempt in attempts:
            attempts_data.append({
                'id': attempt.id,
                'athlete_id': attempt.athlete_id,
                'athlete_name': f"{attempt.athlete.first_name} {attempt.athlete.last_name}",
                'attempt_number': attempt.attempt_number,
                'requested_weight': attempt.requested_weight,
                'lifting_order': attempt.lifting_order,
                'status': attempt.status,
                'final_result': attempt.final_result.value if attempt.final_result else None,
                'started_at': attempt.started_at.isoformat() if attempt.started_at else None,
                'completed_at': attempt.completed_at.isoformat() if attempt.completed_at else None
            })
        
        return jsonify({
            'status': 'success',
            'attempts': attempts_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': 'Failed to retrieve attempts order: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>/attempts/reorder', methods=['POST'])
def reorder_flight_attempts(flight_id):
    """Reorder attempts by lifting_order for a flight"""
    try:
        flight = Flight.query.get_or_404(flight_id)
        data = request.get_json()
        updates = data.get('updates', [])
        
        for update in updates:
            attempt_id = update.get('id')
            new_lifting_order = update.get('lifting_order')
            
            if attempt_id:  # Check if attempt_id is not None/empty
                attempt = Attempt.query.get(attempt_id)
                if attempt:
                    attempt.lifting_order = new_lifting_order
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Attempt order updated successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to update attempt order: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>/attempts/sort/<sort_type>', methods=['POST'])
def sort_flight_attempts(flight_id, sort_type):
    """Sort attempts by various criteria (weight, name, random)"""
    try:
        flight = Flight.query.get_or_404(flight_id)
        
        # Get all attempts for athletes in this flight
        attempts = db.session.query(Attempt).join(
            AthleteFlight, Attempt.athlete_id == AthleteFlight.athlete_id
        ).filter(
            AthleteFlight.flight_id == flight_id
        ).all()
        
        if sort_type == 'weight':
            # Sort by requested weight (ascending)
            attempts.sort(key=lambda x: x.requested_weight or 0)
        elif sort_type == 'name':
            # Sort by athlete name
            attempts.sort(key=lambda x: f"{x.athlete.first_name} {x.athlete.last_name}")
        elif sort_type == 'random':
            # Randomize order
            import random
            random.shuffle(attempts)
        else:
            return jsonify({
                'status': 'error',
                'message': 'Invalid sort type. Use: weight, name, or random'
            }), 400
        
        # Update lifting_order based on new order
        for i, attempt in enumerate(attempts):
            attempt.lifting_order = i + 1
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'Attempts sorted by {sort_type} successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to sort attempts: ' + str(e)
        }), 500

@admin_bp.route('/flights/<int:flight_id>/attempts/generate-test', methods=['POST'])
def generate_test_attempts(flight_id):
    """Generate test attempts for all athletes in a flight (for testing purposes)"""
    try:
        flight = Flight.query.get_or_404(flight_id)
        
        # Get all athletes in this flight
        athlete_flights = AthleteFlight.query.filter_by(flight_id=flight_id).all()
        
        if not athlete_flights:
            return jsonify({
                'status': 'error',
                'message': 'No athletes in this flight'
            }), 400
        
        lifting_order = 1
        attempts_created = 0
        
        for af in athlete_flights:
            athlete = af.athlete
            
            # Create 3 attempts for each athlete (typical for weightlifting)
            for attempt_num in range(1, 4):
                # Check if attempt already exists for this athlete in this flight
                existing = Attempt.query.filter_by(
                    athlete_id=athlete.id,
                    flight_id=flight_id,
                    attempt_number=attempt_num
                ).first()
                
                if not existing:
                    # Get athlete entry for this flight
                    athlete_entry = AthleteEntry.query.join(AthleteFlight).filter(
                        AthleteEntry.athlete_id == athlete.id,
                        AthleteFlight.flight_id == flight_id
                    ).first()
                    
                    # Create a test attempt with a reasonable weight
                    base_weight = 50 + (athlete.id % 20) * 5  # Vary weights based on athlete ID
                    attempt_weight = base_weight + (attempt_num - 1) * 5  # Increase each attempt
                    
                    attempt = Attempt(
                        athlete_id=athlete.id,
                        athlete_entry_id=athlete_entry.id if athlete_entry else None,
                        flight_id=flight_id,
                        attempt_number=attempt_num,
                        requested_weight=attempt_weight,
                        lifting_order=lifting_order
                    )
                    
                    db.session.add(attempt)
                    lifting_order += 1
                    attempts_created += 1
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': f'Generated {attempts_created} test attempts for flight {flight.name}',
            'attempts_created': attempts_created
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to generate test attempts: ' + str(e)
        }), 500

@admin_bp.route('/attempts/<int:attempt_id>/weight', methods=['PUT'])
def update_attempt_weight(attempt_id):
    """Update the weight of a specific attempt"""
    try:
        attempt = Attempt.query.get_or_404(attempt_id)
        data = request.get_json()
        new_weight = data.get('weight')
        
        # Allow any numeric weight value (including negative, zero, etc.)
        if new_weight is None or not isinstance(new_weight, (int, float)):
            return jsonify({
                'status': 'error',
                'message': 'Weight must be a valid number'
            }), 400
        
        # Check if attempt is already finished
        if attempt.completed_at or attempt.final_result:
            return jsonify({
                'status': 'error',
                'message': 'Cannot modify weight of a finished attempt'
            }), 400
        
        # Update the weight
        attempt.requested_weight = new_weight
        
        # If this is attempt 1 (opening weight), also update the AthleteEntry.opening_weights
        if attempt.attempt_number == 1 and attempt.athlete_entry_id:
            athlete_entry = AthleteEntry.query.get(attempt.athlete_entry_id)
            if athlete_entry:
                athlete_entry.opening_weights = int(new_weight) if new_weight is not None else 0
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Attempt weight updated successfully',
            'attempt': {
                'id': attempt.id,
                'requested_weight': attempt.requested_weight
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to update attempt weight: ' + str(e)
        }), 500


@admin_bp.route('/update_attempt_status', methods=['POST'])
def update_attempt_status():
    """Update the status of an attempt"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        attempt_id = data.get('attempt_id')
        new_status = data.get('status')
        
        if not attempt_id or not new_status:
            return jsonify({'error': 'attempt_id and status are required'}), 400
        
        # Validate status value
        valid_statuses = ['waiting', 'in-progress', 'finished']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400
        
        # Find the attempt
        attempt = Attempt.query.get(attempt_id)
        if not attempt:
            return jsonify({'error': 'Attempt not found'}), 404
        
        # Update the status
        attempt.status = new_status
        
        # If marking as finished, set completed_at timestamp
        if new_status == 'finished':
            from datetime import datetime
            attempt.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'message': 'Attempt status updated successfully'})
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating attempt status: {str(e)}")
        return jsonify({'error': 'Failed to update attempt status'}), 500


@admin_bp.route('/attempts/<int:attempt_id>', methods=['GET'])
def get_attempt(attempt_id):
    """Get a specific attempt"""
    try:
        attempt = Attempt.query.get_or_404(attempt_id)
        
        # Get athlete information
        athlete = Athlete.query.get(attempt.athlete_id)
        athlete_name = f"{athlete.first_name} {athlete.last_name}" if athlete else "Unknown Athlete"
        
        return jsonify({
            'id': attempt.id,
            'athlete_id': attempt.athlete_id,
            'athlete_name': athlete_name,
            'attempt_number': attempt.attempt_number,
            'requested_weight': attempt.requested_weight,
            'status': attempt.status or 'waiting',
            'lifting_order': attempt.lifting_order,
            'completed_at': attempt.completed_at.isoformat() if attempt.completed_at else None,
            'final_result': attempt.final_result
        })
        
    except Exception as e:
        print(f"Error getting attempt: {str(e)}")
        return jsonify({'error': 'Failed to get attempt'}), 500


@admin_bp.route('/attempts', methods=['POST'])
def create_attempt():
    """Create a new attempt"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['athlete_id', 'attempt_number', 'requested_weight', 'flight_id']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if athlete is in the flight
        athlete_flight = AthleteFlight.query.filter_by(
            athlete_id=data['athlete_id'],
            flight_id=data['flight_id']
        ).first()
        
        if not athlete_flight:
            return jsonify({'error': 'Athlete is not registered in this flight'}), 400
        
        # Check for duplicate attempt (per athlete per flight)
        existing_attempt = Attempt.query.filter_by(
            athlete_id=data['athlete_id'],
            flight_id=data['flight_id'],
            attempt_number=data['attempt_number']
        ).first()
        
        if existing_attempt:
            return jsonify({'error': f'Attempt {data["attempt_number"]} already exists for this athlete in this flight'}), 400
        
        # Get athlete entry for this flight
        athlete_entry = AthleteEntry.query.join(AthleteFlight).filter(
            AthleteEntry.athlete_id == data['athlete_id'],
            AthleteFlight.flight_id == data['flight_id']
        ).first()
        
        if not athlete_entry:
            return jsonify({'error': 'No athlete entry found for this athlete in this flight'}), 400
        
        # Create new attempt
        attempt = Attempt(
            athlete_id=data['athlete_id'],
            athlete_entry_id=athlete_entry.id,
            flight_id=data['flight_id'],
            attempt_number=data['attempt_number'],
            requested_weight=data['requested_weight'],
            lifting_order=data.get('lifting_order'),
        )
        
        # Set status if provided
        if 'status' in data:
            attempt.status = data['status']
        
        db.session.add(attempt)
        db.session.commit()
        
        return jsonify({
            'message': 'Attempt created successfully',
            'attempt_id': attempt.id
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating attempt: {str(e)}")
        return jsonify({'error': 'Failed to create attempt'}), 500


@admin_bp.route('/attempts/<int:attempt_id>', methods=['PUT'])
def update_attempt(attempt_id):
    """Update an existing attempt"""
    try:
        attempt = Attempt.query.get_or_404(attempt_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update fields if provided
        if 'requested_weight' in data:
            attempt.requested_weight = data['requested_weight']
        if 'actual_weight' in data:
            attempt.actual_weight = data['actual_weight']
        if 'final_result' in data:
            attempt.final_result = AttemptResult[data['final_result'].upper()]
        if 'status' in data:
            attempt.status = data['status']
        if 'lifting_order' in data:
            attempt.lifting_order = data['lifting_order']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Attempt updated successfully',
            'attempt_id': attempt.id
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating attempt: {str(e)}")
        return jsonify({'error': 'Failed to update attempt'}), 500


# ============================================================================
# SCORING API ENDPOINTS
# ============================================================================

@admin_bp.route('/api/scoring/athlete-entry/<int:athlete_entry_id>', methods=['GET'])
def get_athlete_entry_score(athlete_entry_id):
    """
    Get calculated score for an athlete entry.
    """
    try:
        score_data = ScoringCalculator.calculate_athlete_entry_score(athlete_entry_id)
        return jsonify({
            'success': True,
            'athlete_entry_id': athlete_entry_id,
            'score': score_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error calculating score: {str(e)}'
        }), 500


@admin_bp.route('/api/scoring/athlete-entry/<int:athlete_entry_id>/save', methods=['POST'])
def save_athlete_entry_score(athlete_entry_id):
    """
    Calculate and save score for an athlete entry.
    """
    try:
        score = ScoringCalculator.calculate_and_save_score(athlete_entry_id)
        return jsonify({
            'success': True,
            'message': 'Score calculated and saved successfully',
            'score': {
                'id': score.id,
                'athlete_entry_id': score.athlete_entry_id,
                'best_attempt_weight': score.best_attempt_weight,
                'total_score': score.total_score,
                'rank': score.rank,
                'score_type': score.score_type,
                'is_final': score.is_final
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error saving score: {str(e)}'
        }), 500


@admin_bp.route('/api/scoring/event/<int:event_id>/rankings', methods=['GET'])
def get_event_rankings(event_id):
    """
    Get rankings for all athletes in an event.
    """
    try:
        rankings = ScoringCalculator.calculate_event_rankings(event_id)
        return jsonify({
            'success': True,
            'event_id': event_id,
            'rankings': rankings
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error calculating rankings: {str(e)}'
        }), 500


@admin_bp.route('/api/scoring/flight/<int:flight_id>/rankings', methods=['GET'])
def get_flight_rankings(flight_id):
    """
    Get rankings for all athletes in a flight.
    """
    try:
        rankings = ScoringCalculator.calculate_flight_rankings(flight_id)
        return jsonify({
            'success': True,
            'flight_id': flight_id,
            'rankings': rankings
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error calculating flight rankings: {str(e)}'
        }), 500


@admin_bp.route('/api/scoring/event/<int:event_id>/finalize', methods=['POST'])
def finalize_event_scores(event_id):
    """
    Mark all scores for an event as final.
    """
    try:
        ScoringCalculator.finalize_event_scores(event_id)
        return jsonify({
            'success': True,
            'message': f'Scores for event {event_id} have been finalized'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error finalizing scores: {str(e)}'
        }), 500


@admin_bp.route('/api/scoring/athlete/<int:athlete_id>/event/<int:event_id>/total', methods=['GET'])
def get_athlete_total_score(athlete_id, event_id):
    """
    Get total score for an athlete across all movements in an event.
    Useful for Olympic Weightlifting (Snatch + Clean & Jerk).
    """
    try:
        total_data = ScoringCalculator.get_athlete_total_score(athlete_id, event_id)
        return jsonify({
            'success': True,
            'total': total_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error calculating total score: {str(e)}'
        }), 500


@admin_bp.route('/api/scoring/attempt/<int:attempt_id>/time', methods=['POST'])
def record_attempt_time(attempt_id):
    """
    Record timing data for an attempt (for time-based scoring).
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Parse timestamps
        start_time_str = data.get('start_time')
        end_time_str = data.get('end_time')
        
        if not start_time_str or not end_time_str:
            return jsonify({'success': False, 'message': 'start_time and end_time required'}), 400
        
        # Convert to datetime objects
        start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        
        time_taken = TimerScoring.record_attempt_time(attempt_id, start_time, end_time)
        
        return jsonify({
            'success': True,
            'message': 'Attempt time recorded successfully',
            'time_taken': time_taken,
            'attempt_id': attempt_id
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error recording time: {str(e)}'
        }), 500


@admin_bp.route('/api/scoring/attempt/<int:attempt_id>/duration', methods=['GET'])
def get_attempt_duration(attempt_id):
    """
    Get duration of an attempt.
    """
    try:
        duration = TimerScoring.get_attempt_duration(attempt_id)
        
        if duration is None:
            return jsonify({
                'success': False,
                'message': 'Attempt timing data not available'
            }), 404
        
        return jsonify({
            'success': True,
            'attempt_id': attempt_id,
            'duration': duration
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting attempt duration: {str(e)}'
        }), 500

# ============================================================================
        
        # Update fields if provided
        if 'requested_weight' in data:
            attempt.requested_weight = data['requested_weight']
        
        if 'status' in data:
            attempt.status = data['status']
            
        if 'lifting_order' in data:
            attempt.lifting_order = data['lifting_order']
            
        if 'attempt_number' in data:
            # Check for duplicate attempt numbers for the same athlete in the same flight
            existing_attempt = Attempt.query.filter_by(
                athlete_id=attempt.athlete_id,
                flight_id=attempt.flight_id,
                attempt_number=data['attempt_number']
            ).filter(Attempt.id != attempt_id).first()
            
            if existing_attempt:
                return jsonify({'error': f'Attempt {data["attempt_number"]} already exists for this athlete in this flight'}), 400
            
            attempt.attempt_number = data['attempt_number']
        
        db.session.commit()
        
        return jsonify({'message': 'Attempt updated successfully'})
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating attempt: {str(e)}")
        return jsonify({'error': 'Failed to update attempt'}), 500


@admin_bp.route('/attempts/<int:attempt_id>', methods=['DELETE'])
def delete_attempt(attempt_id):
    """Delete an attempt"""
    try:
        attempt = Attempt.query.get_or_404(attempt_id)
        
        # Don't allow deletion of finished attempts
        if attempt.completed_at or attempt.final_result:
            return jsonify({'error': 'Cannot delete finished attempts'}), 400
        
        db.session.delete(attempt)
        db.session.commit()
        
        return jsonify({'message': 'Attempt deleted successfully'})
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting attempt: {str(e)}")
        return jsonify({'error': 'Failed to delete attempt'}), 500

@admin_bp.route('/update-account', methods=['POST'])
def update_account():
    """Update admin account settings"""
    auth_check = require_admin_auth()
    if auth_check:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    try:
        user_id = session.get('user_id')
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found in database'}), 404
            
        if user.role != UserRole.ADMIN:
            return jsonify({'success': False, 'error': 'User is not an admin'}), 403
        
        new_password = request.form.get('new_password')
        
        # Validate and update password
        if not new_password or not new_password.strip():
            return jsonify({'success': False, 'error': 'Password is required'}), 400
            
        if len(new_password.strip()) < 6:
            return jsonify({'success': False, 'error': 'Password must be at least 6 characters long'}), 400
        
        user.password_hash = generate_password_hash(new_password.strip())
        
        # Commit changes
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Account updated successfully'})
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating admin account: {str(e)}")
        return jsonify({'success': False, 'error': 'An error occurred while updating account'}), 500


# ============================================
# Technical Violations Management API
# ============================================

@admin_bp.route('/violations')
def violations_management():
    """Violations management page"""
    auth_check = require_admin_auth()
    if auth_check:
        return auth_check
    return render_template('admin/violations.html')


@admin_bp.route('/api/violations', methods=['GET'])
def get_violations():
    """Get all technical violations"""
    try:
        from ..models import TechnicalViolation
        
        # Get only active violations or all based on query param
        show_all = request.args.get('show_all', 'false').lower() == 'true'
        
        if show_all:
            violations = TechnicalViolation.query.order_by(TechnicalViolation.display_order).all()
        else:
            violations = TechnicalViolation.query.filter_by(is_active=True).order_by(TechnicalViolation.display_order).all()
        
        return jsonify({
            'success': True,
            'violations': [v.to_dict() for v in violations]
        }), 200
        
    except Exception as e:
        print(f"Error fetching violations: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/api/violations', methods=['POST'])
def create_violation():
    """Create a new technical violation"""
    auth_check = require_admin_auth()
    if auth_check:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    try:
        from ..models import TechnicalViolation
        
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        
        if not name:
            return jsonify({'success': False, 'message': 'Violation name is required'}), 400
        
        # Check if violation with same name already exists
        existing = TechnicalViolation.query.filter_by(name=name).first()
        if existing:
            return jsonify({'success': False, 'message': f'Violation "{name}" already exists'}), 400
        
        # Get max display_order and add 1
        max_order = db.session.query(db.func.max(TechnicalViolation.display_order)).scalar() or 0
        
        new_violation = TechnicalViolation(
            name=name,
            description=description,
            is_active=True,
            display_order=max_order + 1
        )
        
        db.session.add(new_violation)
        db.session.commit()
        
        # Broadcast violation update to all connected clients
        socketio.emit('violations_updated', {'action': 'created', 'violation': new_violation.to_dict()}, namespace='/')
        
        return jsonify({
            'success': True,
            'message': f'Violation "{name}" created successfully',
            'violation': new_violation.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating violation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/api/violations/<int:violation_id>', methods=['PUT'])
def update_violation(violation_id):
    """Update a technical violation"""
    auth_check = require_admin_auth()
    if auth_check:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    try:
        from ..models import TechnicalViolation
        
        violation = TechnicalViolation.query.get_or_404(violation_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        # Update name if provided
        if 'name' in data:
            new_name = data['name'].strip()
            if not new_name:
                return jsonify({'success': False, 'message': 'Violation name cannot be empty'}), 400
            
            # Check if another violation with same name exists
            existing = TechnicalViolation.query.filter(
                TechnicalViolation.name == new_name,
                TechnicalViolation.id != violation_id
            ).first()
            
            if existing:
                return jsonify({'success': False, 'message': f'Violation "{new_name}" already exists'}), 400
            
            violation.name = new_name
        
        # Update description if provided
        if 'description' in data:
            violation.description = data['description'].strip()
        
        # Update is_active if provided
        if 'is_active' in data:
            violation.is_active = bool(data['is_active'])
        
        # Update display_order if provided
        if 'display_order' in data:
            violation.display_order = int(data['display_order'])
        
        db.session.commit()
        
        # Broadcast violation update to all connected clients
        socketio.emit('violations_updated', {'action': 'updated', 'violation': violation.to_dict()}, namespace='/')
        
        return jsonify({
            'success': True,
            'message': f'Violation "{violation.name}" updated successfully',
            'violation': violation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating violation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/api/violations/<int:violation_id>', methods=['DELETE'])
def delete_violation(violation_id):
    """Delete a technical violation"""
    auth_check = require_admin_auth()
    if auth_check:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    try:
        from ..models import TechnicalViolation
        
        violation = TechnicalViolation.query.get_or_404(violation_id)
        violation_name = violation.name
        violation_id = violation.id
        
        db.session.delete(violation)
        db.session.commit()
        
        # Broadcast violation update to all connected clients
        socketio.emit('violations_updated', {'action': 'deleted', 'violation_id': violation_id}, namespace='/')
        
        return jsonify({
            'success': True,
            'message': f'Violation "{violation_name}" deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting violation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@admin_bp.route('/api/violations/<int:violation_id>/toggle', methods=['POST'])
def toggle_violation(violation_id):
    """Toggle violation active status"""
    auth_check = require_admin_auth()
    if auth_check:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    try:
        from ..models import TechnicalViolation
        
        violation = TechnicalViolation.query.get_or_404(violation_id)
        violation.is_active = not violation.is_active
        
        db.session.commit()
        
        status = "enabled" if violation.is_active else "disabled"
        
        # Broadcast violation update to all connected clients
        socketio.emit('violations_updated', {'action': 'toggled', 'violation': violation.to_dict()}, namespace='/')
        
        return jsonify({
            'success': True,
            'message': f'Violation "{violation.name}" {status}',
            'violation': violation.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error toggling violation: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
