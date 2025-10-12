# Technical Violations CRUD + Real-Time Decision Display Feature

## Overview
This feature enables administrators to manage technical violations dynamically and displays real-time referee decisions with violations on the admin referee panel page.

## Features Implemented

### 1. **Dynamic Violations Management**
- ✅ Create custom violations with any text name
- ✅ Edit existing violation names and descriptions
- ✅ Delete violations (with confirmation)
- ✅ Enable/Disable violations (toggle active status)
- ✅ View all violations or filter to active only
- ✅ Violations stored in database (`technical_violations` table)

### 2. **Real-Time Updates**
- ✅ Violations automatically update on all referee pages when CRUD operations occur
- ✅ WebSocket broadcasting for instant updates
- ✅ Individual referee pages load violations dynamically from database
- ✅ No need to refresh page after creating/editing violations

### 3. **Referee Decision Display**
- ✅ Shows all referee decisions in real-time on `/admin/referee` page
- ✅ Displays referee names, decisions (Good Lift/No Lift), and selected violations
- ✅ Color-coded decision badges (green for Good Lift, red for No Lift)
- ✅ Violation tags displayed for each referee's decision
- ✅ Final decision calculation (majority vote)
- ✅ Updates automatically when any referee submits a decision

## User Interface Locations

### Admin Referee Panel (`/admin/referee`)
1. **"🚫 Manage Violations" Button** - Opens violations management modal
2. **Referee Panel Votes Section** - Shows real-time decisions with violations
3. **Final Decision** - Shows overall result based on majority vote

### Individual Referee Pages (`/admin/referee/individual/<referee_id>`)
1. **Technical Violations Checkboxes** - Dynamically loaded from database
2. **Auto-updates** - When admin creates/edits violations, checkboxes update instantly

## Database Schema

### `technical_violations` Table
```sql
- id (Primary Key)
- name (String) - Violation name (e.g., "Press Out", "Knee Touch")
- description (Text) - Optional description
- is_active (Boolean) - Whether violation is enabled
- display_order (Integer) - Sort order for display
- created_at (DateTime)
- updated_at (DateTime)
```

### `referee_decision_logs` Table
```sql
- violations (String) - Comma-separated list of violation IDs/names selected by referee
```

## API Endpoints

### Violations CRUD
- `GET /admin/api/violations` - Get all active violations (or all with `?show_all=true`)
- `POST /admin/api/violations` - Create new violation
  ```json
  {
    "name": "Press Out",
    "description": "Bar pressed out incorrectly"
  }
  ```
- `PUT /admin/api/violations/<id>` - Update existing violation
- `DELETE /admin/api/violations/<id>` - Delete violation
- `POST /admin/api/violations/<id>/toggle` - Toggle active status

### Referee Decisions
- `POST /admin/api/referee-decision` - Submit referee decision with violations
  ```json
  {
    "referee_id": 1,
    "competition_id": 1,
    "decision": {"label": "No Lift", "value": false},
    "violations": [1, 3, 5] // IDs of selected violations
  }
  ```

## WebSocket Events

### `violations_updated`
Broadcasted when violations are created, updated, deleted, or toggled.
```javascript
{
  "action": "created|updated|deleted|toggled",
  "violation": { /* violation object */ }
}
```

### `referee_decision_updated`
Broadcasted when a referee submits a decision.
```javascript
{
  "competition_id": 1,
  "referee_id": 1,
  "referee_name": "John Doe",
  "decision": {"label": "No Lift", "value": false},
  "violations": [1, 3, 5],
  "timestamp": "2025-10-07T..."
}
```

## How It Works

### Violations CRUD Flow
1. Admin clicks "🚫 Manage Violations" button
2. Modal opens with list of all violations
3. Admin can:
   - Click "Add New Violation" → Enter name/description → Save
   - Click "Edit" on any violation → Modify → Save
   - Click "Enable/Disable" to toggle active status
   - Click "Delete" to remove (with confirmation)
4. On any CRUD operation:
   - Database updated
   - WebSocket event broadcast to all connected clients
   - All referee pages automatically reload their checkboxes

### Real-Time Decision Display Flow
1. Admin opens `/admin/referee` page
2. Selects competition from dropdown
3. System loads all referees for that competition
4. As each referee submits decisions:
   - Individual referee page sends decision + violations to backend
   - Backend stores in database
   - Backend broadcasts WebSocket event
   - Admin referee panel receives event
   - Display updates showing:
     - Referee name
     - Decision badge (Good Lift/No Lift)
     - Violation tags (if any)
5. Final decision automatically calculated based on majority vote

## Testing Guide

### Test Violations CRUD
1. Go to `http://127.0.0.1:5000/admin/referee`
2. Click "🚫 Manage Violations" button
3. Try creating a new violation (e.g., "Soft Knees")
4. Open an individual referee page in another tab
5. Verify the new violation appears in checkboxes immediately
6. Edit/delete violations and verify updates in real-time

### Test Real-Time Decisions
1. Open `http://127.0.0.1:5000/admin/referee` in one browser tab
2. Select a competition
3. Open multiple individual referee pages in other tabs
4. Have each referee:
   - Select violations (if No Lift)
   - Click their decision button
5. Watch the admin panel update in real-time showing:
   - Each referee's decision
   - Selected violations as tags
   - Final decision based on majority

## Files Modified

### Backend
- `app/models.py` - Added `TechnicalViolation` model
- `app/routes/admin.py` - Added violations CRUD endpoints + WebSocket broadcasts
- `migrations/versions/dd1cdc0a9afe_*.py` - Database migration for violations table

### Frontend
- `app/templates/admin/referee.html` - Added violations management modal + decision display
- `app/templates/admin/individual_referee.html` - Dynamic violations loading + WebSocket listeners

### Scripts
- `seed_violations.py` - Seeds 8 default violations (one-time setup)

## Default Violations Seeded
1. Press Out
2. Elbow Touch
3. Knee Touch
4. Bar Pressed Down
5. Incomplete Lockout
6. Foot Movement
7. Early Drop
8. Other Technical

## Benefits
- ✅ **Flexibility** - Admins can create custom violations on-the-fly
- ✅ **Real-Time** - Instant updates across all connected clients
- ✅ **Transparency** - Referees and admins see decisions and violations immediately
- ✅ **Scalability** - Easily add/remove violations without code changes
- ✅ **Audit Trail** - All decisions and violations stored in database

## Future Enhancements
- Add drag-and-drop reordering for violations
- Violation categories (e.g., Technical, Safety, Equipment)
- Statistics on most common violations
- Export violations history to CSV/PDF
- Violation templates for different competition types
