from asyncio.log import logger
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from ..extensions import db
from ..models import (Competition, Athlete, Flight, Event, SportType, AthleteFlight, ScoringType, Referee,TimerLog)
from ..utils.referee_generator import generate_sample_referee_data, generate_random_username, generate_random_password
from datetime import datetime,timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/')
def admin_dashboard():
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
    return render_template('admin/live_event.html')

@admin_bp.route('/data')
def data():
    return render_template('admin/data.html')

#@admin_bp.route('/timer')
#def timer():
    #return render_template('admin/timer.html')

@admin_bp.route('/referee')
def referee():
    return render_template('admin/referee.html')



@admin_bp.route('/results')
def results_dashboard():
    return render_template('admin/results_dashboard.html')

@admin_bp.route('/display')
def display():
    return render_template('admin/display.html')

# API Routes below
@admin_bp.route('/competition-model/get/<int:id>')
def get_competition_model(id):
    competition = Competition.query.get_or_404(id)
    return jsonify({
        'id': competition.id,
        'name': competition.name,
        'start_date': competition.start_date.isoformat() if competition.start_date else None,
        'description': competition.description,
        'sport_type': competition.sport_type.value if competition.sport_type else None,
        'config': competition.config or {
            'name': competition.name,
            'sport_type': competition.sport_type.value if competition.sport_type else None,
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
        logger.info("Received data: %s", data)  # Debug log

        # Start a database transaction
        db.session.begin_nested()

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
        competition.sport_type = SportType(data['sport_type'])
        competition.start_date = datetime.strptime(data['comp_date'], '%Y-%m-%d').date()
        competition.description = f"Sport type: {data['sport_type']}"

        competition.start_date = datetime.now().date()

        competition.is_active = True
        
        # Store the complete configuration
        competition.config = {
            'name': data['name'],
            'sport_type': data['sport_type'],
            'comp_date': data['comp_date'],
            'features': data.get('features', {
                'allowAthleteInput': True,
                'allowCoachAssignment': True,
                'enableAttemptOrdering': True
            }),
            'events': data.get('events', [])
        }

        # Process events
        current_event_ids = set()
        for event_data in competition.config['events']:
            event_id = event_data.get('id')
            
            if event_id:
                # Update existing event
                event = Event.query.get(event_id)
                if event and event.competition_id == competition.id:
                    event.name = event_data['name']
                    event.gender = event_data.get('gender')
                    event.is_active = True
                    current_event_ids.add(event.id)
            else:
                # Create new event
                event = Event(
                    competition=competition,
                    name=event_data['name'],
                    gender=event_data.get('gender'),
                    is_active=True
                )
                db.session.add(event)
                db.session.flush()  # Get the new event ID
                current_event_ids.add(event.id)

            # Process flights for this event
            if 'groups' in event_data:
                for flight_data in event_data['groups']:
                    if flight_data.get('id'):
                        # Update existing flight
                        flight = Flight.query.get(flight_data['id'])
                        if flight and flight.event_id == event.id:
                            flight.name = flight_data['name']
                            flight.order = flight_data.get('order', 1)
                            flight.is_active = flight_data.get('is_active', True)
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

        # Remove events that no longer exist in the configuration
        events_to_delete = existing_event_ids - current_event_ids
        if events_to_delete:
            Event.query.filter(Event.id.in_(events_to_delete)).delete(synchronize_session='fetch')

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
                'is_active': athlete.is_active
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
            'is_active': athlete.is_active
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
                'is_active': athlete.is_active
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
    """Delete an athlete"""
    try:
        athlete = Athlete.query.get(athlete_id)
        
        if not athlete:
            return jsonify({
                'status': 'error',
                'message': 'Athlete not found'
            }), 404
        
        db.session.delete(athlete)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Athlete deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'status': 'error',
            'message': 'Failed to delete athlete: ' + str(e)
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
                'sport_type': comp.sport_type.value if comp.sport_type else None,
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
            'sport_type': competition.sport_type.value if competition.sport_type else None,
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
    """Submit a referee decision"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        referee_id = data.get('referee_id')
        competition_id = data.get('competition_id')
        decision = data.get('decision')
        timestamp = data.get('timestamp')
        
        if not all([referee_id, competition_id, decision]):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        # Verify referee exists and belongs to the competition
        referee = Referee.query.filter_by(id=referee_id, competition_id=competition_id).first()
        if not referee:
            return jsonify({'success': False, 'message': 'Invalid referee or competition'}), 404
        
        # For now, we'll store decisions in a simple way by updating the referee's notes
        # In a full implementation, you might want to create a separate table for decisions
        decision_info = f"Decision at {timestamp}: {decision.get('label', 'Unknown')} (Value: {decision.get('value', 'Unknown')})"
        
        if referee.notes:
            referee.notes += f"\n{decision_info}"
        else:
            referee.notes = decision_info
        
        db.session.commit()
        
        return jsonify({
            'success': True, 
            'message': 'Decision submitted successfully',
            'referee_id': referee_id,
            'decision': decision
        })
        
    except Exception as e:
        db.session.rollback()
        print("Error submitting referee decision:", str(e))
        return jsonify({'success': False, 'message': 'Error submitting decision'}), 500

@admin_bp.route('/api/current-attempt', methods=['GET'])
def get_current_attempt():
    """Get current attempt data for referees"""
    # For now, return a waiting state since we don't have real-time competition data
    # In a real implementation, this would connect to live competition data
    return jsonify({
        'status': 'waiting',
        'message': 'No active attempt'
    })

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
            is_active=bool(data.get('is_active', False))
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
        
        # If no competition found, get all athletes not in any flight
        if not competition_id:
            subquery = db.session.query(AthleteFlight.athlete_id).subquery()
            available_athletes_query = db.session.query(Athlete).filter(
                ~Athlete.id.in_(subquery),
                Athlete.is_active == True
            )
        else:
            # Get athletes in the same competition who are not in any flight
            subquery = db.session.query(AthleteFlight.athlete_id).subquery()
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
        
        # Get athlete info before deletion
        athlete = Athlete.query.get(athlete_id)
        
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

            'success': False,
            'message': f'Error regenerating credentials: {str(e)}'
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
        
        # Update each athlete's order
        for item in athlete_orders:
            athlete_id = item.get('athlete_id')
            new_order = item.get('order')
            
            if athlete_id is None or new_order is None:
                continue
                
            athlete_flight = AthleteFlight.query.filter_by(
                flight_id=flight_id, 
                athlete_id=athlete_id
            ).first()
            
            if athlete_flight:
                athlete_flight.order = new_order
        
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
