(() => {
    // Utility functions
    function bySelAll(sel, root = document) {
        return Array.from(root.querySelectorAll(sel));
    }

    // Event detail functions
    function updateEventDetails(eventConfig) {
        const container = document.getElementById('event-details-container');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Create event sections for each entry
        eventConfig.entries.forEach(entry => {
            const eventSection = document.createElement('div');
            eventSection.className = 'event-details';
            eventSection.id = `event-${entry.competition_type.exercise.sport_category.name.toLowerCase()}`;

            let attemptsHtml = generateAttemptsSection(entry);
            let openingWeightsHtml = generateOpeningWeightsSection(entry);

            eventSection.innerHTML = `
                <h3>${entry.competition_type.exercise.sport_category.name} - ${entry.competition_type.name}</h3>
                ${openingWeightsHtml}
                ${attemptsHtml}
            `;

            container.appendChild(eventSection);

            // Initialize forms in the new section
            initializeWeightForms(eventSection);
        });
    }

    function generateOpeningWeightsSection(entry) {
        const openingWeights = entry.opening_weights || {};
        return `
            <div class="opening-weights-section">
                <h4>Opening Weights</h4>
                ${Object.entries(openingWeights).map(([lift, weight]) => `
                    <div class="weight-display">
                        <strong>${lift}:</strong>
                        <span class="weight-value">${weight}kg</span>
                        <form class="weight-form" style="display: none;" 
                              action="/athlete/update-opening-weight" method="POST">
                            <input type="hidden" name="competition_type_id" value="${entry.competition_type.id}">
                            <input type="hidden" name="lift_key" value="${lift}">
                            <input type="number" name="weight" value="${weight}" 
                                   step="0.5" min="0" required>
                            <span>kg</span>
                            <button type="submit" class="submit-weight">Save</button>
                        </form>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function generateAttemptsSection(entry) {
        const attemptsByLift = {};
        entry.attempts.forEach(attempt => {
            const liftName = attempt.lift_name || 'Unknown';
            if (!attemptsByLift[liftName]) {
                attemptsByLift[liftName] = [];
            }
            attemptsByLift[liftName].push(attempt);
        });

        return `
            <div class="attempts-section">
                ${Object.entries(attemptsByLift).map(([liftName, attempts]) => `
                    <h4>${liftName}</h4>
                    <div class="attempts-list">
                        ${attempts.sort((a, b) => a.number - b.number).map(attempt => `
                            <div class="attempt ${attempt.result === null ? 'next-attempt' : ''}" 
                                 data-attempt-id="${attempt.id}">
                                <span>Attempt ${attempt.number}:</span>
                                ${attempt.result === null ? `
                                    <div class="weight-display">
                                        <span class="weight-value">${attempt.requested_weight}kg</span>
                                        <form class="weight-form" style="display: none;" 
                                              action="/athlete/update-attempt-weight" method="POST">
                                            <input type="hidden" name="attempt_id" value="${attempt.id}">
                                            <input type="number" name="weight" 
                                                   value="${attempt.requested_weight}" 
                                                   step="0.5" min="0" required>
                                            <span>kg</span>
                                            <button type="submit" class="submit-weight">Save</button>
                                        </form>
                                    </div>
                                ` : `
                                    <span>${attempt.requested_weight}kg</span>
                                `}
                                <span class="status">
                                    ${attempt.result ? 'Completed' : 'Pending'}
                                </span>
                                ${attempt.result ? `<span class="result">${attempt.result}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
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
                <p><strong>Event:</strong> ${data.event_type || 'N/A'}</p>
                <p><strong>Lift:</strong> ${data.lift_type || 'N/A'}</p>
                <p><strong>Weight:</strong> ${data.weight}kg</p>
                <p><strong>Attempt:</strong> ${data.order}</p>
            `;

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
            infoEl.innerHTML = `
                <p><strong>Event:</strong> ${attempt.entry.competition_type.exercise.sport_category.name}</p>
                <p><strong>Lift:</strong> ${attempt.lift_name || 'N/A'}</p>
                <p><strong>Weight:</strong> ${attempt.requested_weight}kg</p>
                <p><strong>Attempt:</strong> ${attempt.number}</p>
            `;
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