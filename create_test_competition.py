#!/usr/bin/env python3
"""
Create a test competition model for referee testing
"""
import requests
import json

# Competition model data for Olympic Weightlifting
competition_model = {
    "name": "Olympic Weightlifting Championship 2025",
    "sport_type": "olympic_weightlifting",
    "features": {
        "allowAthleteInput": True,
        "allowCoachAssignment": True,
        "enableAttemptOrdering": True
    },
    "events": [
        {
            "name": "Men's 73kg Snatch",
            "category": "Men's 73kg",
            "movements": [
                {
                    "name": "Snatch",
                    "timer": {
                        "attempt_seconds": 60,
                        "break_seconds": 120
                    },
                    "scoring": {
                        "name": "Best of 3 attempts",
                        "type": "best_attempt"
                    }
                }
            ]
        },
        {
            "name": "Men's 73kg Clean & Jerk",
            "category": "Men's 73kg", 
            "movements": [
                {
                    "name": "Clean & Jerk",
                    "timer": {
                        "attempt_seconds": 60,
                        "break_seconds": 120
                    },
                    "scoring": {
                        "name": "Best of 3 attempts",
                        "type": "best_attempt"
                    }
                }
            ]
        },
        {
            "name": "Women's 63kg Snatch",
            "category": "Women's 63kg",
            "movements": [
                {
                    "name": "Snatch",
                    "timer": {
                        "attempt_seconds": 60,
                        "break_seconds": 120
                    },
                    "scoring": {
                        "name": "Best of 3 attempts",
                        "type": "best_attempt"
                    }
                }
            ]
        },
        {
            "name": "Women's 63kg Clean & Jerk",
            "category": "Women's 63kg",
            "movements": [
                {
                    "name": "Clean & Jerk",
                    "timer": {
                        "attempt_seconds": 60,
                        "break_seconds": 120
                    },
                    "scoring": {
                        "name": "Best of 3 attempts",
                        "type": "best_attempt"
                    }
                }
            ]
        }
    ]
}

def create_competition():
    """Create competition via API"""
    url = "http://127.0.0.1:8000/admin/competition-model/save"
    
    try:
        print("Creating competition model...")
        print(f"Competition: {competition_model['name']}")
        print(f"Events: {len(competition_model['events'])}")
        
        response = requests.post(url, json=competition_model)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Competition created successfully!")
            print(f"Competition ID: {result.get('competition_id')}")
            return result.get('competition_id')
        else:
            print(f"❌ Error creating competition: {response.status_code}")
            print(response.text)
            return None
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the Flask app. Make sure it's running on http://127.0.0.1:8000")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_api_endpoints():
    """Test that referee API endpoints are working"""
    print("\n🔍 Testing API endpoints...")
    
    # Test competitions endpoint
    try:
        response = requests.get("http://127.0.0.1:8000/admin/api/competitions")
        if response.status_code == 200:
            competitions = response.json()
            print(f"✅ Found {len(competitions)} competitions available")
            for comp in competitions:
                print(f"   - {comp['name']} (ID: {comp['id']})")
        else:
            print(f"❌ Competitions API failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing competitions API: {e}")

def main():
    print("🏋️ Creating Olympic Weightlifting Competition for Referee Testing")
    print("=" * 60)
    
    # Create the competition
    competition_id = create_competition()
    
    if competition_id:
        # Test API endpoints
        test_api_endpoints()
        
        print("\n🎯 Testing Instructions:")
        print("=" * 40)
        print("1. Open your browser and go to: http://127.0.0.1:8000/admin/referee")
        print("2. Select 'Olympic Weightlifting Championship 2025' from the competition dropdown")
        print("3. Choose an event (e.g., 'Men's 73kg Snatch')")
        print("4. Click 'Load Athletes' to populate the athlete queue")
        print("5. Test the referee functionality:")
        print("   - Start the timer")
        print("   - Make decisions (Good Lift/No Lift)")
        print("   - Record referee votes")
        print("   - Submit decisions and move to next athlete")
        print("\n✨ The competition is ready for testing!")
    else:
        print("\n❌ Failed to create competition. Please check the Flask app is running.")

if __name__ == '__main__':
    main()