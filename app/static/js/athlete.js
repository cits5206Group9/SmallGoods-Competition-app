(() => {
    // Utility functions
    function bySelAll(sel, root = document) {
        return Array.from(root.querySelectorAll(sel));
    }

    // Event switching functionality
    function showEvent(eventId) {
        // Hide all event details
        const allEvents = document.querySelectorAll('.event-details');
        allEvents.forEach(event => {
            event.style.display = 'none';
        });
        
        // Show selected event
        const selectedEvent = document.getElementById(eventId);
        if (selectedEvent) {
            selectedEvent.style.display = 'block';
        }
        
        // Update button states
        const allButtons = document.querySelectorAll('.event-button');
        allButtons.forEach(button => {
            button.classList.remove('active');
        });
        
        const activeButton = document.querySelector(`[data-target="${eventId}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // Weight form toggling
    function toggleWeightForm(weightValueElement) {
        const weightDisplay = weightValueElement.parentElement;
        const weightValue = weightDisplay.querySelector('.weight-value');
        const weightForm = weightDisplay.querySelector('.weight-form');
        
        if (weightForm.style.display === 'none' || !weightForm.style.display) {
            weightValue.style.display = 'none';
            weightForm.style.display = 'flex';
            const input = weightForm.querySelector('input[type="number"]');
            if (input) {
                input.focus();
                input.select();
            }
        } else {
            weightValue.style.display = 'inline';
            weightForm.style.display = 'none';
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

            // Update values in existing elements with correct field names
            const eventTypeEl = infoEl.querySelector('.event-type');
            const liftTypeEl = infoEl.querySelector('.lift-type');
            const weightEl = infoEl.querySelector('.weight');
            const attemptOrderEl = infoEl.querySelector('.attempt-order');

            if (eventTypeEl) eventTypeEl.textContent = data.event?.name || 'N/A';
            if (liftTypeEl) liftTypeEl.textContent = data.lift_type || 'N/A';
            if (weightEl) weightEl.textContent = data.weight || 0;
            if (attemptOrderEl) attemptOrderEl.textContent = data.order || 1;

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

    // Enhanced weight form handling with AJAX
    async function handleWeightFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const weightDisplay = form.closest('.weight-display');
        const weightValue = weightDisplay.querySelector('.weight-value');
        const formData = new FormData(form);
        const submitBtn = form.querySelector('.submit-weight');
        const originalText = submitBtn.textContent;
        
        try {
            submitBtn.textContent = 'Saving...';
            submitBtn.disabled = true;
            
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update the weight display
                const newWeight = formData.get('weight');
                weightValue.textContent = newWeight + 'kg';
                
                // Hide the form
                toggleWeightForm(weightValue);
                
                console.log('Weight updated successfully');
                
                // Update next attempt info if this affects the current attempt
                if (data.attempt) {
                    updateNextAttemptDisplay(data.attempt);
                }
            } else {
                alert('Error updating weight: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating weight:', error);
            alert('Error updating weight. Please try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    function updateNextAttemptDisplay(attempt) {
        const timerCard = document.querySelector('.timer-card');
        if (!timerCard) return;

        const infoEl = timerCard.querySelector('.next-attempt-info');
        if (!infoEl) return;

        // Update timer info if this is the current attempt
        const weightEl = infoEl.querySelector('.weight');
        if (weightEl && attempt.requested_weight) {
            weightEl.textContent = attempt.requested_weight;
        }
    }

    // Weight form initialization
    function initializeWeightForms(container = document) {
        container.querySelectorAll('.weight-display').forEach(display => {
            const weightValue = display.querySelector('.weight-value');
            const form = display.querySelector('.weight-form');
            
            if (!weightValue || !form) return;

            // Add click event listener to weight value
            weightValue.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWeightForm(weightValue);
            });

            // Add submit event listener to form
            form.addEventListener('submit', handleWeightFormSubmit);
        });
    }

    // Initialize everything when DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        // Initialize event switching
        const buttons = bySelAll(".event-button");
        
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                const target = this.dataset.target;
                showEvent(target);
            });
        });

        // Show first event by default
        const firstButton = document.querySelector('.event-button.active') || document.querySelector('.event-button');
        if (firstButton) {
            const target = firstButton.dataset.target;
            showEvent(target);
            firstButton.classList.add('active');
        }

        // Initialize timer functionality
        bySelAll(".countdown-timer").forEach(startCountdown);
        
        // Initialize weight forms
        initializeWeightForms();
    });

    // Make functions globally available for onclick handlers
    window.showEvent = showEvent;
    window.toggleWeightForm = toggleWeightForm;
})();