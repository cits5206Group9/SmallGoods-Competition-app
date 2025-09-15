from flask import Blueprint, render_template

main_bp = Blueprint('main', __name__)
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

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
