(() => {
    // Utility functions
    function bySelAll(sel, root = document) {
        return Array.from(root.querySelectorAll(sel));
    }

    // Event detail functions
    function updateEventDetails(response) {
        if (response.success) {
            // Refresh the page to show updated data
            window.location.reload();
        } else {
            alert(response.error || 'Failed to update data');
        }
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

            // Update values in existing elements
            infoEl.querySelector('.event-type').textContent = data.event_type || 'N/A';
            infoEl.querySelector('.lift-type').textContent = data.lift_type || 'N/A';
            infoEl.querySelector('.weight').textContent = data.weight;
            infoEl.querySelector('.attempt-order').textContent = data.order;

            return data.time;
        } catch (error) {
            console.error('Error fetching attempt time:', error);
            timerEl.textContent = '--:--';
            infoEl.innerHTML = '<p>Error updating timer</p>';
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
    function initializeWeightForms(container = document) {
        container.querySelectorAll('.weight-display').forEach(display => {
            const weightValue = display.querySelector('.weight-value');
            const form = display.querySelector('.weight-form');
            
            if (!weightValue || !form) return;

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
        const weightDisplay = form.closest('.weight-display');
        const weightValue = weightDisplay.querySelector('.weight-value');
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
                if (data.attempt) {
                    // Update attempt weight
                    weightValue.textContent = `${data.attempt.requested_weight}kg`;
                    updateNextAttemptInfo(data.attempt);
                } else if (data.entry) {
                    // Update opening weight and related attempts
                    const entrySection = document.getElementById(`event-${data.entry.competition_type.exercise.sport_category.name.toLowerCase()}`);
                    if (entrySection) {
                        const entries = [data.entry];
                        updateEventDetails({ entries }); // Wrap entry in expected format
                    }
                }
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

    function updateNextAttemptInfo(attempt) {
        const timerCard = document.querySelector('.timer-card');
        if (!timerCard) return;

        const infoEl = timerCard.querySelector('.next-attempt-info');
        if (!infoEl) return;

        if (attempt.id === document.querySelector('.next-attempt')?.dataset?.attemptId) {
            // Update values in existing elements
            infoEl.querySelector('.event-type').textContent = attempt.entry.competition_type.exercise.sport_category.name;
            infoEl.querySelector('.lift-type').textContent = attempt.lift_name || 'N/A';
            infoEl.querySelector('.weight').textContent = attempt.requested_weight;
            infoEl.querySelector('.attempt-order').textContent = attempt.number;
        }
    }

    // Initialize everything when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        // Initialize event buttons
        const buttons = bySelAll(".event-button");
        const eventDetails = document.querySelectorAll('.event-details');
        
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                buttons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
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