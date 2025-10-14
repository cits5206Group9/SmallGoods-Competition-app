# 📖 SmallGoods Competition App - User Guide

**Version:** 1.0  
**Last Updated:** October 2025

---

## 📑 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
   - [System Requirements](#system-requirements)
   - [Installation & Setup](#installation--setup)
   - [Running the Application](#running-the-application)
   - [Accessing on Local Network](#accessing-on-local-network)
3. [User Roles & Login](#user-roles--login)
4. [Competition Management](#competition-management)
5. [Flight Management](#flight-management)
6. [Athlete Management](#athlete-management)
7. [Timer Control (Timekeeper)](#timer-control-timekeeper)
8. [Referee System](#referee-system)
9. [Display Screens](#display-screens)
10. [Athlete View](#athlete-view)
11. [Scoreboard](#scoreboard)
12. [Testing Guide](#testing-guide)

---

## 🎯 Introduction

The **SmallGoods Competition App** is a comprehensive web-based platform designed for managing weightlifting competitions. It streamlines the entire competition workflow from athlete registration to real-time scoring and display.

### Key Features

✅ **Competition Setup** - Create and manage multiple competitions with events and flights  
✅ **Real-time Timer** - Synchronized countdown/countup timer for attempts  
✅ **Flight Management** - Organize athletes into flights with automatic attempt ordering  
✅ **Referee Decisions** - Record and process referee verdicts  
✅ **Live Displays** - Scoreboard and attempt tracking for audience  
✅ **Athlete Portal** - Personal dashboard for competitors  
✅ **Network Support** - Access from multiple devices on local network  

---

## 🚀 Getting Started

### System Requirements

- **Python:** 3.8 or higher
- **Operating System:** Windows, macOS, or Linux
- **Browser:** Modern browser (Chrome, Firefox, Safari, Edge)
- **Network:** Wi-Fi router for multi-device access (optional)

### Installation & Setup

#### 1. Clone or Download the Repository

```bash
git clone https://github.com/cits5206Group9/SmallGoods-Competition-app.git
cd SmallGoods-Competition-app
```

#### 2. Create Virtual Environment

**macOS/Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows:**
```bash
python -m venv .venv
.venv\Scripts\activate
```

#### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

#### 4. Initialize Database

```bash
flask db upgrade
```

This creates the SQLite database with all necessary tables.

### Running the Application

#### Development Mode (Recommended for Testing)

**macOS/Linux:**
```bash
./run.sh
```

**Windows:**
```bash
run.bat
```

The application will start on `http://127.0.0.1:5000`

#### Production Mode with Logging Levels

```bash
# INFO level logging (default)
./run.sh INFO

# DEBUG level (most verbose - useful for troubleshooting)
./run.sh DEBUG

# WARNING level (minimal logging)
./run.sh WARNING
```

#### Custom Port

```bash
python3 run.py --port 5001
```

### Accessing on Local Network

To allow multiple devices (tablets, phones) to access the app:

#### 1. Find Your Computer's IP Address

**macOS/Linux:**
```bash
ifconfig | grep "inet "
```

**Windows:**
```bash
ipconfig
```

Look for an IP like `192.168.1.x` or `10.0.0.x`

#### 2. Run with Network Access

```bash
python3 -c "from run import app; app.run(host='0.0.0.0', port=5001, debug=True)"
```

#### 3. Access from Other Devices

Open browser on any device connected to the same Wi-Fi:
```
http://YOUR_IP_ADDRESS:5001
```

Example: `http://192.168.1.100:5001`

#### Firewall Configuration

You may need to allow incoming connections:

**macOS:**
- System Preferences → Security & Privacy → Firewall → Firewall Options
- Allow incoming connections for Python

**Windows:**
- Windows Defender Firewall → Allow an app
- Add Python to allowed apps

---

## 👥 User Roles & Login

### Available Roles

| Role | Access Level | Primary Functions |
|------|--------------|-------------------|
| **Admin** | Full access | Manage competitions, flights, athletes, settings |
| **Referee** | Referee panel | Record attempt decisions, view athlete cards |
| **Timekeeper** | Timer control | Manage attempt timer, track lifting order |
| **Coach** | Athlete management | Register athletes, submit weight changes |
| **Athlete** | Personal view | View schedule, attempts, results |

### Logging In

1. Navigate to `http://YOUR_IP:5001/login`
2. Enter your **email** and **password**
3. Select your **role** from dropdown
4. Click **Login**

### First-Time Setup

Default admin credentials (change immediately):
```
Email: admin@example.com
Password: admin123
```

**⚠️ Important:** Change default passwords in production!

---

## 🏆 Competition Management

### Creating a Competition

1. **Navigate:** Admin Dashboard → Competitions → "Create New Competition"

2. **Fill Competition Details:**
   - **Name:** e.g., "State Championships 2025"
   - **Start Date:** Competition start date
   - **End Date:** Competition end date
   - **Location:** Venue name/address
   - **Status:** Active/Inactive
   - **Break Times:**
     - Between Events: 300 seconds (5 minutes)
     - Between Flights: 180 seconds (3 minutes)

3. **Click "Create Competition"**

### Managing Events

Events are competition categories (e.g., Men's 73kg, Women's 55kg).

#### Adding an Event

1. Navigate to Competition → "Events" tab
2. Click "Add Event"
3. Fill event details:
   - **Event Name:** e.g., "Men's 73kg"
   - **Weight Class:** 73
   - **Gender:** Male/Female
   - **Event Type:** Snatch/Clean & Jerk/Total
   - **Scoring Type:** Sinclair/Total/Bodyweight
4. Click "Save Event"

#### Editing an Event

1. Find event in list
2. Click "Edit" button
3. Update details
4. Click "Save Changes"

### Competition Settings

#### Break Time Configuration

Break times trigger automatically between flights and events:

- **Between Events:** Rest period when switching between Snatch and Clean & Jerk
- **Between Flights:** Rest period between flight groups

These timers auto-start and can be manually controlled by timekeeper.

---

## ✈️ Flight Management

Flights organize athletes into manageable groups that compete together.

### Creating a Flight

1. **Navigate:** Admin Dashboard → Select Competition → Flights
2. **Click "Create New Flight"**
3. **Fill Flight Details:**
   - **Flight Name:** e.g., "Flight A", "Morning Session"
   - **Event:** Select parent event
   - **Status:** Active/Inactive
   - **Scheduled Time:** Start time for this flight
4. **Click "Create Flight"**

### Adding Athletes to Flight

1. Open Flight → "Manage Athletes"
2. Click "Add Athlete to Flight"
3. Select athlete from dropdown (or create new)
4. Set **Starting Weight**
5. Click "Add"

### Attempt Order Management

The **Attempt Order** determines the sequence athletes lift in.

#### Understanding Attempt Order

Athletes are sorted by:
1. **Requested Weight** (ascending)
2. **Lot Number** (if weights are equal)
3. **Attempt Number**

#### Viewing Attempt Order

Navigate to Flight → "Attempt Order Management"

You'll see a sortable list showing:
- Position (#)
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
- **Sort by Weight:** Arrange by requested weight (lightest first)
- **Sort by Name:** Alphabetical order
- **Randomize Order:** Shuffle for draw purposes

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

---

## 👤 Athlete Management

### Adding a New Athlete

1. **Navigate:** Admin Dashboard → Athletes → "Add Athlete"
2. **Fill Athlete Information:**
   - **First Name**
   - **Last Name**
   - **Email** (optional, for athlete portal access)
   - **Date of Birth**
   - **Gender:** Male/Female
   - **Weight Class:** Select appropriate category
   - **Club/Team:** Team affiliation
   - **Lot Number:** Draw number (for tie-breaking)
3. **Click "Create Athlete"**

### Athlete Profile

Each athlete has a profile showing:
- Personal information
- Competition history
- Best lifts (Snatch, Clean & Jerk, Total)
- Current flight assignments

### Registering Athlete for Event

1. Navigate to Event → "Athletes"
2. Click "Register Athlete"
3. Select athlete from dropdown
4. Set **Entry Total** (qualification total)
5. Set **Opening Weights:**
   - Snatch opening weight
   - Clean & Jerk opening weight
6. Click "Register"

### Managing Athlete Attempts

Athletes get 3 attempts per lift type (Snatch, Clean & Jerk):

1. Navigate to Flight → Athlete
2. View attempts list
3. Edit **Requested Weight** before attempt
4. Status updates automatically during competition

---

## ⏱️ Timer Control (Timekeeper)

The **Timekeeper** manages the competition clock and coordinates the lifting order.

### Accessing Timer Control

Navigate to: `http://YOUR_IP:5001/admin/timer`

### Timer Interface Overview

#### 🎯 Selected Flight Panel
- **Competition:** Currently active competition
- **Event:** Current event (Snatch/Clean & Jerk)
- **Flight:** Current flight group

#### 👤 Athlete Selection
- **Athlete Dropdown:** Select current lifter
- **Attempt Dropdown:** Select attempt number (1, 2, or 3)
- **Reload Button:** Refresh athlete list
- **Apply Button:** Confirm selection and mark attempt as "In Progress"
- **Next Button:** Auto-select next athlete in order

#### ⏲️ Attempt Timer

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
- Click "✎ Edit Time" button
- Enter time in format `MM:SS` or `HH:MM:SS`
- Click "Apply" to set new time

**Auto-Stop Feature:**
- Timer automatically stops when time limit is reached
- Duration is capped at maximum (e.g., 120 seconds)
- Attempt is automatically marked as "Finished"

#### 📋 Attempt Order Management

Real-time view of lifting order showing:
- Current position
- Athlete names
- Requested weights
- Attempt numbers
- Status indicators:
  - 🔵 **Waiting** - Not yet started
  - 🟢 **In Progress** - Currently lifting
  - ⚪ **Finished** - Completed

**Filters & Actions:**
- Search athletes by name
- Filter by status
- Sort by weight/name
- Mark first as completed (for batch completion)
- Refresh to update from database

#### 📊 Rest Timers (Pinned Athletes)

After completing an attempt, athletes are "pinned" with individual rest timers:

**Rest Timer Display:**
- Athlete name and attempt completed
- Attempt duration
- Countdown rest timer
- Controls: Start, Pause, Reset, Edit

**Default Rest Time:** 120 seconds (2 minutes)

**Managing Rest Timers:**
- Individual controls for each athlete
- Edit rest time for specific athlete
- Bulk actions: Start All, Pause All, Reset All

#### 🔔 Break Timers

Automatic break timers between segments:

**Flight Break Timer:**
- Triggers automatically between flights
- Duration set in competition settings (default: 3 minutes)
- Edit manually if needed

**Event Break Timer:**
- Triggers automatically between events
- Duration set in competition settings (default: 5 minutes)
- Edit manually if needed

#### 📝 Timer Log

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

5. **Between Flights:**
   - Break timer auto-starts
   - Use break time to verify results
   - Load next flight when ready

### Best Practices

✅ **Always Apply after selecting** - Clicking "Apply" is required to mark attempt as in-progress  
✅ **Use Next button** - Automatically selects next pending athlete  
✅ **Check Attempt Order** - Verify lifting order before each attempt  
✅ **Monitor Rest Timers** - Ensure athletes have adequate rest  
✅ **Review Timer Log** - Use for verification and records  

---

## 👨‍⚖️ Referee System

Referees evaluate each attempt and record their decisions using the referee panel.

### Accessing Referee Panel

Navigate to: `http://YOUR_IP:5001/referee`

### Individual Referee View

Each referee has their own device/screen:

#### Referee Identification
- **Competition:** Current competition name
- **Referee Position:** Left/Center/Right (assigned by admin)
- **Current Athlete:** Shows athlete currently lifting

#### Athlete Card Display

Shows key information:
- Athlete name and photo
- Current attempt number
- Requested weight
- Previous attempts summary
- Best lifts to date

#### Decision Controls

After attempt completion:

**Decision Buttons:**
- ✅ **Good Lift** (White light)
- ❌ **No Lift** (Red light)

**Decision Options:**
- Click button once to register
- Confirmation shown
- Cannot change after submission

### Referee Decision Rules

- **Majority Rule:** 2 out of 3 white lights = successful lift
- **Timing:** Referees must decide within designated time window
- **Synchronization:** All decisions recorded and processed together

### Three-Referee Panel View

For head referee/display purposes:

Navigate to: `http://YOUR_IP:5001/referee/panel`

Shows:
- All three referee positions
- Real-time decision lights
- Final verdict calculation
- Attempt history

---

## 📺 Display Screens

Public displays for audience, coaches, and athletes.

### Scoreboard Display

Navigate to: `http://YOUR_IP:5001/display/scoreboard`

**Features:**
- Current competition and event name
- Real-time rankings
- Athlete names and countries/teams
- Attempt weights (Snatch / Clean & Jerk)
- Current totals
- Running order indicator

**Display Modes:**
- Full competition scoreboard
- Current flight only
- Top 10 leaders
- Final results

**Auto-refresh:** Updates automatically as attempts complete

### Attempt Display

Navigate to: `http://YOUR_IP:5001/display/current-attempt`

**Shows:**
- Current lifter information
- Attempt number (1, 2, or 3)
- Requested weight
- Time remaining
- Referee decision lights (during/after attempt)

**Synchronized with:**
- Timer control
- Referee decisions
- Attempt status updates

### Flight Display

Navigate to: `http://YOUR_IP:5001/display/flight`

**Shows:**
- Complete lifting order for current flight
- Next 5 athletes on deck
- Athlete names and attempt numbers
- Requested weights
- Current attempt status

**Color Coding:**
- 🟢 Green - Current lifter
- 🔵 Blue - Next up
- ⚫ Gray - Completed

### Setting Up Display Screens

**Recommended Setup:**

1. **Main Scoreboard:** Large TV/projector for audience
   - Full-screen scoreboard display
   - Visible from athlete warm-up area

2. **Attempt Display:** Medium screen near platform
   - Current athlete and timer
   - Referee lights
   - Visible to coaches and athletes

3. **Flight Display:** Tablet/monitor in warm-up area
   - Shows upcoming order
   - Helps athletes prepare

**Browser Settings:**
- Press `F11` for full-screen mode
- Disable browser UI elements
- Set zoom level for optimal readability

---

## 🏋️ Athlete View

Personal dashboard for athletes to track their competition.

### Accessing Athlete Portal

1. Navigate to: `http://YOUR_IP:5001/athlete`
2. Login with athlete credentials
3. Or select athlete from dropdown (if public access enabled)

### Athlete Dashboard

#### Personal Information
- Name and competition details
- Flight assignment
- Weight class
- Starting number

#### My Attempts

**Snatch Attempts:**
- Attempt 1: Status, weight, result
- Attempt 2: Status, weight, result
- Attempt 3: Status, weight, result

**Clean & Jerk Attempts:**
- Attempt 1: Status, weight, result
- Attempt 2: Status, weight, result
- Attempt 3: Status, weight, result

#### Status Indicators:
- ⏳ **Pending** - Not yet performed
- 🔵 **In Progress** - Currently lifting
- ✅ **Good** - Successful lift
- ❌ **No Lift** - Failed attempt

#### Current Status

Shows:
- **On Deck:** Position in lifting order
- **Next Up:** Time until athlete's turn (estimated)
- **Rest Timer:** Time since last attempt
- **Current Rank:** Position in competition

#### Personal Records

- Best Snatch (current competition)
- Best Clean & Jerk (current competition)
- Total (Snatch + C&J)
- All-time personal records

### Weight Change Requests

Athletes/coaches can request weight changes:

1. Click "Request Weight Change"
2. Select attempt number
3. Enter new weight
4. Submit request
5. Timekeeper/admin approves or denies

**Rules:**
- Must be requested before called to platform
- Typically 2 minutes before attempt
- Subject to competition rules

---

## 🏆 Scoreboard

Real-time competition rankings and results.

### Main Scoreboard Features

#### Competition Header
- Competition name and location
- Event name (weight class)
- Current flight
- Date and time

#### Athlete Rankings Table

| Rank | Athlete | Team | Snatch | C&J | Total | Status |
|------|---------|------|--------|-----|-------|--------|
| 1 | John Doe | USA | 120kg | 150kg | 270kg | ✓ |
| 2 | Jane Smith | CAN | 115kg | 152kg | 267kg | ✓ |
| 3 | Bob Johnson | GBR | 118kg | 145kg | 263kg | ● |

**Column Details:**
- **Rank:** Current position (updates in real-time)
- **Athlete:** Name and country/team
- **Snatch:** Best successful snatch
- **C&J:** Best successful clean & jerk
- **Total:** Combined total (Snatch + C&J)
- **Status:**
  - ✓ Completed all attempts
  - ● Currently lifting
  - — Still has attempts remaining

#### Filtering & Views

**Filter Options:**
- All athletes
- Current flight only
- Final results
- Medal positions (Top 3)

**Sort Options:**
- By total (default)
- By Sinclair coefficient
- By bodyweight
- Alphabetically

### Live Updates

Scoreboard automatically updates when:
- Attempt is completed
- Referee decisions are recorded
- New athlete enters competition
- Weight changes are approved

### Scoring Systems

#### Total Score
Sum of best Snatch + best Clean & Jerk

#### Sinclair Coefficient
Normalizes scores across weight classes:
- Allows comparison between different weight categories
- Formula accounts for bodyweight
- Higher coefficient = better relative performance

#### Bodyweight Categories
Athletes compete within their weight class:
- Results shown separately per category
- Overall champions may be awarded across all classes

---

## 🧪 Testing Guide

### Running Tests

The application includes comprehensive test suites.

#### Run All Tests

```bash
pytest
```

#### Run Specific Test Types

```bash
# Unit tests only (fast, test individual components)
pytest -m unit

# Integration tests (test component interactions)
pytest -m integration

# System tests (end-to-end tests)
pytest -m system
```

#### Run Specific Test Files

```bash
# Test database models
pytest tests/test_models.py

# Test API integration
pytest tests/test_integration.py

# Test complete workflows
pytest tests/test_system.py
```

#### Verbose Output

```bash
pytest -v
```

#### Stop on First Failure

```bash
pytest -x
```

#### Generate Coverage Report

```bash
pytest --cov=app --cov-report=html
```

View report: `open htmlcov/index.html`

### Test Types Explained

#### 🔬 Unit Tests
- Test individual functions/classes
- Very fast (< 1 second each)
- Mock external dependencies
- Located in `tests/test_models.py`

**Example:**
```python
def test_athlete_creation():
    athlete = Athlete(first_name="John", last_name="Doe")
    assert athlete.first_name == "John"
```

#### 🔗 Integration Tests
- Test component interactions
- Use real database (test instance)
- Medium speed (1-10 seconds each)
- Located in `tests/test_integration.py`

**Example:**
```python
def test_attempt_workflow():
    # Create athlete, register for event, record attempt
    # Verify all database relationships work correctly
```

#### 🌐 System Tests
- Test complete user workflows
- Use HTTP test client
- Slower (10+ seconds each)
- Located in `tests/test_system.py`

**Example:**
```python
def test_competition_creation_flow():
    # Simulate user creating competition via web interface
    # Verify all pages load and data persists correctly
```

### Manual Testing Checklist

Before competition day:

- [ ] Create test competition
- [ ] Add test athletes
- [ ] Register athletes for events
- [ ] Create flights and assign athletes
- [ ] Test timer on all devices
- [ ] Verify referee panels work
- [ ] Check display screens update
- [ ] Test athlete portal login
- [ ] Verify scoreboard calculates correctly
- [ ] Test weight change workflow
- [ ] Check break timers trigger correctly
- [ ] Verify attempt order management
- [ ] Test all network devices can connect

---

## 🆘 Troubleshooting

### Common Issues

#### Application Won't Start

**Problem:** Error when running `./run.sh`

**Solutions:**
1. Check Python version: `python3 --version` (need 3.8+)
2. Activate virtual environment: `source .venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Check database: `flask db upgrade`

#### Can't Access from Other Devices

**Problem:** Other devices can't connect to app

**Solutions:**
1. Verify app is running with `host='0.0.0.0'`
2. Check firewall settings
3. Confirm devices on same Wi-Fi network
4. Try IP address instead of hostname
5. Check port isn't blocked (try different port like 5001)

#### Timer Not Synchronizing

**Problem:** Timer shows different times on different devices

**Solutions:**
1. Refresh all browser tabs
2. Clear browser cache
3. Check network connection stability
4. Restart Flask application
5. Verify WebSocket connections

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

### Getting Help

- **Documentation:** Check this guide and code comments
- **Logs:** Run with `./run.sh DEBUG` for detailed logs
- **GitHub Issues:** Report bugs at repository issues page
- **Email Support:** Contact development team

---

## 📞 Support & Contact

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

### Feature Requests

We welcome suggestions! Submit feature requests via GitHub Issues with:
- Clear description of feature
- Use case / benefit
- Mockups or examples (if applicable)

---

## 📋 Appendix

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Start Timer | `Space` (when timer focused) |
| Full Screen | `F11` |
| Refresh Page | `Ctrl+R` / `Cmd+R` |
| Hard Refresh | `Ctrl+Shift+R` / `Cmd+Shift+R` |
| Dev Tools | `F12` |

### Competition Rules Reference

Standard weightlifting competition rules apply:
- 3 attempts per lift type
- Increasing weight only (no decreases)
- 2-minute rest between own attempts
- Referee majority decision (2/3)
- Lightest weight lifts first

### Network Configuration

**Recommended Setup:**
- Dedicated Wi-Fi network
- Router placement near competition area
- Wired connection for main server
- Quality of Service (QoS) enabled for web traffic
- Static IP for server (optional but recommended)

---

**End of User Guide**

*For technical documentation, see ARCHITECTURE.md and CONTRIBUTING.md*
