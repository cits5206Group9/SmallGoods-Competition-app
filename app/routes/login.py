from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from ..extensions import db
from ..models import User

login_bp = Blueprint("login", __name__, url_prefix="/login")


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
            # Check for admin user in database
            from ..models import UserRole
            from werkzeug.security import check_password_hash

            admin_user = User.query.filter_by(
                email=contact, role=UserRole.ADMIN, is_active=True
            ).first()

            if admin_user and check_password_hash(admin_user.password_hash, password):
                # Set session for admin
                from flask import session

                session["user_id"] = admin_user.id
                session["user_role"] = admin_user.role.name
                session["is_admin"] = True

                return redirect(url_for("admin.admin_dashboard"))
            else:
                if admin_user:
                    flash("Incorrect password. Please try again.", "error")
                else:
                    flash("No admin account found with this email address.", "error")
                return render_template("login.html", contact=contact)
        else:
            # No password provided - attempt athlete login with email only
            from ..models import UserRole, Athlete

            user = User.query.filter_by(
                email=contact, role=UserRole.ATHLETE, is_active=True
            ).first()

            if user:
                # Find the corresponding athlete record
                athlete = Athlete.query.filter_by(user_id=user.id).first()
                if athlete:
                    # Set session for athlete
                    from flask import session

                    session["user_id"] = user.id
                    session["user_role"] = user.role.name
                    session["athlete_id"] = athlete.id

                    return redirect(url_for("athlete.athlete_dashboard"))
                else:
                    flash("No athlete profile found for this user", "error")
            else:
                flash("No athlete account found with this email address", "error")

            return render_template("login.html", contact=contact)

    return render_template("login.html")


# Logout routes
@login_bp.route("/logout", methods=["GET", "POST"])
def logout():
    """Logout user (admin or athlete)"""
    from flask import session

    session.clear()
    flash("You have been logged out successfully", "success")
    return redirect(url_for("login.login"))


@login_bp.route("/admin/logout")
def admin_logout():
    """Admin logout via GET"""
    from flask import session

    session.clear()
    flash("You have been logged out successfully", "success")
    return redirect(url_for("login.login"))


@login_bp.route("/athlete/logout")
def athlete_logout():
    """Athlete logout via GET"""
    from flask import session

    session.clear()
    flash("You have been logged out successfully", "success")
    return redirect(url_for("login.login"))
