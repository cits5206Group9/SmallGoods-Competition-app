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
  // Compact duration: 2h 5m 8s / 1m 30s / 6s
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

  // This will be filled automatically when the flights tree loads
  const CURRENT_CTX = {
    competition: "", // name
    event: "",       // name
    flight: "",      // name
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
      if (this.mode === "countup") {
        this.elapsed = 0;
      } else {
        this.remaining = s;
      }
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
      if (this.mode === "countup") {
        return Math.max(0, this.baseSeconds + this.elapsed + dt);
      } else {
        return Math.max(0, this.remaining - dt);
      }
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
      const val =
        this.mode === "countup"
          ? this.format(this.baseSeconds + this.elapsed)
          : this.format(this.remaining);
      this.displayEl.textContent = val;
    }
  }

  // ---------- Log table (8 columns) ----------
  function addLogRow({ start, stop, action, duration, competition, event, flight, athlete }) {
    const tbody = document.querySelector("#logTable tbody");
    if (!tbody) return;

    // rolling: max 10 rows, then clear (same behavior as before)
    if (tbody.children.length >= 10) {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    }

    // default context if not supplied
    competition = competition ?? CURRENT_CTX.competition ?? "";
    event       = event       ?? CURRENT_CTX.event       ?? "";
    flight      = flight      ?? CURRENT_CTX.flight      ?? "";
    athlete     = athlete     ?? getAthleteName()        ?? "";

    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${start || ""}</td>` +
      `<td>${stop || ""}</td>` +
      `<td>${competition}</td>` +
      `<td>${event}</td>` +
      `<td>${flight}</td>` +
      `<td>${athlete}</td>` +
      `<td>${action || ""}</td>` +
      `<td>${duration || ""}</td>`;
    tbody.prepend(tr);
  }
  const nowStr = () => new Date().toLocaleTimeString();

  // ---------- Attempt Timer ----------
  const attemptClock = new Timer({
    displayEl: $("attemptClock"),
    mode: "countup",
    formatter: fmtHMS,
  });
  attemptClock.set(0);

  // Track a single Attempt session: Start → Stop
  let attemptSessionStartTime = null;
  let attemptSessionStartRemOrElapsed = null;

  // START
  const bindClick = (sel, handler) =>
    document.querySelectorAll(`#${CSS.escape(sel)}`).forEach((n) => (n.onclick = handler));

  bindClick("btnStart", () => {
    attemptClock.start();
    if (!attemptSessionStartTime) {
      attemptSessionStartTime = new Date();
      attemptSessionStartRemOrElapsed = attemptClock.currentSeconds();
    }
  });

  // PAUSE / RESUME
  bindClick("btnPause",  () => { attemptClock.pause();  });
  bindClick("btnResume", () => { attemptClock.resume(); });

  // RESET
  bindClick("btnReset", () => {
    attemptClock.reset();
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  });

  // STOP (square): close the session and log a single combined row
  bindClick("btnBarLeft", () => {
    attemptClock.pause();
    if (attemptSessionStartTime) {
      const startTs = attemptSessionStartTime;
      const stopTs  = new Date();

      const nowSecs = attemptClock.currentSeconds();
      let durationSec;
      if (attemptClock.mode === "countup") {
        durationSec = Math.max(0, nowSecs); // elapsed
      } else {
        durationSec = Math.max(0, attemptSessionStartRemOrElapsed - nowSecs); // used in countdown
      }

      addLogRow({
        start: startTs.toLocaleTimeString(),
        stop:  stopTs.toLocaleTimeString(),
        action: "Attempt",
        duration: fmtDurationStr(durationSec),
      });
    }
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  });

  // ---------- Attempt: 1-min countdown toggle (no logging) ----------
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
      if (countdownOn) {
        attemptClock.mode = "countdown";
        attemptClock.set(60); // fixed 1:00
      } else {
        attemptClock.mode = "countup";
        attemptClock.set(0);
      }
      // clear any in-progress Attempt session when mode changes
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
      addLogRow({ start: nowStr(), action: "Break", duration: "Expired" });
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
        addLogRow({ start: nowStr(), action: "Break", duration: `Set ${fmtDurationStr(secs)}` });
      } else {
        btnBreakApply.classList.add("invalid");
        setTimeout(() => btnBreakApply.classList.remove("invalid"), 300);
      }
    };
  }

  bindClick("btnBreakStart",  () => { breakClock.start();  addLogRow({ start: nowStr(), action: "Break", duration: "Start"  }); });
  bindClick("btnBreakPause",  () => { breakClock.pause();  addLogRow({ start: nowStr(), action: "Break", duration: "Pause"  }); });
  bindClick("btnBreakResume", () => { breakClock.resume(); addLogRow({ start: nowStr(), action: "Break", duration: "Resume" }); });
  bindClick("btnBreakReset",  () => { breakClock.reset();  addLogRow({ start: nowStr(), action: "Break", duration: "Reset"  }); });

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

  // ============================================================================
  // Flights / Available Competitions integration
  // ============================================================================

  // Clear log when scoping to a specific flight
  (function bootstrapFlightScope() {
    if (CURRENT_FLIGHT_ID) {
      const tbody = document.querySelector("#logTable tbody");
      if (tbody) tbody.innerHTML = "";
    }
  })();

  function renderFlightsTree(tree) {
    const body = document.getElementById("tk-competitions-body");
    const empty = document.getElementById("tk-competitions-empty");
    if (!body) return;

    // Clear previous tree
    const old = body.querySelector(".tk-flight-tree");
    if (old) old.remove();

    // Any flights?
    const hasAny = tree.some(c => c.events.some(e => e.flights.length));
    if (empty) empty.style.display = hasAny ? "none" : "";

    if (!hasAny) return;

    const wrap = document.createElement("div");
    wrap.className = "tk-flight-tree";

    tree.forEach(comp => {
      const compEl = document.createElement("div");
      compEl.className = "tk-comp";
      compEl.innerHTML = `<h5 class="tk-comp__title">${comp.name}</h5>`;

      comp.events.forEach(evt => {
        if (!evt.flights.length) return;

        const evtEl = document.createElement("div");
        evtEl.className = "tk-evt";
        evtEl.innerHTML = `<div class="tk-evt__title">${evt.name}</div>`;

        const list = document.createElement("div");
        list.className = "tk-flight-list";

        evt.flights.forEach(f => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tk-flight" + (CURRENT_FLIGHT_ID === f.id ? " is-active" : "");
          btn.textContent = `${f.name}${f.is_active ? "" : " (inactive)"}`;

          // If this is the selected flight, capture names into CURRENT_CTX
          if (CURRENT_FLIGHT_ID === f.id) {
            CURRENT_CTX.competition = comp.name;
            CURRENT_CTX.event       = evt.name;
            CURRENT_CTX.flight      = f.name;
          }

          btn.onclick = () => {
            const url = new URL(location.href);
            url.searchParams.set("flight_id", String(f.id));
            location.href = url.toString();
          };
          list.appendChild(btn);
        });

        evtEl.appendChild(list);
        compEl.appendChild(evtEl);
      });

      wrap.appendChild(compEl);
    });

    body.appendChild(wrap);
  }

  async function loadFlightsTree() {
    try {
      // If you temporarily provided window.TK_MOCK_FLIGHTS in HTML, prefer it
      if (window.TK_MOCK_FLIGHTS) {
        renderFlightsTree(window.TK_MOCK_FLIGHTS);
        return;
      }

      const j = (u) => fetch(u, { headers: { "X-Requested-With":"fetch" } }).then(r => r.json());

      // competitions
      const comps = await j("/admin/competitions"); // [{id,name,...}]
      const tree = [];

      for (const c of comps) {
        // events for competition
        const events = await j(`/admin/competitions/${c.id}/events`); // [{id,name,...}]
        const evts = [];

        for (const e of events) {
          // flights for event
          const flights = await j(`/admin/events/${e.id}/flights`); // [{id,name,order,is_active,...}]
          evts.push({ id: e.id, name: e.name, flights });
        }

        tree.push({ id: c.id, name: c.name, events: evts });
      }

      renderFlightsTree(tree);
    } catch (err) {
      // Fail silent; empty state remains (offline-first friendly)
      // console.warn("Failed to load flights", err);
    }
  }

  // Kick off flights loading once the page is ready
  loadFlightsTree();

  
})();
