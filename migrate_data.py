#!/usr/bin/env python3
"""
Data migration script from old database to new database
Handles schema differences between old and new database versions
"""

import sqlite3
import sys
from datetime import datetime


def migrate_data():
    old_db = "instance/app.db.old"
    new_db = "instance/app.db"

    print("Starting data migration...")
    print(f"From: {old_db}")
    print(f"To: {new_db}")
    print("-" * 60)

    try:
        # Connect to both databases
        old_conn = sqlite3.connect(old_db)
        new_conn = sqlite3.connect(new_db)

        old_cursor = old_conn.cursor()
        new_cursor = new_conn.cursor()

        # Migrate Users
        print("Migrating users...")
        old_cursor.execute(
            "SELECT id, email, password_hash, first_name, last_name, role, created_at FROM user"
        )
        users = old_cursor.fetchall()
        for user in users:
            new_cursor.execute(
                "INSERT OR IGNORE INTO user (id, email, password_hash, first_name, last_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                user,
            )
        print(f"  ✓ Migrated {len(users)} users")

        # Migrate Competitions
        print("Migrating competitions...")
        old_cursor.execute(
            "SELECT id, name, description, start_date, is_active, created_at, config FROM competition"
        )
        competitions = old_cursor.fetchall()
        for comp in competitions:
            new_cursor.execute(
                "INSERT OR IGNORE INTO competition (id, name, description, start_date, is_active, created_at, config) VALUES (?, ?, ?, ?, ?, ?, ?)",
                comp,
            )
        print(f"  ✓ Migrated {len(competitions)} competitions")

        # Migrate Events (with schema mapping)
        print("Migrating events...")
        old_cursor.execute(
            "SELECT id, competition_id, name, weight_category, gender, scoring_type, is_active FROM event"
        )
        events = old_cursor.fetchall()
        for event in events:
            # Add default sport_type since old DB doesn't have it
            # Using 'WEIGHTLIFTING' as default
            event_data = list(event)
            event_data.insert(5, "WEIGHTLIFTING")  # Insert sport_type after gender

            new_cursor.execute(
                "INSERT OR IGNORE INTO event (id, competition_id, name, weight_category, gender, sport_type, scoring_type, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                event_data,
            )
        print(
            f"  ✓ Migrated {len(events)} events (added default sport_type='WEIGHTLIFTING')"
        )

        # Migrate Athletes
        print("Migrating athletes...")
        old_cursor.execute(
            "SELECT id, user_id, competition_id, first_name, last_name, gender, bodyweight, age, team, phone, email, is_active, current_attempt_number, created_at FROM athlete"
        )
        athletes = old_cursor.fetchall()
        for athlete in athletes:
            new_cursor.execute(
                "INSERT OR IGNORE INTO athlete (id, user_id, competition_id, first_name, last_name, gender, bodyweight, age, team, phone, email, is_active, current_attempt_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                athlete,
            )
        print(f"  ✓ Migrated {len(athletes)} athletes")

        # Migrate Flights
        print("Migrating flights...")
        old_cursor.execute('SELECT id, event_id, name, "order" FROM flight')
        flights = old_cursor.fetchall()
        for flight in flights:
            flight_data = list(flight)
            # Add competition_id and movement_type (new columns)
            # Get competition_id from event
            old_cursor.execute(
                "SELECT competition_id FROM event WHERE id = ?", (flight[1],)
            )
            comp_result = old_cursor.fetchone()
            comp_id = comp_result[0] if comp_result else None

            new_cursor.execute(
                'INSERT OR IGNORE INTO flight (id, event_id, name, "order", competition_id, movement_type) VALUES (?, ?, ?, ?, ?, ?)',
                (flight[0], flight[1], flight[2], flight[3], comp_id, None),
            )
        print(f"  ✓ Migrated {len(flights)} flights")

        # Migrate Athlete Entries
        print("Migrating athlete entries...")
        old_cursor.execute("SELECT id, athlete_id, entry_order FROM athlete_entry")
        entries = old_cursor.fetchall()
        for entry in entries:
            # New schema requires more fields, using defaults
            new_cursor.execute(
                "INSERT OR IGNORE INTO athlete_entry (id, athlete_id, entry_order, event_id, flight_id, lift_type) VALUES (?, ?, ?, ?, ?, ?)",
                (entry[0], entry[1], entry[2], None, None, None),
            )
        print(f"  ✓ Migrated {len(entries)} athlete entries")

        # Migrate Athlete-Flight associations
        print("Migrating athlete-flight associations...")
        old_cursor.execute("SELECT athlete_id, flight_id FROM athlete_flight")
        assocs = old_cursor.fetchall()
        for assoc in assocs:
            new_cursor.execute(
                'INSERT OR IGNORE INTO athlete_flight (athlete_id, flight_id, "order") VALUES (?, ?, ?)',
                (assoc[0], assoc[1], 0),  # Default order = 0
            )
        print(f"  ✓ Migrated {len(assocs)} athlete-flight associations")

        # Migrate Referees
        print("Migrating referees...")
        old_cursor.execute(
            "SELECT id, name, username, password, position, email, phone, competition_id, is_active, created_at, last_login, notes FROM referee"
        )
        referees = old_cursor.fetchall()
        for ref in referees:
            new_cursor.execute(
                "INSERT OR IGNORE INTO referee (id, name, username, password, position, email, phone, competition_id, is_active, created_at, last_login, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                ref,
            )
        print(f"  ✓ Migrated {len(referees)} referees")

        # Skip referee_assignment and timer_log tables (schema too different or empty)
        print(
            "Skipping referee_assignment and timer_log (incompatible schemas or no data)"
        )

        # Commit all changes
        new_conn.commit()

        print("-" * 60)
        print("✅ Migration completed successfully!")

        # Close connections
        old_conn.close()
        new_conn.close()

    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    migrate_data()
