# Technical Violations Testing Guide (Simplified Version)

## Overview
This guide helps you test the **simplified** Technical Violations feature on the Individual Referee page.

## Feature Description
Referees can now specify technical violations when casting their decisions. The violations section is **always visible** below the decision buttons, allowing referees to:
1. **First:** Select violations (if any)
2. **Then:** Click their decision button to submit

The violations are stored in the database and displayed on the Decision Results page.

## Testing Steps

### 1. Access the Referee Page
1. Navigate to: `http://127.0.0.1:5000/admin/referee/login`
2. Login with referee credentials (e.g., referee ID: 7)
3. You'll be redirected to: `http://127.0.0.1:5000/admin/referee/individual/7`

### 2. Wait for Active Lift
- Make sure there's an active lift in progress
- The timer should be running or in "Running (countdown)" state
- The "Cast Your Decision" section should show decision buttons (0, 1, 2, 3, 4, 5)
- **The "Technical Violations (Optional)" section should be visible below the buttons**

### 3. Submit Decision with Violations (Simple Workflow)

#### The New Simplified Process:
1. **First, select applicable violations** (if any):
   - ☐ Press Out
   - ☐ Elbow Touch
   - ☐ Knee Touch
   - ☐ Bar Pressed Down
   - ☐ Incomplete Lockout
   - ☐ Foot Movement
   - ☐ Early Drop
   - ☐ Other Technical
   - You can select multiple violations or none at all

2. **Then, click your decision button** (0, 1, 2, 3, 4, or 5):
   - Decision submits immediately with any checked violations
   - You should see "Decision submitted successfully!"
   - The page will prevent you from voting again until refresh

### 4. Verify on Decision Results Page
1. Navigate to: `http://127.0.0.1:5000/admin/decision-results`
2. Find the lift you just voted on
3. Verify:
   - Your decision appears in the table
   - The "Violations" column shows your selected violations (e.g., "Press Out, Knee Touch")
   - If no violations were selected, it shows "-"

### 5. Edit Decision with Violations
1. On the Decision Results page, click "Edit" for a decision
2. In the modal, you can modify:
   - Decision value
   - Violations (comma-separated text)
3. Click "Save Changes"
4. Verify the table updates with your changes

## Expected Behavior

### ✅ What Should Work
- ✅ Violations section is **always visible** below decision buttons
- ✅ Multiple violations can be selected before clicking decision
- ✅ **Any decision** (0-5) can be submitted with or without violations
- ✅ Violations are submitted automatically with the decision
- ✅ Violations appear in Decision Results table (comma-separated)
- ✅ Violations can be edited in the modal
- ✅ After voting, page prevents duplicate votes until refresh
- ✅ No extra confirmation step needed

### ❌ What Should NOT Happen
- ❌ Violations section should NOT be hidden
- ❌ Decision should NOT require "Confirm" button
- ❌ Page should NOT allow multiple votes without refresh

## UI Layout
```
┌─────────────────────────────────────────────────┐
│            Cast Your Decision                   │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│
│  │  0  │ │  1  │ │  2  │ │  3  │ │  4  │ │  5  ││
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘│
├─────────────────────────────────────────────────┤
│      Technical Violations (Optional)            │
│   Select violations (if any), then click        │
│   your decision above                           │
│                                                 │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │☐ Press Out       │  │☐ Incomplete      │    │
│  │                  │  │  Lockout         │    │
│  └──────────────────┘  └──────────────────┘    │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │☐ Elbow Touch     │  │☐ Foot Movement   │    │
│  └──────────────────┘  └──────────────────┘    │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │☐ Knee Touch      │  │☐ Early Drop      │    │
│  └──────────────────┘  └──────────────────┘    │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │☐ Bar Pressed Down│  │☐ Other Technical │    │
│  └──────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Troubleshooting

### Issue: Violations Section Not Visible
**Possible Causes:**
1. Browser cache issue
   - **Solution:** Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
   
2. CSS not loaded properly
   - **Solution:** Check browser console (F12) for CSS errors

### Issue: Can't Vote Again
**This is expected behavior!**
- After voting once, you must refresh the page to vote again
- This prevents accidental duplicate votes

**Solution:** Refresh the page (F5 or Cmd+R / Ctrl+R)

### Issue: Violations Don't Appear in Decision Results
**Possible Causes:**
1. No violations were checked before clicking decision button
   - **Expected behavior** - Shows "-" when no violations selected
   
2. Database migration not applied
   - **Solution:** Run `flask db upgrade` in terminal

### Issue: JavaScript Errors in Console
**Solution:** 
1. Open browser console (F12 > Console tab)
2. Look for red error messages
3. Take a screenshot and share with development team

## Database Verification

To check if violations are stored correctly:

```bash
cd /Users/sarthaksaini/Downloads/capstone/SmallGoods-Competition-app
python3 -c "
from app import create_app, db
from app.models import RefereeDecisionLog

app = create_app()
with app.app_context():
    decisions = RefereeDecisionLog.query.order_by(RefereeDecisionLog.timestamp.desc()).limit(5).all()
    print('Recent Decisions with Violations:')
    print('-' * 60)
    for d in decisions:
        violations_display = d.violations if d.violations else 'None'
        print(f'Referee {d.referee_id}: Decision={d.decision}, Violations={violations_display}')
"
```

## Available Violations
| Violation | Description |
|-----------|-------------|
| Press Out | Bar pressed out incorrectly |
| Elbow Touch | Elbow touched the knee/leg during lift |
| Knee Touch | Knee touched the platform |
| Bar Pressed Down | Bar pressed down instead of up |
| Incomplete Lockout | Arms not fully locked at top |
| Foot Movement | Feet moved during the lift |
| Early Drop | Bar dropped before official signal |
| Other Technical | Any other technical violation |

## Quick Reference

### Referee Workflow:
1. ✅ **Check violations** (optional)
2. ✅ **Click decision button** (0-5)
3. ✅ **See confirmation** message
4. ✅ **Refresh page** to vote on next lift

### Admin Workflow (Decision Results):
1. ✅ **View violations** in table column
2. ✅ **Click Edit** to modify
3. ✅ **Update violations** field
4. ✅ **Save changes**
