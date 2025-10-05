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

    // Form toggling (weight and reps)
    function toggleForm(valueElement) {
        const display = valueElement.parentElement;
        const valueSpan = display.querySelector('.weight-value, .reps-value');
        const form = display.querySelector('.weight-form, .reps-form');
        
        if (form.style.display === 'none' || !form.style.display) {
            valueSpan.style.display = 'none';
            form.style.display = 'flex';
            const input = form.querySelector('input[type="number"]');
            if (input) {
                input.focus();
                input.select();
            }
        } else {
            valueSpan.style.display = 'inline';
            form.style.display = 'none';
        }
    }

    // Helper function to update timer display
    function updateTimerDisplay(remaining, timerType, state) {
        const timerEl = document.querySelector('.countdown-timer');
        if (!timerEl) return;

        const m = Math.floor(remaining / 60);
        const s = Math.floor(remaining % 60);
        timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
        
        timerEl.className = `timer countdown-timer ${timerType || ''} ${state || ''}`;
        timerEl.classList.toggle("warning", remaining <= 120);
        timerEl.classList.toggle("critical", remaining <= 60);
        
        if (state === 'expired' || remaining <= 0) {
            timerEl.classList.add("expired");
        }
    }

    // Helper function to update timer info display
    function updateTimerInfoDisplay(infoEl, data) {
        if (!infoEl) return;

        const sportTypeEl = infoEl.querySelector('.sport-type');
        const liftTypeEl = infoEl.querySelector('.lift-type');
        const weightEl = infoEl.querySelector('.weight');
        const attemptOrderEl = infoEl.querySelector('.attempt-order');

        if (sportTypeEl) sportTypeEl.textContent = data.event?.sport_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A';
        if (liftTypeEl) liftTypeEl.textContent = data.lift_type || 'N/A';
        if (weightEl) weightEl.textContent = data.weight || 0;
        if (attemptOrderEl) attemptOrderEl.textContent = data.order || 1;
    }

    // Timer countdown function
    function startCountdown(el) {
        const infoEl = el.closest('.timer-card').querySelector('.next-attempt-info');
        let currentDeadline = null;
        let isTimerActive = false;
        let lastTimerState = null;
        let updateIntervalId = null;
        let connectionFailures = 0;
        const maxFailures = 3;
        
        async function updateTimer() {
            try {
                const response = await fetch('/athlete/next-attempt-timer');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                
                // Reset failure count on successful connection
                connectionFailures = 0;
                
                if (data.error || !data.timer_active || data.time === null) {
                    // No active timer - stop countdown
                    isTimerActive = false;
                    currentDeadline = null;
                    el.textContent = '--:--';
                    el.className = 'timer countdown-timer inactive';
                    if (infoEl) infoEl.innerHTML = '<p>No active timer</p>';
                    return;
                }
            } catch (error) {
                connectionFailures++;
                console.warn(`Timer update failed (${connectionFailures}/${maxFailures}):`, error.message);
                
                if (connectionFailures >= maxFailures) {
                    console.log('Max connection failures reached. Stopping timer updates.');
                    if (updateIntervalId) {
                        clearInterval(updateIntervalId);
                        updateIntervalId = null;
                    }
                    
                    // Show disconnected state
                    isTimerActive = false;
                    currentDeadline = null;
                    el.textContent = '--:--';
                    el.className = 'timer countdown-timer disconnected';
                    if (infoEl) infoEl.innerHTML = '<p>Server disconnected</p>';
                }
                return;
            }
            
            // Update timer info display
            updateTimerInfoDisplay(infoEl, data);
            
            // Active timer - start/update countdown
            isTimerActive = true;
            lastTimerState = data.timer_type;
            currentDeadline = Date.now() + data.time * 1000;
            el.className = `timer countdown-timer ${data.timer_type}`;
            
            if (!isTimerActive) {
                tick(); // Start ticking if not already active
            }
        }

        function render(remaining) {
            const m = Math.floor(remaining / 60);
            const s = Math.floor(remaining % 60);
            el.textContent = `${m}:${s.toString().padStart(2, "0")}`;
            el.classList.toggle("warning", remaining <= 120);
            el.classList.toggle("critical", remaining <= 60);
        }

        function tick() {
            if (!isTimerActive || !currentDeadline) return;

            const remaining = Math.max(0, Math.ceil((currentDeadline - Date.now()) / 1000));
            render(remaining);

            if (remaining > 0) {
                requestAnimationFrame(tick);
            } else {
                el.classList.add("expired");
                isTimerActive = false;
                el.dispatchEvent(new CustomEvent("countdown:finished", { bubbles: true }));
            }
        }

        // Update every 2 seconds to catch server timer state changes
        updateTimer();
        updateIntervalId = setInterval(updateTimer, 2000);
    }

    // Enhanced reps form handling with AJAX
    async function handleRepsFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const repsDisplay = form.closest('.reps-display');
        const repsValue = repsDisplay.querySelector('.reps-value');
        const formData = new FormData(form);
        const submitBtn = form.querySelector('.submit-reps');
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
                // Update the reps display with the array format
                const newReps = data.entry.reps_display || formData.get('reps');
                repsValue.textContent = newReps;
                
                // Hide the form
                toggleForm(repsValue);
                
                console.log('Reps updated successfully');
            } else {
                alert('Error updating reps: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating reps:', error);
            alert('Error updating reps. Please try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async function handleWeightFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const weightDisplay = form.closest('.weight-display');
        const weightValue = weightDisplay.querySelector('.weight-value');
        const formData = new FormData(form);
        const submitBtn = form.querySelector('.submit-weight');
        const originalText = submitBtn.textContent;
        
        // Validate weight based on competition rules
        const weightInput = form.querySelector('input[name="weight"]');
        const newWeight = parseFloat(weightInput.value);
        
        if (!validateWeightSelection(form, newWeight)) {
            return; // Validation failed, don't submit
        }
        
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
                weightValue.textContent = newWeight + 'kg';
                
                // Hide the form
                toggleWeightForm(weightValue);
                
                // If this is an opening weight form, update attempt 1 displays in the same movement section
                if (form.closest('.opening-weights-section')) {
                    updateAttempt1Display(form, newWeight);
                }
                
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

    function updateAttempt1Display(openingWeightForm, newWeight) {
        // Find the movement section that contains this opening weight form
        const movementSection = openingWeightForm.closest('.movement-section');
        if (!movementSection) return;

        // Find all attempt 1 displays in this movement section
        const attemptsSection = movementSection.querySelector('.attempts-section');
        if (!attemptsSection) return;

        // Look for attempt 1 displays (those that show opening weight)
        const attempt1Elements = attemptsSection.querySelectorAll('.attempt');
        attempt1Elements.forEach(attemptEl => {
            // Check if this is attempt 1 by looking for the "(Opening Weight)" note
            const weightNote = attemptEl.querySelector('.weight-note');
            if (weightNote && weightNote.textContent.includes('Opening Weight')) {
                // Update the weight value display
                const weightValue = attemptEl.querySelector('.weight-value');
                if (weightValue) {
                    weightValue.textContent = newWeight + 'kg';
                }
            }
        });
    }

    function validateWeightSelection(form, newWeight) {
        // Skip validation for opening weight forms (attempt 1)
        if (form.closest('.opening-weights-section')) {
            return true; // Opening weights have no restrictions
        }

        // Get the movement section to analyze previous attempts
        const movementSection = form.closest('.movement-section');
        if (!movementSection) return true;

        const attemptsSection = movementSection.querySelector('.attempts-section');
        if (!attemptsSection) return true;

        // Collect attempt data
        const attempts = [];
        const attemptElements = attemptsSection.querySelectorAll('.attempt');
        
        attemptElements.forEach(attemptEl => {
            const attemptText = attemptEl.textContent;
            const attemptMatch = attemptText.match(/Attempt (\d+):/);
            if (!attemptMatch) return;
            
            const attemptNum = parseInt(attemptMatch[1]);
            const weightMatch = attemptText.match(/(\d+(?:\.\d+)?)kg/);
            const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
            
            const status = attemptEl.querySelector('.status')?.textContent || 'Pending';
            const result = attemptEl.querySelector('.result')?.textContent || null;
            
            attempts.push({
                number: attemptNum,
                weight: weight,
                status: status,
                result: result,
                isCompleted: status === 'Completed',
                isSuccessful: result === 'good_lift'
            });
        });

        // Sort attempts by number
        attempts.sort((a, b) => a.number - b.number);

        // Find which attempt we're updating
        const attemptIdInput = form.querySelector('input[name="attempt_id"]');
        if (!attemptIdInput) return true;

        // Find the current attempt number by matching against attempt elements
        let currentAttemptNum = null;
        const currentAttemptEl = form.closest('.attempt');
        if (currentAttemptEl) {
            const attemptText = currentAttemptEl.textContent;
            const attemptMatch = attemptText.match(/Attempt (\d+):/);
            if (attemptMatch) {
                currentAttemptNum = parseInt(attemptMatch[1]);
            }
        }

        if (!currentAttemptNum) return true;

        // Apply validation rules
        const validationResult = applyWeightValidationRules(attempts, currentAttemptNum, newWeight);
        
        if (!validationResult.isValid) {
            alert(validationResult.message);
            return false;
        }

        return true;
    }

    function applyWeightValidationRules(attempts, currentAttemptNum, newWeight) {
        // Rule 1: Find the first successful attempt weight (cannot go lighter than this)
        const firstSuccessfulAttempt = attempts.find(a => a.isCompleted && a.isSuccessful);
        if (firstSuccessfulAttempt && newWeight < firstSuccessfulAttempt.weight) {
            return {
                isValid: false,
                message: `Cannot select a weight lighter than your first successful attempt (${firstSuccessfulAttempt.weight}kg)`
            };
        }

        // Rule 2: Check the previous attempt (both completed and pending)
        const previousAttempt = attempts.find(a => a.number === currentAttemptNum - 1);
        if (previousAttempt) {
            // For completed attempts, check result
            if (previousAttempt.isCompleted) {
                if (previousAttempt.isSuccessful) {
                    // Previous lift was successful - suggest 2.5kg increase
                    const suggestedWeight = previousAttempt.weight + 2.5;
                    if (newWeight < suggestedWeight) {
                        const confirmMsg = `Previous lift was successful. Suggested weight is ${suggestedWeight}kg (2.5kg increase). Continue with ${newWeight}kg?`;
                        if (!confirm(confirmMsg)) {
                            return { isValid: false, message: 'Weight selection cancelled' };
                        }
                    }
                } else {
                    // Previous lift failed - can repeat same weight or go heavier
                    if (newWeight < previousAttempt.weight) {
                        return {
                            isValid: false,
                            message: `Previous lift failed. You can repeat the same weight (${previousAttempt.weight}kg) or go heavier, but cannot go lighter.`
                        };
                    }
                    
                    // If repeating the same weight after a fail, show confirmation
                    if (newWeight === previousAttempt.weight) {
                        const confirmMsg = `Repeating the same weight (${newWeight}kg) after a failed attempt. Continue?`;
                        if (!confirm(confirmMsg)) {
                            return { isValid: false, message: 'Weight selection cancelled' };
                        }
                    }
                }
            } else {
                // For pending attempts, cannot go lighter than previous attempt weight
                if (newWeight < previousAttempt.weight) {
                    return {
                        isValid: false,
                        message: `Cannot select a weight lighter than your previous attempt (${previousAttempt.weight}kg). You must attempt weights in ascending order.`
                    };
                }
            }
        }

        return { isValid: true };
    }

    // Form initialization (weight and reps)
    function initializeForms(container = document) {
        // Initialize weight forms
        container.querySelectorAll('.weight-display').forEach(display => {
            const weightValue = display.querySelector('.weight-value');
            const form = display.querySelector('.weight-form');
            
            if (!weightValue || !form) return;

            // Add click event listener to weight value
            weightValue.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleForm(weightValue);
            });

            // Add submit event listener to form
            form.addEventListener('submit', handleWeightFormSubmit);
        });

        // Initialize reps forms
        container.querySelectorAll('.reps-display').forEach(display => {
            const repsValue = display.querySelector('.reps-value');
            const form = display.querySelector('.reps-form');
            
            if (!repsValue || !form) return;

            // Add click event listener to reps value
            repsValue.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleForm(repsValue);
            });

            // Add submit event listener to form
            form.addEventListener('submit', handleRepsFormSubmit);
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
        
        // Initialize forms (weight and reps)
        initializeForms();
        
        // Initialize WebSocket connection
        if (typeof initializeWebSocket === 'function') {
            initializeWebSocket();
        }
    });

    // WebSocket connection for real-time timer updates
    function initializeWebSocket() {
        // Only initialize if Socket.IO is available
        if (typeof io === 'undefined') {
            console.warn('Socket.IO not available - falling back to polling timer updates');
            initializePollingTimerUpdates();
            return;
        }

        const socket = io();
        
        socket.on('connect', () => {
            console.log('Connected to real-time server');
            
            // Join competition room if we have competition data
            const competitionMeta = window.competitionData;
            if (competitionMeta && competitionMeta.id) {
                socket.emit('join_competition', {
                    competition_id: competitionMeta.id,
                    user_type: 'athlete'
                });
            }
        });

        socket.on('timer_update', (data) => {
            // Update timer display when receiving real-time updates
            if (data.remaining !== undefined && (data.type === 'break' || data.timer_id?.startsWith('attempt_'))) {
                updateTimerDisplay(data.remaining, data.type, data.state);
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from real-time server');
            // Fall back to polling if WebSocket disconnects
            initializePollingTimerUpdates();
        });

        socket.on('connect_error', () => {
            console.warn('WebSocket connection failed - falling back to polling');
            initializePollingTimerUpdates();
        });
    }

    // Fallback: Polling-based timer updates (works without WebSocket)
    function initializePollingTimerUpdates() {
        console.log('Using polling for timer updates (local network friendly)');
        
        let connectionFailures = 0;
        const maxFailures = 3;
        let pollingIntervalId = null;
        
        // Poll every 1 second for more responsive timer updates
        pollingIntervalId = setInterval(async () => {
            try {
                const response = await fetch('/athlete/next-attempt-timer');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                
                // Reset failure count on successful connection
                connectionFailures = 0;
                
                const infoEl = document.querySelector('.next-attempt-info');
                
                if (!data.error && data.timer_active && data.time !== null) {
                    // Update timer display
                    updateTimerDisplay(data.time, data.timer_type, '');
                    
                    // Update info display
                    updateTimerInfoDisplay(infoEl, data);
                } else {
                    // No active timer - show inactive state
                    const timerEl = document.querySelector('.countdown-timer');
                    if (timerEl) {
                        timerEl.textContent = '--:--';
                        timerEl.className = 'timer countdown-timer inactive';
                    }
                    if (infoEl && data.error) {
                        infoEl.innerHTML = '<p>No upcoming attempts</p>';
                    }
                }
            } catch (error) {
                connectionFailures++;
                console.warn(`Polling failed (${connectionFailures}/${maxFailures}):`, error.message);
                
                if (connectionFailures >= maxFailures) {
                    console.log('Max connection failures reached. Stopping polling.');
                    if (pollingIntervalId) {
                        clearInterval(pollingIntervalId);
                        pollingIntervalId = null;
                    }
                    
                    // Show disconnected state
                    const timerEl = document.querySelector('.countdown-timer');
                    const infoEl = document.querySelector('.next-attempt-info');
                    if (timerEl) {
                        timerEl.textContent = '--:--';
                        timerEl.className = 'timer countdown-timer disconnected';
                    }
                    if (infoEl) {
                        infoEl.innerHTML = '<p>Server disconnected</p>';
                    }
                } else {
                    // Show error state but keep trying
                    const timerEl = document.querySelector('.countdown-timer');
                    if (timerEl) {
                        timerEl.textContent = '--:--';
                        timerEl.className = 'timer countdown-timer error';
                    }
                }
            }
        }, 1000); // Update every 1 second for more responsive updates
    }

    // Make functions globally available for onclick handlers
    window.showEvent = showEvent;
    window.toggleForm = toggleForm;
    window.initializeWebSocket = initializeWebSocket;
})();