from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from ..extensions import db
from ..models import User

login_bp = Blueprint('login', __name__, url_prefix='/login')

@login_bp.get("/seed")
def seed():
    # Simple seed route for local dev
    if not User.query.filter_by(username="demo").first():
        db.session.add(User(username="demo"))
        db.session.commit()
    return jsonify(message="seeded")

# Login routes
@login_bp.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        contact = request.form.get("contact")
        password = request.form.get("password")

        if not contact:
            flash("Email is required", "error")
            return render_template("login.html")

        # If password is provided, attempt admin login
        if password:
            # TODO: Implement admin authentication logic
            # For now, just show the form data for admin login
            flash(f"Admin login attempt for: {contact}", "info")
            return redirect(url_for("login.login"))
        else:
            # No password provided - attempt athlete login with email only
            from ..models import UserRole, Athlete
            user = User.query.filter_by(email=contact, role=UserRole.ATHLETE, is_active=True).first()
            
            if user:
                # Find the corresponding athlete record
                athlete = Athlete.query.filter_by(user_id=user.id).first()
                if athlete:
                    # Set session for athlete
                    from flask import session
                    session['user_id'] = user.id
                    session['user_role'] = user.role.name
                    session['athlete_id'] = athlete.id
                    
                    flash(f"Welcome {user.first_name}!", "success")
                    return redirect(url_for("athlete.athlete_dashboard"))
                else:
                    flash("No athlete profile found for this user", "error")
            else:
                flash("No athlete account found with this email address", "error")
            
            return render_template("login.html", contact=contact)

    return render_template("login.html")

# Logout route for athletes
@login_bp.route("/logout", methods=["POST"])
def logout():
    """Logout user (admin or athlete)"""
    from flask import session
    session.clear()
    flash("You have been logged out successfully", "success")
    return redirect(url_for("login.login"))
    """Athlete login using email only"""
    if request.method == "POST":
        # Check if this is email-only login (no password field)
        email = request.form.get("contact") or request.form.get("email")
        password = request.form.get("password")
        
        # If password field exists, this is regular login - redirect to main login
        if password:
            flash("Athletes should login with email only", "info")
            return render_template("login.html", is_athlete_login=True)
        
        if not email:
            flash("Email is required", "error")
            return render_template("login.html", is_athlete_login=True)
        
        # Find user by email with athlete role
        from ..models import UserRole, Athlete
        user = User.query.filter_by(email=email, role=UserRole.ATHLETE, is_active=True).first()
        
        if user:
            # Find the corresponding athlete record
            athlete = Athlete.query.filter_by(user_id=user.id).first()
            if athlete:
                # Set session for athlete
                from flask import session
                session['user_id'] = user.id
                session['user_role'] = user.role.name
                session['athlete_id'] = athlete.id
                
                flash(f"Welcome {user.first_name}!", "success")
                return redirect(url_for("athlete.athlete_dashboard"))
            else:
                flash("No athlete profile found for this user", "error")
        else:
            flash("No account found with this email address", "error")
        
        return render_template("login.html", is_athlete_login=True, email=email)
    
    return render_template("login.html", is_athlete_login=True)

@login_bp.route("/athlete/logout", methods=["POST"])
def athlete_logout():
    """Logout athlete"""
    from flask import session
    session.clear()
    flash("You have been logged out successfully", "success")
    return redirect(url_for("login.athlete_login"))

# Placeholder routes for links
@login_bp.get("/forgot-password")
def forgot_password():
    return "<h1>Forgot Password</h1><p>Password reset functionality will go here...</p>"