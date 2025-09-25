"""
Flight synchronization utilities
Functions for maintaining data consistency between flight assignments and athlete entries.
"""

from ..extensions import db
from ..models import AthleteEntry


def update_athlete_entries_flight_info(athlete_id: int, event_id: int, new_flight_id: int = None, new_entry_order: int = None):
    """
    Update flight_id and entry_order for existing AthleteEntry records when flight assignment changes.
    If new_flight_id is None, this clears the flight assignment (sets flight_id to None).
    """
    entries = AthleteEntry.query.filter_by(
        athlete_id=athlete_id,
        event_id=event_id
    ).all()
    
    for entry in entries:
        entry.flight_id = new_flight_id  # This will be None if athlete is removed from flight
        entry.entry_order = new_entry_order or 0
    
    if entries:
        db.session.commit()
    
    return len(entries)