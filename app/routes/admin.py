from flask import Blueprint, render_template, request, jsonify
from ..extensions import db
from ..models import Competition, SportType, SportCategory, Exercise, CompetitionType, Athlete, Flight, Event
from datetime import datetime
from sqlalchemy.exc import IntegrityError

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

@admin_bp.route('/referee/login')
def referee_login():
    return render_template('auth/referee_login.html')

@admin_bp.route('/referee/<int:referee_id>')
def individual_referee(referee_id):
    if referee_id not in [1, 2, 3]:
        return "Invalid referee ID", 400
    return render_template('admin/individual_referee.html', referee_id=str(referee_id))

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
        'description': competition.description,
        'sport_type': competition.sport_type.value if competition.sport_type else None,
        'config': competition.config or {
            'name': competition.name,
            'sport_type': competition.sport_type.value if competition.sport_type else None,
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
        print("Received data:", data)  # Debug log
        
        # Create new competition or update existing one
        competition_id = data.get('id')
        if competition_id:
            competition = Competition.query.get_or_404(competition_id)
        else:
            competition = Competition()

        # Update basic fields
        competition.name = data['name']
        competition.sport_type = SportType(data['sport_type'])
        competition.description = f"Sport type: {data['sport_type']}"
        competition.start_date = datetime.now().date()
        competition.end_date = datetime.now().date()
        competition.is_active = True
        
        for event_data in data.get('events', []):
            category = SportCategory(
                competition=competition,
                name=event_data['name'],
                is_active=True
            )
            db.session.add(category)
            db.session.flush()
            
            for idx, movement in enumerate(event_data.get('movements', []), 1):
                exercise = Exercise(
                    sport_category=category,
                    name=movement['name'],
                    order=idx,
                    attempt_time_limit=movement['timer'].get('attempt_seconds', 60),
                    break_time_default=movement['timer'].get('break_seconds', 120)
                )
                db.session.add(exercise)
                db.session.flush()
                
                comp_type = CompetitionType(
                    exercise=exercise,
                    name=movement.get('scoring', {}).get('name', 'Standard'),
                    is_active=True
                )
                db.session.add(comp_type)
        
        if not competition_id:
            db.session.add(competition)
        
        # Commit the changes
        db.session.commit()
        
        print("Saved competition:", competition.id, competition.config)  # Debug log
        
        return jsonify({
            'status': 'success',
            'competition_id': competition.id,
            'message': 'Competition model saved successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        print("Error saving competition:", str(e))  # Debug log
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
    
    # Get all competitions for the filter dropdown
    competitions = Competition.query.all()
    
    # Get athletes with pagination
    athletes_query = Athlete.query
    athletes = athletes_query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/atheletes_management.html', 
                         athletes=athletes.items,
                         competitions=competitions,
                         pagination=athletes,
                         page=page,
                         per_page=per_page,
                         total=athletes.total)

@admin_bp.route('/flights-management')
def flights_management():
    # Get all competitions for the selection dropdown
    competitions = Competition.query.all()
    
    return render_template('admin/flights_management.html',
                         competitions=competitions)
<<<<<<< HEAD
=======

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
        
        return jsonify({
            'status': 'success',
            'message': 'Athlete created successfully',
            'athlete_id': athlete.id
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
        athlete = Athlete.query.get(athlete_id)
        
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
        
        return jsonify({
            'status': 'success',
            'message': 'Athlete updated successfully'
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
def get_competitions():
    try:
        competitions = Competition.query.all()
        return jsonify([{
            'id': comp.id,
            'name': comp.name,
            'start_date': comp.start_date.isoformat() if comp.start_date else None,
            'end_date': comp.end_date.isoformat() if comp.end_date else None
        } for comp in competitions])
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

# Flight API Routes
@admin_bp.route('/flights', methods=['POST'])
def create_flight():
    """Create a new flight"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name') or not data.get('event_id'):
            return jsonify({
                'status': 'error',
                'message': 'Flight name and event ID are required'
            }), 400
        
        # Check if event exists
        event = Event.query.get(data.get('event_id'))
        if not event:
            return jsonify({
                'status': 'error',
                'message': 'Event not found'
            }), 404
        
        # Create new flight
        flight = Flight(
            event_id=int(data.get('event_id')),
            name=data.get('name', '').strip(),
            order=int(data.get('order', 1)),
            is_active=bool(data.get('is_active', False))
        )
        
        db.session.add(flight)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Flight created successfully',
            'flight_id': flight.id
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

@admin_bp.route('/flights/<int:flight_id>', methods=['GET'])
def get_flight(flight_id):
    """Get flight details by ID"""
    try:
        flight = Flight.query.get(flight_id)
        
        if not flight:
            return jsonify({
                'status': 'error',
                'message': 'Flight not found'
            }), 404
        
        return jsonify({
            'id': flight.id,
            'event_id': flight.event_id,
            'name': flight.name,
            'order': flight.order,
            'is_active': flight.is_active
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
        if 'event_id' in data:
            # Check if new event exists
            event = Event.query.get(int(data['event_id']))
            if not event:
                return jsonify({
                    'status': 'error',
                    'message': 'Event not found'
                }), 404
            flight.event_id = int(data['event_id'])
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Flight updated successfully'
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

@admin_bp.route('/flights/all', methods=['GET'])
def get_all_flights():
    """Get all flights across all events"""
    try:
        flights = Flight.query.order_by(Flight.order).all()
        
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
>>>>>>> 9480c1c (athelete flights managment v3)
