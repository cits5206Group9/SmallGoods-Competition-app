"""
Main routes for Small Goods Competition Application
Provides all the interfaces for different user roles and competition management
"""

from flask import Blueprint, render_template, jsonify, request, redirect, url_for, flash
from datetime import datetime, date
import qrcode
import io
import base64
from .extensions import db, socketio
from .models import (
    Competition, Event, Lift, Flight, Athlete, AthleteFlight, 
    Referee, Attempt, Score, Timer, SportType, ScoringType, AttemptResult
)
from .services.competition_service import CompetitionService
from .services.scoring_service import ScoringService

main_bp = Blueprint("main", __name__)

# =====================
# MAIN & HEALTH ROUTES
# =====================

@main_bp.get("/")
def index():
    """Main landing page with competition selection"""
    competitions = Competition.query.filter_by(is_active=True).all()
    return render_template("index.html", competitions=competitions)

@main_bp.get("/health")
def health():
    """Health check endpoint"""
    return jsonify(status="ok", timestamp=datetime.utcnow().isoformat())

# =====================
# ADMIN INTERFACE (FR1, FR2, FR3)
# =====================

@main_bp.route("/admin")
def admin_dashboard():
    """Admin dashboard for competition management"""
    competitions = Competition.query.all()
    return render_template("admin/dashboard.html", competitions=competitions)

@main_bp.route("/admin/competition/new", methods=["GET", "POST"])
def create_competition():
    """Create new competition (FR1)"""
    if request.method == "POST":
        try:
            data = request.get_json() if request.is_json else request.form
            
            competition = Competition(
                name=data.get("name"),
                sport_type=SportType(data.get("sport_type")),
                date=datetime.strptime(data.get("date"), "%Y-%m-%d").date(),
                config=data.get("config", {})
            )
            
            db.session.add(competition)
            db.session.flush()  # Get ID before commit
            
            # Create events based on sport type
            CompetitionService.create_default_events(competition)
            
            db.session.commit()
            
            if request.is_json:
                return jsonify({"success": True, "competition_id": competition.id})
            else:
                flash(f"Competition '{competition.name}' created successfully!", "success")
                return redirect(url_for("main.admin_competition", id=competition.id))
                
        except Exception as e:
            db.session.rollback()
            if request.is_json:
                return jsonify({"success": False, "error": str(e)}), 400
            else:
                flash(f"Error creating competition: {str(e)}", "error")
                return redirect(url_for("main.admin_dashboard"))
    
    return render_template("admin/create_competition.html", sport_types=SportType)

@main_bp.route("/admin/competition/<int:id>")
def admin_competition(id):
    """Admin view for specific competition (FR1, FR2, FR3)"""
    competition = Competition.query.get_or_404(id)
    events = Event.query.filter_by(competition_id=id).all()
    athletes = Athlete.query.filter_by(competition_id=id).all()
    referees = Referee.query.filter_by(competition_id=id).all()
    
    return render_template("admin/competition.html", 
                         competition=competition, events=events, 
                         athletes=athletes, referees=referees)

@main_bp.route("/admin/competition/<int:id>/athletes", methods=["GET", "POST"])
def manage_athletes(id):
    """Add/edit athletes in competition"""
    competition = Competition.query.get_or_404(id)
    
    if request.method == "POST":
        try:
            data = request.get_json() if request.is_json else request.form
            
            athlete = Athlete(
                competition_id=id,
                name=data.get("name"),
                gender=data.get("gender"),
                bodyweight=float(data.get("bodyweight")) if data.get("bodyweight") else None,
                age=int(data.get("age")) if data.get("age") else None,
                team=data.get("team"),
                phone=data.get("phone"),
                email=data.get("email")
            )
            
            db.session.add(athlete)
            db.session.commit()
            
            if request.is_json:
                return jsonify({"success": True, "athlete_id": athlete.id})
            else:
                flash(f"Athlete '{athlete.name}' added successfully!", "success")
                return redirect(url_for("main.admin_competition", id=id))
                
        except Exception as e:
            db.session.rollback()
            if request.is_json:
                return jsonify({"success": False, "error": str(e)}), 400
            else:
                flash(f"Error adding athlete: {str(e)}", "error")
    
    athletes = Athlete.query.filter_by(competition_id=id).all()
    return render_template("admin/athletes.html", competition=competition, athletes=athletes)

@main_bp.route("/admin/competition/<int:id>/live-edit", methods=["POST"])
def live_edit_competition(id):
    """Live editing of competition model during event (FR3)"""
    try:
        data = request.get_json()
        edit_type = data.get("type")
        
        if edit_type == "reorder_athletes":
            # Reorder athletes based on weights (FR6)
            new_order = data.get("new_order", [])
            for i, attempt_id in enumerate(new_order):
                attempt = Attempt.query.get(attempt_id)
                if attempt:
                    attempt.lifting_order = i + 1
            
            # Broadcast via SocketIO
            socketio.emit("athlete_order_updated", {
                "competition_id": id,
                "new_order": new_order
            }, room=f"competition_{id}_admin")
            
        elif edit_type == "update_weight":
            # Update athlete's requested weight
            attempt_id = data.get("attempt_id")
            new_weight = data.get("new_weight")
            
            attempt = Attempt.query.get(attempt_id)
            if attempt:
                attempt.requested_weight = new_weight
                
                socketio.emit("weight_updated", {
                    "attempt_id": attempt_id,
                    "athlete_name": attempt.athlete.name,
                    "new_weight": new_weight
                }, room=f"competition_{id}_admin")
        
        elif edit_type == "add_athlete":
            # Add athlete during competition
            athlete_data = data.get("athlete_data")
            athlete = Athlete(**athlete_data, competition_id=id)
            db.session.add(athlete)
            
        db.session.commit()
        return jsonify({"success": True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 400

# =====================
# REFEREE INTERFACE (FR4)
# =====================

@main_bp.route("/referee")
def referee_interface():
    """Main referee interface"""
    competitions = Competition.query.filter_by(is_active=True).all()
    return render_template("referee/dashboard.html", competitions=competitions)

@main_bp.route("/referee/competition/<int:id>")
def referee_competition(id):
    """Referee interface for specific competition"""
    competition = Competition.query.get_or_404(id)
    active_event = Event.query.filter_by(competition_id=id, is_active=True).first()
    
    # Get current attempt to judge
    current_attempt = None
    if active_event:
        current_attempt = Attempt.query.join(Athlete).filter(
            Athlete.competition_id == id,
            Attempt.result.is_(None)
        ).order_by(Attempt.lifting_order).first()
    
    return render_template("referee/competition.html", 
                         competition=competition, active_event=active_event,
                         current_attempt=current_attempt, attempt_results=AttemptResult)

# =====================
# ATHLETE/COACH INTERFACE
# =====================

@main_bp.route("/athlete")
def athlete_interface():
    """Athlete/Coach interface selection"""
    competitions = Competition.query.filter_by(is_active=True).all()
    return render_template("athlete/dashboard.html", competitions=competitions)

@main_bp.route("/athlete/competition/<int:id>")
def athlete_competition(id):
    """Athlete view for specific competition"""
    competition = Competition.query.get_or_404(id)
    athletes = Athlete.query.filter_by(competition_id=id).all()
    
    return render_template("athlete/competition.html", competition=competition, athletes=athletes)

@main_bp.route("/athlete/<int:athlete_id>/dashboard")
def athlete_dashboard(athlete_id):
    """Individual athlete dashboard"""
    athlete = Athlete.query.get_or_404(athlete_id)
    
    # Get athlete's attempts and scores
    attempts = Attempt.query.filter_by(athlete_id=athlete_id).order_by(Attempt.attempt_number).all()
    scores = Score.query.filter_by(athlete_id=athlete_id).all()
    
    # Get upcoming attempts
    upcoming_attempts = [a for a in attempts if a.result is None]
    
    return render_template("athlete/athlete_dashboard.html", 
                         athlete=athlete, attempts=attempts, scores=scores,
                         upcoming_attempts=upcoming_attempts)

# =====================
# TIMEKEEPER INTERFACE (FR7)
# =====================

@main_bp.route("/timekeeper")
def timekeeper_interface():
    """Timekeeper/Technical Controller interface"""
    competitions = Competition.query.filter_by(is_active=True).all()
    return render_template("timekeeper/dashboard.html", competitions=competitions)

@main_bp.route("/timekeeper/competition/<int:id>")
def timekeeper_competition(id):
    """Timer control interface for specific competition"""
    competition = Competition.query.get_or_404(id)
    active_event = Event.query.filter_by(competition_id=id, is_active=True).first()
    
    timer = None
    if active_event:
        timer = Timer.query.filter_by(event_id=active_event.id).first()
    
    return render_template("timekeeper/competition.html", 
                         competition=competition, active_event=active_event, timer=timer)

# =====================
# PUBLIC DISPLAY (FR11)
# =====================

@main_bp.route("/display")
def display_selection():
    """Display screen selection"""
    competitions = Competition.query.filter_by(is_active=True).all()
    return render_template("display/selection.html", competitions=competitions)

@main_bp.route("/display/competition/<int:id>")
def display_competition(id):
    """Large screen display for competition"""
    competition = Competition.query.get_or_404(id)
    return render_template("display/competition.html", competition=competition)

# =====================
# QR CODE GENERATION (FR8)
# =====================

@main_bp.route("/wifi-qr")
def generate_wifi_qr():
    """Generate QR code for WiFi access (FR8)"""
    try:
        # In production, these would come from configuration
        wifi_ssid = request.args.get("ssid", "SmallGoodsComp")
        wifi_password = request.args.get("password", "competition2024")
        wifi_security = request.args.get("security", "WPA")
        
        # WiFi QR code format
        wifi_string = f"WIFI:T:{wifi_security};S:{wifi_ssid};P:{wifi_password};;"
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(wifi_string)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64 for display
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return render_template("admin/wifi_qr.html", 
                             qr_code=img_str, ssid=wifi_ssid)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# =====================
# API ENDPOINTS
# =====================

@main_bp.route("/api/competition/<int:id>/status")
def api_competition_status(id):
    """API endpoint for competition status"""
    competition = Competition.query.get_or_404(id)
    active_event = Event.query.filter_by(competition_id=id, is_active=True).first()
    
    status = {
        "competition": {
            "id": competition.id,
            "name": competition.name,
            "sport_type": competition.sport_type.value,
            "date": competition.date.isoformat()
        },
        "active_event": None,
        "current_lifter": None,
        "next_lifters": [],
        "timer": None
    }
    
    if active_event:
        status["active_event"] = {
            "id": active_event.id,
            "name": active_event.name,
            "weight_category": active_event.weight_category
        }
        
        # Get current lifting order
        current_attempts = Attempt.query.join(Athlete).filter(
            Athlete.competition_id == id,
            Attempt.result.is_(None)
        ).order_by(Attempt.lifting_order).limit(5).all()
        
        if current_attempts:
            current = current_attempts[0]
            status["current_lifter"] = {
                "athlete_name": current.athlete.name,
                "team": current.athlete.team,
                "weight": current.requested_weight,
                "attempt": current.attempt_number,
                "lift": current.lift.name
            }
            
            status["next_lifters"] = [
                {
                    "athlete_name": attempt.athlete.name,
                    "weight": attempt.requested_weight,
                    "attempt": attempt.attempt_number
                }
                for attempt in current_attempts[1:]
            ]
        
        # Get timer status
        timer = Timer.query.filter_by(event_id=active_event.id).first()
        if timer:
            status["timer"] = {
                "remaining_seconds": timer.remaining_seconds,
                "is_running": timer.is_running,
                "duration": timer.duration_seconds
            }
    
    return jsonify(status)

@main_bp.route("/api/competition/<int:id>/rankings")
def api_competition_rankings(id):
    """API endpoint for current rankings"""
    competition = Competition.query.get_or_404(id)
    
    # Get rankings for all events
    rankings = {}
    events = Event.query.filter_by(competition_id=id).all()
    
    for event in events:
        event_rankings = ScoringService.calculate_event_rankings(event.id)
        rankings[event.name] = event_rankings
    
    return jsonify(rankings)

# =====================
# SCORING AND RESULTS (FR5)
# =====================

@main_bp.route("/api/competition/<int:id>/calculate-scores", methods=["POST"])
def calculate_scores(id):
    """Recalculate scores for competition"""
    try:
        competition = Competition.query.get_or_404(id)
        
        # Calculate scores for all events
        for event in competition.events:
            ScoringService.calculate_event_scores(event.id)
        
        # Broadcast score updates
        socketio.emit("scores_updated", {
            "competition_id": id
        }, room=f"competition_{id}_admin")
        
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

# =====================
# LEGACY ROUTES (for backward compatibility)
# =====================

@main_bp.get("/seed")
def seed():
    """Simple seed route for development"""
    from .models import User
    if not User.query.filter_by(username="demo").first():
        db.session.add(User(username="demo"))
        db.session.commit()
    return jsonify(message="seeded")
