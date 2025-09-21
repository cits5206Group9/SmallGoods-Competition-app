from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from ..extensions import db
from ..models import Competition, SportType, Exercise, CompetitionType, Referee
from ..utils.referee_generator import generate_sample_referee_data, generate_random_username, generate_random_password
from datetime import datetime

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

@admin_bp.route('/timer')
def timer():
    return render_template('admin/timer.html')

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
        
        # Store the complete configuration including events, movements, and groups
        competition.config = {
            'name': data['name'],
            'sport_type': data['sport_type'],
            'features': data.get('features', {
                'allowAthleteInput': True,
                'allowCoachAssignment': True,
                'enableAttemptOrdering': True
            }),
            'events': data.get('events', [])
        }
        
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
                'start_date': comp.start_date.isoformat() if comp.start_date else None,
                'end_date': comp.end_date.isoformat() if comp.end_date else None
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
            'end_date': competition.end_date.isoformat() if competition.end_date else None,
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