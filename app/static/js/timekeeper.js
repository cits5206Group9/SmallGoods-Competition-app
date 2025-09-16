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

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const bindClickAll = (id, handler) =>
    document.querySelectorAll(`#${CSS.escape(id)}`).forEach((n) => (n.onclick = handler));

  // 4-column log row (Start, Stop, Action, Duration)
  function addLogRow({ start, stop, action, duration }) {
    const tbody = document.querySelector("#logTable tbody");
    if (!tbody) return;

    // rolling: only show up to 10 rows
    if (tbody.children.length >= 10) {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    }

    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td>${start || ""}</td>` +
      `<td>${stop || ""}</td>` +
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
  let attemptSessionStartTime = null;          // Date when Start was first pressed
  let attemptSessionStartRemOrElapsed = null;  // seconds baseline at Start

  // START: open a session if none exists (no log yet)
  bindClickAll("btnStart", () => {
    attemptClock.start();
    if (!attemptSessionStartTime) {
      attemptSessionStartTime = new Date();
      attemptSessionStartRemOrElapsed = attemptClock.currentSeconds();
    }
  });

  // PAUSE / RESUME: ignore in Attempt log
  bindClickAll("btnPause",  () => { attemptClock.pause();  });
  bindClickAll("btnResume", () => { attemptClock.resume(); });

  // RESET: clear timer and abandon any open session without logging
  bindClickAll("btnReset", () => {
    attemptClock.reset();
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  });

  // STOP (square): close the session and log a single combined row
  bindClickAll("btnBarLeft", () => {
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
        duration: fmtDurationStr(durationSec)
      });
    }
    attemptSessionStartTime = null;
    attemptSessionStartRemOrElapsed = null;
  });

  // ---------- Attempt: 1-min countdown toggle (no logging) ----------
  const btnAttemptToggle = $("btnAttemptToggle");
  let countdownOn = false;
  function updateToggleLabel() {
    btnAttemptToggle.textContent = countdownOn
      ? "Disable 1-min Countdown"
      : "Enable 1-min Countdown";
  }
  if (btnAttemptToggle) {
    btnAttemptToggle.onclick = () => {
      countdownOn = !countdownOn;
      if (countdownOn) {
        attemptClock.mode = "countdown";
        attemptClock.set(60); // always 1 minute
      } else {
        attemptClock.mode = "countup";
        attemptClock.set(0);
      }
      // Clear any in-progress Attempt session when mode changes
      attemptSessionStartTime = null;
      attemptSessionStartRemOrElapsed = null;

      updateToggleLabel();
    };
    updateToggleLabel();
  }

  // ---------- Break Timer (unchanged logic; logs kept) ----------
  const breakClock = new Timer({
    displayEl: $("breakClock"),
    mode: "countdown",
    formatter: fmtHMS,
    onExpire: () => { addLogRow({ start: nowStr(), stop: "", action: "Break", duration: "Expired" }); beep(400, 520); },
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
        addLogRow({ start: nowStr(), stop: "", action: "Break", duration: `Set ${fmtDurationStr(secs)}` });
      } else {
        btnBreakApply.classList.add("invalid");
        setTimeout(() => btnBreakApply.classList.remove("invalid"), 300);
      }
    };
  }

  bindClickAll("btnBreakStart",  () => { breakClock.start();  addLogRow({ start: nowStr(), stop: "", action: "Break", duration: "Start"  }); });
  bindClickAll("btnBreakPause",  () => { breakClock.pause();  addLogRow({ start: nowStr(), stop: "", action: "Break", duration: "Pause"  }); });
  bindClickAll("btnBreakResume", () => { breakClock.resume(); addLogRow({ start: nowStr(), stop: "", action: "Break", duration: "Resume" }); });
  bindClickAll("btnBreakReset",  () => { breakClock.reset();  addLogRow({ start: nowStr(), stop: "", action: "Break", duration: "Reset"  }); });

  // ---------- Keyboard Shortcuts ----------
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space") {
      if (!attemptClock.running) document.querySelector("#btnStart")?.click();
      else document.querySelector("#btnPause")?.click();
      e.preventDefault();
    } else if (e.key === "b" || e.key === "B") {
      document.querySelector("#btnBreakStart")?.click();
    }
  });
})();
