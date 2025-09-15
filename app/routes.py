from flask import Blueprint, render_template, jsonify

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')
athlete_bp = Blueprint('athlete', __name__, url_prefix='/athlete')

# Mock data for development - replace with database queries in production
athlete_events_data = [
    {
        'type': 'Weightlifting',
        'attempts': {
            'snatch': [
                {'order': 1, 'weight': 25, 'status': 'Completed', 'result': 'Success'},
                {'order': 2, 'weight': 28, 'status': 'Next', 'result': None, 'time': 300},
                {'order': 3, 'weight': 30, 'status': 'Pending', 'result': None}
            ],
            'clean_and_jerk': [
                {'order': 1, 'weight': 35, 'status': 'Pending', 'result': None},
                {'order': 2, 'weight': 40, 'status': 'Pending', 'result': None},
                {'order': 3, 'weight': 45, 'status': 'Pending', 'result': None}
            ]
        }
    }
]

@main_bp.route('/')
def index():
    return render_template('index.html')

@admin_bp.route('/')
def admin_dashboard():
    return render_template('admin/admin.html')

@admin_bp.route('/competition-model')
def competition_model():
    return render_template('admin/competition_model.html')

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

@admin_bp.route('/display')
def display():
    return render_template('admin/display.html')


@athlete_bp.route('/next-attempt-timer')
def get_next_attempt_timer():
    try:
        # Replace this with database query when database is ready
        # Example with SQLAlchemy:
        """
        next_attempt = Attempt.query.filter_by(
            athlete_id=current_user.id,
            status='Next'
        ).join(Event).first()

        if next_attempt:
            return jsonify({
                'time': next_attempt.time_remaining,
                'event_type': next_attempt.event.type,
                'lift_type': next_attempt.lift_type,
                'order': next_attempt.order,
                'weight': next_attempt.weight
            })
        """
        
        # Using mock data for now
        for event in athlete_events_data:
            if event['type'] == 'Weightlifting':
                for attempt in event['attempts']['snatch']:
                    if attempt['status'] == 'Next':
                        return jsonify({
                            'time': attempt['time'],
                            'event_type': 'Weightlifting',
                            'lift_type': 'Snatch',
                            'order': attempt['order'],
                            'weight': attempt['weight']
                        })
                for attempt in event['attempts']['clean_and_jerk']:
                    if attempt['status'] == 'Next':
                        return jsonify({
                            'time': attempt['time'],
                            'event_type': 'Weightlifting',
                            'lift_type': 'Clean & Jerk',
                            'order': attempt['order'],
                            'weight': attempt['weight']
                        })
        return jsonify({'error': 'No next attempt found'})
    except Exception as e:
        print(f"Error fetching next attempt timer: {str(e)}")
        return jsonify({'error': 'Error fetching timer data'}), 500

@athlete_bp.route('/event-detail/<event_type>')
def get_event_detail(event_type):
    try:
        # Convert event_type to title case for matching (Weightlifting, Powerlifting)
        event_type = event_type.lower()
        if event_type == 'weightlifting':
            event_type = 'Weightlifting'
        elif event_type == 'powerlifting':
            event_type = 'Powerlifting'

        # Find the event in athlete_events_data (our mock data)
        matching_events = [event for event in athlete_events_data if event['type'] == event_type]
        
        if matching_events:
            event = matching_events[0]
            return jsonify({
                'type': event['type'],
                'flight': event.get('flight'),
                'opener': event.get('opener'),
                'status': event.get('status'),
                'attempts': event.get('attempts', {})
            })
        
        # If no event found, return a structured response
        return jsonify({
            'type': event_type,
            'flight': None,
            'opener': None,
            'status': 'Not Registered',
            'attempts': {}
        })
    except Exception as e:
        print(f"Error fetching event detail: {str(e)}")
        return jsonify({'error': 'Error fetching event data'}), 500


@athlete_bp.route('/')
def athlete_dashboard():
    athlete_data = {
        'name': 'Ann',
        'id': 'ann@email.com',
        'gender': 'F'
    }
    
    competition_data = {
        'name': '2025 SG Throwdown',
        'date': 'Sept 12-15, 2025',
        'venue': 'SmallGoods Arena'
    }
    
    # Add more event details for each event type
    athlete_events = [
        {
            'type': 'Weightlifting',
            'flight': 'Flight 1',
            'opener': '25',
            'total': '83kg',
            'rank': 4,
            'status': 'In Progress',
            'attempts': {
                'snatch': [
                    {'order': 1, 'weight': 25, 'status': 'Completed', 'result': 'Success'},
                    {'order': 2, 'weight': 28, 'status': 'Next', 'result': None, 'time': 300},
                    {'order': 3, 'weight': 30, 'status': 'Pending', 'result': None}
                ],
                'clean_and_jerk': [
                    {'order': 1, 'weight': 35, 'status': 'Pending', 'result': None},
                    {'order': 2, 'weight': 40, 'status': 'Pending', 'result': None},
                    {'order': 3, 'weight': 45, 'status': 'Pending', 'result': None}
                ]
            }
        },
        {
            'type': 'Powerlifting',
            'flight': None,
            'opener': None,
            'total': 'N/A',
            'rank': None,
            'status': 'Not Registered',
            'attempts': None
        }
        # {
        #     'type': 'Powerlifting',
        #     'flight': 'Flight 2',
        #     'opener': '40',
        #     'total': '115kg',
        #     'rank': 3,
        #     'status': 'Not Started',
        #     'attempts': {
        #         'squat': [
        #             {'order': 1, 'weight': 150, 'status': 'Pending', 'result': None},
        #             {'order': 2, 'weight': 160, 'status': 'Pending', 'result': None},
        #             {'order': 3, 'weight': 170, 'status': 'Pending', 'result': None}
        #         ],
        #         'bench_press': [
        #             {'order': 1, 'weight': 100, 'status': 'Pending', 'result': None},
        #             {'order': 2, 'weight': 105, 'status': 'Pending', 'result': None},
        #             {'order': 3, 'weight': 110, 'status': 'Pending', 'result': None}
        #         ],
        #         'deadlift': [
        #             {'order': 1, 'weight': 180, 'status': 'Pending', 'result': None},
        #             {'order': 2, 'weight': 190, 'status': 'Pending', 'result': None},
        #             {'order': 3, 'weight': 200, 'status': 'Pending', 'result': None}
        #         ]
        #     }
        # }
    ]
    
    # Find the next attempt across all events
    next_attempt = None
    for event in athlete_events:
        if event['type'] == 'Weightlifting':
            for attempt in event['attempts']['snatch']:
                if attempt['status'] == 'Next':
                    next_attempt = {
                        'event_type': 'Weightlifting',
                        'lift_type': 'Snatch',
                        'order': attempt['order'],
                        'weight': attempt['weight'],
                        'time': attempt['time']
                    }
                    break
            if not next_attempt:
                for attempt in event['attempts']['clean_and_jerk']:
                    if attempt['status'] == 'Next':
                        next_attempt = {
                            'event_type': 'Weightlifting',
                            'lift_type': 'Clean & Jerk',
                            'order': attempt['order'],
                            'weight': attempt['weight'],
                            'time': attempt['time']
                        }
                        break

    return render_template(
        'athlete/athlete.html',
        athlete=athlete_data,
        competition=competition_data,
        athlete_events=athlete_events,
        next_attempt=next_attempt
    )