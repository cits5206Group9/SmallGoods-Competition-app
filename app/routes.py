from flask import Blueprint, render_template, jsonify, request, flash, redirect, url_for
from .extensions import db
from .models import User

main_bp = Blueprint("main", __name__)

@main_bp.get("/")
def index():
    return render_template("index.html")

@main_bp.get("/health")
def health():
    return jsonify(status="ok")

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

# Registration routes
@main_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        # Get form data
        role = request.form.get("role")
        full_name = request.form.get("full_name")
        password = request.form.get("password")
        phone = request.form.get("phone")
        email = request.form.get("email")
        
        # TODO: Implement actual registration logic
        # For now, just show the form data
        flash(f"Registration attempt for: {full_name} as {role}", "info")
        return redirect(url_for("main.register"))
    
    return render_template("register.html")

# Placeholder routes for links
@main_bp.get("/terms")
def terms():
    return "<h1>Terms of Service</h1><p>Terms content will go here...</p>"

@main_bp.get("/privacy")
def privacy():
    return "<h1>Privacy Policy</h1><p>Privacy policy content will go here...</p>"

@main_bp.get("/forgot-password")
def forgot_password():
    return "<h1>Forgot Password</h1><p>Password reset functionality will go here...</p>"
