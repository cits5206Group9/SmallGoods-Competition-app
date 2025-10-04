/* timekeeper.js — timer + selector + athlete dropdown + DB log + model-driven defaults */
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

  // show decimal seconds like the DB
  const fmtSecExact = (sec) => {
    if (typeof sec !== 'number' || !isFinite(sec)) return '';
    // 4 decimals is a good balance; bump to 6 if you want even more precision
    return `${sec.toFixed(3)} s`;
  };

  const now = () => performance.now();
  const $ = (id) => document.getElementById(id);

  // Master log so we can filter by athlete
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

  // names captured when a flight is selected (used by log rows)
  const CURRENT_CTX = { competition: "", event: "", flight: "" };

  // exposed so the selector can set context + flight id
  window.TK_updateContext = function ({ competition, event, flight, flightId } = {}) {
    if (typeof competition === "string") CURRENT_CTX.competition = competition;
    if (typeof event === "string")       CURRENT_CTX.event       = event;
    if (typeof flight === "string")      CURRENT_CTX.flight      = flight;
    if (flightId != null)                CURRENT_FLIGHT_ID       = Number(flightId);
  };

  // Prefer the dropdown for athlete name; fall back to hidden text input (compat)
  function getAthleteName() {
    const sel = document.getElementById('athleteSelect');
    if (sel && sel.value) return sel.options[sel.selectedIndex].text;
    const el = document.getElementById('athleteName'); // fallback (hidden)
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
  function normalizeLogEntry({ start, stop, action, duration, competition, event, flight, athlete, attempt_no }) {
    competition = competition ?? CURRENT_CTX.competition ?? "";
    event       = event       ?? CURRENT_CTX.event       ?? "";
    flight      = flight      ?? CURRENT_CTX.flight      ?? "";
    athlete     = athlete     ?? getAthleteName()        ?? "";
    attempt_no  = attempt_no  ?? (document.getElementById('attemptSelect')?.value || "");
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
        `<td>${r.attempt_no || ''}</td>` + 
        `<td>${r.action}</td>` +
        `<td>${r.duration}</td>`;
      tbody.appendChild(tr);
    });

    const count = document.getElementById("logSearchCount");
    if (count) {
      if (LOG_FILTER) count.textContent = `Showing ${rows.length} match(es)`;
      else count.textContent = "";
    }
  }

  function addLogRow(entry) {
    MASTER_LOG.push(normalizeLogEntry(entry));
    renderLogTable();
  }
  const nowStr = () => new Date().toLocaleTimeString();

  // ---------- Attempt Timer ----------
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
        action: "Attempt",
        duration: fmtSecExact(durationSec),
        attempt_no: document.getElementById('attemptSelect')?.value || ""
      });
      // Save to DB
      try {
        fetch("/admin/timer/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competition_id: getSelectedCompetitionId(),
            event_id:       getSelectedEventId(),
            flight_id:      CURRENT_FLIGHT_ID,
            athlete:        getAthleteName(),
            action:         "Attempt",
            start_iso:      startTs.toISOString(),
            stop_iso:       stopTs.toISOString(),
            duration_sec:   durationSec,
            // store extra info in meta (no schema change needed)
            meta: {
              attempt_no: document.getElementById('attemptSelect')?.value || null,
              athlete_id: localStorage.getItem('TK_ATHLETE_ID') || null
            }
          })

        }).catch(()=>{});
      } catch {}
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
    onExpire: () => { addLogRow({ start: nowStr(), action: "Break", duration: "Expired" }); beep(400, 520); },
  });
  breakClock.set(600);

  const breakHMSInput = $("breakHMS");
  if (breakHMSInput) breakHMSInput.value = fmtHMS(600);

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
        addLogRow({ start: nowStr(), action: "Break", duration: `Set ${fmtDurationStr(secs)}` });
      } else {
        btnBreakApply.classList.add("invalid");
        setTimeout(() => btnBreakApply.classList.remove("invalid"), 300);
      }
    };
  }

  // ---- Break timer server sync (local network endpoints)
  function getSelectedCompetitionId() {
    const selComp = document.getElementById('selComp');
    return selComp ? parseInt(selComp.value) : null;
  }

  function getSelectedEventId() {
    const selEvent = document.getElementById('selEvent');
    return selEvent && selEvent.value ? parseInt(selEvent.value) : null;
  }

  async function startServerBreakTimer(competitionId, duration) {
    try {
      const response = await fetch(`/athlete/timer/start-break/${competitionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: duration })
      });
      const result = await response.json();
      if (!result.success) console.error('Failed to start server break timer:', result.error);
    } catch (error) {
      console.error('Error starting server break timer:', error);
    }
  }

  async function controlServerTimer(competitionId, timerId, action, data = {}) {
    try {
      const response = await fetch(`/athlete/timer/control/${competitionId}/${timerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, ...data })
      });
      const result = await response.json();
      if (!result.success) console.error(`Failed to ${action} server timer:`, result.error);
    } catch (error) {
      console.error(`Error ${action} server timer:`, error);
    }
  }

  bindClick("btnBreakStart",  () => { 
    breakClock.start();  
    addLogRow({ start: nowStr(), action: "Break", duration: "Start"  });
    const compId = getSelectedCompetitionId();
    if (compId) startServerBreakTimer(compId, breakClock.baseSeconds);
  });
  bindClick("btnBreakPause",  () => { 
    breakClock.pause();  
    addLogRow({ start: nowStr(), action: "Break", duration: "Pause"  });
    const compId = getSelectedCompetitionId();
    if (compId) controlServerTimer(compId, 'break', 'pause');
  });
  bindClick("btnBreakResume", () => { 
    breakClock.resume(); 
    addLogRow({ start: nowStr(), action: "Break", duration: "Resume" }); 
    const compId = getSelectedCompetitionId();
    if (compId) controlServerTimer(compId, 'break', 'resume');
  });
  bindClick("btnBreakReset",  () => { 
    breakClock.reset();  
    addLogRow({ start: nowStr(), action: "Break", duration: "Reset"  }); 
    const compId = getSelectedCompetitionId();
    if (compId) controlServerTimer(compId, 'break', 'reset', { duration: breakClock.baseSeconds });
  });

  // ---- Apply timer defaults from server (based on selected comp/event/flight)
  window.TK_applyTimerDefaultsFromSelection = async function (compId, eventId, flightId) {
    try {
      const params = new URLSearchParams();
      if (compId)  params.set("comp_id",  String(compId));
      if (eventId) params.set("event_id", String(eventId));
      if (flightId) params.set("flight_id", String(flightId));

      const res = await fetch(`/admin/api/timer-defaults?${params.toString()}`);
      if (!res.ok) return;

      const j = await res.json();
      const a = j.attempt_seconds;
      const b = j.break_seconds;

      // Attempt timer
      if (typeof a === "number" && a > 0) {
        attemptClock.mode = "countdown";
        attemptClock.set(a);
        const attemptHMS = document.getElementById("attemptHMS");
        if (attemptHMS) attemptHMS.value = fmtHMS(a);
        countdownOn = true;
        updateToggleLabel();
      } else {
        attemptClock.mode = "countup";
        attemptClock.set(0);
        countdownOn = false;
        updateToggleLabel();
      }

      // Break timer
      if (typeof b === "number" && b >= 0) {
        breakClock.set(b);
        const breakHMSInput = document.getElementById("breakHMS");
        if (breakHMSInput) breakHMSInput.value = fmtHMS(b);
      }
    } catch (err) {
      console.warn("Failed to load timer defaults:", err);
    }
  };

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

  // Clear log when scoping to a specific flight (URL param present)
  (function bootstrapFlightScope() {
    if (CURRENT_FLIGHT_ID) {
      const tbody = document.querySelector("#logTable tbody");
      if (tbody) tbody.innerHTML = "";
    }
  })();

  // (Old flights tree renderer: no-op placeholder to keep previous behavior)
  async function loadFlightsTree() {
    try {
      const j = (u) => fetch(u, { headers: { "X-Requested-With":"fetch" } }).then(r => r.json());
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
      // no-op render
    } catch {}
  }
  loadFlightsTree();

  // ---- Log search wiring (searches by athlete column)
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
})();


// ---- Timekeeper: Competition/Event/Flight selector (+ athlete dropdown) ----
(function TKSelector() {
  const selComp   = document.getElementById('selComp');
  const selEvent  = document.getElementById('selEvent');
  const selFlight = document.getElementById('selFlight');
  const btnGo     = document.getElementById('selGo');

  const card = document.getElementById('tk-available-card');
  const body = document.getElementById('tk-competitions-body');
  const summary  = document.getElementById('tk-selected-summary');
  const emptyMsg = document.getElementById('tk-competitions-empty');

  // Athlete editor hooks
  const athleteEditor  = document.getElementById('tk-athlete-editor');
  const athleteInput   = document.getElementById('athleteName');     // hidden compat
  const btnAthlete     = document.getElementById('btnAthleteApply');
  const athleteApplied = document.getElementById('athleteApplied');
  const ATHLETE_KEY    = 'TK_ATHLETE_NAME';

  // NEW: dropdown + reload + id storage
  const athleteSelect      = document.getElementById('athleteSelect');
  const btnReloadAthletes  = document.getElementById('btnReloadAthletes');
  const ATHLETE_ID_KEY     = 'TK_ATHLETE_ID';

  const attemptSelect      = document.getElementById('attemptSelect');

  let lastFlightId = null;

  if (!selComp || !selEvent || !selFlight || !btnGo || !card || !body) return;

  const opt     = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; return o; };
  const clear   = (el) => { el.innerHTML = ''; };
  const disable = (el, yes) => { el.disabled = !!yes; };

  async function getCompetitions() { return (await fetch('/admin/competitions')).json(); }
  async function getEvents(compId)  { return (await fetch(`/admin/competitions/${compId}/events`)).json(); }
  async function getFlights(eventId){ return (await fetch(`/admin/events/${eventId}/flights`)).json(); }

  // --- NEW: API helpers to load athletes for a flight and populate the dropdown
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
        name: a.full_name || `${a.first_name || ''} ${a.last_name || ''}`.trim()
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
      const o = document.createElement('option');
      o.value = String(a.id);
      o.textContent = a.name;
      athleteSelect.appendChild(o);
    }

    athleteSelect.disabled = false;

    // restore previously applied selection if it exists
    const savedId = localStorage.getItem(ATHLETE_ID_KEY);
    const savedName = localStorage.getItem(ATHLETE_KEY);
    if (savedId && athleteSelect.querySelector(`option[value="${savedId}"]`)) {
      athleteSelect.value = savedId;
      if (athleteApplied) athleteApplied.textContent = savedName ? `Applied: ${savedName}` : '';
    }
  }

  function updateAthleteApplied() {
    if (!athleteApplied) return;
    let name = '';
    if (athleteSelect && athleteSelect.value) {
      name = athleteSelect.options[athleteSelect.selectedIndex].text;
    } else if (athleteInput) {
      name = athleteInput.value.trim();
    }
    athleteApplied.textContent = name ? `Applied: ${name}` : '';
  }

  if (btnAthlete) {
    btnAthlete.addEventListener('click', () => {
      let id = '', name = '';
      if (athleteSelect && athleteSelect.value) {
        id = athleteSelect.value;
        name = athleteSelect.options[athleteSelect.selectedIndex].text;
      } else if (athleteInput) {
        name = athleteInput.value.trim();
      }
      if (id) localStorage.setItem(ATHLETE_ID_KEY, id); else localStorage.removeItem(ATHLETE_ID_KEY);
      localStorage.setItem(ATHLETE_KEY, name);
      // reflect attempt number in the Applied label
      if (athleteApplied) {
        const at = attemptSelect && attemptSelect.value ? ` • Attempt ${attemptSelect.value}` : '';
        athleteApplied.textContent = name ? `Applied: ${name}${at}` : '';
      }
      
    });
  }

  if (btnReloadAthletes) {
    btnReloadAthletes.addEventListener('click', () => {
      const targetId = lastFlightId || selFlight.value;
      if (targetId) populateAthleteDropdown(targetId);
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

    // keep context for log rows and remember current flight id
    lastFlightId = flight.id;
    window.TK_updateContext({
      competition: comp.name,
      event: evt.name,
      flight: flight.name,
      flightId: flight.id
    });

    // Populate athlete dropdown for this flight
    if (athleteEditor) {
      populateAthleteDropdown(flight.id);
      athleteEditor.style.display = 'block';
    }

    // enable attempt dropdown and default to blank until athlete chosen
    if (attemptSelect) {
      attemptSelect.disabled = false;
      if (!attemptSelect.value) attemptSelect.value = "";
    }

    // (compat) keep hidden input in sync with saved name if no dropdown selection
    if (athleteInput && !athleteInput.value) {
      athleteInput.value = localStorage.getItem(ATHLETE_KEY) || '';
    }
    updateAthleteApplied();
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

    // Render selection (names + ids)
    renderSelected({
      comp:   { id: Number(selComp.value),  name: selComp.options[selComp.selectedIndex].textContent },
      evt:    { id: Number(selEvent.value), name: selEvent.options[selEvent.selectedIndex].textContent },
      flight: { id: Number(selFlight.value), name: selFlight.options[selFlight.selectedIndex].textContent, is_active: true }
    });

    // Fetch and apply attempt/break defaults from the server
    window.TK_applyTimerDefaultsFromSelection(
      Number(selComp.value),
      Number(selEvent.value),
      Number(selFlight.value)
    );

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
