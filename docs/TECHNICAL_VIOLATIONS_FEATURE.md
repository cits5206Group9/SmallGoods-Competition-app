# Technical Violations Feature

## Overview
Added a comprehensive technical violations tracking system to the referee decision-making process. Referees can now select specific technical violations when casting a "No Lift" decision, and these violations are stored in the database and displayed in the Decision Results page.

## Changes Made

### 1. Database Model Updates
**File:** `app/models.py`
- Added `violations` field to `RefereeDecisionLog` model (Text field, nullable)
- Stores comma-separated list of violations
- Updated `to_dict()` method to include violations in serialization

**Migration:** `0b6ea5018ef6_add_violations_field_to_referee_decision_log.py`
- Successfully created and applied migration

### 2. Backend API Updates
**File:** `app/routes/admin.py`

#### `submit_referee_decision()` endpoint
- Accepts `violations` array in request body
- Converts violations array to comma-separated string
- Stores violations in `RefereeDecisionLog.violations` field

#### `update_decision_result()` endpoint
- Accepts `violations` in PUT request
- Handles both array and string formats
- Updates violations when editing decisions

### 3. Individual Referee Page UI
**File:** `app/templates/admin/individual_referee.html`

#### CSS Added:
- `.violations-section` - Yellow-bordered section for violations
- `.violations-grid` - Responsive grid layout for checkboxes
- `.violation-checkbox` - Styled checkbox containers with hover effects
- Conditional visibility with `.show` class

#### HTML Added:
Technical violations section with 8 checkbox options:
- Press Out
- Elbow Touch
- Knee Touch
- Bar Pressed Down
- Incomplete Lockout
- Foot Movement
- Early Drop
- Other Technical

#### JavaScript Updates:

**`renderDecisionButtons()` method:**
- Shows violations section when "No Lift" decision is selected (value === false)
- Hides violations section and clears checkboxes for "Good Lift" decisions
- Dynamic based on decision value

**`castDecision()` method:**
- Collects checked violations before submitting decision
- Only includes violations for "No Lift" decisions
- Sends violations array in API request
- Disables checkboxes after successful submission
- Displays violations in success message

### 4. Decision Results Page Updates
**File:** `app/templates/admin/referee_decisions.html`

#### Table Updates:
- Added "Violations" column header
- Displays violations in results table (shows "-" if none)

#### Edit Modal Updates:
- Added violations text input field with helper text
- Accepts comma-separated violations for editing
- Populates violations field when editing existing decision
- Sends violations in UPDATE request

#### JavaScript Updates:

**`displayResults()` method:**
- Renders violations column in results table

**`showEditModal()` method:**
- Extracts violations from table row
- Populates edit form with existing violations

**`saveDecisionEdit()` method:**
- Collects violations from text input
- Sends violations in UPDATE request

## User Workflow

### For Referees (Individual Referee Page):
1. Referee views athlete attempt and timer
2. Referee clicks decision button (e.g., "No Lift")
3. **NEW:** Violations section appears with checkboxes
4. Referee selects applicable violations (optional but encouraged)
5. Referee confirms decision
6. Success message shows decision + violations
7. Decision with violations is stored in database

### For Admins (Decision Results Page):
1. Admin filters by competition/event/flight
2. Loads decision results
3. **NEW:** Violations column shows all violations for each decision
4. Admin can edit decisions and violations
5. Violations field accepts comma-separated values

## Technical Details

### Data Storage:
- **Format:** Comma-separated string (e.g., "Press Out, Knee Touch")
- **Field Type:** `db.Text`, nullable
- **Default:** NULL (no violations recorded)

### Validation:
- Violations only collected for "No Lift" decisions
- Optional field (can be empty)
- No hard validation on content (free-form with suggestions)

### Display Logic:
- Shows "-" in table when no violations recorded
- Highlights violations in yellow section on referee page
- Violations included in success notification

## Benefits

✅ **Enhanced Decision Tracking**
- Referees document specific reasons for "No Lift" decisions
- Creates audit trail for technical violations
- Helps with post-competition analysis

✅ **Improved Communication**
- Athletes/coaches can see specific violation reasons
- Reduces ambiguity in "No Lift" calls
- Educational for referees and athletes

✅ **Data Analytics**
- Track common violation patterns
- Identify training needs
- Competition-level statistics

✅ **Compliance**
- Follows powerlifting/weightlifting standards
- Documents technical rule violations
- Supports competition integrity

## Testing Checklist

- [x] Database migration applied successfully
- [x] Violations section appears on "No Lift" selection
- [x] Violations section hides on "Good Lift" selection
- [x] Multiple violations can be selected
- [x] Violations sent to backend API
- [x] Violations stored in database
- [x] Violations displayed in Decision Results table
- [x] Violations can be edited via modal
- [x] Checkboxes disabled after decision submitted

## Future Enhancements

**Potential Improvements:**
1. Pre-defined violation templates per lift type
2. Multi-language violation labels
3. Violation statistics dashboard
4. Video timestamp linking to violations
5. Referee-specific violation patterns analysis
6. Export violations to PDF reports

## Files Modified

- ✅ `app/models.py` - Added violations field
- ✅ `app/routes/admin.py` - Backend API support
- ✅ `app/templates/admin/individual_referee.html` - Referee UI
- ✅ `app/templates/admin/referee_decisions.html` - Results display
- ✅ `migrations/versions/0b6ea5018ef6_*.py` - Database migration

## Database Schema

```python
class RefereeDecisionLog(db.Model):
    # ... existing fields ...
    violations = db.Column(db.Text, nullable=True)  # NEW: Comma-separated violations
```

## API Request Example

```json
{
  "referee_id": 1,
  "competition_id": 1,
  "decision": {
    "label": "No Lift",
    "value": false,
    "color": "red"
  },
  "violations": ["Press Out", "Incomplete Lockout"],  // NEW
  "athlete_name": "John Doe",
  "attempt_weight": 150,
  "attempt_number": 2
}
```

## Response Example

```json
{
  "id": 123,
  "athlete_name": "John Doe",
  "decision_label": "No Lift",
  "decision_value": false,
  "violations": "Press Out, Incomplete Lockout",  // NEW
  "timestamp": "2025-10-07T12:34:56Z"
}
```
