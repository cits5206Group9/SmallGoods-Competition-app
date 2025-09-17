(() => {
    // Utility functions
    function bySelAll(sel, root = document) {
        return Array.from(root.querySelectorAll(sel));
    }

    // Event detail functions
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
                <div class="weight-display">
                    <span class="weight-value">${attempt.weight}kg</span>
                    <form class="weight-form" style="display: none;" action="/athlete/update-attempt-weight" method="POST">
                        <input type="hidden" name="attempt_id" value="${attempt.id}">
                        <input type="number" name="weight" value="${attempt.weight}" step="0.5" min="0" required>
                        <span>kg</span>
                        <button type="submit" class="submit-weight">Save</button>
                    </form>
                </div>
                <span class="status">${attempt.status}</span>
                ${attempt.result ? `<span class="result">${attempt.result}</span>` : ''}
            </div>
        `).join('');
    }

    // Timer functions
    async function updateAttemptInfo(timerEl, infoEl) {
        try {
            const response = await fetch('/athlete/next-attempt-timer');
            const data = await response.json();
            
            if (data.error) {
                timerEl.textContent = '--:--';
                infoEl.innerHTML = '<p>No upcoming attempts</p>';
                return null;
            }

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
                currentDeadline = Date.now() + newTime * 1000;
                tick();
            }
        }

        function render(remaining) {
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            el.textContent = `${m}:${s.toString().padStart(2, "0")}`;
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

        updateTimer();
        setInterval(updateTimer, 5000);
    }

    // Weight form functions
    function initializeWeightForms() {
        document.querySelectorAll('.weight-display').forEach(display => {
            const weightValue = display.querySelector('.weight-value');
            const form = display.querySelector('.weight-form');
            
            weightValue.addEventListener('click', () => {
                weightValue.style.display = 'none';
                form.style.display = 'flex';
            });

            form.addEventListener('submit', handleWeightFormSubmit);
        });
    }

    async function handleWeightFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const weightValue = form.previousElementSibling;
        const formData = new FormData(form);
        const submitBtn = form.querySelector('.submit-weight');
        
        try {
            submitBtn.disabled = true;
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            if (data.success) {
                weightValue.textContent = `${data.weight}kg`;
                form.style.display = 'none';
                weightValue.style.display = 'inline';
            } else {
                alert(data.error || 'Failed to update weight');
            }
        } catch (error) {
            console.error('Error updating weight:', error);
            alert('Failed to update weight. Please try again.');
        } finally {
            submitBtn.disabled = false;
        }
    }

    // Initialize everything when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        // Initialize event buttons
        const buttons = bySelAll(".event-button");
        const detailsContainer = document.getElementById('event-details-container');
        const eventDetails = document.querySelectorAll('.event-details');
        
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                buttons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                detailsContainer.style.display = 'block';
                eventDetails.forEach(detail => detail.style.display = 'none');
                
                const targetDetails = document.getElementById(this.getAttribute('data-target'));
                if (targetDetails) {
                    targetDetails.style.display = 'block';
                }
            });
        });

        // Initialize timer and weight forms
        bySelAll(".countdown-timer").forEach(startCountdown);
        initializeWeightForms();
    });
})();