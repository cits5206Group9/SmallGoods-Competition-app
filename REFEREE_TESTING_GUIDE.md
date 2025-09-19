# 🏋️ Competition Model Setup for Referee Testing

## Step 1: Start the Flask App
```bash
cd SmallGoods-Competition-app
python3 run.py
```
The app should be running on: **http://127.0.0.1:8000**

## Step 2: Create a Competition Model

### Option A: Use the Web Interface (Recommended)
1. Open your browser and go to: **http://127.0.0.1:8000/admin/competition-model**
2. Fill in the competition details:
   - **Competition Name**: "Olympic Weightlifting Championship 2025"
   - **Sport Type**: Select "Olympic Weightlifting"
3. Add Events:
   
   **Event 1: Men's 73kg Snatch**
   - Event Name: "Men's 73kg Snatch"
   - Add Movement:
     - Movement Name: "Snatch"
     - Timer Settings:
       - Attempt Time: 60 seconds
       - Break Time: 120 seconds
     - Scoring: "Best of 3 attempts"

   **Event 2: Men's 73kg Clean & Jerk**
   - Event Name: "Men's 73kg Clean & Jerk"  
   - Add Movement:
     - Movement Name: "Clean & Jerk"
     - Timer Settings:
       - Attempt Time: 60 seconds
       - Break Time: 120 seconds
     - Scoring: "Best of 3 attempts"

4. Click **"Save Competition Model"**

### Option B: Use the Seeder Script (If web interface fails)
```bash
cd SmallGoods-Competition-app
python3 seed_test_data.py
```

## Step 3: Test the Referee Interface

1. **Navigate to Referee Page**:
   Go to: **http://127.0.0.1:8000/admin/referee**

2. **Select Competition**:
   - From the "Competition" dropdown, select "Olympic Weightlifting Championship 2025"
   - From the "Event" dropdown, select "Men's 73kg Snatch"

3. **Load Athletes**:
   - Click "Load Athletes" button
   - This will populate the athlete queue with sample athletes

4. **Test Referee Functionality**:

   **For each athlete:**
   - ✅ **Timer**: Click "Start Timer" to begin 60-second countdown
   - ✅ **Decision**: Click "Good Lift" or "No Lift" 
   - ✅ **Technical Violations**: If "No Lift", check appropriate violations
   - ✅ **Referee Votes**: Click the white (⚪) or red (🔴) buttons for each of the 3 referees
   - ✅ **Submit**: Click "Submit Decision" when all votes are in
   - ✅ **Next**: Click "Next Athlete" to move to the next competitor

5. **Test Features**:
   - **Emergency Stop**: Red button for emergency situations
   - **Technical Break**: Orange button to pause competition
   - **Timer Reset**: Reset the countdown timer
   - **Athletes Queue**: View all athletes and their progress
   - **Competition Progress**: Track overall completion

## Step 4: Available URLs for Testing

- **Main App**: http://127.0.0.1:8000/
- **Admin Dashboard**: http://127.0.0.1:8000/admin/
- **Competition Model**: http://127.0.0.1:8000/admin/competition-model
- **Referee Panel**: http://127.0.0.1:8000/admin/referee

## Troubleshooting

### If Competition Dropdown is Empty:
1. Make sure you saved the competition model successfully
2. Check the browser console for any JavaScript errors
3. Try refreshing the referee page

### If API Errors Occur:
- The referee page uses `/admin/api/competitions` endpoint
- Make sure the Flask app is running and accessible
- Check browser developer tools (F12) for network errors

### Sample Competition Data
If you need to recreate the competition, here's the JSON structure:
```json
{
  "name": "Olympic Weightlifting Championship 2025",
  "sport_type": "olympic_weightlifting",
  "events": [
    {
      "name": "Men's 73kg Snatch",
      "movements": [
        {
          "name": "Snatch",
          "timer": {
            "attempt_seconds": 60,
            "break_seconds": 120
          }
        }
      ]
    },
    {
      "name": "Men's 73kg Clean & Jerk", 
      "movements": [
        {
          "name": "Clean & Jerk",
          "timer": {
            "attempt_seconds": 60,
            "break_seconds": 120
          }
        }
      ]
    }
  ]
}
```

## 🎯 Expected Referee Workflow

1. **Competition Setup** → Select competition and event
2. **Athlete Loading** → Load competitors into queue  
3. **Individual Attempts**:
   - Start timer (60s countdown)
   - Make lift decision (Good/No Lift)
   - Record referee votes (3 referees)
   - Submit final decision
4. **Progress Tracking** → Move to next athlete
5. **Completion** → All athletes finish 3 attempts each

✨ **The referee interface is now ready for comprehensive testing!**