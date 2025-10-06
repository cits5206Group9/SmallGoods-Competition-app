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

  const CURRENT_CTX = { competition: "", event: "", flight: "" };
  window.TK_updateContext = function ({ competition, event, flight, flightId } = {}) {
    const prevCompetition = CURRENT_CTX.competition;
    if (typeof competition === "string") CURRENT_CTX.competition = competition;
    if (typeof event === "string") CURRENT_CTX.event = event;
    if (typeof flight === "string") CURRENT_CTX.flight = flight;
    if (flightId != null) CURRENT_FLIGHT_ID = Number(flightId);
    
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
      timestamp: Date.now()
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

    // set time row (no presets)
    const setRow = document.createElement("div");
    setRow.className = "pin-setrow";
    setRow.innerHTML = `
      <label class="pin-setlabel">Set Time:
        <input type="text" class="pin-hms" placeholder="HH:MM:SS">
      </label>
      <button class="pin-btn pin-apply" type="button">Apply</button>
    `;

    // actions
    const actions = document.createElement("div");
    actions.className = "pin-actions";

    const btnStart = document.createElement("button");
    btnStart.className = "pin-btn";
    btnStart.textContent = "Start Rest";

    const btnPause = document.createElement("button");
    btnPause.className = "pin-btn";
    btnPause.textContent = "Pause";

    const btnReset = document.createElement("button");
    btnReset.className = "pin-btn";
    btnReset.textContent = "Reset";

    actions.append(btnStart, btnPause, btnReset);

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
        saveTimerState();
      } else {
        btnApply.classList.add("invalid");
        setTimeout(() => btnApply.classList.remove("invalid"), 300);
      }
    };

    pin.elements = { card, timeEl, btnStart, btnPause, btnReset, sub, inputHMS, btnApply };
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
  bindClick("btnBarLeft", () => {
    attemptClock.pause();
    if (attemptSessionStartTime) {
      const startTs = attemptSessionStartTime;
      const stopTs = new Date();
      const nowSecs = attemptClock.currentSeconds();
      let durationSec;
      if (attemptClock.mode === "countup") durationSec = Math.max(0, nowSecs);
      else durationSec = Math.max(0, attemptSessionStartRemOrElapsed - nowSecs);

      const attemptNo = document.getElementById("attemptSelect")?.value || "";

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
        athleteId: localStorage.getItem("TK_ATHLETE_ID") || null
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
  let countdownOn = false;
  function setAttemptMode(countdownSeconds) {
    if (typeof countdownSeconds === "number" && countdownSeconds > 0) {
      countdownOn = true;
      attemptClock.mode = "countdown";
      attemptClock.set(countdownSeconds);
      if (btnAttemptToggle) btnAttemptToggle.textContent = "Disable 1-min Countdown";
    } else {
      countdownOn = false;
      attemptClock.mode = "countup";
      attemptClock.set(0);
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
    btnAthlete.addEventListener("click", () => {
      let id = "", name = "";
      if (athleteSelect && athleteSelect.value) {
        id = athleteSelect.value;
        name = athleteSelect.options[athleteSelect.selectedIndex].text;
      } else if (athleteInput) {
        name = athleteInput.value.trim();
      }
      if (id) localStorage.setItem(ATHLETE_ID_KEY, id); else localStorage.removeItem(ATHLETE_ID_KEY);
      localStorage.setItem(ATHLETE_KEY, name);
      updateAthleteApplied();
    });
  }

  if (btnReloadAthletes) {
    btnReloadAthletes.addEventListener("click", () => {
      const targetId = lastFlightId || selFlight.value;
      if (targetId) populateAthleteDropdown(targetId);
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
})();
