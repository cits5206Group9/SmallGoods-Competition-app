# Athlete Name Filter Feature

## Overview
Added athlete name filtering to the Decision Results page, allowing users to filter referee decisions by specific athlete names in addition to competition, event, and flight filters.

## Changes Made

### 1. Frontend Changes (`app/templates/admin/referee_decisions.html`)

#### UI Updates:
- **Added fourth filter dropdown** for athlete name selection
- Updated grid layout from 3 columns to 4 (Competition, Event, Flight, Athlete Name)
- Adjusted grid template columns to `minmax(220px, 1fr)` for better spacing

#### HTML Addition:
```html
<div class="filter-group">
    <label for="athlete-select">Athlete Name</label>
    <select id="athlete-select" disabled>
        <option value="">All athletes...</option>
    </select>
</div>
```

#### JavaScript Updates:
- Added `athleteSelect` to DecisionResults class constructor
- Added athlete select change event listener
- Updated `onCompetitionChange()` to reset athlete dropdown
- Updated `onCompetitionChange()` to populate athletes from API response
- Updated `loadResults()` to include athlete filter in API request URL

**Key JavaScript Changes:**
```javascript
// Constructor
this.athleteSelect = document.getElementById('athlete-select');

// Event listener
this.athleteSelect.addEventListener('change', () => this.onFilterChange());

// Populate athletes dropdown
this.athleteSelect.innerHTML = '<option value="">All athletes</option>';
if (data.athletes && data.athletes.length > 0) {
    data.athletes.forEach(athlete => {
        const option = document.createElement('option');
        option.value = athlete;
        option.textContent = athlete;
        this.athleteSelect.appendChild(option);
    });
}

// Include in API request
if (athlete) url += `&athlete=${encodeURIComponent(athlete)}`;
```

### 2. Backend Changes (`app/routes/admin.py`)

#### API Endpoint: `/admin/api/decision-filters/<competition_id>`
**Added athlete names to response:**
```python
# Get unique athlete names
athletes = db.session.query(RefereeDecisionLog.athlete_name)\
    .filter_by(competition_id=competition_id)\
    .filter(RefereeDecisionLog.athlete_name.isnot(None))\
    .distinct()\
    .order_by(RefereeDecisionLog.athlete_name)\
    .all()

return jsonify({
    'success': True,
    'events': [e[0] for e in events if e[0]],
    'flights': [f[0] for f in flights if f[0]],
    'athletes': [a[0] for a in athletes if a[0]]  # NEW
}), 200
```

#### API Endpoint: `/admin/api/decision-results`
**Added athlete filtering:**
```python
def get_decision_results():
    """Get referee decisions with filtering"""
    competition_id = request.args.get('competition_id', type=int)
    event = request.args.get('event')
    flight = request.args.get('flight')
    athlete = request.args.get('athlete')  # NEW
    
    # ... query building ...
    
    if athlete:
        query = query.filter_by(athlete_name=athlete)  # NEW
```

## Feature Workflow

### User Experience:
1. **Select Competition** → Loads events, flights, and athletes for that competition
2. **Select Event** (optional) → Filters results by event
3. **Select Flight** (optional) → Filters results by flight  
4. **Select Athlete Name** (optional) → Filters results by specific athlete
5. **Click "Load Results"** → Displays filtered referee decisions

### Filter Combinations:
- ✅ Competition only → Show all decisions
- ✅ Competition + Event → Show decisions for that event
- ✅ Competition + Flight → Show decisions for that flight
- ✅ Competition + Athlete → Show decisions for that athlete
- ✅ Competition + Event + Flight → Show decisions for specific event/flight
- ✅ Competition + Event + Athlete → Show decisions for athlete in specific event
- ✅ Competition + Flight + Athlete → Show decisions for athlete in specific flight
- ✅ All filters → Show decisions for athlete in specific event/flight combo

## Technical Details

### Database Query:
```python
# Get unique athletes for dropdown
athletes = db.session.query(RefereeDecisionLog.athlete_name)\
    .filter_by(competition_id=competition_id)\
    .filter(RefereeDecisionLog.athlete_name.isnot(None))\
    .distinct()\
    .order_by(RefereeDecisionLog.athlete_name)\
    .all()
```

### API Request URL Examples:
```
/admin/api/decision-results?competition_id=1
/admin/api/decision-results?competition_id=1&athlete=sangram%20Saini
/admin/api/decision-results?competition_id=1&event=weight&athlete=sangram%20Saini
/admin/api/decision-results?competition_id=1&flight=Flight%20A&athlete=Sarthak%20Saini
```

## Benefits

1. **Quick Athlete Lookup** - Find all decisions for a specific athlete across events
2. **Performance Analysis** - Track individual athlete decisions and violations
3. **Improved Filtering** - More granular control over decision results display
4. **Better UX** - Sorted alphabetically for easy selection
5. **Consistent Design** - Matches existing filter pattern (Competition → Event → Flight → Athlete)

## Testing

### Test Cases:
1. ✅ Select competition → Athlete dropdown populates with names
2. ✅ Select athlete → Results filter to show only that athlete's decisions
3. ✅ Combine with event filter → Shows athlete decisions in specific event
4. ✅ Combine with flight filter → Shows athlete decisions in specific flight
5. ✅ Clear athlete filter → Shows all athletes again
6. ✅ Switch competitions → Athlete dropdown updates with new athlete list

### Example Test:
```
1. Select "SG-Test" competition
2. Select "sangram Saini" from athlete dropdown
3. Click "Load Results"
4. Verify only "sangram Saini" decisions appear in table
```

## Files Modified

1. **app/templates/admin/referee_decisions.html**
   - Added athlete filter UI
   - Updated JavaScript filtering logic
   - Updated CSS grid layout

2. **app/routes/admin.py**
   - Updated `get_decision_filters()` to return athletes
   - Updated `get_decision_results()` to filter by athlete

## Related Features

This feature complements:
- ✅ Technical Violations feature (see `VIOLATIONS_TESTING_GUIDE_v2.md`)
- ✅ Competition/Event/Flight filtering
- ✅ Decision Results table display
- ✅ Edit/Delete decision actions

## Future Enhancements

Potential improvements:
- Add search/autocomplete for athlete names (for large competitions)
- Add athlete statistics (total decisions, violations count, etc.)
- Add multi-select for comparing multiple athletes
- Add export functionality for athlete-specific reports
