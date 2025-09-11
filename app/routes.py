from flask import Blueprint, render_template, jsonify
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
