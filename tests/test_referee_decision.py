"""
Test script to verify referee decision submission works correctly.
Run this after starting the Flask app to test the referee decision flow.
"""

import requests
import json

BASE_URL = "http://127.0.0.1:5000"


def test_referee_decision_with_attempt():
    """Test submitting a referee decision with attempt_id"""
    print("\n" + "=" * 60)
    print("TEST 1: Referee Decision WITH attempt_id")
    print("=" * 60)

    # This would require actual data in your database
    # Adjust these IDs based on your test data
    test_data = {
        "referee_id": 1,
        "competition_id": 1,
        "attempt_id": 1,  # Must exist in database
        "decision": "good_lift",
        "timestamp": "2024-10-07T10:00:00Z",
        "notes": "Test decision with attempt_id",
    }

    print(f"\nSending POST to {BASE_URL}/admin/api/referee-decision")
    print(f"Data: {json.dumps(test_data, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}/admin/api/referee-decision",
            json=test_data,
            headers={"Content-Type": "application/json"},
        )

        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")

        if response.ok:
            data = response.json()
            if data.get("success"):
                print("\n✓ SUCCESS: Decision created in referee_decision table")
                if "attempt_id" in data:
                    print(f"  Attempt ID: {data['attempt_id']}")
                if "decision_enum" in data:
                    print(f"  Decision: {data['decision_enum']}")
                if "score" in data:
                    print(f"  Score: {data['score']}")
            else:
                print(f"\n✗ FAILED: {data.get('message')}")
        else:
            print(f"\n✗ HTTP ERROR: {response.status_code}")

    except Exception as e:
        print(f"\n✗ EXCEPTION: {str(e)}")


def test_referee_decision_without_attempt():
    """Test submitting a referee decision without attempt_id (should try to get from timer state)"""
    print("\n" + "=" * 60)
    print("TEST 2: Referee Decision WITHOUT attempt_id (uses timer state)")
    print("=" * 60)

    test_data = {
        "referee_id": 1,
        "competition_id": 1,
        # No attempt_id - should be retrieved from timer state
        "decision": "no_lift",
        "timestamp": "2024-10-07T10:05:00Z",
        "notes": "Test decision without attempt_id",
    }

    print(f"\nSending POST to {BASE_URL}/admin/api/referee-decision")
    print(f"Data: {json.dumps(test_data, indent=2)}")
    print("\nNote: This will try to get attempt_id from timer_state.json")

    try:
        response = requests.post(
            f"{BASE_URL}/admin/api/referee-decision",
            json=test_data,
            headers={"Content-Type": "application/json"},
        )

        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")

        if response.ok:
            data = response.json()
            if data.get("success"):
                if "attempt_id" in data:
                    print(
                        "\n✓ SUCCESS: Found attempt from timer state and created decision"
                    )
                    print(f"  Attempt ID: {data['attempt_id']}")
                elif "warning" in data:
                    print(
                        "\n⚠ WARNING: No attempt found - decision logged in notes only"
                    )
                    print(f"  {data.get('warning')}")
            else:
                print(f"\n✗ FAILED: {data.get('message')}")
        else:
            print(f"\n✗ HTTP ERROR: {response.status_code}")

    except Exception as e:
        print(f"\n✗ EXCEPTION: {str(e)}")


def test_referee_decision_with_object():
    """Test submitting a referee decision with decision as object (legacy format)"""
    print("\n" + "=" * 60)
    print("TEST 3: Referee Decision with Object Format (legacy)")
    print("=" * 60)

    test_data = {
        "referee_id": 1,
        "competition_id": 1,
        "attempt_id": 1,
        "decision": {"label": "Good Lift", "value": True, "color": "green"},
        "timestamp": "2024-10-07T10:10:00Z",
    }

    print(f"\nSending POST to {BASE_URL}/admin/api/referee-decision")
    print(f"Data: {json.dumps(test_data, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}/admin/api/referee-decision",
            json=test_data,
            headers={"Content-Type": "application/json"},
        )

        print(f"\nResponse Status: {response.status_code}")
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")

        if response.ok:
            data = response.json()
            if data.get("success"):
                print("\n✓ SUCCESS: Object format converted correctly")
                if "decision_enum" in data:
                    print(f"  Converted to: {data['decision_enum']}")
            else:
                print(f"\n✗ FAILED: {data.get('message')}")
        else:
            print(f"\n✗ HTTP ERROR: {response.status_code}")

    except Exception as e:
        print(f"\n✗ EXCEPTION: {str(e)}")


def check_timer_state():
    """Check current timer state"""
    print("\n" + "=" * 60)
    print("CHECKING TIMER STATE")
    print("=" * 60)

    try:
        response = requests.get(f"{BASE_URL}/admin/api/timer-state")

        if response.ok:
            state = response.json()
            print("\nCurrent Timer State:")
            print(json.dumps(state, indent=2))

            if state.get("attempt_id"):
                print(f"\n✓ attempt_id found in timer state: {state['attempt_id']}")
            else:
                print("\n⚠ No attempt_id in timer state")

        else:
            print(f"Failed to get timer state: {response.status_code}")

    except Exception as e:
        print(f"Error: {str(e)}")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("REFEREE DECISION SUBMISSION TEST SUITE")
    print("=" * 60)
    print("\nMake sure the Flask app is running at http://127.0.0.1:5000")
    print("And you have test data in the database:")
    print("  - Referee with id=1, competition_id=1")
    print("  - Attempt with id=1")

    input("\nPress Enter to start tests...")

    # Check timer state first
    check_timer_state()

    # Run tests
    test_referee_decision_with_attempt()
    test_referee_decision_without_attempt()
    test_referee_decision_with_object()

    print("\n" + "=" * 60)
    print("TESTS COMPLETE")
    print("=" * 60)
    print("\nCheck your database:")
    print("  SELECT * FROM referee_decision;")
    print("  SELECT * FROM referee;  -- check notes column")
    print("\n")
