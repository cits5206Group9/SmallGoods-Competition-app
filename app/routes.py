from flask import Blueprint, render_template, jsonify, request, flash, redirect, url_for
from .extensions import db
from .models import User

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@main_bp.route('/')
def index():
    return render_template('index.html')

@admin_bp.route('/')
def admin_dashboard():
    return render_template('admin/admin.html')

@main_bp.get("/seed")
def seed():
    # Simple seed route for local dev
    if not User.query.filter_by(username="demo").first():
        db.session.add(User(username="demo"))
        db.session.commit()
    return jsonify(message="seeded")

# Login routes
@main_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        contact = request.form.get("contact")
        password = request.form.get("password")

        # TODO: Implement actual authentication logic
        # For now, just show the form data
        flash(f"Login attempt for: {contact}", "info")
        return redirect(url_for("main.login"))

    return render_template("login.html")

# Placeholder routes for links
@main_bp.get("/forgot-password")
def forgot_password():
    return "<h1>Forgot Password</h1><p>Password reset functionality will go here...</p>"

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
