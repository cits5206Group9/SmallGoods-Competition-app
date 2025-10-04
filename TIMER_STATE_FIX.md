# Timer State Persistence Fix

## Bug Description
When refreshing the Timekeeper page (`/admin/timer`), all timer state was lost including:
- Attempt timer state (running/paused, time remaining)
- Pinned break/rest timers for athletes
- Selected flight and context information

This caused issues when a referee/timekeeper refreshed the page accidentally during a competition.

## Solution Implemented
Added **localStorage-based state persistence** to `app/static/js/timekeeper.js`:

### Changes Made:

1. **State Save Function** (`saveTimerState()`)
   - Saves complete timer state to localStorage
   - Includes attempt timer configuration (mode, elapsed time, remaining time)
   - Includes all pinned break timers with their state
   - Stores flight ID and context
   - Includes timestamp for staleness check

2. **State Restore Function** (`restoreTimerState()`)
   - Restores timer state on page load
   - Validates state is not stale (< 24 hours old)
   - Recreates all pinned break timer cards
   - Restores timer values but **does not auto-resume** running timers (safety feature)

3. **Auto-save Triggers**
   - Automatic save every 2 seconds
   - Manual save on all timer actions:
     - Main timer: Start, Pause, Resume, Reset
     - Break timers: Start, Pause, Reset, Apply custom time
     - Pin/Remove break timers
     - Bulk actions (Start All, Pause All, Reset All)

4. **Page Load Restoration**
   - `restoreTimerState()` is called automatically when the page loads

### Files Modified:
- `app/static/js/timekeeper.js` - Added state persistence logic

## How to Test:

### Test Case 1: Attempt Timer Persistence
1. Navigate to `/admin/timer`
2. Select a competition/event/flight
3. Start the attempt timer and let it run for a few seconds
4. Pause the timer
5. **Refresh the page** (F5 or Cmd+R)
6. ✅ **Expected**: Timer should show the same paused time

### Test Case 2: Break Timer Persistence
1. Start an attempt timer
2. Click "Stop" to end the attempt
3. A break/rest timer card should appear
4. Start the break timer
5. **Refresh the page**
6. ✅ **Expected**: Break timer card should reappear with the current time

### Test Case 3: Multiple Break Timers
1. Create multiple break timers for different athletes
2. Set different times on each
3. Start some, pause others
4. **Refresh the page**
5. ✅ **Expected**: All break timer cards should reappear with their respective states

### Test Case 4: State Cleanup
1. Clear all timers and remove all break timer cards
2. **Refresh the page**
3. ✅ **Expected**: Page should load clean without any restored timers

## Technical Details:

### LocalStorage Key:
```javascript
TK_TIMER_STATE
```

### State Structure:
```javascript
{
  attemptTimer: {
    mode: "countup|countdown",
    baseSeconds: number,
    elapsed: number,
    remaining: number,
    running: boolean,
    sessionStartTime: ISO string | null,
    sessionStartRemOrElapsed: number | null
  },
  pins: [{
    id: string,
    athlete: string,
    attempt: string,
    attemptDurationSec: number,
    restTimerRemaining: number,
    restTimerRunning: boolean,
    restTimerBaseSeconds: number
  }],
  flightId: number | null,
  context: {
    competition: string,
    event: string,
    flight: string
  },
  timestamp: number
}
```

### Safety Features:
- State expires after 24 hours
- Running timers are NOT auto-resumed on refresh (prevents accidental restarts)
- Invalid/corrupt state is caught and cleared
- State is only saved if localStorage is available

## Notes:
- This fix applies to the **Timekeeper** page (`/admin/timer`), not the Referee Panel page
- The bug description mentioned "referee page" but the actual issue is in the timekeeper interface
- Timers do not resume automatically after refresh - this is intentional for safety

## Verification:
Run the application and follow the test cases above to verify the fix works correctly.

```bash
# Start the Flask application
python run.py

# Navigate to: http://127.0.0.1:8000/admin/timer
# Follow test cases above
```
