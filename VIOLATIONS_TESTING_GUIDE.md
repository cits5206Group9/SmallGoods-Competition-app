# Violations Feature - User Testing Guide

## How to Test the Technical Violations Feature

### Step-by-Step Testing:

1. **Navigate to Referee Panel**
   - Go to: `http://127.0.0.1:5000/admin/referee/individual/7`
   - (Replace 7 with your referee ID)

2. **Select a "No Lift" Decision**
   - Look at the decision buttons (0, 1, 2, 3, 4, 5)
   - Click on any button that represents "No Lift" (e.g., button "3")
   - The button should highlight with a purple/selected state

3. **Violations Section Appears**
   - A yellow-bordered section should appear below the buttons
   - Title: "Technical Violations (if No Lift)"
   - Shows 8 checkboxes:
     * Press Out
     * Elbow Touch
     * Knee Touch
     * Bar Pressed Down
     * Incomplete Lockout
     * Foot Movement
     * Early Drop
     * Other Technical

4. **Select Violations**
   - Check one or more violations that apply
   - Example: Check "Press Out" and "Incomplete Lockout"

5. **Confirm Decision**
   - Click the green "Confirm Decision" button at the bottom of violations section
   - Success message appears: "Decision '3' submitted successfully! Violations: Press Out, Incomplete Lockout"

6. **Verify in Database**
   - Go to: `http://127.0.0.1:5000/admin/referee-decisions`
   - Select competition, event, flight
   - Click "Load Results"
   - Find your decision in the table
   - "Violations" column should show: "Press Out, Incomplete Lockout"

### Expected Behavior:

#### For "No Lift" Decisions (e.g., button 3):
1. Click button → Button highlights
2. Violations section appears with checkboxes
3. Select violations (optional)
4. Click "Confirm Decision"
5. Decision submitted with violations

#### For "Good Lift" Decisions (e.g., button 0):
1. Click button → Immediate submission
2. No violations section shown
3. Success message appears instantly

### Troubleshooting:

**If violations section doesn't appear:**
1. Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Check browser console for errors (F12 → Console tab)
3. Verify you clicked a "No Lift" button (value: false in competition config)

**If checkboxes don't work:**
1. Make sure you haven't already voted (page needs refresh after each decision)
2. Check that JavaScript is enabled
3. Try different checkboxes

**If data doesn't save:**
1. Check terminal/console for backend errors
2. Verify database migration was applied
3. Check network tab (F12) for API errors

### Current Configuration:

Based on your screenshot:
- Competition: SG-Test
- Athlete: sangram Saini
- Buttons: 0, 1, 2, 3, 4, 5 (red/pink colored)
- All buttons appear to be "No Lift" type decisions

### Next Test:
1. Refresh the page to reset your vote
2. Click button "3" again
3. You should now see the violations section appear
4. Check some violations
5. Click "Confirm Decision"
6. Check the Decision Results page

### Quick Debug:
If violations section still doesn't show, check the browser console and paste any errors here.
