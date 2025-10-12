# Small Goods Competition App - User Guide

## Table of Contents
- [Getting Started](#getting-started)
- [Competition Management](#competition-management)
- [Event Management](#event-management)
- [Athlete Management](#athlete-management)
- [Flight Management](#flight-management)
- [Competition Workflow](#competition-workflow)

---

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

3. **Login**
   - Use your admin credentials to access the admin dashboard
   - Default admin account (if seeded): Check with your system administrator

---

## Competition Management

### Creating a Competition

1. Navigate to **Admin Dashboard** → **Competitions**
2. Click **"Create New Competition"** button
3. Fill in the competition details:
   - **Name**: Competition title (e.g., "State Championships 2025")
   - **Description**: Brief description of the competition
   - **Start Date**: Competition start date
   - **Break Times**:
     - Between events (default: 300 seconds / 5 minutes)
     - Between flights (default: 180 seconds / 3 minutes)
4. Click **"Create Competition"** to save

### Managing Competitions

- **View All Competitions**: Listed on the competitions page
- **Edit Competition**: Click the edit icon next to a competition
- **Activate/Deactivate**: Toggle the active status
- **Delete Competition**: Click delete icon (⚠️ This will remove all associated events, flights, and athlete entries)

---

## Event Management

Events are specific categories within a competition (e.g., "Men's 85kg", "Women's Snatch").

### Creating an Event

1. Navigate to **Admin Dashboard** → **Events**
2. Select the parent competition
3. Click **"Create New Event"**
4. Fill in event details:
   - **Event Name**: Descriptive name (e.g., "Men's 85kg Snatch")
   - **Competition**: Select parent competition
   - **Sport Type**: Choose from:
     - Olympic Weightlifting
     - Powerlifting
     - CrossFit
     - HYROX
   - **Scoring Type**:
     - **MAX**: Heaviest successful lift (weightlifting)
     - **SUM**: Total of all lifts (powerlifting total)
     - **TIME**: Fastest completion time (HYROX, CrossFit)
   - **Weight Category**: e.g., "85kg", "94kg", "Open"
   - **Gender**: Male, Female, or Mixed
5. Click **"Create Event"**

### Managing Events

- **Activate Event**: Set as the current active event for competition
- **Edit Event**: Update event details
- **Delete Event**: Remove event (⚠️ Will delete all flights and entries)

---

## Athlete Management

### Adding Athletes

1. Navigate to **Admin Dashboard** → **Athletes**
2. Click **"Create New Athlete"**
3. Fill in athlete information:
   - **First Name**: Athlete's first name
   - **Last Name**: Athlete's last name
   - **Competition**: Assign to a competition
   - **Gender**: Male/Female/Other
   - **Bodyweight**: Current bodyweight in kg
   - **Age**: Athlete's age
   - **Team**: Team/club affiliation (optional)
   - **Contact Information**:
     - Email
     - Phone number
4. Click **"Create Athlete"**

### Athlete Registration Details

**Important Fields:**
- **Bodyweight**: Used for Sinclair/IPF calculations and weight class verification
- **Team**: For team competitions and leaderboards
- **Email**: For athlete portal access (if enabled)

### Managing Athletes

#### Viewing Athletes
- **List View**: See all athletes with filters by:
  - Competition
  - Gender
  - Weight category
  - Team
- **Search**: Quick search by name

#### Editing Athletes
1. Click **Edit** icon next to athlete name
2. Update any field
3. Click **"Save Changes"**

#### Deleting Athletes
1. Click **Delete** icon next to athlete
2. Confirm deletion
3. ⚠️ **Warning**: This removes the athlete and all their entries, attempts, and scores

#### Creating User Accounts for Athletes
1. Navigate to athlete details
2. Click **"Create User Account"**
3. System generates login credentials
4. Athletes can then access their personal dashboard

### Bulk Operations

**Import Athletes** (if available):
1. Download the CSV template
2. Fill in athlete information
3. Upload the CSV file
4. Review and confirm imports

---

## Flight Management

Flights are groups of athletes competing together in the same event. Proper flight management ensures smooth competition flow.

### Understanding Flights

- **What is a Flight?**: A group of athletes competing in sequence
- **Why Flights?**: Organize large numbers of athletes, manage time, allow for warm-up areas
- **Flight Naming**: Convention: "Flight A", "Flight B", etc.

### Creating a Flight

1. Navigate to **Admin Dashboard** → **Flights**
2. Select the **Event** for the flight
3. Click **"Create New Flight"**
4. Fill in flight details:
   - **Flight Name**: e.g., "Flight A", "Flight 1"
   - **Event**: Parent event (auto-selected if creating from event page)
   - **Order**: Flight order in the competition sequence (1, 2, 3, ...)
   - **Movement Type**: Specific movement for this flight (e.g., "snatch", "clean_jerk", "squat")
5. Click **"Create Flight"**

### Adding Athletes to Flights

#### Method 1: Individual Addition
1. Navigate to the **Flight Details** page
2. Click **"Add Athletes"**
3. See list of available athletes (filtered by event criteria)
4. Click **"Add"** next to each athlete
5. Athletes are added with sequential ordering

#### Method 2: Bulk Addition
1. On Flight Details page, click **"Add Multiple Athletes"**
2. Select multiple athletes using checkboxes
3. Click **"Add Selected Athletes"**
4. System assigns order automatically

#### Available Athletes
Athletes shown are those who:
- Are registered for the competition
- Match the event criteria (gender, weight class)
- Are not already in another flight for the same event/movement

### Managing Flight Athletes

#### Reordering Athletes
Athletes compete in the order specified within their flight.

1. Navigate to **Flight Details**
2. Click **"Reorder Athletes"**
3. Drag and drop athletes to desired order, OR
4. Enter order numbers manually
5. Click **"Save Order"**

**Ordering Strategies:**
- **By Entry Weight**: Lightest to heaviest (common in weightlifting)
- **By Lot Number**: Random draw
- **By Ranking**: Higher ranked athletes go later
- **Custom**: Manual arrangement

#### Removing Athletes from Flights
1. Navigate to Flight Details
2. Click **Remove** icon next to athlete
3. Confirm removal
4. Athlete becomes available for other flights

### Flight Settings

#### Attempt Time Limits
- Set per athlete entry (default: 60 seconds)
- Configurable in athlete entry details
- Used by timer system during competition

#### Flight Activation
- **Activate Flight**: Make this the current active flight
- Only one flight can be active at a time
- Active flight appears on display screens and athlete portals

### Flight Order Management

Flights within an event compete in sequence.

1. Navigate to **Event Details**
2. View all flights for the event
3. Click **"Reorder Flights"**
4. Drag flights to desired order
5. Save changes

**Example Order:**
```
Event: Men's 85kg Clean & Jerk
  ├── Flight A (Order: 1)  
  ├── Flight B (Order: 2)
  └── Flight C (Order: 3)
```

### Flight Attempt Management

#### Viewing Flight Attempts
1. Navigate to **Flight Details**
2. Click **"View Attempts"** tab
3. See all attempts in order:
   - Athlete name
   - Attempt number (1, 2, 3)
   - Requested weight
   - Order in flight

#### Reordering Attempts
During competition, attempt order may change based on requested weights.

1. On Flight Details, click **"Reorder Attempts"**
2. Drag attempts to new order
3. Save changes

#### Auto-Sorting Attempts
1. Click **"Sort Attempts"**
2. Choose sorting method:
   - **By Weight**: Lightest to heaviest
   - **By Athlete Order**: Based on flight roster order
   - **Custom**: Manual arrangement
3. System reorders automatically

---

## Competition Workflow

### Pre-Competition Setup

1. **Create Competition**
   - Set dates, break times
   
2. **Create Events**
   - Define all events/categories
   
3. **Register Athletes**
   - Add all participants
   - Verify contact info and bodyweights
   
4. **Create Flights**
   - Organize athletes into manageable groups
   - Assign athletes to flights
   - Set athlete order within flights
   
5. **Verify Setup**
   - Review all flights have athletes
   - Check attempt configurations
   - Test display screens

### During Competition

1. **Activate Event**: Set current event as active
2. **Activate Flight**: Set current flight as active
3. **Monitor Progress**: 
   - Track attempts on admin dashboard
   - View live updates on display screens
4. **Manage Attempts**:
   - Athletes declare attempt weights
   - Referees record decisions
   - System calculates scores automatically
5. **Between Flights**: 
   - Automatic break timer activates
   - Prepare next flight

### Post-Competition

1. **Review Results**: Check all scores and rankings
2. **Generate Reports**: Export competition data
3. **Archive**: Mark competition as inactive

---

## Tips and Best Practices

### Athlete Management
- ✅ **Verify bodyweights** before competition starts
- ✅ **Collect contact information** for communication
- ✅ **Use consistent naming** (First Last format)
- ✅ **Assign teams** for proper team scoring

### Flight Management
- ✅ **Balance flight sizes**: Aim for 8-12 athletes per flight
- ✅ **Order flights logically**: Consider warm-up area capacity
- ✅ **Use clear naming**: "Flight A", "Flight B" easier than "Flight 1", "Flight 2"
- ✅ **Double-check athlete assignments**: Ensure no duplicates
- ✅ **Set attempt time limits**: Default 60s is standard, adjust if needed

### Event Organization
- ✅ **Create events early**: Allows athletes to pre-register
- ✅ **Match sport type to scoring**: Ensures correct calculations
- ✅ **Use weight categories**: Helps with automatic flight generation
- ✅ **Test one event fully**: Before creating all events

### Competition Day
- ✅ **Activate only one flight**: Prevents confusion
- ✅ **Monitor attempt order**: Update as athletes change requests
- ✅ **Keep display screens visible**: For athletes and audience
- ✅ **Have backup plan**: Export data regularly

---

## Troubleshooting

### Athletes Not Appearing in Flight
**Problem**: Can't add athlete to flight
**Solutions**:
- Verify athlete registered for correct competition
- Check athlete matches event criteria (gender, weight class)
- Ensure athlete not already in another flight for same event

### Flight Order Issues
**Problem**: Flights not competing in correct order
**Solutions**:
- Navigate to Event → Reorder Flights
- Verify "Order" field for each flight
- Save changes

### Athlete Order Problems
**Problem**: Athletes competing in wrong order
**Solutions**:
- Go to Flight Details → Reorder Athletes
- Check for duplicate order numbers
- Use auto-sort if needed

### Cannot Delete Flight
**Problem**: Error when trying to delete flight
**Solutions**:
- Check if flight has active attempts/results
- Remove athletes first, then delete flight
- Ensure flight is not currently active

---

## Getting Help

- **Documentation**: Check `/docs` folder for technical guides
- **Issue Tracker**: Report bugs on GitHub Issues
- **Support**: Contact system administrator

---

## Appendix: Terminology

- **Competition**: Top-level event (e.g., "State Championships")
- **Event**: Category within competition (e.g., "Men's 85kg Snatch")  
- **Flight**: Group of athletes competing together
- **Athlete Entry**: An athlete's registration in a specific event
- **Attempt**: Single lift/performance by an athlete
- **Scoring Type**: How winners are determined (MAX, SUM, TIME)
- **Sport Type**: Type of sport (Weightlifting, Powerlifting, etc.)

---

**Version**: 1.0  
**Last Updated**: October 2025
