# Quick Start Guide: Referee Decision Results Feature

## Accessing the Decision Results Page

### Step 1: Navigate to the Page
Open your browser and go to:
```
http://127.0.0.1:5000/admin/referee-decisions
```

Or from the admin menu, click on "Decision Results" (if you add a menu link)

### Step 2: Select Filters

1. **Select Competition**: Choose a competition from the first dropdown
   - This will automatically load available events and flights for that competition

2. **Select Event (Optional)**: Choose a specific event to filter by
   - Leave as "All events" to see decisions from all events

3. **Select Flight (Optional)**: Choose a specific flight to filter by
   - Leave as "All flights" to see decisions from all flights

4. **Click "Load Results"**: This will fetch and display the decisions

### Step 3: View Results

The results table will show:
- **Timestamp**: When the decision was made
- **Athlete**: Name of the athlete
- **Event**: Event name (e.g., "Men's 73kg")
- **Flight**: Flight name (e.g., "Flight A")
- **Weight Class**: Athlete's weight class
- **Lift**: Type of lift (Snatch, Clean & Jerk, etc.)
- **Attempt**: Attempt number (#1, #2, #3)
- **Weight**: Weight attempted (in kg)
- **Referee**: Name of the referee who made the decision
- **Position**: Referee position (Head Referee, Side Referee, etc.)
- **Decision**: Color-coded badge showing the decision
  - 🟢 Green = Good Lift
  - 🔴 Red = No Lift

## How Decisions Are Stored

### Automatic Storage
Every time a referee casts a decision on their individual referee page:

1. The decision is automatically saved to the database
2. All athlete and competition context is captured
3. The decision includes:
   - Who made it (referee)
   - When it was made (timestamp)
   - What was being judged (athlete, lift, attempt, weight)
   - The decision result (good lift, no lift, etc.)

### Data Captured
The system automatically captures:
- Current athlete's name from the timer
- Competition, event, and flight information
- Attempt number and weight
- Lift type (Snatch, Clean & Jerk, etc.)
- Athlete's weight class and team
- Referee details and position
- Exact timestamp of decision

## Integration with Existing Features

### Timer Integration
The decision storage system integrates with the timekeeper timer:
- Reads current athlete information from timer state
- Captures attempt details in real-time
- Ensures accurate context for every decision

### Referee Pages
No changes needed for referees:
- Referees continue using their individual pages normally
- Decisions are automatically saved in the background
- All existing functionality remains unchanged

## Filter Options

### Competition Filter
- **Required**: Must select a competition first
- Loads all competitions from the database
- Enables event and flight dropdowns

### Event Filter
- **Optional**: Can filter by specific event
- Shows "All events" by default
- Populated based on selected competition

### Flight Filter
- **Optional**: Can filter by specific flight
- Shows "All flights" by default
- Populated based on selected competition

## Example Usage Scenarios

### Scenario 1: Review All Decisions for a Competition
1. Select: "Spring Championship 2025"
2. Leave event and flight as "All"
3. Click "Load Results"
4. View all decisions made during the competition

### Scenario 2: Check Specific Flight Results
1. Select: "Spring Championship 2025"
2. Select Event: "Men's 73kg"
3. Select Flight: "Flight A"
4. Click "Load Results"
5. View decisions only for that specific flight

### Scenario 3: Monitor Event Progress
1. Select: "Spring Championship 2025"
2. Select Event: "Women's 63kg"
3. Leave flight as "All flights"
4. Click "Load Results"
5. See all decisions across all flights in that event

## Troubleshooting

### No Results Shown
- **Check**: Have any decisions been made for the selected filters?
- **Try**: Select a different competition or remove event/flight filters
- **Verify**: Referees are using their pages and making decisions

### Filters Not Populating
- **Check**: Is a competition selected?
- **Verify**: Does the competition have decisions recorded?
- **Try**: Refresh the page and try again

### Missing Information in Results
- **Timer State**: Ensure the timekeeper has set up athlete information
- **Athlete Context**: Check that timer state includes athlete details
- **Decision Timing**: Decisions made before timer setup may have limited info

## Benefits of This Feature

✅ **Complete Decision History**: Every decision is permanently stored
✅ **Easy Filtering**: Quickly find decisions by competition, event, or flight
✅ **Transparent Judging**: Review all referee decisions in one place
✅ **Competition Management**: Track judging patterns and consistency
✅ **Athlete Records**: Complete history of an athlete's judging results
✅ **Audit Trail**: Timestamp and referee information for every decision

## Need Help?

If you encounter any issues or have questions:
1. Check the console for error messages (F12 in browser)
2. Verify database migrations are applied (`flask db upgrade`)
3. Ensure referees are logged in and decisions are being submitted
4. Review the technical documentation in `REFEREE_DECISION_STORAGE_FEATURE.md`
