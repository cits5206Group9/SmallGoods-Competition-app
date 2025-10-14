# SmallGoods Competition App - User Guide

**Version:** 1.0  
**Last Updated:** October 2025


## Table of Contents

1. [Getting Started](#getting-started)
2. [Login](#login)
3. [Competition Model Editor](#competition-model-editor)
4. [Flight Management](#flight-management)
5. [Athlete Management](#athlete-management)
6. [Timekeeper](#timekeeper)
7. [Referee System](#referee-system)
8. [Scoreboard History](#scoreboard-history)
9. [Public Display](#public-display)
10. [Athlete Dashboard](#athlete-dashboard)
11. [Troubleshooting](#troubleshooting)


## Getting Started

### Accessing the Application

1. **Start the Application**
   ```bash
   # Navigate to project directory
   cd SmallGoods-Competition-app
   
   # Activate virtual environment
   source .venv/bin/activate  # macOS/Linux
   # or
   .venv\Scripts\activate     # Windows
   
   # Run the application
   ./run.sh                   # macOS/Linux
   # or
   run.bat                    # Windows
   ```

2. **Access the Web Interface**
   - Open your browser and navigate to: `http://127.0.0.1:5000`
   - You should see the landing page of the application


## Login
#### ADMIN

Default admin credentials (change immediately):
```
Email: admin@email.com
Password: SG-PASSWORD
```
**⚠️ Important:** Change default passwords via 'Admin Dashboard → Account → Change Password'

#### ATHLETE

Athletes can log in with their emails that are used for athlete register.  
No password is needed for athlete login.

## ADMIN DASHBOARD

## Competition Model Editor

The Competition Model Editor allows administrators to define the complete structure of a competition.

### Accessing the Model Editor

Navigate to: `http://127.0.0.1:5000/admin/competition-model`

### Creating a New Competition Model

1. Navigate to: `http://127.0.0.1:5000/admin/competition-model/create`

2. Fill in competition details:
   - **Competition Name:** e.g., "SG Open 2025"
   - **Competition Date:** Select date
   - **Break Time Between Events:** Default 600 seconds (10 minutes)
   - **Break Time Between Flights:** Default 180 seconds (3 minutes)

### Adding Events

Events represent main competition categories (e.g., Men's Weightlifting, Women's Powerlifting).

1. Click **+ Add Event** button

2. Configure event details:
   - **Event Name:** e.g., "Mixed Weightlifting"
   - **Sport Type:** Select from dropdown
   - **Gender:** Select from dropdown
   
3. Set **Attempt Ordering** (optional):
   - **None:** No automatic ordering
   - **Heaviest Last:** Athletes with heavier weights go last
   - **Lightest First:** Athletes with lighter weights go first
   - **Custom:** Define custom sequence (e.g., `1,2,1,2,3`)

### Adding Movements/Lifts

Movements define specific lifts or exercises within an event.

1. Within an event card, click **+ Add Movement/Lift**

2. Configure movement:
   - **Name:** e.g., "Snatch", "Clean & Jerk", "Squat"
   - **Reps/Attempts:** Enter as comma-separated list
     - Example: `1,1,1` = 3 attempts of 1 rep each
   - **Attempt Time:** Time limit in seconds (e.g., 60)

3. Set **Scoring Configuration:**
   - **Scoring Name:** e.g., "best lift", "biggest"
   - **Scoring Type:** Select from dropdown
     - **Max:** Best attempt counts (e.g., weightlifting)
     - **Sum:** Total of all attempts
     - **Min:** Lowest value wins (e.g., fastest time)
   - **Metric:** What to measure (e.g., "weight", "time", "reps")

4. Add **Additional Metrics** (optional):
   - Click **+ Add Metric**
   - **Metric Name:** e.g., "weight", "reps", "time"
   - **Units:** e.g., "kg", "count", "sec", "m"

### Adding Groups/Flights

Groups (Flights) organize athletes into manageable sessions.

1. Within an event card, click **+ Add Group/Flight**

2. Configure flight:
   - **Name:** e.g., "Flight A", "Session 1"
   - **Override Reps/Attempts:** Optional override (e.g., `1,1,1`)
   - **Order In Group:** Sequence number (1, 2, 3...)

3. Set **Referee Input Specification:**
   - **# of Referees:** Typically 3
   - **Decision Options:** Enter one per line in format: `Label,Color,Value`
   
   **Example (Weightlifting):**
   ```
   good lift,green,true
   no lift,red,false
   ```
   

### Saving the Model

**Available save options:**

- **Save to Browser:** Temporary local storage (quick saves while editing)
- **Save to Database:** Permanent storage (recommended for competition use)
- **Download JSON:** Export as backup file

### Editing an Existing Model

1. Navigate to: `http://127.0.0.1:5000/admin/competition-model/edit`

2. Select competition from dropdown

3. Modify any fields:
   - Update competition details
   - Add/remove events
   - Add/remove movements
   - Add/remove flights

4. Click **Save Changes** to update database


## Flight Management 

Flights are groups of athletes competing together in the same event. 

**You can either create a flight manually or use the defined flights in competition model.** 

### 1. Creating a Flight

1. Navigate: Admin Dashboard → Flight Management
2. Click "Create New Flight"
3. Fill Flight Details:
   - Flight Name
   - Competition, Event
   - Movement Type
   - Order
4. Click "Save Flight"

### 2. Use pre-defined Flights
1. Click "Edit"
2. **⚠️ Important: Select "Movement Type"**
3. Click "Update Flight"

### Adding Athletes to Flight

1. Open Flight → Athlete
2. Click 'Add' for availble athletes.

### Attempt Order Management

The **Attempt Order** determines the sequence athletes lift in.

#### Viewing Attempt Order

Navigate to Flight → Athlete → "Attempt Order Management"

You'll see a sortable list showing:
- Athlete Name
- Requested Weight (kg)
- Attempt Number
- Status (Waiting/In Progress/Finished)

#### Reordering Attempts

**Drag & Drop:**
1. Click and hold athlete's row
2. Drag to new position
3. Release - changes save automatically

**Sort Buttons:**
- Sort by Weight: Arrange by requested weight (lightest first)
- Sort by Name: Alphabetical order
- Randomize Order: Shuffle for draw purposes

**Filters:**
- Search by athlete name
- Filter by status (All/Waiting/In Progress/Finished)

#### Editing Attempt Weights

1. Find attempt in list
2. Click on weight value
3. Enter new weight
4. Changes save automatically

#### Generate Test Attempts

For testing purposes, click **"Generate Test Attempts"** to create sample attempts for all athletes in the flight.


## Athlete Management

### Adding Athletes

1. Navigate to **Admin Dashboard** → **Athletes Management**
2. Click **"Create New Athlete"**
3. Fill in athlete information:
   - **Personal Info**: Name, Gender, Weight, Age
   - **Email**: For athlete dashboard access
   - **Team**
   - **Competition**: Assign to a competition
4. Click **"Save Athlete"**
5. Can be editted/deleted.

### Managing Athletes

#### Viewing Athletes
- **List View**: See all athletes with filters by:
  - Competition
  - Gender
  - Status
- **Search**: Quick search by name

#### Editing Athletes
1. Click **Edit** icon next
2. Update any field
3. Click **"Save Changes"**

#### Deleting Athletes
1. Click **Delete** icon next to athlete
2. Confirm deletion
3. **Warning**: This removes the athlete and all their entries, attempts, and scores

#### Creating User Accounts for Athletes
1. Navigate to athlete details
2. Click **"Create User Account"**
3. System generates login credentials
4. Athletes can then access their personal dashboard


## Timekeeper

The **Timekeeper** manages the competition timer and coordinates the lifting order.

### Accessing Timer Control

Navigate to: `http://127.0.0.1/admin/timer`

### Timer Interface Overview

#### Selected Flight Panel
- **Competition:** Currently active competition
- **Event:** Current event
- **Flight:** Current flight group

#### Athlete Selection
- **Athlete Dropdown:** Select current lifter
- **Attempt Dropdown:** Select attempt number
- **Next Button:** Auto-select next athlete in order
- **Reload Button:** Refresh athlete list
- **Apply Button:** Confirm selection and mark attempt as "In Progress"

#### Attempt Timer

**Timer Display:** Shows time in HH:MM:SS format

**Timer Controls:**
- **Start:** Begin timing attempt
- **Pause:** Pause the timer
- **Resume:** Continue paused timer
- **Reset:** Reset to initial time
- **Stop (Bar Left Platform):** End attempt and record duration

**Timer Modes:**

1. **Countdown Mode:**
   - Timer counts down from set time (e.g., 2:00 → 0:00)
   - Auto-stops at 0:00
   - Toggle with "Enable/Disable Countdown"

2. **Countup Mode:**
   - Timer counts up from 0:00
   - Runs until manually stopped or reaches time limit
   - Useful for tracking attempt duration

**Edit Timer:**
- Click "Edit Time" button
- Enter time in format `MM:SS` or `HH:MM:SS`
- Click "Apply" to set new time

**Auto-Stop Feature:**
- Timer automatically stops when time limit is reached
- Duration is capped at maximum (e.g., 120 seconds)
- Attempt is automatically marked as "Finished"

#### Attempt Order Management

Real-time view of lifting order showing:
- Athlete names
- Requested weights
- Attempt numbers
- Status indicators:
  - **Waiting** - Not yet started
  - **In Progress** - Currently lifting
  - **Finished** - Completed

**Filters & Actions:**
- Search athletes by name
- Filter by status
- Sort by weight/name
- Mark first as completed (for batch completion)
- Refresh to update from database

#### Break Timers

Automatic break timers between flights and events. Completion of last attempts will activate break timer.

**Flight Break Timer:**
- Triggers automatically between flights
- Duration set in competition settings (default: 3 minutes)
- Edit manually if needed

**Event Break Timer:**
- Triggers automatically between events
- Duration set in competition settings (default: 5 minutes)
- Edit manually if needed

#### Timer Log

Records all attempt activities:
- Start time
- Stop time
- Athlete name
- Attempt number
- Duration (exact seconds)
- Action type

**Search & Filter:**
- Search by athlete name
- Clear log entries

### Workflow Example

**Typical Competition Flow:**

1. **Load Flight:**
   - Select Competition, Event, Flight
   - Click "Load"
   - First pending athlete auto-selects

2. **Prepare Athlete:**
   - Verify athlete name and attempt number
   - Click "Apply" to mark as "In Progress"
   - Athlete card shows on display screens

3. **Time Attempt:**
   - Athlete approaches platform
   - Click "Start" when they begin
   - Timer runs automatically
   - Timer auto-stops at time limit OR
   - Click "Stop" when athlete finishes

4. **Move to Next:**
   - Click "Next" button
   - Next pending athlete is selected (skips finished)
   - Click "Apply" to confirm
   - Repeat process

5. **Between Flights(Events):**
   - Break timer auto-starts
   - Use break time to verify results
   - Load next flight(event) when ready

### Best Practices

✅ **Always Apply after selecting** - Clicking "Apply" is required to mark attempt as in-progress  
✅ **Use Next button** - Automatically selects next pending athlete  
✅ **Check Attempt Order** - Verify lifting order before each attempt   
✅ **Review Timer Log** - Use for verification and records  

---

## Referee System

Referees evaluate each attempt and record their decisions using the referee panel.

### Accessing Referee Panel
Navigate to: `http://127.0.0.1/admin/referee`

### Setting up referees
1. Navigate to: `http://127.0.0.1:5000/admin/referee-settings`.  

- Adding new referee and setting up new referee account are availble.

2. Login with the created referee account here. `http://127.0.0.1:5000/admin/referee/login`


### Individual Referee View

Each referee has their own device/screen:

#### Referee Identification
- **Competition:** Current competition name
- **Referee Position:** Left/Center/Right (assigned by admin)
- **Current Athlete:** Shows athlete currently lifting

#### Decision Controls

After attempt completion:

**Decision Buttons (Defined from config):**
- **Good Lift**
- **No Lift**

**Decision Options:**
- Click button once to register
- Confirmation shown
- Cannot change after submission

### Referee Decision Rules

- **Majority Rule:** 2 out of 3 success = successful lift
- **Synchronization:** All decisions recorded and processed together


## Scoreboard History

The Scoreboard History tool provides comprehensive view of competition scores and results.

### Accessing Scoreboard History

Navigate to: `http://127.0.0.1:5000/admin/scoreboard-history`

### Viewing Scores

The score table displays:

- **Rank:** Current ranking position
- **Athlete:** Athlete name
- **Event:** Event name
- **Flight:** Flight/group name
- **Lift Type:** Movement/lift name
- **Best Weight (kg):** Highest successful weight
- **Total Score:** Final calculated score
- **Status:** Provisional or Final
- **Calculated At:** Timestamp of calculation
- **Actions:** Edit or view details

### Filtering Results

Use filters to narrow down displayed scores:

1. **Competition Filter:** Select specific competition or "All Competitions"
2. **Event Filter:** Filter by event (updates based on competition)
3. **Flight Filter:** Show specific flights (updates based on event)
4. **Status Filter:** Options:
   - All Statuses
   - Final Only
   - Provisional Only

5. Click **Apply Filters** to update table

### Score Status Types

- **Provisional:** Scores still being processed; may change
- **Final:** Scores are locked and official

### Editing Scores

Manual score adjustments (e.g., referee corrections, technical issues).

1. Locate score in table

2. Click **Edit** in Actions column

3. Modify editable fields:
   - **Best Weight (kg):** Adjust top weight
   - **Total Score:** Modify total score
   - **Rank:** Change ranking position
   - **Mark as Final:** Convert provisional to final

4. Click **Save Changes**

**Note:** Editing scores will recalculate rankings. Ensure proper authorization.

### Exporting Data

Export scores for analysis, reporting, or archival.

1. Apply filters (optional) to export specific data

2. Click **📥 Export CSV** button

3. CSV file downloads with current visible results

**CSV includes all columns:**
```
Rank,Athlete,Event,Flight,Lift Type,Best Weight (kg),Total Score,Status,Calculated At
```

## Public Display

Public displays for audience, coaches, and athletes.

* Real-time timer showing the current athlete’s countdown

* Table view of all flights with:
  -Athlete names and weight classes
  -Three attempts per athlete with success/fail marks
  -Best lift and total scores
  -Current athlete highlighted in yellow

* Bottom status bar displaying:
  - Timer (color changes based on time left)
  - Current athlete’s name
  - Requested weight

Usage:

1. Navigate to: `http://127.0.0.1:5000/display/public-stage`
2. Select competition.
3. The display updates every second automatically.
4. No manual interaction is required.


## Athlete Dashboard

Personal dashboard for athletes to track their competition.

### Accessing Athlete Portal

1. Navigate to: `http://127.0.0.1/athlete`
2. Login with athlete email

#### Personal Information
- Name
- Team, Gender, Age, Weight
- Email

#### Registered competition details

All the registered events' detail will be shown.
- **Reps per Attempt**
- **Opening Weight:** 
- **Attempts:** Attempt number, status, weight, result

#### Next Attempt detail

- **Estimated Timer:** Estimated remaining time until next attempt displayed. Break time between flights and events will be shown as separately.
- **Attempt detail:** Type, Lift, Weight, Attempt number

#### Score and Ranking

- Event name and ranking/score of the athlete will be displayed.

### Weight Change Requests

Athletes/coaches can request weight changes:

1. Click the weight form.
2. Enter new weight.
4. Save

**Rules:**
- Opening weight: Should be done before competition start
- Normal weight: 3 minutes before attempt


## Troubleshooting

### Common Issues

#### Application Won't Start

**Problem:** Error when running `./run.sh`

**Solutions:**
1. Check Python version: `python3 --version` (need 3.8+)
2. Activate virtual environment: `source .venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Check database: `flask db upgrade`

#### Database Errors

**Problem:** "No such table" or migration errors

**Solutions:**
```bash
# Check current migration state
flask db current

# Apply all migrations
flask db upgrade

# If corrupt, reset (WARNING: loses data)
rm instance/app.db
flask db upgrade
```

#### Display Screens Not Updating

**Problem:** Scoreboard doesn't show latest results

**Solutions:**
1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Check JavaScript console for errors (F12)
3. Verify WebSocket connection
4. Check network connectivity
5. Restart application


---

## Support & Contact

### Development Team

- **Project:** SmallGoods Competition App
- **Repository:** [GitHub](https://github.com/cits5206Group9/SmallGoods-Competition-app)
- **Version:** 1.0
- **License:** MIT

### Reporting Issues

Please report bugs or feature requests:
1. Visit GitHub repository
2. Create new issue
3. Include:
   - Description of problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Browser and OS information
