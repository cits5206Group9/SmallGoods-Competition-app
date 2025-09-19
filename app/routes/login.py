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

        # TODO: Implement actual authentication logic
        # For now, just show the form data
        flash(f"Login attempt for: {contact}", "info")
        return redirect(url_for("login.login"))

    return render_template("login.html")

# Placeholder routes for links
@login_bp.get("/forgot-password")
def forgot_password():
    return "<h1>Forgot Password</h1><p>Password reset functionality will go here...</p>"