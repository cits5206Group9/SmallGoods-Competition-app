# Competition Model Setup for Timekeeper Testing

## Step 1: Start the Flask App
Instructions for testing :
1. Clone the repository
   
  - git clone https://github.com/cits5206Group9/SmallGoods-Competition-app.git

  - cd SmallGoods-Competition-app

2. Create and activate virtual environment
   
  - python -m venv .venv
  
  - Activate (Windows) : .venv\Scripts\activate **OR**
  
  - Activate (macOS/Linux) : source .venv/bin/activate

4. Install dependencies : pip install -r requirements.txt
  
5. Upgrade DB : flask db upgrade
  
6. Run app : flask run
7. Navigate to **http://127.0.0.1:5000/**


## Step 2: Create a Competition Model

### Option A: Use the Web Interface (Recommended)
1. Open your browser and go to: **http://127.0.0.1:5000/admin/competition-model**
2. Fill in the competition details:
   - **Competition Name**: "Olympic Weightlifting Championship 2025"
   - **Sport Type**: Select "Olympic Weightlifting"
3. Add Events:
   
   **Event 1: Men's 73kg Snatch**
   - Event Name: "Men's 73kg Snatch"
   - Gender: "Male"
   - Attempt Ordering:
     - Rule: Select any
     - Custom order : 1,2,1,2
   - Add Movement/Lift
     - Movement Name: "Snatch"
     - Reps / Attempts : 1,1,1
     - Timer Settings:
       - Attempt Time: 60 seconds
       - Break Time: 120 seconds
     - Scoring: "Best of 3 attempts"
    
4. Add Group/flights
   - Name : Flight A
   - Order in Group : 1
   - #of referees : 1
   - Decision Options:  good lift, green, true
                        bad lift, red, false
                        not to depth, blue, false

5. Click **"Save to Database"**

## Step 3: Test the Timekeeper Interface

1. **Navigate to Timekeeper Page**:
   Go to: **http://127.0.0.1:8000/admin/timer**

2. **Select Competition**:
   - From the "Competition" dropdown, select "Olympic Weightlifting Championship 2025"
   - From the "Event" dropdown, select "Men's 73kg Snatch"
   - From the "Flight" dropdown, select "Flight A"
   - Click "**Load**" button

   - Enter an "Athelete" name in input and click "Apply"

3. **Attempt timer** and **Break timer** will display the attempt time and break time defined in the competition model in Step 2.

4. For custom timer: Can "Set time" and "Apply"

5. Test the timers using "Start" and "Stop". The timer record will be displayed in Timer Log table for particular compettion and event.
