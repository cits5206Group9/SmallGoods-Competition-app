/* timekeeper.js — real API + searchable log + DB persistence */
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
  const now = () => performance.now();
  const $ = (id) => document.getElementById(id);

  // Keep a full in-memory log so we can filter without losing rows
  const MASTER_LOG = [];
  let LOG_FILTER = ""; // lowercase athlete filter

  function beep(ms = 150, freq = 880) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + ms / 1000);
      osc.onended = () => ctx.close();
    } catch {}
  }

  // ---------- Global page context ----------
  const getQueryParam = (k) => new URLSearchParams(location.search).get(k);
  let CURRENT_FLIGHT_ID = parseInt(getQueryParam("flight_id") || "", 10);
  if (Number.isNaN(CURRENT_FLIGHT_ID)) CURRENT_FLIGHT_ID = null;

  // Also keep numeric IDs for comp & event (set by selector)
  window.CURRENT_COMPETITION_ID = null;
  window.CURRENT_EVENT_ID = null;

  // names captured when a flight is selected (used by log rows)
  const CURRENT_CTX = { competition: "", event: "", flight: "" };

  // exposed so the selector can set context + flight id
  window.TK_updateContext = function ({ competition, event, flight, flightId } = {}) {
    if (typeof competition === "string") CURRENT_CTX.competition = competition;
    if (typeof event === "string")       CURRENT_CTX.event       = event;
    if (typeof flight === "string")      CURRENT_CTX.flight      = flight;
    if (flightId != null)                CURRENT_FLIGHT_ID       = Number(flightId);
  };

  // Small helper to read athlete name when logging
  function getAthleteName() {
    const el = $("athleteName");
    return el ? el.value.trim() : "";
  }

  // ---------- Timer ----------
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
  function normalizeLogEntry({
    start, stop, action, duration,
    competition, event, flight, athlete,
    start_iso, stop_iso, duration_sec
  }) {
    // defaults from CURRENT_CTX + athlete field
    competition = competition ?? CURRENT_CTX.competition ?? "";
    event       = event       ?? CURRENT_CTX.event       ?? "";
    flight      = flight      ?? CURRENT_CTX.flight      ?? "";
    athlete     = athlete     ?? getAthleteName()        ?? "";
    return {
      start: start || "",
      stop: stop || "",
      action: action || "",
      duration: duration || "",
      competition, event, flight, athlete,
      start_iso: start_iso || null,
      stop_iso:  stop_iso  || null,
      duration_sec: typeof duration_sec === "number" ? duration_sec : null
    };
  }

  // Renders the table from MASTER_LOG and current LOG_FILTER
  function renderLogTable() {
    const tbody = document.querySelector("#logTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Pick rows: filtered (all that match) OR last 10 when no filter
    const rows = LOG_FILTER
      ? MASTER_LOG.filter(r => (r.athlete || "").toLowerCase().includes(LOG_FILTER))
      : MASTER_LOG.slice(-10);

    // Show newest first
    rows.slice().reverse().forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${r.start}</td>` +
        `<td>${r.stop}</td>` +
        `<td>${r.competition}</td>` +
        `<td>${r.event}</td>` +
        `<td>${r.flight}</td>` +
        `<td>${r.athlete}</td>` +
        `<td>${r.action}</td>` +
        `<td>${r.duration}</td>`;
      tbody.appendChild(tr);
    });
  }

  // Public entry point used everywhere you were calling addLogRow before
  function addLogRow(entry) {
    const r = normalizeLogEntry(entry);
    MASTER_LOG.push(r);
    renderLogTable();

    // Persist to DB (best-effort; ignore failures in UI)
    try {
      const payload = {
        competition_id: window.CURRENT_COMPETITION_ID ?? null,
        event_id:       window.CURRENT_EVENT_ID ?? null,
        flight_id:      window.CURRENT_FLIGHT_ID ?? null,
        athlete:        r.athlete || "",
        action:         r.action || "Attempt",
        start_iso:      r.start_iso,
        stop_iso:       r.stop_iso,
        duration_sec:   r.duration_sec,
        meta: { source: "timekeeper-ui" }
      };
      fetch("/admin/timer/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin"
      });
    } catch {}
  }
  const nowStr = () => new Date().toLocaleTimeString();

  // ---------- Attempt Timer ----------
  const attemptClock = new Timer({
    displayEl: $("attemptClock"),
    mode: "countup",
    formatter: fmtHMS,
  });
  attemptClock.set(0);

  let attemptSessionStartTime = null;          // Date object
  let attemptSessionStartRemOrElapsed = null;  // seconds snapshot

  const bindClick = (sel, handler) =>
    document.querySelectorAll(`#${CSS.escape(sel)}`).forEach((n) => (n.onclick = handler));

  bindClick("btnStart", () => {
    attemptClock.start();
    if (!attemptSessionStartTime) {
      attemptSessionStartTime = new Date();
      attemptSessionStartRemOrElapsed = attemptClock.currentSeconds();
    }
  });
  bindClick("btnPause",  () => { attemptClock.pause();  });
  bindClick("btnResume", () => { attemptClock.resume(); });
  bindClick("btnReset", () => {
    attemptClock.reset();
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  });
  bindClick("btnBarLeft", () => {
    attemptClock.pause();
    if (attemptSessionStartTime) {
      const startTs = attemptSessionStartTime;
      const stopTs  = new Date();
      const nowSecs = attemptClock.currentSeconds();
      let durationSec;
      if (attemptClock.mode === "countup") durationSec = Math.max(0, nowSecs);
      else durationSec = Math.max(0, attemptSessionStartRemOrElapsed - nowSecs);
      addLogRow({
        start: startTs.toLocaleTimeString(),
        stop:  stopTs.toLocaleTimeString(),
        start_iso: startTs.toISOString(),
        stop_iso:  stopTs.toISOString(),
        duration_sec: Math.round(durationSec),
        action: "Attempt",
        duration: fmtDurationStr(durationSec),
      });
    }
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  });

  // ---------- Attempt: 1-min countdown toggle ----------
  const btnAttemptToggle = $("btnAttemptToggle");
  let countdownOn = false;
  function updateToggleLabel() {
    if (!btnAttemptToggle) return;
    btnAttemptToggle.textContent = countdownOn
      ? "Disable 1-min Countdown"
      : "Enable 1-min Countdown";
  }
  if (btnAttemptToggle) {
    btnAttemptToggle.onclick = () => {
      countdownOn = !countdownOn;
      if (countdownOn) { attemptClock.mode = "countdown"; attemptClock.set(60); }
      else { attemptClock.mode = "countup"; attemptClock.set(0); }
      attemptSessionStartTime = null;
      attemptSessionStartRemOrElapsed = null;
      updateToggleLabel();
    };
    updateToggleLabel();
  }

  // ---------- Break Timer ----------
  const breakClock = new Timer({
    displayEl: $("breakClock"),
    mode: "countdown",
    formatter: fmtHMS,
    onExpire: () => {
      addLogRow({
        start: nowStr(),
        start_iso: new Date().toISOString(),
        action: "Break",
        duration: "Expired"
      });
      beep(400, 520);
    },
  });
  breakClock.set(window.TK_DEFAULT_BREAK || 600);

  const breakHMSInput = $("breakHMS");
  if (breakHMSInput) breakHMSInput.value = fmtHMS(window.TK_DEFAULT_BREAK || 600);

  const btnBreakApply = $("btnBreakApply");
  if (btnBreakApply && breakHMSInput) {
    btnBreakApply.onclick = () => {
      const val = breakHMSInput.value;
      const parts = val.trim().split(":").map(Number);
      let secs = NaN;
      if (parts.length === 3) secs = parts[0]*3600+parts[1]*60+parts[2];
      else if (parts.length === 2) secs = parts[0]*60+parts[1];
      else if (parts.length === 1) secs = parts[0];
      if (!Number.isNaN(secs)) {
        breakClock.set(secs);
        addLogRow({
          start: nowStr(),
          start_iso: new Date().toISOString(),
          action: "Break",
          duration: `Set ${fmtDurationStr(secs)}`
        });
      } else {
        btnBreakApply.classList.add("invalid");
        setTimeout(() => btnBreakApply.classList.remove("invalid"), 300);
      }
    };
  }
  bindClick("btnBreakStart",  () => {
    breakClock.start();
    addLogRow({ start: nowStr(), start_iso: new Date().toISOString(), action: "Break", duration: "Start" });
  });
  bindClick("btnBreakPause",  () => {
    breakClock.pause();
    addLogRow({ start: nowStr(), start_iso: new Date().toISOString(), action: "Break", duration: "Pause" });
  });
  bindClick("btnBreakResume", () => {
    breakClock.resume();
    addLogRow({ start: nowStr(), start_iso: new Date().toISOString(), action: "Break", duration: "Resume" });
  });
  bindClick("btnBreakReset",  () => {
    breakClock.reset();
    addLogRow({ start: nowStr(), start_iso: new Date().toISOString(), action: "Break", duration: "Reset" });
  });

  // ---------- Keyboard Shortcuts ----------
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space") {
      if (!attemptClock.running) $("btnStart")?.click();
      else $("btnPause")?.click();
      e.preventDefault();
    } else if (e.key === "b" || e.key === "B") {
      $("btnBreakStart")?.click();
    }
  });

  // ---- Log search wiring (searches by athlete column) ----
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

  // Clear log when scoping to a specific flight (URL param present)
  (function bootstrapFlightScope() {
    if (CURRENT_FLIGHT_ID) {
      const tbody = document.querySelector("#logTable tbody");
      if (tbody) tbody.innerHTML = "";
    }
  })();
})();


// ---- Timekeeper: Competition/Event/Flight selector (+ athlete editor) ----
(function TKSelector() {
  const selComp   = document.getElementById('selComp');
  const selEvent  = document.getElementById('selEvent');
  const selFlight = document.getElementById('selFlight');
  const btnGo     = document.getElementById('selGo');

  const card    = document.getElementById('tk-available-card');
  const body    = document.getElementById('tk-competitions-body');
  const summary = document.getElementById('tk-selected-summary');
  const emptyMsg= document.getElementById('tk-competitions-empty');

  // Athlete editor hooks
  const athleteEditor  = document.getElementById('tk-athlete-editor');
  const athleteInput   = document.getElementById('athleteName');
  const btnAthlete     = document.getElementById('btnAthleteApply');
  const athleteApplied = document.getElementById('athleteApplied');
  const ATHLETE_KEY    = 'TK_ATHLETE_NAME';

  if (!selComp || !selEvent || !selFlight || !btnGo || !card || !body) return;

  const opt     = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
  const clear   = (el) => { el.innerHTML = ''; };
  const disable = (el, yes) => { el.disabled = !!yes; };

  async function getCompetitions() { return (await fetch('/admin/competitions')).json(); }
  async function getEvents(compId)  { return (await fetch(`/admin/competitions/${compId}/events`)).json(); }
  async function getFlights(eventId){ return (await fetch(`/admin/events/${eventId}/flights`)).json(); }

  function updateAthleteApplied() {
    if (!athleteApplied) return;
    const name = athleteInput ? athleteInput.value.trim() : '';
    athleteApplied.textContent = name ? `Applied: ${name}` : '';
  }
  function showAthleteEditor() {
    if (!athleteEditor) return;
    athleteEditor.style.display = 'block';
    if (athleteInput && !athleteInput.value) {
      const saved = localStorage.getItem(ATHLETE_KEY) || '';
      athleteInput.value = saved;
    }
    updateAthleteApplied();
  }
  if (btnAthlete && athleteInput && athleteApplied) {
    btnAthlete.addEventListener('click', () => {
      const name = athleteInput.value.trim();
      localStorage.setItem(ATHLETE_KEY, name);
      athleteApplied.textContent = name ? `Applied: ${name}` : '';
    });
  }

  function renderSelected({ comp, evt, flight }) {
    card.style.display = 'block';
    if (emptyMsg) emptyMsg.style.display = 'none';

    if (summary) {
      summary.style.display = 'block';
      summary.innerHTML = `
        <div class="selected-row"><strong>Competition:</strong> ${comp.name}</div>
        <div class="selected-row"><strong>Event:</strong> ${evt.name}</div>
        <div class="selected-row"><strong>Flight:</strong> ${flight.name}${flight.is_active === false ? ' <span class="text-muted">(inactive)</span>' : ''}</div>
      `;
    }

    // keep context for log rows (names)
    window.TK_updateContext({
      competition: comp.name,
      event: evt.name,
      flight: flight.name,
      flightId: flight.id
    });

    // also keep numeric IDs for persistence
    window.CURRENT_COMPETITION_ID = Number(comp.id) || null;
    window.CURRENT_EVENT_ID       = Number(evt.id)  || null;
    window.CURRENT_FLIGHT_ID      = Number(flight.id) || window.CURRENT_FLIGHT_ID;

    // reveal & initialize the athlete editor
    if (athleteEditor) {
      athleteEditor.style.display = 'block';
      if (athleteInput && !athleteInput.value) {
        athleteInput.value = localStorage.getItem(ATHLETE_KEY) || '';
      }
      if (athleteApplied) {
        const name = athleteInput ? athleteInput.value.trim() : '';
        athleteApplied.textContent = name ? `Applied: ${name}` : '';
      }
    }
  }

  async function init() {
    clear(selComp); clear(selEvent); clear(selFlight);
    selComp.append(opt('', 'Select competition…'));
    selEvent.append(opt('', 'Select event…'));
    selFlight.append(opt('', 'Select flight…'));
    disable(selEvent, true); disable(selFlight, true); disable(btnGo, true);

    const comps = await getCompetitions();
    comps.forEach(c => selComp.append(opt(c.id, c.name)));
  }

  async function onCompChange() {
    const compId = selComp.value;
    clear(selEvent); clear(selFlight);
    selEvent.append(opt('', 'Select event…'));
    selFlight.append(opt('', 'Select flight…'));
    disable(btnGo, true);
    card.style.display = 'none';

    if (!compId) { disable(selEvent, true); disable(selFlight, true); return; }

    const events = await getEvents(compId);
    events.forEach(e => selEvent.append(opt(e.id, e.name)));
    disable(selEvent, false);
    disable(selFlight, true);
  }

  async function onEventChange() {
    const eventId = selEvent.value;
    clear(selFlight);
    selFlight.append(opt('', 'Select flight…'));
    disable(btnGo, true);
    card.style.display = 'none';

    if (!eventId) { disable(selFlight, true); return; }

    const flights = await getFlights(eventId);
    flights.forEach(f => selFlight.append(opt(f.id, f.name + (f.is_active === false ? ' (inactive)' : ''))));
    disable(selFlight, false);
  }

  function onFlightChange() {
    disable(btnGo, !selFlight.value);
  }

  function onGo() {
    const flightId = selFlight.value;
    if (!flightId) return;

    // Use names directly from the selects (real API path)
    renderSelected({
      comp:   { id: selComp.value,  name: selComp.options[selComp.selectedIndex].textContent },
      evt:    { id: selEvent.value, name: selEvent.options[selEvent.selectedIndex].textContent },
      flight: { id: selFlight.value, name: selFlight.options[selFlight.selectedIndex].textContent, is_active: true }
    });

    // Keep URL param for compatibility with other JS, but avoid page reload
    const url = new URL(location.href);
    url.searchParams.set('flight_id', flightId);
    history.replaceState(null, '', url.toString());
  }

  selComp.addEventListener('change', onCompChange);
  selEvent.addEventListener('change', onEventChange);
  selFlight.addEventListener('change', onFlightChange);
  btnGo.addEventListener('click', onGo);

  init();
})();
