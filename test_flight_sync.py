#!/usr/bin/env python3
"""
Test script to verify that AthleteEntry records are properly synchronized
with flight assignments when athletes are added to or removed from flights.
"""

import sys
import os

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app
from app.extensions import db
from app.models import Athlete, Flight, Event, Competition, AthleteEntry, AthleteFlight
from app.routes.athlete import update_athlete_entries_flight_info, ensure_athlete_entries_for_event

def test_flight_sync():
    """Test flight synchronization with AthleteEntry records"""
    app = create_app()
    
    with app.app_context():
        # Get some test data
        athlete = Athlete.query.first()
        flight = Flight.query.first()
        
        if not athlete or not flight:
            print("❌ No test data found. Please run the application first to create some test data.")
            return False
            
        print(f"🧪 Testing with Athlete: {athlete.first_name} {athlete.last_name} (ID: {athlete.id})")
        print(f"🧪 Testing with Flight: {flight.name} (ID: {flight.id})")
        
        if flight.event:
            print(f"🧪 Flight Event: {flight.event.name} (ID: {flight.event.id})")
            
            # Step 1: Ensure athlete has entries for this event
            print("\n📝 Step 1: Creating AthleteEntry records...")
            entries_created = ensure_athlete_entries_for_event(
                athlete_id=athlete.id,
                event_id=flight.event.id,
                flight_id=None,  # Initially no flight
                entry_order=0
            )
            print(f"✅ Created/verified {len(entries_created)} AthleteEntry records")
            
            # Check initial state
            entries = AthleteEntry.query.filter_by(
                athlete_id=athlete.id,
                event_id=flight.event.id
            ).all()
            
            print(f"📊 Initial flight_id values: {[entry.flight_id for entry in entries]}")
            
            # Step 2: Simulate adding athlete to flight
            print(f"\n📝 Step 2: Simulating adding athlete to flight {flight.id}...")
            updated_count = update_athlete_entries_flight_info(
                athlete_id=athlete.id,
                event_id=flight.event.id,
                new_flight_id=flight.id,
                new_entry_order=1
            )
            print(f"✅ Updated {updated_count} AthleteEntry records")
            
            # Check updated state
            entries = AthleteEntry.query.filter_by(
                athlete_id=athlete.id,
                event_id=flight.event.id
            ).all()
            
            flight_ids = [entry.flight_id for entry in entries]
            print(f"📊 After adding to flight: {flight_ids}")
            
            if all(fid == flight.id for fid in flight_ids):
                print("✅ All AthleteEntry records now have correct flight_id")
            else:
                print("❌ Some AthleteEntry records have incorrect flight_id")
                return False
            
            # Step 3: Simulate removing athlete from flight
            print(f"\n📝 Step 3: Simulating removing athlete from flight...")
            updated_count = update_athlete_entries_flight_info(
                athlete_id=athlete.id,
                event_id=flight.event.id,
                new_flight_id=None,  # Remove from flight
                new_entry_order=0
            )
            print(f"✅ Updated {updated_count} AthleteEntry records")
            
            # Check final state
            entries = AthleteEntry.query.filter_by(
                athlete_id=athlete.id,
                event_id=flight.event.id
            ).all()
            
            flight_ids = [entry.flight_id for entry in entries]
            print(f"📊 After removing from flight: {flight_ids}")
            
            if all(fid is None for fid in flight_ids):
                print("✅ All AthleteEntry records now have flight_id cleared")
                print("\n🎉 All tests passed! Flight synchronization is working correctly.")
                return True
            else:
                print("❌ Some AthleteEntry records still have flight_id set")
                return False
        else:
            print("❌ Flight has no associated event")
            return False

if __name__ == "__main__":
    if test_flight_sync():
        print("\n✅ Flight synchronization test completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Flight synchronization test failed!")
        sys.exit(1)