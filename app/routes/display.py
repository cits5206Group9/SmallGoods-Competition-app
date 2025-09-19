from flask import Blueprint, render_template
display_bp = Blueprint('display', __name__, url_prefix='/display' )


@display_bp.route('/')
def display_index():
    return render_template('display/selection.html')

@display_bp.route('/competition')
def display_competition():
    return render_template('display/competition.html')

@display_bp.route('/datatable')
def display_datatable():
    return render_template('display/datatable.html')