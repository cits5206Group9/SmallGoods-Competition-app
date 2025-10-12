/* timekeeper.js — Attempt timer + athlete/attempt selection + pinned rest timers + DB log (light UI) */
(function () {
  // ---------- Utilities ----------
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  const fmtHMS = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  };
  const fmtDurationStr = (sec) => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(" ");
  };
  // exact seconds like DB
  const fmtSecExact = (sec) => (typeof sec === "number" && isFinite(sec) ? `${sec.toFixed(4)} s` : "");
  const now = () => performance.now();
  const $ = (id) => document.getElementById(id);
  const nowStr = () => new Date().toLocaleTimeString();

  // ---------- Global page context ----------
  const getQueryParam = (k) => new URLSearchParams(location.search).get(k);
  let CURRENT_FLIGHT_ID = parseInt(getQueryParam("flight_id") || "", 10);
  if (Number.isNaN(CURRENT_FLIGHT_ID)) CURRENT_FLIGHT_ID = null;

  const CURRENT_CTX = { competition: "", event: "", flight: "", flightId: "" };
  window.TK_updateContext = function ({ competition, event, flight, flightId } = {}) {
    const prevCompetition = CURRENT_CTX.competition;
    if (typeof competition === "string") CURRENT_CTX.competition = competition;
    if (typeof event === "string") CURRENT_CTX.event = event;
    if (typeof flight === "string") CURRENT_CTX.flight = flight;
    if (flightId != null) {
      CURRENT_FLIGHT_ID = Number(flightId);
      CURRENT_CTX.flightId = String(flightId);  // Store in CURRENT_CTX as well
    }
    
    // Load the log for this competition if it changed
    if (competition && competition !== prevCompetition) {
      loadTimerLog();
    }
  };

  // Prefer dropdown for athlete name; fallback to hidden input (compat)
  function getAthleteName() {
    const sel = document.getElementById("athleteSelect");
    if (sel && sel.value) return sel.options[sel.selectedIndex].text;
    const el = document.getElementById("athleteName");
    return el ? el.value.trim() : "";
  }

  // Helper function to update attempt status - make it globally accessible
 const baseUpdateAttemptStatus = async function(athleteId, attemptNumber, flightId, status) {
    if (!athleteId || !attemptNumber) {
      console.warn('Missing athlete ID or attempt number for status update');
      return false;
    }

    try {
      // First, get the attempt ID from the athlete's attempts
      const response = await fetch(`/admin/athletes/${athleteId}/attempts?flight_id=${flightId || ''}`);
      if (!response.ok) {
        console.warn('Failed to fetch athlete attempts');
        return false;
      }
      
      const data = await response.json();
      const attempt = data.attempts.find(a => a.attempt_number == attemptNumber);
      
      if (!attempt) {
        console.warn(`Attempt ${attemptNumber} not found for athlete ${athleteId}`);
        return false;
      }

      // Update the attempt status
      const updateResponse = await fetch('/admin/update_attempt_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attempt_id: attempt.id,
          status: status
        })
      });

      if (updateResponse.ok) {
        console.log(`Successfully updated attempt ${attemptNumber} status to ${status} for athlete ${athleteId}`);
        return true;
      } else {
        console.warn('Failed to update attempt status:', await updateResponse.text());
        return false;
      }
    } catch (error) {
      console.warn('Error updating attempt status:', error);
      return false;
    }
  };

  // Wrap with break trigger check
  window.updateAttemptStatus = async function(athleteId, attemptNumber, flightId, status) {
    const result = await baseUpdateAttemptStatus(athleteId, attemptNumber, flightId, status);
    
    // Check if this was marking an attempt as finished
    if (result && status === 'finished' && flightId) {
      // Use a slight delay to ensure DB is updated
      setTimeout(() => checkForBreakTrigger(flightId), 100);
    }
    
    return result;
  };
  
  // Helper function to mark all "in-progress" attempts in a flight as "finished" except the specified one
  window.markOtherAttemptsAsFinished = async function(flightId, currentAthleteId, currentAttemptNumber) {
    if (!flightId) return;
    
    try {
      // Get all attempts in the flight
      const response = await fetch(`/admin/flights/${flightId}/attempts/order`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const attempts = data.attempts || [];
      
      // Find all attempts that are "in-progress" but are NOT the current one
      const inProgressAttempts = attempts.filter(att => 
        att.status === 'in-progress' && 
        !(String(att.athlete_id) === String(currentAthleteId) && String(att.attempt_number) === String(currentAttemptNumber))
      );
      
      // Mark each of them as finished
      for (const att of inProgressAttempts) {
        console.log(`Auto-finishing orphaned in-progress attempt: Athlete ${att.athlete_id}, Attempt ${att.attempt_number}`);
        await window.updateAttemptStatus(att.athlete_id, att.attempt_number, flightId, 'finished');
      }
      
      return inProgressAttempts.length;
    } catch (error) {
      console.warn('Error marking other attempts as finished:', error);
      return 0;
    }
  };

  // ---------- Timer primitive ----------
  class Timer {
    constructor({ displayEl, mode = "countup", onExpire, formatter = fmtHMS }) {
      this.displayEl = displayEl;
      this.mode = mode;
      this.onExpire = onExpire || (() => {});
      this.format = formatter;

      this.baseSeconds = 0;
      this.elapsed = 0;
      this.remaining = 0;
      this.running = false;
      this._t0 = 0;
      this._raf = null;
      this.render();
    }
    set(seconds) {
      const s = Math.max(0, seconds | 0);
      this.baseSeconds = s;
      if (this.mode === "countup") this.elapsed = 0;
      else this.remaining = s;
      this.pause();
      this.render();
    }
    start() {
      if (this.running) return;
      this.running = true;
      this._t0 = now();
      this._tick();
    }
    pause() {
      if (!this.running) return;
      this.running = false;
      const dt = (now() - this._t0) / 1000;
      if (this.mode === "countup") this.elapsed += dt;
      else this.remaining = Math.max(0, this.remaining - dt);
      this._stop();
      this.render();
    }
    resume() { if (!this.running) this.start(); }
    reset() {
      this.running = false;
      if (this.mode === "countup") this.elapsed = 0;
      else this.remaining = this.baseSeconds;
      this._stop();
      this.render();
    }
    currentSeconds() {
      const dt = this.running ? (now() - this._t0) / 1000 : 0;
      if (this.mode === "countup") return Math.max(0, this.baseSeconds + this.elapsed + dt);
      return Math.max(0, this.remaining - dt);
    }
    _tick() {
      this._raf = requestAnimationFrame(() => {
        const dt = (now() - this._t0) / 1000;
        if (this.mode === "countup") {
          const val = this.baseSeconds + this.elapsed + dt;
          this.displayEl.textContent = this.format(val);
          
          // Check if countup timer has reached its limit (baseSeconds > 0 means there's a limit)
          if (this.baseSeconds > 0 && val >= this.baseSeconds) {
            this.pause(); // Stop the timer
            this.displayEl.textContent = this.format(this.baseSeconds); // Show exact limit
            this.onExpire();
            return;
          }
        } else {
          const left = Math.max(0, this.remaining - dt);
          this.displayEl.textContent = this.format(left);
          if (left <= 0) {
            this.running = false;
            this._stop();
            this.onExpire();
            return;
          }
        }
        this._tick();
      });
    }
    _stop() { if (this._raf) cancelAnimationFrame(this._raf), (this._raf = null); }
    render() {
      const val = this.mode === "countup"
        ? this.format(this.baseSeconds + this.elapsed)
        : this.format(this.remaining);
      this.displayEl.textContent = val;
    }
  }

  // ---------- Log table ----------
  const MASTER_LOG = [];
  let LOG_FILTER = ""; // lowercase athlete filter

  function normalizeLogEntry({ start, stop, action, duration, competition, event, flight, athlete, attempt_no }) {
    competition = competition ?? CURRENT_CTX.competition ?? "";
    event       = event       ?? CURRENT_CTX.event       ?? "";
    flight      = flight      ?? CURRENT_CTX.flight      ?? "";
    athlete     = athlete     ?? getAthleteName()        ?? "";
    attempt_no  = attempt_no  ?? (document.getElementById("attemptSelect")?.value || "");
    return { start: start || "", stop: stop || "", action: action || "", duration: duration || "",
             competition, event, flight, athlete, attempt_no };
  }

  function renderLogTable() {
    const tbody = document.querySelector("#logTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const rows = LOG_FILTER
      ? MASTER_LOG.filter(r => r.athlete.toLowerCase().includes(LOG_FILTER))
      : MASTER_LOG.slice(-10);

    rows.slice().reverse().forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${r.start}</td>` +
        `<td>${r.stop}</td>` +
        `<td>${r.competition}</td>` +
        `<td>${r.event}</td>` +
        `<td>${r.flight}</td>` +
        `<td>${r.athlete}</td>` +
        `<td>${r.attempt_no || ""}</td>` +
        `<td>${r.action}</td>` +
        `<td>${r.duration}</td>`;
      tbody.appendChild(tr);
    });

    const count = document.getElementById("logSearchCount");
    if (count) count.textContent = LOG_FILTER ? `Showing ${rows.length} match(es)` : "";
  }

  function addLogRow(entry) {
    MASTER_LOG.push(normalizeLogEntry(entry));
    renderLogTable();
    saveTimerLog();
  }

  // ---------- Attempt Timer (main) ----------
  const attemptClock = new Timer({
    displayEl: $("attemptClock"),
    mode: "countup",
    formatter: fmtHMS,
    onExpire: async () => {
      console.log("Timer expired - auto-stopping attempt");
      // Automatically trigger the stop button logic
      document.getElementById("btnBarLeft")?.click();
    }
  });
  attemptClock.set(0);

  let attemptSessionStartTime = null;
  let attemptSessionStartRemOrElapsed = null;

  const bindClick = (sel, handler) =>
    document.querySelectorAll(`#${CSS.escape(sel)}`).forEach((n) => (n.onclick = handler));

  bindClick("btnStart", () => {
    attemptClock.start();

    if (!attemptSessionStartTime) {
      attemptSessionStartTime = new Date();
      attemptSessionStartRemOrElapsed = attemptClock.currentSeconds();
    }

    saveTimerState();
  });
  bindClick("btnPause",  () => { attemptClock.pause();
    saveTimerState();
  });
  bindClick("btnResume", () => { attemptClock.resume();
    saveTimerState();
  });
  bindClick("btnReset", () => {
    attemptClock.reset();
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
    saveTimerState();
  });

  // ---------- Pinned Timers (per-athlete Rest) ----------
  const PINS = []; // { id, athlete, attempt, attemptDurationSec, restTimer, elements }
  const defaultRestSeconds = 120;

  const btnPinsStartAll = $("btnPinsStartAll");
  const btnPinsPauseAll = $("btnPinsPauseAll");
  const btnPinsResetAll = $("btnPinsResetAll");

  function ensurePinsPanelVisibility() {
    const card = $("pinnedTimersCard");
    const empty = $("pinnedEmpty");
    if (!card) return;
    if (PINS.length === 0) {
      card.style.display = "none";
      if (empty) empty.style.display = "none";
    } else {
      card.style.display = "block";
      if (empty) empty.style.display = "none";
    }
  }

  // ========== STATE PERSISTENCE ==========
  const STATE_KEY = "TK_TIMER_STATE";
  const LOG_KEY_PREFIX = "TK_TIMER_LOG_";
  
  function getLogKey() {
    // Create a unique key for each competition
    const comp = CURRENT_CTX.competition || "unknown";
    return LOG_KEY_PREFIX + comp.replace(/[^a-zA-Z0-9]/g, "_");
  }
  
  function saveTimerLog() {
    if (!CURRENT_CTX.competition) return;
    try {
      const logKey = getLogKey();
      localStorage.setItem(logKey, JSON.stringify(MASTER_LOG));
    } catch (e) {
      console.warn("Failed to save timer log:", e);
    }
  }
  
  function loadTimerLog() {
    if (!CURRENT_CTX.competition) return;
    try {
      const logKey = getLogKey();
      const stored = localStorage.getItem(logKey);
      
      // Clear existing logs first to prevent appending
      MASTER_LOG.length = 0;
      
      if (stored) {
        const logs = JSON.parse(stored);
        MASTER_LOG.push(...logs);
        console.log(`Loaded ${logs.length} log entries for competition: ${CURRENT_CTX.competition}`);
      } else {
        console.log(`No saved logs found for competition: ${CURRENT_CTX.competition}`);
      }
      
      renderLogTable();
    } catch (e) {
      console.warn("Failed to load timer log:", e);
    }
  }
  
  function broadcastTimerState() {
    // Send current timer state to server for referee page synchronization
    const athleteSelect = document.getElementById("athleteSelect");
    const attemptSelect = document.getElementById("attemptSelect");
    
    // Get precise current timer value
    const currentSeconds = attemptClock.currentSeconds();
    
    // Get athlete data from the stored context or fetch it
    const athleteId = athleteSelect?.value || localStorage.getItem("TK_ATHLETE_ID") || '';
    const attemptNumber = attemptSelect?.value || '';
    
    // Try to get attempt weight from the active pin or athlete data
    let attemptWeight = 0;
    let weightClass = '';
    let team = '';
    let currentLift = '';
    
    // Look for active pin with athlete data
    const activePin = PINS.find(p => p.athlete && p.athlete.id && p.athlete.id.toString() === athleteId.toString());
    if (activePin && activePin.athlete) {
      // Try to get weight from attempts data
      if (activePin.athlete.attempts && activePin.athlete.attempts.length > 0) {
        const attemptNum = parseInt(attemptNumber) || 1;
        const attemptData = activePin.athlete.attempts.find(a => a.attempt_number === attemptNum);
        if (attemptData) {
          attemptWeight = attemptData.requested_weight || attemptData.actual_weight || 0;
        }
      }
      
      // Get other athlete info
      weightClass = activePin.athlete.weight_class || activePin.athlete.bodyweight || '';
      team = activePin.athlete.team || '';
    }
    
    // Try to infer lift type from event name
    if (CURRENT_CTX.event) {
      const eventLower = CURRENT_CTX.event.toLowerCase();
      if (eventLower.includes('snatch')) {
        currentLift = 'Snatch';
      } else if (eventLower.includes('clean') || eventLower.includes('jerk')) {
        currentLift = 'Clean & Jerk';
      } else {
        currentLift = CURRENT_CTX.event;
      }
    }
    
    const state = {
      athlete_name: getAthleteName() || '',
      athlete_id: athleteId,
      attempt_number: attemptNumber,
      timer_seconds: currentSeconds, // Use precise value, not rounded
      timer_running: attemptClock.running,
      timer_mode: attemptClock.mode,
      competition: CURRENT_CTX.competition || '',
      event: CURRENT_CTX.event || '',
      flight: CURRENT_CTX.flight || '',
      flight_id: CURRENT_CTX.flightId || '',
      base_seconds: attemptClock.baseSeconds,
      timestamp: Date.now(),
      // Additional athlete context for referee decisions
      attempt_weight: attemptWeight,
      weight_class: weightClass,
      team: team,
      current_lift: currentLift
    };
    
    fetch('/admin/api/timer-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    }).catch(err => console.warn('Failed to broadcast timer state:', err));
  }
  
  function saveTimerState() {
    const state = {
      attemptTimer: {
        mode: attemptClock.mode,
        baseSeconds: attemptClock.baseSeconds,
        elapsed: attemptClock.elapsed,
        remaining: attemptClock.remaining,
        running: attemptClock.running,
        sessionStartTime: attemptSessionStartTime ? attemptSessionStartTime.toISOString() : null,
        sessionStartRemOrElapsed: attemptSessionStartRemOrElapsed
      },
      pins: PINS.map(p => ({
        id: p.id,
        athlete: p.athlete,
        attempt: p.attempt,
        attemptDurationSec: p.attemptDurationSec,
        restTimerRemaining: p.restTimer ? p.restTimer.remaining : defaultRestSeconds,
        restTimerRunning: p.restTimer ? p.restTimer.running : false,
        restTimerBaseSeconds: p.restTimer ? p.restTimer.baseSeconds : defaultRestSeconds
      })),
      flightId: CURRENT_FLIGHT_ID,
      context: CURRENT_CTX,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save timer state:", e);
    }
  }

  function restoreTimerState() {
    try {
      const stored = localStorage.getItem(STATE_KEY);
      if (!stored) return false;
      
      const state = JSON.parse(stored);
      
      if (Date.now() - state.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(STATE_KEY);
        return false;
      }

      if (state.flightId) {
        CURRENT_FLIGHT_ID = state.flightId;
        Object.assign(CURRENT_CTX, state.context || {});
      }

      if (state.attemptTimer) {
        const at = state.attemptTimer;
        attemptClock.mode = at.mode;
        attemptClock.baseSeconds = at.baseSeconds;
        attemptClock.elapsed = at.elapsed || 0;
        attemptClock.remaining = at.remaining || at.baseSeconds;
        attemptClock.render();
        
        if (at.sessionStartTime) {
          attemptSessionStartTime = new Date(at.sessionStartTime);
          attemptSessionStartRemOrElapsed = at.sessionStartRemOrElapsed;
        }
      }

      if (state.pins && state.pins.length > 0) {
        state.pins.forEach(pinData => {
          const pin = {
            id: pinData.id,
            athlete: pinData.athlete,
            attempt: pinData.attempt,
            attemptDurationSec: pinData.attemptDurationSec
          };
          PINS.push(pin);
          renderPin(pin);
          
          if (pin.restTimer) {
            pin.restTimer.baseSeconds = pinData.restTimerBaseSeconds || defaultRestSeconds;
            pin.restTimer.remaining = pinData.restTimerRemaining || pinData.restTimerBaseSeconds;
            pin.restTimer.elapsed = 0;
            pin.restTimer.render();
          }
        });
      }

      console.log("Timer state restored");
      return true;
    } catch (e) {
      console.warn("Failed to restore timer state:", e);
      localStorage.removeItem(STATE_KEY);
      return false;
    }
  }

  // Save timer state to localStorage every 2 seconds
  setInterval(saveTimerState, 2000);
  
  // Broadcast timer state to server every 500ms for real-time sync with referee page
  setInterval(broadcastTimerState, 500);

  function parseHMS(input) {
    // accepts "HH:MM:SS" or "MM:SS" or seconds
    if (!input) return NaN;
    const parts = String(input).trim().split(":").map(Number);
    if (parts.some(isNaN)) return NaN;
    if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
    if (parts.length === 2) return parts[0]*60 + parts[1];
    if (parts.length === 1) return parts[0];
    return NaN;
  }

  function renderPin(pin) {
    const wrap = $("pinnedTimers");
    if (!wrap) return;

    const card = document.createElement("div");
    card.className = "pin-card";
    card.dataset.pinId = pin.id;

    const close = document.createElement("button");
    close.className = "pin-close";
    close.setAttribute("aria-label", "Remove pinned timer");
    close.textContent = "✕";
    close.onclick = () => removePin(pin.id);

    const title = document.createElement("div");
    title.className = "pin-title";
    title.textContent = `${pin.athlete || "Athlete"} • Attempt ${pin.attempt || "?"}`;

    const sub = document.createElement("div");
    sub.className = "pin-sub";
    sub.textContent = `Attempt duration: ${fmtSecExact(pin.attemptDurationSec)}`;

    // time display
    const timeEl = document.createElement("div");
    timeEl.className = "pin-time";
    timeEl.textContent = fmtHMS(defaultRestSeconds);

    // set time row (no presets) - initially hidden
    const setRow = document.createElement("div");
    setRow.className = "pin-setrow";
    setRow.style.display = "none";
    setRow.innerHTML = `
      <label class="pin-setlabel">Set Time:
        <input type="text" class="pin-hms" placeholder="HH:MM:SS">
      </label>
      <button class="pin-btn pin-apply" type="button">Apply</button>
    `;

    // actions
    const actions = document.createElement("div");
    actions.className = "pin-actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "pin-btn";
    btnEdit.textContent = "✎ Edit";

    const btnStart = document.createElement("button");
    btnStart.className = "pin-btn";
    btnStart.textContent = "Start Rest";

    const btnPause = document.createElement("button");
    btnPause.className = "pin-btn";
    btnPause.textContent = "Pause";

    const btnReset = document.createElement("button");
    btnReset.className = "pin-btn";
    btnReset.textContent = "Reset";

    actions.append(btnEdit, btnStart, btnPause, btnReset);

    card.append(close, title, sub, timeEl, setRow, actions);
    wrap.prepend(card);

    // rest timer instance
    const restTimer = new Timer({
      displayEl: timeEl,
      mode: "countdown",
      formatter: fmtHMS,
      onExpire: () => {
        // gentle cue
        sub.textContent = `Attempt duration: ${fmtSecExact(pin.attemptDurationSec)} • Rest expired`;
      }
    });
    restTimer.set(defaultRestSeconds);

    const inputHMS = card.querySelector(".pin-hms");
    const btnApply = card.querySelector(".pin-apply");

    btnStart.onclick = () => {
      restTimer.start();
      saveTimerState();
    };


    
    btnStart.onclick = async () => {
      restTimer.start();
      
      // Also start the backend timer for real-time sync with athlete pages
      if (pin.athleteId && CURRENT_FLIGHT_ID) {
        try {
          const compId = getSelectedCompetitionId();
          if (compId) {
            const duration = restTimer.currentSeconds();
            const response = await fetch(`/athlete/timer/start-break/${compId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                athlete_id: pin.athleteId,
                duration: duration
              })
            });
            
            if (!response.ok) {
              console.warn(`Backend break timer start failed: ${response.status}`);
            } else {
              const result = await response.json();
              if (!result.success) {
                console.warn(`Backend break timer start failed: ${result.error || 'Unknown error'}`);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to start backend break timer:", err);
        }
      }
      saveTimerState();
    };
    btnPause.onclick = async () => {
      restTimer.pause();
      
      // Pause backend timer as well
      if (pin.athleteId && CURRENT_FLIGHT_ID) {
        try {
          const compId = getSelectedCompetitionId();
          if (compId) {
            const timerId = `break_athlete_${pin.athleteId}`;
            const response = await fetch(`/athlete/timer/control/${compId}/${timerId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "pause" })
            });
            
            if (!response.ok) {
              console.warn(`Backend break timer pause failed: ${response.status}`);
            } else {
              const result = await response.json();
              if (!result.success) {
                console.warn(`Backend break timer pause failed: ${result.error || 'Timer not found'}`);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to pause backend break timer:", err);
        }
      }
      saveTimerState();
    };
    btnReset.onclick = async () => {
      restTimer.set(defaultRestSeconds);
      
      // Reset backend timer as well
      if (pin.athleteId && CURRENT_FLIGHT_ID) {
        try {
          const compId = getSelectedCompetitionId();
          if (compId) {
            const timerId = `break_athlete_${pin.athleteId}`;
            const response = await fetch(`/athlete/timer/control/${compId}/${timerId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                action: "reset",
                duration: defaultRestSeconds
              })
            });
            
            if (!response.ok) {
              console.warn(`Backend break timer reset failed: ${response.status}`);
            } else {
              const result = await response.json();
              if (!result.success) {
                console.warn(`Backend break timer reset failed: ${result.error || 'Timer not found'}`);
              }
            }
          }
        } catch (err) {
          console.warn("Failed to reset backend break timer:", err);
        }
      }
      saveTimerState();
    };

    btnApply.onclick = async () => {
      const secs = parseHMS(inputHMS.value);
      if (!Number.isNaN(secs) && secs >= 0) {
        restTimer.set(secs);
        setRow.style.display = "none";
        btnEdit.textContent = "✎ Edit";
        saveTimerState();
      } else {
        btnApply.classList.add("invalid");
        setTimeout(() => btnApply.classList.remove("invalid"), 300);
      }
    };

    // Edit button to toggle the set time row
    btnEdit.onclick = () => {
      const isVisible = setRow.style.display !== "none";
      setRow.style.display = isVisible ? "none" : "flex";
      btnEdit.textContent = isVisible ? "✎ Edit" : "✕ Cancel";
      
      // Pre-fill with current timer value when opening
      if (!isVisible) {
        const currentSeconds = restTimer.currentSeconds();
        inputHMS.value = fmtHMS(currentSeconds);
      }
    };

    pin.elements = { card, timeEl, btnEdit, btnStart, btnPause, btnReset, sub, inputHMS, btnApply };
    pin.restTimer = restTimer;

    ensurePinsPanelVisibility();
  }

  function removePin(id) {
    const idx = PINS.findIndex((p) => p.id === id);
    if (idx === -1) return;
    const pin = PINS[idx];
    if (pin.restTimer) pin.restTimer.pause();
    if (pin.elements?.card) pin.elements.card.remove();
    PINS.splice(idx, 1);
    ensurePinsPanelVisibility();
    saveTimerState();
  }

  function clearAllPins() {
    // Stop and remove all pinned timers
    while (PINS.length > 0) {
      const pin = PINS[0];
      if (pin.restTimer) pin.restTimer.pause();
      if (pin.elements?.card) pin.elements.card.remove();
      PINS.shift();
    }
    ensurePinsPanelVisibility();
  }

  function pinFinishedAttempt({ athlete, attempt, attemptDurationSec, athleteId }) {
    const id = `pin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pin = { id, athlete, attempt, attemptDurationSec, athleteId };
    PINS.push(pin);
    renderPin(pin);
  }

  // Stop / “Bar left platform”
  bindClick("btnBarLeft", async () => {
    attemptClock.pause();
    if (attemptSessionStartTime) {
      const startTs = attemptSessionStartTime;
      const stopTs = new Date();
      
      // Calculate duration from actual wall-clock time (more reliable)
      let durationSec = Math.max(0, (stopTs - startTs) / 1000);
      
      // Cap duration at the timer limit (don't save more than the allowed time)
      if (attemptTimeLimit > 0 && durationSec > attemptTimeLimit) {
        durationSec = attemptTimeLimit;
      }

      const attemptNo = document.getElementById("attemptSelect")?.value || "";
      const athleteId = localStorage.getItem("TK_ATHLETE_ID") || null;

      // Update attempt status to 'finished' when timer is stopped
      if (athleteId && attemptNo) {
        await window.updateAttemptStatus(athleteId, attemptNo, CURRENT_FLIGHT_ID, 'finished');
        
        // Refresh the attempt order list to show updated status (without auto-selecting)
        if (CURRENT_FLIGHT_ID && typeof loadAttemptOrder === 'function') {
          await loadAttemptOrder(CURRENT_FLIGHT_ID, false); // Pass false to prevent auto-selection
        }
      }

      // 1) UI log row (exact seconds)
      addLogRow({
        start: startTs.toLocaleTimeString(),
        stop: stopTs.toLocaleTimeString(),
        action: "Attempt",
        duration: fmtSecExact(durationSec),
        attempt_no: attemptNo
      });

      // 2) Pin a rest card
      pinFinishedAttempt({
        athlete: getAthleteName(),
        attempt: attemptNo || "?",
        attemptDurationSec: durationSec,
        athleteId: athleteId
      });

      // 3) DB POST
      try {
        fetch("/admin/timer/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competition_id: getSelectedCompetitionId(),
            event_id: getSelectedEventId(),
            flight_id: CURRENT_FLIGHT_ID,
            athlete: getAthleteName(),
            action: "Attempt",
            start_iso: startTs.toISOString(),
            stop_iso: stopTs.toISOString(),
            duration_sec: durationSec,
            meta: {
              attempt_no: attemptNo || null,
              athlete_id: localStorage.getItem("TK_ATHLETE_ID") || null
            }
          })
        }).catch(() => {});
      } catch {}
    }
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  });

  // ---------- Attempt: countdown toggle + defaults sync ----------
  const btnAttemptToggle = $("btnAttemptToggle");
  const btnAttemptEdit = $("btnAttemptEdit");
  const attemptSetRow = $("attemptSetRow");
  const attemptHMS = $("attemptHMS");
  const btnAttemptApply = $("btnAttemptApply");
  
  let countdownOn = false;
  let attemptTimeLimit = 120; // Default 2-minute limit for attempts
  
  function setAttemptMode(countdownSeconds) {
    if (typeof countdownSeconds === "number" && countdownSeconds > 0) {
      countdownOn = true;
      attemptTimeLimit = countdownSeconds;
      attemptClock.mode = "countdown";
      attemptClock.set(countdownSeconds);
      if (btnAttemptToggle) btnAttemptToggle.textContent = "Disable 1-min Countdown";
    } else {
      countdownOn = false;
      attemptClock.mode = "countup";
      // Set baseSeconds to the limit so timer knows when to expire
      attemptClock.set(attemptTimeLimit);
      // Reset elapsed to 0 to start counting from 0
      attemptClock.elapsed = 0;
      attemptClock.render();
      if (btnAttemptToggle) btnAttemptToggle.textContent = "Enable 1-min Countdown";
    }
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  }
  if (btnAttemptToggle) {
    btnAttemptToggle.onclick = () => {
      setAttemptMode(countdownOn ? 0 : 60);
    };
  }
  
  // Edit button to show/hide time setter
  if (btnAttemptEdit && attemptSetRow) {
    btnAttemptEdit.onclick = () => {
      const isVisible = attemptSetRow.style.display !== "none";
      attemptSetRow.style.display = isVisible ? "none" : "flex";
      btnAttemptEdit.textContent = isVisible ? "✎ Edit Time" : "✕ Cancel";
      
      // Pre-fill with current timer value when opening
      if (!isVisible) {
        const currentSeconds = attemptClock.currentSeconds();
        attemptHMS.value = fmtHMS(currentSeconds);
      }
    };
  }
  
  // Apply button to set new time
  if (btnAttemptApply && attemptHMS) {
    btnAttemptApply.onclick = () => {
      const val = attemptHMS.value.trim();
      if (!val) return;
      
      const parts = val.split(":").map(s => parseInt(s, 10) || 0);
      let totalSec = 0;
      if (parts.length === 3) {
        totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        totalSec = parts[0] * 60 + parts[1];
      } else if (parts.length === 1) {
        totalSec = parts[0];
      }
      
      if (totalSec < 0) totalSec = 0;
      
      // Update the time limit
      attemptTimeLimit = totalSec;
      
      // Preserve the current mode (countdown or countup)
      const wasRunning = attemptClock.running;
      attemptClock.set(totalSec);
      
      // If in countup mode, reset elapsed to start from 0
      if (attemptClock.mode === "countup") {
        attemptClock.elapsed = 0;
        attemptClock.render();
      }
      
      // If timer was running, restart it
      if (wasRunning) {
        attemptClock.start();
      }
      
      // Hide the setter
      attemptSetRow.style.display = "none";
      btnAttemptEdit.textContent = "✎ Edit Time";
      
      saveTimerState();
    };
  }

  // Fetch defaults from server and apply (keeps Current Status in sync with model)
  async function applyTimerDefaultsFromSelection(compId, eventId, flightId) {
    try {
      const params = new URLSearchParams();
      if (compId)  params.set("comp_id",  String(compId));
      if (eventId) params.set("event_id", String(eventId));
      if (flightId) params.set("flight_id", String(flightId));

      const res = await fetch(`/admin/api/timer-defaults?${params.toString()}`);
      if (!res.ok) return;
      const j = await res.json();

      const a = j.attempt_seconds;
      // we no longer use a global break; ignore j.break_seconds here

      setAttemptMode(typeof a === "number" && a > 0 ? a : 0);
    } catch (err) {
      console.warn("Failed to load timer defaults:", err);
    }
  }
  // exposed for selector
  window.TK_applyTimerDefaultsFromSelection = applyTimerDefaultsFromSelection;

  // ---------- “Pinned Timers” header bulk actions ----------
  if (btnPinsStartAll) btnPinsStartAll.onclick = () => {
    PINS.forEach(p => p.restTimer?.start());
    saveTimerState();
  };
  if (btnPinsPauseAll) btnPinsPauseAll.onclick = () => {
    PINS.forEach(p => p.restTimer?.pause());
    saveTimerState();
  };
  if (btnPinsResetAll) btnPinsResetAll.onclick = () => {
    PINS.forEach(p => p.restTimer?.set(defaultRestSeconds));
    saveTimerState();
  };

  // ---------- Keyboard Shortcuts ----------
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space") {
      if (!attemptClock.running) $("btnStart")?.click();
      else $("btnPause")?.click();
      e.preventDefault();
    }
  });

  // Restore timer state from localStorage on page load
  restoreTimerState();
  loadTimerLog();

  // minimal tree preload (selectors render themselves)
  async function loadFlightsTree() {
    try {
      const j = (u) => fetch(u, { headers: { "X-Requested-With": "fetch" } }).then(r => r.json());
      const comps = await j("/admin/competitions");
      const tree = [];
      for (const c of comps) {
        const events = await j(`/admin/competitions/${c.id}/events`);
        const evts = [];
        for (const e of events) {
          const flights = await j(`/admin/events/${e.id}/flights`);
          evts.push({ id: e.id, name: e.name, flights });
        }
        tree.push({ id: c.id, name: c.name, events: evts });
      }
      // not used here
    } catch {}
  }
  
  loadFlightsTree();

  // ---- Log search wiring
  const logSearch = document.getElementById("logSearch");
  const logSearchClear = document.getElementById("logSearchClear");
  if (logSearch) {
    logSearch.addEventListener("input", (e) => {
      LOG_FILTER = e.target.value.trim().toLowerCase();
      renderLogTable();
    });
  }
  if (logSearchClear) {
    logSearchClear.addEventListener("click", () => {
      LOG_FILTER = "";
      if (logSearch) logSearch.value = "";
      renderLogTable();
    });
  }

  function getSelectedCompetitionId() {
    const selComp = document.getElementById("selComp");
    return selComp ? parseInt(selComp.value) : null;
  }
  function getSelectedEventId() {
    const selEvent = document.getElementById("selEvent");
    return selEvent && selEvent.value ? parseInt(selEvent.value) : null;
  }
})();


// ---- Timekeeper: Competition/Event/Flight selector (+ athlete & attempt dropdowns) ----
(function TKSelector() {
  const selComp   = document.getElementById("selComp");
  const selEvent  = document.getElementById("selEvent");
  const selFlight = document.getElementById("selFlight");
  const btnGo     = document.getElementById("selGo");

  const card = document.getElementById("tk-available-card");
  const summary = document.getElementById("tk-selected-summary");
  const emptyMsg = document.getElementById("tk-competitions-empty");

  // Athlete & attempt hooks
  const athleteEditor  = document.getElementById("tk-athlete-editor");
  const athleteInput   = document.getElementById("athleteName"); // hidden compat
  const btnAthlete     = document.getElementById("btnAthleteApply");
  const athleteApplied = document.getElementById("athleteApplied");
  const ATHLETE_KEY    = "TK_ATHLETE_NAME";

  const athleteSelect      = document.getElementById("athleteSelect");
  const btnReloadAthletes  = document.getElementById("btnReloadAthletes");
  const ATHLETE_ID_KEY     = "TK_ATHLETE_ID";
  const attemptSelect      = document.getElementById("attemptSelect");

  let lastFlightId = null;

  if (!selComp || !selEvent || !selFlight || !btnGo || !card) return;

  const opt = (v, t) => { const o = document.createElement("option"); o.value = v; o.textContent = t; return o; };
  const clear = (el) => { el.innerHTML = ""; };
  const disable = (el, yes) => { el.disabled = !!yes; };

  async function getCompetitions() { return (await fetch("/admin/competitions")).json(); }
  async function getEvents(compId)  { return (await fetch(`/admin/competitions/${compId}/events`)).json(); }
  async function getFlights(eventId){ return (await fetch(`/admin/events/${eventId}/flights`)).json(); }

  // Athletes for a flight
  async function fetchFlightAthletes(flightId) {
    try {
      const res = await fetch(`/admin/flights/${flightId}/athletes`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      if (!res.ok) return [];
      const j = await res.json();
      const list = j.athletes || [];
      return list.map(a => ({
        id: a.id,
        name: a.full_name || `${a.first_name || ""} ${a.last_name || ""}`.trim()
      }));
    } catch (e) {
      console.warn("Failed to fetch flight athletes:", e);
      return [];
    }
  }

  async function populateAthleteDropdown(flightId) {
    if (!athleteSelect) return;
    athleteSelect.innerHTML = '<option value="">Select athlete…</option>';
    athleteSelect.disabled = true;

    const list = await fetchFlightAthletes(flightId);
    for (const a of list) {
      const o = document.createElement("option");
      o.value = String(a.id);
      o.textContent = a.name;
      athleteSelect.appendChild(o);
    }

    athleteSelect.disabled = false;

    // Initialize attempt dropdown
    if (attemptSelect) {
      attemptSelect.innerHTML = '<option value="">Select athlete first…</option>';
      attemptSelect.disabled = true;
    }

    // restore previous selection if still present
    const savedId = localStorage.getItem(ATHLETE_ID_KEY);
    const savedName = localStorage.getItem(ATHLETE_KEY);
    if (savedId && athleteSelect.querySelector(`option[value="${savedId}"]`)) {
      athleteSelect.value = savedId;
      // Trigger dynamic attempt population for restored athlete selection
      populateAttemptDropdown(savedId);
      if (athleteApplied) {
        const at = (attemptSelect && attemptSelect.value) ? ` • Attempt ${attemptSelect.value}` : "";
        athleteApplied.textContent = savedName ? `Applied: ${savedName}${at}` : "";
      }
    }
  }

  function updateAthleteApplied() {
    if (!athleteApplied) return;
    let name = "";
    if (athleteSelect && athleteSelect.value) {
      name = athleteSelect.options[athleteSelect.selectedIndex].text;
    } else if (athleteInput) {
      name = athleteInput.value.trim();
    }
    const at = (attemptSelect && attemptSelect.value) ? ` • Attempt ${attemptSelect.value}` : "";
    athleteApplied.textContent = name ? `Applied: ${name}${at}` : "";
  }

  if (btnAthlete) {
    btnAthlete.addEventListener("click", async () => {
      console.log("=== APPLY BUTTON CLICKED ===");
      console.log("athleteSelect.value BEFORE:", athleteSelect?.value);
      console.log("attemptSelect.value BEFORE:", attemptSelect?.value);
      
      let id = "", name = "";
      if (athleteSelect && athleteSelect.value) {
        id = athleteSelect.value;
        name = athleteSelect.options[athleteSelect.selectedIndex].text;
      } else if (athleteInput) {
        name = athleteInput.value.trim();
      }
      
      console.log("Selected athlete ID:", id, "Name:", name);
      
      // Get previous athlete/attempt from localStorage
      const prevAthleteId = localStorage.getItem(ATHLETE_ID_KEY);
      const prevAthleteName = localStorage.getItem(ATHLETE_KEY);
      
      // Mark previous attempt as finished if it was in progress
      if (prevAthleteId && attemptSelect) {
        // Get the previously selected attempt number from the dropdown's current state
        const prevAttemptNumber = attemptSelect.dataset.previousValue || attemptSelect.value;
        if (prevAttemptNumber && (prevAthleteId !== id || prevAttemptNumber !== attemptSelect.value)) {
          console.log(`Marking previous attempt as finished: Athlete ${prevAthleteId}, Attempt ${prevAttemptNumber}`);
          await window.updateAttemptStatus(prevAthleteId, prevAttemptNumber, lastFlightId, 'finished');
        }
      }
      
      // Update storage with new athlete
      if (id) localStorage.setItem(ATHLETE_ID_KEY, id); else localStorage.removeItem(ATHLETE_ID_KEY);
      localStorage.setItem(ATHLETE_KEY, name);
      
      // Update attempt status to 'in-progress' when new athlete is applied
      const attemptNumber = attemptSelect?.value;
      if (id && attemptNumber && lastFlightId) {
        console.log("Applying athlete:", id, "Attempt:", attemptNumber);
        
        // IMPORTANT: First, mark all other in-progress attempts as finished
        await window.markOtherAttemptsAsFinished(lastFlightId, id, attemptNumber);
        
        // Store current attempt number for next comparison
        if (attemptSelect) attemptSelect.dataset.previousValue = attemptNumber;
        
        // Then mark this attempt as in-progress
        await window.updateAttemptStatus(id, attemptNumber, lastFlightId, 'in-progress');
        
        console.log("athleteSelect.value AFTER status update:", athleteSelect?.value);
        console.log("attemptSelect.value AFTER status update:", attemptSelect?.value);
        
        // Refresh the attempt order list to show updated status (without auto-selecting)
        if (typeof loadAttemptOrder === 'function') {
          console.log("Calling loadAttemptOrder with autoSelect=false");
          await loadAttemptOrder(lastFlightId, false); // Pass false to prevent auto-selection
          console.log("athleteSelect.value AFTER loadAttemptOrder:", athleteSelect?.value);
          console.log("attemptSelect.value AFTER loadAttemptOrder:", attemptSelect?.value);
        }
      }
      
      updateAthleteApplied();
      console.log("=== APPLY BUTTON COMPLETE ===");
    });
  }

  if (btnReloadAthletes) {
    btnReloadAthletes.addEventListener("click", () => {
      const targetId = lastFlightId || selFlight.value;
      if (targetId) populateAthleteDropdown(targetId);
    });
  }

  // Fetch ordered attempts for a flight
  async function fetchOrderedAttempts(flightId) {
    try {
      const res = await fetch(`/admin/flights/${flightId}/attempts/order`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.attempts || [];
    } catch (e) {
      console.warn("Failed to fetch ordered attempts:", e);
      return [];
    }
  }

  // Next Athlete button handler
  const btnNextAthlete = document.getElementById("btnNextAthlete");
  if (btnNextAthlete) {
    btnNextAthlete.addEventListener("click", async () => {
      // Get current flight
      const flightId = lastFlightId || selFlight.value;
      if (!flightId) {
        alert("Please select a flight first");
        return;
      }

      // Get all attempts in lifting order (athlete + attempt number combinations)
      const orderedAttempts = await fetchOrderedAttempts(flightId);
      if (!orderedAttempts || orderedAttempts.length === 0) {
        alert("No attempts found in this flight");
        return;
      }

      // Get current athlete ID and attempt number
      const currentAthleteId = athleteSelect?.value;
      const currentAttemptNumber = attemptSelect?.value;
      
      // Find current position in the ordered attempts list
      let currentIndex = -1;
      if (currentAthleteId && currentAttemptNumber) {
        currentIndex = orderedAttempts.findIndex(att => 
          String(att.athlete_id) === String(currentAthleteId) && 
          String(att.attempt_number) === String(currentAttemptNumber)
        );
      }

      // Filter out finished attempts (status: 'finished', 'success', 'failed')
      const pendingAttempts = orderedAttempts.filter(att => {
        const status = (att.status || '').toLowerCase();
        return !['finished', 'success', 'failed'].includes(status);
      });

      if (pendingAttempts.length === 0) {
        alert("All attempts in this flight are finished");
        return;
      }

      // Get next attempt (only from pending attempts)
      let nextAttempt = null;
      if (currentIndex === -1) {
        // No attempt selected, start with first pending attempt
        nextAttempt = pendingAttempts[0];
      } else {
        // Find current attempt in the full list
        const currentAttempt = orderedAttempts[currentIndex];
        
        // Find next pending attempt after current position
        let foundNext = false;
        for (let i = currentIndex + 1; i < orderedAttempts.length; i++) {
          const att = orderedAttempts[i];
          const status = (att.status || '').toLowerCase();
          if (!['finished', 'success', 'failed'].includes(status)) {
            nextAttempt = att;
            foundNext = true;
            break;
          }
        }
        
        if (!foundNext) {
          // No more pending attempts after current, wrap to first pending
          nextAttempt = pendingAttempts[0];
          
          // If we're already at the last pending attempt, show message
          if (String(nextAttempt.athlete_id) === String(currentAthleteId) && 
              String(nextAttempt.attempt_number) === String(currentAttemptNumber)) {
            alert("This is the last pending attempt in the flight");
            return;
          }
        }
      }

      // Select next athlete and attempt in dropdowns (WITHOUT auto-applying)
      if (athleteSelect && attemptSelect && nextAttempt) {
        // Set athlete dropdown
        athleteSelect.value = String(nextAttempt.athlete_id);
        
        // Populate attempts for this athlete
        await populateAttemptDropdown(nextAttempt.athlete_id);
        
        // Set attempt dropdown to the specific attempt
        attemptSelect.value = String(nextAttempt.attempt_number);
        
        // Show visual feedback that selection was made (but NOT applied yet)
        if (athleteApplied) {
          const name = nextAttempt.athlete_name;
          const attemptNum = nextAttempt.attempt_number;
          athleteApplied.textContent = `Selected: ${name} • Attempt ${attemptNum} (Click Apply to confirm)`;
          athleteApplied.style.color = '#d69e2e'; // Orange color to indicate not yet applied
          setTimeout(() => { athleteApplied.style.color = ''; }, 3000);
        }
        
        // Scroll the Apply button into view to make it obvious
        if (btnAthlete) {
          btnAthlete.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          // Add a subtle highlight effect
          btnAthlete.style.animation = 'pulse 0.5s ease-in-out 2';
          setTimeout(() => { btnAthlete.style.animation = ''; }, 1000);
        }
      }
    });
  }

  async function populateAttemptDropdown(athleteId) {
    if (!attemptSelect || !athleteId) {
      if (attemptSelect) {
        attemptSelect.innerHTML = '<option value="">Select…</option>';
        attemptSelect.disabled = true;
      }
      return;
    }

    // Clear existing attempt options
    attemptSelect.innerHTML = '<option value="">Select…</option>';
    attemptSelect.disabled = true;
    
    try {
      // Fetch athlete's attempts to populate dropdown dynamically
      // Include flight context to get flight-specific attempts
      let url = `/admin/athletes/${athleteId}/attempts`;
      if (lastFlightId) {
        url += `?flight_id=${lastFlightId}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        
        // Always use real-time data, no fallback to hardcoded attempts
        if (data.attempt_numbers && data.attempt_numbers.length > 0) {
          // Clear the placeholder option first
          attemptSelect.innerHTML = '';
          
          data.attempt_numbers.forEach(attemptNum => {
            const option = document.createElement('option');
            option.value = attemptNum;
            option.textContent = attemptNum;
            attemptSelect.appendChild(option);
          });
          
          // Set default to first attempt if none selected
          if (!attemptSelect.value) attemptSelect.value = data.attempt_numbers[0];
          attemptSelect.disabled = false;
        } else {
          // If no attempts found, leave dropdown empty but enabled
          attemptSelect.innerHTML = '<option value="">No attempts available</option>';
          attemptSelect.disabled = true;
        }
      } else {
        console.error('Failed to fetch athlete attempts:', response.status);
        attemptSelect.innerHTML = '<option value="">Failed to load attempts</option>';
        attemptSelect.disabled = true;
      }
    } catch (error) {
      console.error('Error fetching athlete attempts:', error);
      attemptSelect.innerHTML = '<option value="">Error loading attempts</option>';
      attemptSelect.disabled = true;
    }
  }

  if (athleteSelect && attemptSelect) {
    athleteSelect.addEventListener("change", async () => {
      const athleteId = athleteSelect.value;
      await populateAttemptDropdown(athleteId);
      updateAthleteApplied();
    });
    attemptSelect.addEventListener("change", updateAthleteApplied);
  }

  function renderSelected({ comp, evt, flight }) {
    card.style.display = "block";
    if (emptyMsg) emptyMsg.style.display = "none";

    if (summary) {
      summary.style.display = "block";
      summary.innerHTML = `
        <div class="selected-row"><strong>Competition:</strong> ${comp.name}</div>
        <div class="selected-row"><strong>Event:</strong> ${evt.name}</div>
        <div class="selected-row"><strong>Flight:</strong> ${flight.name}${flight.is_active === false ? ' <span class="text-muted">(inactive)</span>' : ''}</div>
      `;
    }

    lastFlightId = flight.id;
    window.TK_updateContext({
      competition: comp.name,
      event: evt.name,
      flight: flight.name,
      flightId: flight.id
    });
    
    // Load competition data for break timers when competition is loaded
    loadCompetitionBreakTimerData(comp.id);

    // Clear previous competition's data when switching flights
    if (typeof clearAllPins === 'function') {
      clearAllPins();
    }
    if (typeof loadTimerLog === 'function') {
      loadTimerLog();
    }

    if (athleteEditor) {
      populateAthleteDropdown(flight.id);
      athleteEditor.style.display = "block";
    }

    // Update attempt dropdown when flight changes (different flights may have different attempt configs)
    if (athleteSelect && athleteSelect.value) {
      // If an athlete is already selected, repopulate attempts for the new flight context
      populateAttemptDropdown(athleteSelect.value);
    } else if (attemptSelect) {
      // If no athlete selected, clear attempt dropdown
      attemptSelect.innerHTML = '<option value="">Select athlete first…</option>';
      attemptSelect.disabled = true;
    }

    if (athleteInput && !athleteInput.value) {
      athleteInput.value = localStorage.getItem(ATHLETE_KEY) || "";
    }
    updateAthleteApplied();

    // Apply server defaults so the Current Status timer stays in sync with the model
    window.TK_applyTimerDefaultsFromSelection(
      Number(comp.id), Number(evt.id), Number(flight.id)
    );
  }

  async function init() {
    clear(selComp); clear(selEvent); clear(selFlight);
    selComp.append(opt("", "Select competition…"));
    selEvent.append(opt("", "Select event…"));
    selFlight.append(opt("", "Select flight…"));
    disable(selEvent, true); disable(selFlight, true); disable(btnGo, true);

    const comps = await getCompetitions();
    comps.forEach((c) => selComp.append(opt(c.id, c.name)));
  }

  async function onCompChange() {
    const compId = selComp.value;
    clear(selEvent); clear(selFlight);
    selEvent.append(opt("", "Select event…"));
    selFlight.append(opt("", "Select flight…"));
    disable(btnGo, true);
    if (!compId) { disable(selEvent, true); disable(selFlight, true); return; }

    const events = await getEvents(compId);
    events.forEach((e) => selEvent.append(opt(e.id, e.name)));
    disable(selEvent, false);
    disable(selFlight, true);
  }

  async function onEventChange() {
    const eventId = selEvent.value;
    clear(selFlight);
    selFlight.append(opt("", "Select flight…"));
    disable(btnGo, true);
    if (!eventId) { disable(selFlight, true); return; }

    // Set this event as active for athlete context
    try {
      await fetch(`/athlete/set-active-event/${eventId}`, { method: 'POST' });
    } catch (error) {
      // Silently ignore errors - not critical for timekeeper operation
    }

    const flights = await getFlights(eventId);
    flights.forEach((f) =>
      selFlight.append(opt(f.id, f.name + (f.is_active === false ? " (inactive)" : "")))
    );
    disable(selFlight, false);
  }

  function onFlightChange() {
    disable(btnGo, !selFlight.value);
  }

  function onGo() {
    const comp = { id: Number(selComp.value), name: selComp.options[selComp.selectedIndex].textContent };
    const evt  = { id: Number(selEvent.value), name: selEvent.options[selEvent.selectedIndex].textContent };
    const flt  = { id: Number(selFlight.value), name: selFlight.options[selFlight.selectedIndex].textContent, is_active: true };
    if (!flt.id) return;

    renderSelected({ comp, evt, flight: flt });

    const url = new URL(location.href);
    url.searchParams.set("flight_id", flt.id);
    history.replaceState(null, "", url.toString());
  }

  selComp.addEventListener("change", onCompChange);
  selEvent.addEventListener("change", onEventChange);
  selFlight.addEventListener("change", onFlightChange);
  btnGo.addEventListener("click", onGo);

  init();

  // ============================================
  // Attempt Order Management Section
  // ============================================
  
  const attemptOrderSection = document.getElementById("tk-attempt-order-section");
  const attemptOrderList = document.getElementById("tk-attempt-order-list");
  const athleteNameFilter = document.getElementById("tk-athlete-name-filter");
  const attemptStatusFilter = document.getElementById("tk-attempt-status-filter");
  const clearFiltersBtn = document.getElementById("tk-clear-filters");
  const sortByWeightBtn = document.getElementById("tk-sort-by-weight");
  const sortByNameBtn = document.getElementById("tk-sort-by-name");
  const randomizeOrderBtn = document.getElementById("tk-randomize-order");
  const generateTestAttemptsBtn = document.getElementById("tk-generate-test-attempts");
  const markFirstCompletedBtn = document.getElementById("tk-mark-first-completed");
  const refreshAttemptsBtn = document.getElementById("tk-refresh-attempts");
  
  let allAttempts = [];
  let attemptsSortable = null;
  
  // Fetch and display attempts when flight is loaded
  const originalRenderSelected = renderSelected;
  renderSelected = function({ comp, evt, flight }) {
    originalRenderSelected({ comp, evt, flight });
    
    // Show attempt order section and load attempts
    if (attemptOrderSection) {
      attemptOrderSection.style.display = "block";
      loadAttemptOrder(flight.id);
    }
  };
  
  async function loadAttemptOrder(flightId, autoSelect = true) {
    if (!flightId) return;
    
    console.log("loadAttemptOrder called with autoSelect:", autoSelect);
    
    try {
      const response = await fetch(`/admin/flights/${flightId}/attempts/order`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      
      if (!response.ok) {
        throw new Error("Failed to load attempts");
      }
      
      const data = await response.json();
      const attempts = data.attempts || [];
      displayAttemptOrder(attempts);
      
      console.log("Should auto-select?", autoSelect, "Attempts count:", attempts.length);
      
      // Auto-select (but don't apply) the first PENDING athlete from the ordered attempts
      // Only do this when loading the flight initially, not when refreshing after Apply
      if (autoSelect && attempts.length > 0 && athleteSelect && attemptSelect) {
        // Find first pending attempt (skip finished ones)
        const firstPendingAttempt = attempts.find(att => {
          const status = (att.status || '').toLowerCase();
          return !['finished', 'success', 'failed'].includes(status);
        });
        
        if (firstPendingAttempt) {
          // Set athlete dropdown
          athleteSelect.value = String(firstPendingAttempt.athlete_id);
          
          // Populate attempts for this athlete
          await populateAttemptDropdown(firstPendingAttempt.athlete_id);
          
          // Set attempt dropdown to the specific attempt
          attemptSelect.value = String(firstPendingAttempt.attempt_number);
          
          // Show visual feedback that first athlete is selected (but NOT applied yet)
          if (athleteApplied) {
            const name = firstPendingAttempt.athlete_name;
            const attemptNum = firstPendingAttempt.attempt_number;
            athleteApplied.textContent = `Selected: ${name} • Attempt ${attemptNum} (Click Apply to start)`;
            athleteApplied.style.color = '#d69e2e'; // Orange color to indicate not yet applied
          }
        } else {
          // All attempts are finished
          if (athleteApplied) {
            athleteApplied.textContent = `All attempts in this flight are finished`;
            athleteApplied.style.color = '#718096'; // Gray color
          }
        }
      }
    } catch (error) {
      console.error("Error loading attempt order:", error);
      attemptOrderList.innerHTML = `<div style="color:#e53e3e;padding:1rem;background:#fff5f5;border-radius:8px">Error loading attempts: ${error.message}</div>`;
    }
  }
  
  function displayAttemptOrder(attempts) {
    if (!attemptOrderList) return;
    
    allAttempts = attempts;
    const filteredAttempts = applyAttemptFilters(attempts);
    
    attemptOrderList.innerHTML = "";
    
    if (filteredAttempts.length === 0) {
      attemptOrderList.innerHTML = `
        <div style="text-align:center;padding:2rem;color:#718096;background:#f7fafc;border-radius:8px">
          <p><strong>No attempts found${attempts.length > 0 ? ' for current filters' : ' for this flight'}.</strong></p>
          <p><small>${attempts.length > 0 ? 'Try adjusting your filters or ' : 'Add some athletes to this flight and '}generate test attempts to see them here.</small></p>
        </div>
      `;
      return;
    }
    
    // Separate finished and pending attempts
    const finishedAttempts = [];
    const pendingAttempts = [];
    
    filteredAttempts.forEach(attempt => {
      const isFinished = ['finished', 'success', 'failed'].includes(attempt.status?.toLowerCase() || '');
      if (isFinished) {
        finishedAttempts.push(attempt);
      } else {
        pendingAttempts.push(attempt);
      }
    });
    
    // Sort pending by lifting_order
    pendingAttempts.sort((a, b) => (a.lifting_order || 999999) - (b.lifting_order || 999999));
    finishedAttempts.sort((a, b) => (a.lifting_order || 999999) - (b.lifting_order || 999999));
    
    const orderedAttempts = [...pendingAttempts, ...finishedAttempts];
    
    orderedAttempts.forEach((attempt, index) => {
      const isFinished = ['finished', 'success', 'failed'].includes(attempt.status?.toLowerCase() || '');
      const isInProgress = attempt.status?.toLowerCase() === 'in-progress';
      
      let statusClass = 'waiting';
      let statusText = 'Waiting';
      let bgColor = '#fff';
      let borderColor = '#4299e1';
      
      if (isInProgress) {
        statusClass = 'in-progress';
        statusText = 'In Progress';
        bgColor = '#f0fff4';
        borderColor = '#48bb78';
      } else if (isFinished) {
        statusClass = 'finished';
        statusText = 'Finished';
        bgColor = '#f7fafc';
        borderColor = '#a0aec0';
      }
      
      const item = document.createElement("div");
      item.className = `attempt-item attempt-${statusClass}`;
      item.dataset.attemptId = attempt.id;
      item.dataset.finished = isFinished ? "true" : "false";
      item.style.cssText = `
        display:flex; align-items:center; gap:1rem; padding:1rem; margin-bottom:.5rem;
        background:${bgColor}; border-left:4px solid ${borderColor}; border-radius:8px;
        ${!isFinished ? 'cursor:move;' : 'opacity:0.7;'}
      `;
      
      item.innerHTML = `
        <div style="font-weight:700; font-size:1.25rem; color:#2d3748; min-width:40px; text-align:center">${index + 1}</div>
        <div style="flex:1">
          <div style="font-weight:600; font-size:1rem; color:#2d3748">${attempt.athlete_name}</div>
          <div style="font-size:0.875rem; color:#718096">${attempt.requested_weight || 0} kg • Attempt ${attempt.attempt_number}</div>
        </div>
        <div style="padding:.25rem .75rem; background:#${statusClass === 'in-progress' ? '48bb78' : statusClass === 'finished' ? 'a0aec0' : '4299e1'}; color:white; border-radius:20px; font-size:0.875rem; font-weight:600">
          ${statusText}
        </div>
        ${!isFinished ? '<div style="color:#cbd5e0; font-size:1.5rem; cursor:move">⋮⋮</div>' : ''}
      `;
      
      attemptOrderList.appendChild(item);
    });
    
    // Initialize Sortable for drag-and-drop
    initializeSortable();
  }
  
  function applyAttemptFilters(attempts) {
    let filtered = attempts;
    
    // Filter by athlete name
    if (athleteNameFilter && athleteNameFilter.value.trim()) {
      const searchTerm = athleteNameFilter.value.trim().toLowerCase();
      filtered = filtered.filter(att => 
        att.athlete_name.toLowerCase().includes(searchTerm)
      );
    }
    
    // Filter by status
    if (attemptStatusFilter && attemptStatusFilter.value) {
      const statusFilter = attemptStatusFilter.value.toLowerCase();
      filtered = filtered.filter(att => 
        att.status?.toLowerCase() === statusFilter
      );
    }
    
    return filtered;
  }
  
  function initializeSortable() {
    if (!attemptOrderList) return;
    
    if (attemptsSortable) {
      attemptsSortable.destroy();
    }
    
    attemptsSortable = new Sortable(attemptOrderList, {
      animation: 150,
      filter: '.attempt-finished',
      ghostClass: 'sortable-ghost',
      onEnd: async (evt) => {
        if (evt.newIndex !== evt.oldIndex) {
          await updateAttemptOrder();
        }
      }
    });
  }
  
  async function updateAttemptOrder() {
    if (!lastFlightId) return;
    
    const items = attemptOrderList.querySelectorAll('.attempt-item');
    const updates = [];
    
    items.forEach((item, index) => {
      const attemptId = parseInt(item.dataset.attemptId);
      updates.push({ id: attemptId, lifting_order: index + 1 });
    });
    
    try {
      const response = await fetch(`/admin/flights/${lastFlightId}/attempts/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        },
        body: JSON.stringify({ updates })
      });
      
      if (!response.ok) throw new Error("Failed to update order");
      
      console.log("Attempt order updated successfully");
    } catch (error) {
      console.error("Error updating attempt order:", error);
      alert("Error updating attempt order: " + error.message);
    }
  }
  
  // Event Listeners
  if (athleteNameFilter) {
    athleteNameFilter.addEventListener("input", () => {
      displayAttemptOrder(allAttempts);
    });
  }
  
  if (attemptStatusFilter) {
    attemptStatusFilter.addEventListener("change", () => {
      displayAttemptOrder(allAttempts);
    });
  }
  
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (athleteNameFilter) athleteNameFilter.value = "";
      if (attemptStatusFilter) attemptStatusFilter.value = "";
      displayAttemptOrder(allAttempts);
    });
  }
  
  if (refreshAttemptsBtn) {
    refreshAttemptsBtn.addEventListener("click", () => {
      if (lastFlightId) loadAttemptOrder(lastFlightId);
    });
  }
  
  // Sort by Weight
  if (sortByWeightBtn) {
    sortByWeightBtn.addEventListener("click", async () => {
      await sortAttempts("weight");
    });
  }
  
  // Sort by Name
  if (sortByNameBtn) {
    sortByNameBtn.addEventListener("click", async () => {
      await sortAttempts("name");
    });
  }
  
  // Randomize Order
  if (randomizeOrderBtn) {
    randomizeOrderBtn.addEventListener("click", async () => {
      await sortAttempts("random");
    });
  }
  
  // Generate Test Attempts
  if (generateTestAttemptsBtn) {
    generateTestAttemptsBtn.addEventListener("click", async () => {
      await generateTestAttempts();
    });
  }
  
  // Mark First as Completed
  if (markFirstCompletedBtn) {
    markFirstCompletedBtn.addEventListener("click", async () => {
      await markFirstAttemptCompleted();
    });
  }
  
  // Sort attempts function
  async function sortAttempts(sortType) {
    if (!lastFlightId) {
      showNotification("No flight selected", "error");
      return;
    }
    
    const buttonMap = {
      'weight': sortByWeightBtn,
      'name': sortByNameBtn,
      'random': randomizeOrderBtn
    };
    
    const clickedButton = buttonMap[sortType];
    const originalText = clickedButton ? clickedButton.textContent : '';
    
    if (clickedButton) {
      clickedButton.textContent = 'Saving...';
      clickedButton.disabled = true;
    }
    
    try {
      const response = await fetch(`/admin/flights/${lastFlightId}/attempts/sort/${sortType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to sort attempts by ${sortType}`);
      }
      
      const result = await response.json();
      showNotification(result.message || `Attempts sorted by ${sortType} successfully`, "success");
      
      // Reload attempt order
      await loadAttemptOrder(lastFlightId);
      
    } catch (error) {
      console.error('Error sorting attempts:', error);
      showNotification(error.message || `Error sorting attempts by ${sortType}`, "error");
    } finally {
      if (clickedButton) {
        clickedButton.textContent = originalText;
        clickedButton.disabled = false;
      }
    }
  }
  
  // Generate test attempts
  async function generateTestAttempts() {
    if (!lastFlightId) {
      showNotification("No flight selected", "error");
      return;
    }
    
    const originalText = generateTestAttemptsBtn ? generateTestAttemptsBtn.textContent : '';
    
    if (generateTestAttemptsBtn) {
      generateTestAttemptsBtn.textContent = 'Generating...';
      generateTestAttemptsBtn.disabled = true;
    }
    
    try {
      const response = await fetch(`/admin/flights/${lastFlightId}/attempts/generate-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate test attempts');
      }
      
      const result = await response.json();
      showNotification(result.message || 'Test attempts generated successfully', "success");
      
      // Reload attempt order to show new attempts
      await loadAttemptOrder(lastFlightId);
      
    } catch (error) {
      console.error('Error generating test attempts:', error);
      showNotification(error.message || 'Error generating test attempts', "error");
    } finally {
      if (generateTestAttemptsBtn) {
        generateTestAttemptsBtn.textContent = originalText;
        generateTestAttemptsBtn.disabled = false;
      }
    }
  }
  
  // Mark first attempt as completed
  async function markFirstAttemptCompleted() {
    if (!lastFlightId) return;
    
    try {
      // Find the first pending attempt (not finished)
      const firstPendingAttempt = allAttempts.find(attempt => 
        !['finished', 'success', 'failed'].includes(attempt.status?.toLowerCase() || '')
      );
      
      if (!firstPendingAttempt) {
        showNotification('No pending attempts found to mark as completed.', 'warning');
        return;
      }
      
      const response = await fetch('/admin/update_attempt_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attempt_id: firstPendingAttempt.id,
          status: 'finished'
        })
      });
      
      if (response.ok) {
        // Reload the attempt order to show the updated queue
        await loadAttemptOrder(lastFlightId);
        showNotification(`Attempt by ${firstPendingAttempt.athlete_name} marked as completed.`, 'success');
      } else {
        const errorData = await response.json();
        showNotification(`Error: ${errorData.error}`, 'error');
      }
    } catch (error) {
      console.error('Error marking attempt as completed:', error);
      showNotification('Error marking attempt as completed', 'error');
    }
  }
  
  // Show notification helper
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    Object.assign(notification.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      padding: "1rem 1.5rem",
      borderRadius: "8px",
      color: "white",
      fontWeight: "600",
      zIndex: "10000",
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      animation: "slideIn 0.3s ease-out"
    });
    
    // Set background color based on type
    const colors = {
      success: "#48bb78",
      error: "#e53e3e",
      warning: "#d69e2e",
      info: "#4299e1"
    };
    notification.style.background = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-out";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // ============================================
  // Break Timer Feature (Event/Flight Breaks)
  // ============================================
  
  const breakTimerCard = document.getElementById("breakTimerCard");
  const breakTimerTitle = document.getElementById("breakTimerTitle");
  const breakTimerMessage = document.getElementById("breakTimerMessage");
  const breakTimerClock = document.getElementById("breakTimerClock");
  const breakTimerSubtext = document.getElementById("breakTimerSubtext");
  const btnBreakStart = document.getElementById("btnBreakStart");
  const btnBreakPause = document.getElementById("btnBreakPause");
  const btnBreakReset = document.getElementById("btnBreakReset");
  const btnBreakDismiss = document.getElementById("btnBreakDismiss");
  
  let breakTimerInterval = null;
  let breakTimerSeconds = 0;
  let breakTimerRunning = false;
  let currentCompetitionData = null;
  
  // Listen for attempt status updates to detect when to start break timers
  if (typeof window.updateAttemptStatus !== 'undefined') {
    const originalUpdateAttemptStatus = window.updateAttemptStatus;
    window.updateAttemptStatus = async function(athleteId, attemptNumber, flightId, status) {
      const result = await originalUpdateAttemptStatus(athleteId, attemptNumber, flightId, status);
      
      // Check if this was marking an attempt as finished
      if (status === 'finished') {
        await checkForBreakTrigger(flightId);
      }
      
      return result;
    };
  }
  
  async function checkForBreakTrigger(flightId) {
    try {
      // Get all attempts for this flight
      const attemptsResponse = await fetch(`/admin/flights/${flightId}/attempts/order`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      
      if (!attemptsResponse.ok) return;
      
      const attemptsData = await attemptsResponse.json();
      const attempts = attemptsData.attempts || [];
      
      // Check if all attempts in the flight are finished
      const allFinished = attempts.every(att => 
        ['finished', 'success', 'failed'].includes(att.status?.toLowerCase() || '')
      );
      
      if (!allFinished) return; // Not all attempts finished yet
      
      // Get flight and event information
      const flightResponse = await fetch(`/admin/flights/${flightId}/athletes`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      
      if (!flightResponse.ok) return;
      
      const flightData = await flightResponse.json();
      const flight = flightData.flight;
      const eventId = flight.event_id;
      const competitionId = flight.competition_id;
      
      // Get competition data for break times
      const compResponse = await fetch(`/admin/api/competitions/${competitionId}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      
      if (!compResponse.ok) return;
      
      currentCompetitionData = await compResponse.json();
      
      // Get all flights for this event to check if it's the last flight
      const eventsResponse = await fetch(`/admin/events/${eventId}/flights`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      
      if (!eventsResponse.ok) {
        // Trigger flight break if we can't determine event status
        triggerFlightBreak();
        return;
      }
      
      const flights = await eventsResponse.json();
      const sortedFlights = flights.sort((a, b) => (a.order || 0) - (b.order || 0));
      const lastFlightInEvent = sortedFlights[sortedFlights.length - 1];
      
      if (lastFlightInEvent && lastFlightInEvent.id === flightId) {
        // This is the last flight in the event - trigger EVENT break
        triggerEventBreak();
      } else {
        // Not the last flight - trigger FLIGHT break
        triggerFlightBreak();
      }
      
    } catch (error) {
      console.error('Error checking for break trigger:', error);
    }
  }
  
  function triggerFlightBreak() {
    const breakSeconds = currentCompetitionData?.breaktime_between_flights || 180;
    startBreakTimer('Flight Break', 'Flight has finished. Break time before next flight.', breakSeconds);
  }
  
  function triggerEventBreak() {
    const breakSeconds = currentCompetitionData?.breaktime_between_events || 300;
    startBreakTimer('Event Break', 'Event has finished. Break time before next event.', breakSeconds);
  }
  
  function startBreakTimer(title, message, seconds) {
    breakTimerTitle.textContent = title;
    breakTimerMessage.textContent = message;
    breakTimerSeconds = seconds;
    breakTimerSubtext.textContent = `Break duration: ${formatTime(seconds)}`;
    updateBreakTimerDisplay();
    
    // Show the break timer card
    if (breakTimerCard) {
      breakTimerCard.style.display = 'block';
      breakTimerCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Auto-start the timer
    startBreakCountdown();
  }
  
  function startBreakCountdown() {
    if (breakTimerRunning) return;
    
    breakTimerRunning = true;
    btnBreakStart.disabled = true;
    btnBreakPause.disabled = false;
    
    breakTimerInterval = setInterval(() => {
      if (breakTimerSeconds > 0) {
        breakTimerSeconds--;
        updateBreakTimerDisplay();
      } else {
        // Timer finished
        stopBreakCountdown();
        breakTimerClock.style.color = '#48bb78';
        breakTimerMessage.textContent = '✓ Break time is over!';
        showNotification('Break time has ended!', 'success');
      }
    }, 1000);
  }
  
  function pauseBreakCountdown() {
    if (!breakTimerRunning) return;
    
    breakTimerRunning = false;
    clearInterval(breakTimerInterval);
    breakTimerInterval = null;
    btnBreakStart.disabled = false;
    btnBreakPause.disabled = true;
  }
  
  function stopBreakCountdown() {
    breakTimerRunning = false;
    if (breakTimerInterval) {
      clearInterval(breakTimerInterval);
      breakTimerInterval = null;
    }
    btnBreakStart.disabled = true;
    btnBreakPause.disabled = true;
  }
  
  function resetBreakTimer() {
    stopBreakCountdown();
    const originalSeconds = currentCompetitionData?.breaktime_between_flights || 180;
    breakTimerSeconds = originalSeconds;
    breakTimerClock.style.color = '#2d3748';
    updateBreakTimerDisplay();
    btnBreakStart.disabled = false;
    btnBreakPause.disabled = true;
  }
  
  function dismissBreakTimer() {
    stopBreakCountdown();
    if (breakTimerCard) {
      breakTimerCard.style.display = 'none';
    }
  }
  
  function updateBreakTimerDisplay() {
    if (breakTimerClock) {
      breakTimerClock.textContent = formatTime(breakTimerSeconds);
    }
  }
  
  function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  // Load competition data and show break timer controls
  async function loadCompetitionBreakTimerData(competitionId) {
    if (!competitionId) return;
    
    try {
      const response = await fetch(`/admin/api/competitions/${competitionId}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      
      if (!response.ok) {
        console.warn('Failed to load competition data for break timers');
        return;
      }
      
      currentCompetitionData = await response.json();
      
      // Show the break timer card with controls visible (but don't start timer yet)
      if (breakTimerCard) {
        breakTimerCard.style.display = 'block';
        breakTimerTitle.textContent = 'Flight/Event Break Timer';
        breakTimerMessage.textContent = 'Break timer controls are ready. Timer will auto-start when a flight or event finishes.';
        
        // Set default times based on competition settings
        const flightBreakTime = currentCompetitionData?.breaktime_between_flights || 180;
        const eventBreakTime = currentCompetitionData?.breaktime_between_events || 300;
        
        breakTimerSubtext.innerHTML = `
          <div>Flight break: ${formatTime(flightBreakTime)}</div>
          <div>Event break: ${formatTime(eventBreakTime)}</div>
        `;
        
        // Initialize display with flight break time as default
        breakTimerSeconds = flightBreakTime;
        updateBreakTimerDisplay();
        
        // Enable manual start button
        btnBreakStart.disabled = false;
        btnBreakPause.disabled = true;
      }
      
    } catch (error) {
      console.error('Error loading competition break timer data:', error);
    }
  }
  
  // Break timer button event listeners
  const btnBreakEdit = document.getElementById("btnBreakEdit");
  const breakTimerEditRow = document.getElementById("breakTimerEditRow");
  const breakTimerHMS = document.getElementById("breakTimerHMS");
  const btnBreakApply = document.getElementById("btnBreakApply");
  
  if (btnBreakStart) {
    btnBreakStart.addEventListener('click', startBreakCountdown);
  }
  
  if (btnBreakPause) {
    btnBreakPause.addEventListener('click', pauseBreakCountdown);
  }
  
  if (btnBreakReset) {
    btnBreakReset.addEventListener('click', resetBreakTimer);
  }
  
  if (btnBreakDismiss) {
    btnBreakDismiss.addEventListener('click', dismissBreakTimer);
  }
  
  // Edit button to show/hide time setter
  if (btnBreakEdit && breakTimerEditRow) {
    btnBreakEdit.addEventListener('click', () => {
      const isVisible = breakTimerEditRow.style.display !== 'none';
      breakTimerEditRow.style.display = isVisible ? 'none' : 'block';
      btnBreakEdit.textContent = isVisible ? '✎ Edit' : '✕ Cancel';
      
      // Pre-fill with current timer value when opening
      if (!isVisible) {
        breakTimerHMS.value = formatTime(breakTimerSeconds);
      }
    });
  }
  
  // Apply button to set new time
  if (btnBreakApply && breakTimerHMS) {
    btnBreakApply.addEventListener('click', () => {
      const val = breakTimerHMS.value.trim();
      if (!val) return;
      
      const parts = val.split(":").map(s => parseInt(s, 10) || 0);
      let totalSec = 0;
      if (parts.length === 3) {
        totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) {
        totalSec = parts[0] * 60 + parts[1];
      } else if (parts.length === 1) {
        totalSec = parts[0];
      }
      
      if (totalSec < 0) totalSec = 0;
      
      // Update the break timer
      const wasRunning = breakTimerRunning;
      breakTimerSeconds = totalSec;
      updateBreakTimerDisplay();
      
      // Update the subtext to show the custom time that was set
      if (breakTimerSubtext) {
        breakTimerSubtext.innerHTML = `<div>Custom break time: ${formatTime(totalSec)}</div>`;
      }
      
      // If timer was running, restart it
      if (wasRunning) {
        pauseBreakCountdown();
        startBreakCountdown();
      }
      
      // Hide the setter
      breakTimerEditRow.style.display = 'none';
      btnBreakEdit.textContent = '✎ Edit';
    });
  }

})();
