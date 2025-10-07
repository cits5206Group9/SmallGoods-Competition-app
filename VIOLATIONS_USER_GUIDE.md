# Technical Violations Management - User Guide

## Quick Start Guide

### For Administrators

#### Managing Violations (CRUD Operations)

1. **Access Violations Management**
   - Navigate to `http://127.0.0.1:5000/admin/referee`
   - Click the red **"🚫 Manage Violations"** button in the top header
   - A modal window will open showing all violations

2. **Create a New Violation**
   - Click **"+ Add New Violation"** button
   - Enter the violation name (Required) - e.g., "Soft Knees", "Improper Grip"
   - Enter description (Optional) - e.g., "Knees not locked at completion"
   - Click **"Save Violation"**
   - ✅ The new violation immediately appears on all referee pages!

3. **Edit an Existing Violation**
   - In the violations list, find the violation you want to edit
   - Click the **"Edit"** button (blue)
   - Modify the name or description
   - Click **"Save Violation"**
   - ✅ All referee pages update instantly!

4. **Disable/Enable a Violation**
   - Click the **"Disable"** or **"Enable"** button (yellow) next to any violation
   - Disabled violations won't appear on referee pages but remain in the database
   - You can re-enable them anytime

5. **Delete a Violation**
   - Click the **"Delete"** button (red)
   - Confirm the deletion in the popup
   - ⚠️ This permanently removes the violation from the database

6. **View Inactive Violations**
   - Check the **"Show Inactive"** checkbox
   - All disabled violations will appear in gray
   - Uncheck to see only active violations

#### Viewing Live Referee Decisions

1. **Access the Referee Panel**
   - Go to `http://127.0.0.1:5000/admin/referee`
   - Select a competition from the dropdown

2. **Monitor Decisions in Real-Time**
   - The **"Referee Panel Votes"** section shows all referees
   - As referees submit decisions, you'll see:
     - **Referee Name** - Who submitted the decision
     - **Decision Badge** - Green for "Good Lift" ✅, Red for "No Lift" ❌
     - **Violation Tags** - Yellow badges showing which violations were selected
   - No page refresh needed - updates happen automatically!

3. **Final Decision**
   - Shows the overall result based on majority vote
   - Example: "✅ GOOD LIFT (3/5)" means 3 out of 5 referees voted Good Lift
   - Updates as each referee votes

---

### For Referees

#### Selecting Violations When Making Decisions

1. **Access Your Referee Page**
   - Go to your assigned referee URL: `http://127.0.0.1:5000/admin/referee/individual/<your_id>`
   - Log in if required

2. **View Available Violations**
   - The **"Technical Violations (Optional)"** section shows all active violations
   - These are dynamically loaded from the database
   - If admin adds new violations, they appear instantly without refreshing!

3. **Submit a Decision**
   - If the lift is **Good Lift**: Click the green button (no violations needed)
   - If the lift is **No Lift**: 
     - ✅ Check the applicable violations (e.g., "Press Out", "Knee Touch")
     - Click the red "No Lift" button
   - Your decision with violations is immediately visible to admins

4. **After Submission**
   - Checkboxes are disabled (can't change)
   - Your decision is sent to the admin panel in real-time
   - Decision is stored in the database with violations

---

## Features at a Glance

### ✨ What Makes This System Special

| Feature | Benefit |
|---------|---------|
| **Create Custom Violations** | Add any violation text you need on-the-fly |
| **Real-Time Updates** | No page refresh needed - everything syncs instantly |
| **Enable/Disable** | Temporarily hide violations without deleting them |
| **Live Decision Display** | Admins see all referee decisions as they happen |
| **Violation Tags** | Easy visual identification of which violations occurred |
| **Majority Vote** | Automatic final decision calculation |
| **Database Storage** | Full audit trail of all decisions and violations |

---

## Common Use Cases

### Scenario 1: Adding a New Competition-Specific Violation
```
Problem: Your competition has a special rule not in the default violations
Solution:
1. Click "🚫 Manage Violations"
2. Click "+ Add New Violation"
3. Enter name: "Early Platform Contact"
4. Description: "Foot touched platform before completion signal"
5. Save
✅ All referees can now select this violation immediately!
```

### Scenario 2: Fixing a Typo in Violation Name
```
Problem: Violation name has a spelling error
Solution:
1. Click "🚫 Manage Violations"
2. Find the violation with the typo
3. Click "Edit"
4. Fix the spelling
5. Save
✅ All referee pages update with the corrected name!
```

### Scenario 3: Temporarily Removing a Violation
```
Problem: A violation doesn't apply to this event
Solution:
1. Click "🚫 Manage Violations"
2. Find the violation
3. Click "Disable"
✅ Violation disappears from referee pages but stays in database
✅ Re-enable it later when needed!
```

### Scenario 4: Monitoring a Close Decision
```
Problem: Need to see all referee votes and violations in real-time
Solution:
1. Open /admin/referee page
2. Select the competition
3. Watch the "Referee Panel Votes" section
✅ See each referee's decision as they vote
✅ See which violations they selected
✅ See final decision automatically calculated
```

---

## Default Violations (Pre-Seeded)

Your system comes with 8 common technical violations already configured:

1. **Press Out** - Bar pressed out incorrectly
2. **Elbow Touch** - Elbow touched the knee/leg during lift
3. **Knee Touch** - Knee touched the platform
4. **Bar Pressed Down** - Bar pressed down instead of up
5. **Incomplete Lockout** - Arms not fully locked at top
6. **Foot Movement** - Feet moved during the lift
7. **Early Drop** - Bar dropped before official signal
8. **Other Technical** - Any other technical violation

You can edit, disable, or delete any of these and add your own!

---

## Tips & Best Practices

### For Administrators
- ✅ Create violations with clear, concise names
- ✅ Use descriptions to clarify complex violations
- ✅ Disable violations instead of deleting when temporarily not needed
- ✅ Keep violation names short (displays better on referee pages)
- ✅ Test new violations on a practice competition first

### For Referees
- ✅ Select all applicable violations (can select multiple)
- ✅ Double-check violations before clicking decision button
- ✅ Use "Other Technical" for violations not in the list
- ✅ Remember: Violations are optional for "Good Lift" decisions

---

## Troubleshooting

### Problem: New violation doesn't appear on referee pages
**Solution**: 
- Check if violation is marked as "Active" in manage violations modal
- Verify referee page has WebSocket connection (check browser console)
- Refresh the referee page as a last resort

### Problem: Can't delete a violation
**Solution**:
- Check if the violation is being used in existing decision records
- Consider disabling instead of deleting to preserve historical data

### Problem: Decisions not showing up on admin panel
**Solution**:
- Verify competition is selected in the dropdown
- Check browser console for WebSocket connection errors
- Ensure referees are assigned to the selected competition

---

## Technical Details

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Requirements
- JavaScript must be enabled
- WebSocket support required for real-time updates
- Internet connection for WebSocket communication

### Data Storage
- All violations stored in `technical_violations` database table
- All decisions with violations stored in `referee_decision_logs` table
- Full audit trail maintained

---

## Support

If you encounter any issues:
1. Check browser console for error messages
2. Verify database migrations are up to date
3. Restart the Flask server
4. Clear browser cache and cookies

---

**Version**: 1.0  
**Last Updated**: October 7, 2025  
**Feature Status**: ✅ Fully Operational
