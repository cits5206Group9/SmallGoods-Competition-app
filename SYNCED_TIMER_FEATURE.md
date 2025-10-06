# Synchronized Timer Feature - Referee Page

## Overview
The referee page now displays a **real-time synchronized timer** that pulls data from the timekeeper page. This ensures all referees see the same timer and athlete information that the timekeeper is managing.

## Features Implemented

### 1. **Live Timer Synchronization**
- Referee page polls the timekeeper state every second
- Displays current timer value (countdown/countup)
- Shows running/paused status with visual indicators
- Updates in real-time (1-second refresh rate)

### 2. **Athlete Information Display**
- Current competing athlete's name
- Attempt number
- All synced from timekeeper page

### 3. **Visual Status Indicators**
- **Green pulsing dot**: Timer is running
- **Orange dot**: Timer is paused
- **Gray dot**: Waiting for timekeeper to start

### 4. **Centralized Timer Control**
- Only timekeeper can start/stop/reset timer
- Referee page is read-only (display only)
- Ensures single source of truth for timing

## Technical Implementation

### Backend Changes

#### 1. New API Endpoint (`app/routes/timer.py`)
```python
@admin_bp.route("/api/timer-state", methods=['GET', 'POST'])
```

**GET Request**: Returns current timer state
```json
{
  "athlete_name": "John Doe",
  "attempt_number": "2",
  "timer_seconds": 45,
  "timer_running": true,
  "timer_mode": "attempt",
  "competition": "Spring Championship",
  "event": "Snatch",
  "flight": "Flight A",
  "timestamp": 1696502400000
}
```

**POST Request**: Timekeeper broadcasts state updates
- Called every 2 seconds by timekeeper page
- Saves state to `instance/timer_state.json`

### Frontend Changes

#### 1. Timekeeper Page (`app/static/js/timekeeper.js`)

**New Function**: `broadcastTimerState()`
- Sends current timer state to server every 2 seconds
- Includes athlete name, attempt number, timer value, and competition context
- Runs alongside existing `saveTimerState()` function

```javascript
function broadcastTimerState() {
  const state = {
    athlete_name: getAthleteName() || '',
    attempt_number: attemptSelect?.value || '',
    timer_seconds: Math.round(attemptClock.currentSeconds()),
    timer_running: attemptClock.running,
    timer_mode: attemptClock.mode,
    competition: CURRENT_CTX.competition || '',
    event: CURRENT_CTX.event || '',
    flight: CURRENT_CTX.flight || '',
    timestamp: Date.now()
  };
  
  fetch('/admin/api/timer-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
}
```

#### 2. Referee Page (`app/templates/admin/referee.html`)

**Replaced**:
- Old local timer controls (Start Timer, Reset, Start Break buttons)

**With**:
- New synchronized timer display
- Read-only visual indicator
- Status dots for running/paused/waiting states

**New HTML Structure**:
```html
<div class="timer-display synced-timer">
    <div class="timer-label">Live Timer from Timekeeper</div>
    <span id="synced-timer-display" class="synced-timer-value">60</span>
    <div class="timer-status">
        <span id="timer-status-indicator" class="status-dot"></span>
        <span id="timer-status-text">Waiting for timekeeper...</span>
    </div>
</div>
```

**New CSS Styles**:
- Purple gradient background for timer display
- Large 72px font for timer value
- Animated pulsing dot for running status
- Smooth transitions and shadows

#### 3. Referee JavaScript (`app/static/js/referee.js`)

**New Functions**:

1. `initSyncedTimer()` - Starts polling timer state every second
2. `fetchTimerState()` - Fetches current state from API
3. `updateSyncedTimerDisplay(state)` - Updates UI with new timer data

```javascript
async fetchTimerState() {
  const response = await fetch('/admin/api/timer-state');
  const state = await response.json();
  this.updateSyncedTimerDisplay(state);
}
```

## Data Flow

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│  Timekeeper     │  POST   │   Backend    │   GET   │  Referee Page   │
│     Page        │────────→│   API        │←────────│                 │
│  (Controls)     │ Every   │  /api/timer  │ Every   │  (Display)      │
│                 │ 2 sec   │   -state     │ 1 sec   │                 │
└─────────────────┘         └──────────────┘         └─────────────────┘
                                   ↓
                            ┌──────────────┐
                            │  timer_state │
                            │    .json     │
                            │   (Shared    │
                            │    State)    │
                            └──────────────┘
```

## Files Modified

1. **`app/routes/timer.py`** - Added API endpoint for timer state
2. **`app/static/js/timekeeper.js`** - Added broadcast function
3. **`app/templates/admin/referee.html`** - Updated timer display UI
4. **`app/static/js/referee.js`** - Added polling and sync logic

## How to Test

### Step 1: Open Timekeeper Page
1. Navigate to `/admin/timer`
2. Select a competition/event/flight
3. Enter athlete name
4. Start the timer

### Step 2: Open Referee Page
1. In a new tab/window, navigate to `/referee/1` (or `/referee/2`, `/referee/3`)
2. Select the same competition and event

### Step 3: Verify Synchronization
✅ Referee page should show:
- Same athlete name as timekeeper
- Same timer value (updated every second)
- Running status indicator (green pulsing dot)
- Timer counting down/up in sync

### Step 4: Test State Changes
- **Pause** timer on timekeeper → Referee shows orange dot
- **Resume** timer → Referee shows green pulsing dot
- **Change athlete** → Referee updates athlete name
- **Refresh** referee page → Still shows current state

## Benefits

1. **Single Source of Truth**: Only timekeeper controls the timer
2. **Real-Time Updates**: All referees see the same timer instantly
3. **No Conflicts**: Prevents timing discrepancies between pages
4. **Better UX**: Clear visual indicators of timer status
5. **Scalability**: Multiple referees can view without interference

## Future Enhancements

Potential improvements:
- WebSocket implementation for instant updates (instead of polling)
- Add attempt weight display sync
- Sync lift result decisions across referee panels
- Add connection status indicator
- Implement offline fallback with last known state

## Notes

- **Polling Interval**: 1 second for referee, 2 seconds for timekeeper broadcast
- **Storage**: Uses `instance/timer_state.json` as temporary shared state
- **Persistence**: Timer log persistence feature works independently
- **Backwards Compatible**: Existing timer features remain functional

---

## Related Documentation
- See `TIMER_STATE_FIX.md` for timer persistence feature
- See `PR_DESCRIPTION.md` for pull request details
