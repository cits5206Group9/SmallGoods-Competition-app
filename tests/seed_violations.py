"""Seed default technical violations"""

from app import create_app, db
from app.models import TechnicalViolation


def seed_violations():
    app = create_app()
    with app.app_context():
        # Check if violations already exist
        existing_count = TechnicalViolation.query.count()
        if existing_count > 0:
            print(f"✓ {existing_count} violations already exist in database")
            return

        # Default violations
        violations = [
            {
                "name": "Press Out",
                "description": "Bar pressed out incorrectly",
                "display_order": 1,
            },
            {
                "name": "Elbow Touch",
                "description": "Elbow touched the knee/leg during lift",
                "display_order": 2,
            },
            {
                "name": "Knee Touch",
                "description": "Knee touched the platform",
                "display_order": 3,
            },
            {
                "name": "Bar Pressed Down",
                "description": "Bar pressed down instead of up",
                "display_order": 4,
            },
            {
                "name": "Incomplete Lockout",
                "description": "Arms not fully locked at top",
                "display_order": 5,
            },
            {
                "name": "Foot Movement",
                "description": "Feet moved during the lift",
                "display_order": 6,
            },
            {
                "name": "Early Drop",
                "description": "Bar dropped before official signal",
                "display_order": 7,
            },
            {
                "name": "Other Technical",
                "description": "Any other technical violation",
                "display_order": 8,
            },
        ]

        for v_data in violations:
            violation = TechnicalViolation(**v_data)
            db.session.add(violation)

        db.session.commit()
        print(f"✓ Successfully seeded {len(violations)} technical violations")

        # Display seeded violations
        print("\nSeeded violations:")
        for v in TechnicalViolation.query.order_by(
            TechnicalViolation.display_order
        ).all():
            print(f"  {v.display_order}. {v.name} - {v.description}")


if __name__ == "__main__":
    seed_violations()
