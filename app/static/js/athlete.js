(() => {
  function bySelAll(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  async function activateEvent(targetId, { updateHash = true } = {}) {
    const details = bySelAll(".event-details");
    const buttons = bySelAll(".event-button");
    const eventType = targetId.replace('event-', '');

    try {
        // Fetch updated event details
        const response = await fetch(`/athlete/event-detail/${eventType}`);
        const eventData = await response.json();

        if (eventData.error) {
            console.error('Error loading event details:', eventData.error);
            return;
        }

        // Update UI state
        details.forEach(d => d.classList.toggle("active", d.id === targetId));
        buttons.forEach(b => b.classList.toggle("active", b.dataset.target === targetId));

        // Update content
        const detailsContainer = document.getElementById(targetId);
        if (detailsContainer) {
            updateEventDetails(detailsContainer, eventData);
        }

        if (updateHash) {
            try { history.replaceState(null, "", `#${targetId}`); } catch (_) {}
        }
    } catch (error) {
        console.error('Error fetching event details:', error);
    }
  }

  function updateEventDetails(container, eventData) {
    let attemptsHtml = '';
    if (eventData.type === 'Weightlifting') {
        attemptsHtml = generateWeightliftingAttempts(eventData.attempts);
    } else if (eventData.type === 'Powerlifting') {
        attemptsHtml = generatePowerliftingAttempts(eventData.attempts);
    }

    container.innerHTML = `
        <h3>${eventData.type} Details</h3>
        <p><strong>Flight:</strong> ${eventData.flight}</p>
        <p><strong>Opening Weight:</strong> ${eventData.opener}kg</p>
        <p><strong>Status:</strong> ${eventData.status}</p>
        <div class="attempts-section">
            ${attemptsHtml}
        </div>
    `;
  }

  function generateWeightliftingAttempts(attempts) {
    return `
        <h4>Snatch Attempts</h4>
        ${generateAttemptsList(attempts.snatch)}
        
        <h4>Clean & Jerk Attempts</h4>
        ${generateAttemptsList(attempts.clean_and_jerk)}
    `;
  }

  function generatePowerliftingAttempts(attempts) {
    return `
        <h4>Squat</h4>
        ${generateAttemptsList(attempts.squat)}
        
        <h4>Bench Press</h4>
        ${generateAttemptsList(attempts.bench_press)}
        
        <h4>Deadlift</h4>
        ${generateAttemptsList(attempts.deadlift)}
    `;
  }

  function generateAttemptsList(attempts) {
    return attempts.map(attempt => `
        <div class="attempt ${attempt.status === 'Next' ? 'next-attempt' : ''}">
            <span>Attempt ${attempt.order}: ${attempt.weight}kg</span>
            <span class="status">${attempt.status}</span>
            ${attempt.result ? `<span class="result">${attempt.result}</span>` : ''}
        </div>
    `).join('');
  }

  async function updateAttemptInfo(timerEl, infoEl) {
    try {
        const response = await fetch('/athlete/next-attempt-timer');
        const data = await response.json();
        
        if (data.error) {
            timerEl.textContent = '--:--';
            infoEl.innerHTML = '<p>No upcoming attempts</p>';
            return null;
        }

        // Update attempt info
        infoEl.innerHTML = `
            <p><strong>Event:</strong> ${data.event_type}</p>
            <p><strong>Lift:</strong> ${data.lift_type}</p>
            <p><strong>Weight:</strong> ${data.weight}kg</p>
            <p><strong>Attempt:</strong> ${data.order}</p>
        `;

        return data.time;
    } catch (error) {
        console.error('Error fetching attempt time:', error);
        return null;
    }
}

function startCountdown(el) {
    const infoEl = el.closest('.timer-card').querySelector('.next-attempt-info');
    let currentDeadline = null;
    
    async function updateTimer() {
        const newTime = await updateAttemptInfo(el, infoEl);
        if (newTime !== null) {
            // Reset deadline with new time
            currentDeadline = Date.now() + newTime * 1000;
            tick();
        }
    }

    function render(remaining) {
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        el.textContent = `${m}:${s.toString().padStart(2, "0")}`;

        // Add visual indicators for time remaining
        el.classList.toggle("warning", remaining <= 120);
        el.classList.toggle("critical", remaining <= 60);
    }

    function tick() {
        if (!currentDeadline) return;

        const remaining = Math.max(0, Math.ceil((currentDeadline - Date.now()) / 1000));
        render(remaining);

        if (remaining > 0) {
            requestAnimationFrame(tick);
        } else {
            el.classList.add("expired");
            el.dispatchEvent(new CustomEvent("countdown:finished", { bubbles: true }));
        }
    }

    // Initial update
    updateTimer();

    // Update every 5 seconds
    setInterval(updateTimer, 5000);
}

  document.addEventListener("DOMContentLoaded", () => {
    // --- Event buttons / tabs ---
    const buttons = bySelAll(".event-button");
    buttons.forEach(btn => {
      // Ensure buttons are clickable & keyboard accessible
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        if (!targetId) return;
        activateEvent(targetId);
        const pane = document.getElementById(targetId);
        if (pane) {
          // Keep the content in view without jumping the page
          pane.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          btn.click();
        }
      });
    });

    // If URL hash points to a specific event panel, activate it
    const hashId = (location.hash || "").slice(1);
    if (hashId && document.getElementById(hashId)) {
      activateEvent(hashId, { updateHash: false });
    }

    // --- Countdown timers (supports one or many on the page) ---
    bySelAll(".countdown-timer").forEach(startCountdown);
  });

  // Expose minimal API (optional)
  window.AthleteDashboard = {
    activateEvent,
    startCountdownFor(el) { startCountdown(el); }
  };
})();