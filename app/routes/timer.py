from flask import render_template, request, jsonify
from .admin import admin_bp  # reuse the existing /admin blueprint

@admin_bp.route("/timer", endpoint="timer")
def timer_page():
    flight_id = request.args.get("flight_id", type=int)

    # ---- Placeholder: future live attempt context ----
    # This mock data is currently unused by timer.html,
    # but can be used later if you add a "Now / Next" athlete panel.
    ctx = {
        "now":  {"athlete": "Jane Doe", "attempt": 2, "lift": "Snatch", "declared": 85.0},
        "next": {"athlete": "Alex Kim", "attempt": 1, "lift": "Snatch", "declared": 86.0},
        "avg_sec_per_lift": 90,
        "notes": "Bar change expected after next attempt."
    }

    return render_template(
        "admin/timer.html",
        default_attempt_seconds=60,
        default_break_seconds=600,
        context=ctx,
        flight_id=flight_id,
    )

@admin_bp.route("/api/timer-state", endpoint="timer_state", methods=['GET', 'POST'])
def timer_state():
    """
    API endpoint to get/set the current timer state from the timekeeper page.
    GET: Returns the current timer state
    POST: Updates the timer state (called by timekeeper)
    """
    import json
    from pathlib import Path
    
    # Use a temporary file to share state between timekeeper and referee pages
    state_file = Path(__file__).parent.parent.parent / 'instance' / 'timer_state.json'
    
    if request.method == 'POST':
        try:
            # Save the timer state from timekeeper
            state_data = request.get_json()
            
            # Enrich with athlete attempt data if available
            athlete_id = state_data.get('athlete_id')
            attempt_number = state_data.get('attempt_number')
            flight_id = state_data.get('flight_id')
            
            if athlete_id and attempt_number:
                from app.models import Athlete, Attempt, AthleteEntry
                try:
                    athlete = Athlete.query.get(int(athlete_id))
                    if athlete:
                        # Add athlete details
                        if hasattr(athlete, 'bodyweight'):
                            state_data['weight_class'] = f"{athlete.bodyweight}kg" if athlete.bodyweight else ''
                        state_data['team'] = athlete.team or ''
                        
                        # Find the athlete's attempts - try multiple approaches
                        attempt = None
                        if flight_id:
                            # Try with flight_id if provided
                            attempt = Attempt.query.filter_by(
                                athlete_id=int(athlete_id),
                                attempt_number=int(attempt_number),
                                flight_id=int(flight_id)
                            ).first()
                        
                        if not attempt:
                            # Try without flight_id
                            attempt = Attempt.query.filter_by(
                                athlete_id=int(athlete_id),
                                attempt_number=int(attempt_number)
                            ).first()
                        
                        if attempt:
                            state_data['attempt_weight'] = attempt.requested_weight or attempt.actual_weight or 0
                        else:
                            # If no attempt found, try to get from athlete entry (opening weight)
                            athlete_entry = AthleteEntry.query.filter_by(athlete_id=int(athlete_id)).first()
                            if athlete_entry and athlete_entry.opening_weights:
                                state_data['attempt_weight'] = athlete_entry.opening_weights
                        
                        # Try to get lift type from event
                        if state_data.get('event'):
                            event_name = state_data['event'].lower()
                            if 'snatch' in event_name:
                                state_data['current_lift'] = 'Snatch'
                            elif 'clean' in event_name or 'jerk' in event_name:
                                state_data['current_lift'] = 'Clean & Jerk'
                            else:
                                state_data['current_lift'] = state_data['event']
                                
                except Exception as e:
                    print(f"Warning: Could not fetch athlete data: {e}")
                    import traceback
                    traceback.print_exc()
            
            state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(state_file, 'w') as f:
                json.dump(state_data, f)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        # GET request - return the current state
        try:
            if state_file.exists():
                with open(state_file, 'r') as f:
                    state = json.load(f)
                    return jsonify(state)
            else:
                # Return default empty state
                return jsonify({
                    'athlete_name': '',
                    'attempt_number': '',
                    'timer_seconds': 60,
                    'timer_running': False,
                    'timer_mode': 'attempt',
                    'competition': '',
                    'event': '',
                    'flight': '',
                    'weight_class': '',
                    'team': '',
                    'current_lift': '',
                    'attempt_weight': '',
                    'timestamp': 0
                })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

# NOTE:
# The temporary mock API endpoints for competitions/events/flights
# have been removed. timekeeper.js now calls the real DB-backed endpoints
# already provided in admin.py:
#   - GET /admin/competitions
#   - GET /admin/competitions/<int:competition_id>/events
#   - GET /admin/events/<int:event_id>/flights
