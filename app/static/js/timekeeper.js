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
  const now = () => performance.now();

  // Tiny beep (no external files)
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

  // ---------- Timer (countup & countdown) ----------
  class Timer {
    constructor({ displayEl, mode = "countdown", onExpire, formatter }) {
      this.displayEl = displayEl;
      this.mode = mode; // "countup" | "countdown"
      this.onExpire = onExpire || (() => {});
      this.format = formatter || fmtHMS;

      this.baseSeconds = 0;
      this.elapsed = 0;   // for countup
      this.remaining = 0; // for countdown
      this.running = false;
      this._t0 = 0;
      this._raf = null;
      this.render();
    }
    set(seconds) {
      const s = Math.max(0, seconds | 0);
      if (this.mode === "countup") {
        this.baseSeconds = s;
        this.elapsed = 0;
      } else {
        this.baseSeconds = s;
        this.remaining = s;
      }
      this.running = false;
      this._stop();
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
    _tick() {
      this._raf = requestAnimationFrame(() => {
        const dt = (now() - this._t0) / 1000;
        if (this.mode === "countup") {
          const value = this.baseSeconds + this.elapsed + dt;
          this.displayEl.textContent = this.format(value);
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
  const bindClickAll = (id, handler) => {
    // Bind handler to ALL elements with same id (handles hidden duplicates)
    document.querySelectorAll(`#${CSS.escape(id)}`).forEach((node) => {
      node.onclick = handler;
    });
  };

  function addLog(action, detail) {
    const table = document.getElementById("logTable");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    // If the current batch already has 10 rows, clear it for the next batch
    if (tbody.children.length >= 10) {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    }

    // Prepend the newest row
    const tr = document.createElement("tr");
    const t = new Date().toLocaleTimeString();
    tr.innerHTML = `<td>${t}</td><td>${action}</td><td>${detail || ""}</td>`;
    tbody.prepend(tr);
  }


  // ---------- Timers ----------
  // Main attempt: stopwatch from 00:00:00
  const attemptClock = new Timer({
    displayEl: $("attemptClock"),
    mode: "countup",
    formatter: fmtHMS,
  });
  attemptClock.set(0);

  // Break/Block: countdown from 10 minutes → 00:00:00 (HH:MM:SS)
  const breakClock = new Timer({
    displayEl: $("breakClock"),
    mode: "countdown",
    formatter: fmtHMS,
    onExpire: () => { addLog("Break", "Expired"); beep(400, 520); },
  });
  breakClock.set(window.TK_DEFAULT_BREAK || 600); // 600s = 00:10:00

  // ---------- Controls ----------
  // Attempt controls (works for tile buttons, any hidden duplicates, and dock proxies)
  bindClickAll("btnStart",   () => { attemptClock.start();  addLog("Attempt", "Start");  });
  bindClickAll("btnPause",   () => { attemptClock.pause();  addLog("Attempt", "Pause");  });
  bindClickAll("btnResume",  () => { attemptClock.resume(); addLog("Attempt", "Resume"); });
  bindClickAll("btnReset",   () => { attemptClock.reset();  addLog("Attempt", "Reset");  });
  bindClickAll("btnBarLeft", () => { attemptClock.pause();  addLog("Attempt", "Stop");   });

  // Break controls
  bindClickAll("btnBreakStart",  () => { breakClock.start();  addLog("Break", "Start");  });
  bindClickAll("btnBreakPause",  () => { breakClock.pause();  addLog("Break", "Pause");  });
  bindClickAll("btnBreakResume", () => { breakClock.resume(); addLog("Break", "Resume"); });
  bindClickAll("btnBreakReset",  () => { breakClock.reset();  addLog("Break", "Reset");  });


  // --- helper to parse "HH:MM:SS" or "MM:SS" or "SS" into seconds
function parseHMS(str) {
  if (!str) return NaN;
  const parts = str.trim().split(":").map(s => s.trim());
  if (parts.some(p => p === "")) return NaN;
  if (parts.length === 3) {
    const [hh, mm, ss] = parts.map(Number);
    if ([hh,mm,ss].some(n => Number.isNaN(n) || n < 0)) return NaN;
    return hh*3600 + mm*60 + ss;
  } else if (parts.length === 2) {
    const [mm, ss] = parts.map(Number);
    if ([mm,ss].some(n => Number.isNaN(n) || n < 0)) return NaN;
    return mm*60 + ss;
  } else if (parts.length === 1) {
    const ss = Number(parts[0]);
    if (Number.isNaN(ss) || ss < 0) return NaN;
    return ss;
  }
  return NaN;
}

// Pre-fill the input with the default break value in HH:MM:SS
const breakHMSInput = document.getElementById("breakHMS");
if (breakHMSInput) {
  breakHMSInput.value = fmtHMS(window.TK_DEFAULT_BREAK || 600);
}

// Apply -> set countdown to entered time
const btnBreakApply = document.getElementById("btnBreakApply");
if (btnBreakApply && breakHMSInput) {
  btnBreakApply.onclick = () => {
    const secs = parseHMS(breakHMSInput.value);
    if (!Number.isNaN(secs)) {
      breakClock.set(secs);
      addLog("Break", `Set ${fmtHMS(secs)}`);
    } else {
      // optional: quick visual shake
      btnBreakApply.classList.add("invalid");
      setTimeout(() => btnBreakApply.classList.remove("invalid"), 300);
    }
  };
}


  // ---------- Keyboard shortcuts ----------
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space") {
      // Space toggles attempt timer
      if (!attemptClock.running) document.querySelector("#btnStart")?.click();
      else document.querySelector("#btnPause")?.click();
      e.preventDefault();
    } else if (e.key === "b" || e.key === "B") {
      document.querySelector("#btnBreakStart")?.click();
    }
  });
})();
