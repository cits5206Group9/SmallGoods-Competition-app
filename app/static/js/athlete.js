(() => {
    // Notification System (works without internet)
    let notificationPermission = 'default';
    let notifiedAt5Min = false;
    let notifiedAt3Min = false;
    let notifiedAt1Min = false;

    // Timer countdown state
    let timerCountdownInterval = null;
    let timerTargetSeconds = 0;
    let timerLastUpdate = Date.now();
    
    // Track if timer has expired (module-level so it's accessible everywhere)
    let timerHasExpired = false;
    let currentCountdownAttemptId = null;
    let lastTimerType = null;
    let lastServerTime = null; // Track last server time to detect significant changes
    let timerWasRestored = false; // Track if timer was restored from localStorage
    let currentAttemptInfo = null;

    let eventStarted = false; // Track if event has started
    let currentAttemptTimeRemaining = null; // Track time until next attempt
    
    // LocalStorage keys for timer persistence
    const TIMER_STATE_KEY = 'athlete_timer_state';
    
    // Save timer state to localStorage
    function saveTimerState() {
        try {
            const state = {
                timerTargetSeconds,
                timerLastUpdate,
                timerHasExpired,
                currentCountdownAttemptId,
                lastTimerType,
                lastServerTime,
                currentAttemptInfo, // Save attempt info for display
                hasInterval: !!timerCountdownInterval,
                savedAt: Date.now()
            };
            localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save timer state:', e);
        }
    }
    
    // Restore timer state from localStorage
    function restoreTimerState() {
        try {
            const stored = localStorage.getItem(TIMER_STATE_KEY);
            if (!stored) return false;
            
            const state = JSON.parse(stored);
            
            // Don't restore if state is too old (> 1 hour)
            if (Date.now() - state.savedAt > 60 * 60 * 1000) {
                localStorage.removeItem(TIMER_STATE_KEY);
                return false;
            }
            
            // Restore state
            timerHasExpired = state.timerHasExpired || false;
            currentCountdownAttemptId = state.currentCountdownAttemptId;
            lastTimerType = state.lastTimerType;
            lastServerTime = state.lastServerTime;
            
            // Restore attempt info for display
            if (state.currentAttemptInfo) {
                currentAttemptInfo = state.currentAttemptInfo;
            }
            
            // If timer was running, calculate current time
            if (state.hasInterval && !state.timerHasExpired) {
                const elapsedSinceLastUpdate = Math.floor((Date.now() - state.timerLastUpdate) / 1000);
                timerTargetSeconds = Math.max(0, state.timerTargetSeconds - elapsedSinceLastUpdate);
                
                if (timerTargetSeconds > 0) {
                    timerLastUpdate = Date.now();
                    console.log(`🔄 Restored timer: ${timerTargetSeconds}s remaining`);
                    // Restart the countdown from where it left off
                    startLocalCountdown(timerTargetSeconds, state.lastTimerType, currentAttemptInfo);
                    
                    // Restore attempt info display
                    const infoEl = document.querySelector('.next-attempt-info');
                    if (infoEl && currentAttemptInfo) {
                        updateTimerInfoDisplay(infoEl, {
                            event: currentAttemptInfo.event,
                            lift_type: currentAttemptInfo.lift_type,
                            order: currentAttemptInfo.order,
                            weight: currentAttemptInfo.weight,
                            no_attempts: false
                        });
                    }
                    
                    return true;
                } else {
                    // Timer expired while page was closed
                    timerHasExpired = true;
                    updateTimerDisplay(0, 'ready', '');
                    
                    // Restore attempt info display
                    const infoEl = document.querySelector('.next-attempt-info');
                    if (infoEl && currentAttemptInfo) {
                        updateTimerInfoDisplay(infoEl, {
                            event: currentAttemptInfo.event,
                            lift_type: currentAttemptInfo.lift_type,
                            order: currentAttemptInfo.order,
                            weight: currentAttemptInfo.weight,
                            no_attempts: false
                        });
                    }
                    
                    console.log('⏱️ Timer expired while page was closed - showing GET READY');
                    return true;
                }
            } else if (state.timerHasExpired) {
                // Timer was already expired
                updateTimerDisplay(0, 'ready', '');
                
                // Restore attempt info display
                const infoEl = document.querySelector('.next-attempt-info');
                if (infoEl && currentAttemptInfo) {
                    updateTimerInfoDisplay(infoEl, {
                        event: currentAttemptInfo.event,
                        lift_type: currentAttemptInfo.lift_type,
                        order: currentAttemptInfo.order,
                        weight: currentAttemptInfo.weight,
                        no_attempts: false
                    });
                }
                
                console.log('⏱️ Restored expired timer - showing GET READY');
                return true;
            }
            
            return false;
        } catch (e) {
            console.warn('Failed to restore timer state:', e);
            localStorage.removeItem(TIMER_STATE_KEY);
            return false;
        }
    }

    
    // Update notification button visibility and status
    function updateNotificationButton() {
        const btn = document.getElementById('enable-notifications');
        if (!btn) return;
        
        if (notificationPermission === 'granted') {
            btn.style.display = 'none';
        } else if (notificationPermission === 'denied') {
            btn.textContent = '🔕';
            btn.style.background = '#f44336';
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
            btn.style.display = 'block';
        } else {
            btn.textContent = '🔔';
            btn.style.background = '#4CAF50';
            btn.style.cursor = 'pointer';
            btn.disabled = false;
            btn.style.display = 'block';
        }
    }
    
    // Request notification permission on page load
    async function requestNotificationPermission() {
        if ('Notification' in window) {
            try {
                notificationPermission = Notification.permission;
                updateNotificationButton();
            } catch (error) {
                console.warn('Notification initialization error:', error);
            }
        }
    }
    
    // Manually request permission when button clicked
    async function enableNotifications() {
        if ('Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                notificationPermission = permission;
                updateNotificationButton();
                
                if (permission === 'granted') {
                    showNotification('🎉 Notifications Enabled!', 'You will receive alerts at 5min, 3min, and 1min before your attempts', 'test-notification');
                }
            } catch (error) {
                console.warn('Could not enable notifications:', error);
            }
        }
    }
    
    // Show notification (works locally without internet)
    function showNotification(title, body, tag) {
        showVisualNotification(title, body);
        
        if (notificationPermission === 'granted') {
            try {
                const notification = new Notification(title, {
                    body: body,
                    tag: tag,
                    requireInteraction: false,
                    silent: false
                });
                
                setTimeout(() => notification.close(), 10000);
                
                notification.onclick = function() {
                    window.focus();
                    this.close();
                };
            } catch (error) {
                console.warn('Could not show browser notification:', error);
            }
        }
    }
    
    // Show visual notification on the page
    function showVisualNotification(title, body) {
        const visualNotif = document.getElementById('visual-notification');
        const titleEl = document.getElementById('notification-title');
        const bodyEl = document.getElementById('notification-body');
        
        if (!visualNotif || !titleEl || !bodyEl) return;
        
        titleEl.textContent = title;
        bodyEl.textContent = body;
        visualNotif.style.display = 'block';
        
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            // Silently fail if audio doesn't work
        }
        
        setTimeout(() => {
            visualNotif.style.display = 'none';
        }, 10000);
    }
    
    // Check timer and send notifications at specific intervals
    function checkAndNotify(remainingSeconds, timerType, attemptInfo) {
        // Only notify for estimate timers (not "you-are-up")
        if (timerType !== 'estimate') {
            notifiedAt5Min = false;
            notifiedAt3Min = false;
            notifiedAt1Min = false;
            return;
        }
        
        // 5 minutes remaining (300 seconds, trigger between 300-295)
        if (remainingSeconds <= 300 && remainingSeconds >= 295 && !notifiedAt5Min) {
            notifiedAt5Min = true;
            const message = attemptInfo 
                ? `${attemptInfo.lift_type} - Attempt ${attemptInfo.order} (${attemptInfo.weight}kg) in 5 minutes`
                : 'Your next attempt is in 5 minutes';
            showNotification('⏰ 5 Minutes Until Your Attempt', message, 'timer-5min');
        }
        
        // 3 minutes remaining (180 seconds, trigger between 180-175)
        if (remainingSeconds <= 180 && remainingSeconds >= 175 && !notifiedAt3Min) {
            notifiedAt3Min = true;
            const message = attemptInfo 
                ? `${attemptInfo.lift_type} - Attempt ${attemptInfo.order} (${attemptInfo.weight}kg) in 3 minutes`
                : 'Your next attempt is in 3 minutes';
            showNotification('⏰ 3 Minutes Until Your Attempt', message, 'timer-3min');
        }
        
        // 1 minute remaining (60 seconds, trigger between 60-55)
        if (remainingSeconds <= 60 && remainingSeconds >= 55 && !notifiedAt1Min) {
            notifiedAt1Min = true;
            const message = attemptInfo 
                ? `${attemptInfo.lift_type} - Attempt ${attemptInfo.order} (${attemptInfo.weight}kg) in 1 minute!`
                : 'Your next attempt is in 1 minute!';
            showNotification('🔔 1 Minute Until Your Attempt!', message, 'timer-1min');
        }
    }
    
    // Request permission when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', requestNotificationPermission);
    } else {
        requestNotificationPermission();
    }
    
    // Utility functions
    function bySelAll(sel, root = document) {
        return Array.from(root.querySelectorAll(sel));
    }

    // Event switching functionality
    function showEvent(eventId) {
        const allEvents = document.querySelectorAll('.event-details');
        allEvents.forEach(event => {
            event.style.display = 'none';
        });
        
        const selectedEvent = document.getElementById(eventId);
        if (selectedEvent) {
            selectedEvent.style.display = 'block';
        }
        
        const allButtons = document.querySelectorAll('.event-button');
        allButtons.forEach(button => {
            button.classList.remove('active');
        });
        
        const activeButton = document.querySelector(`[data-target="${eventId}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    // Form toggling (weight)
    function toggleForm(valueElement) {
        const display = valueElement.parentElement;
        const valueSpan = display.querySelector('.weight-value');
        const form = display.querySelector('.weight-form');
        
        // Check if this is opening weight
        const isOpeningWeight = display.closest('.opening-weights-section') !== null;
        
        // Get attempt ID if it's an attempt weight
        let attemptId = null;
        if (!isOpeningWeight) {
            const attemptEl = display.closest('.attempt');
            if (attemptEl) {
                attemptId = attemptEl.dataset.attemptId;
            }
        }
        
        // Check if update is allowed
        const canUpdate = canUpdateWeight(isOpeningWeight, attemptId);
        
        if (!canUpdate.allowed) {
            alert(canUpdate.message);
            return;
        }

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

        if (remaining <= 0 && timerType !== 'you-are-up' && timerType !== 'ready') {
            timerEl.textContent = '--:--';
        } else if (timerType === 'you-are-up') {
            timerEl.textContent = 'YOU ARE UP!';
            timerEl.classList.add('you-are-up');
        } else if (timerType === 'ready') {
            timerEl.textContent = 'GET READY!';
            timerEl.classList.add('ready');
            timerEl.classList.remove('you-are-up');
        } else {
            const m = Math.floor(remaining / 60);
            const s = Math.floor(remaining % 60);
            timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
            timerEl.classList.remove('you-are-up', 'ready');
        }
        
        timerEl.className = `timer countdown-timer ${timerType || ''} ${state || ''}`;
        timerEl.classList.toggle("warning", remaining <= 300 && remaining > 60);
        timerEl.classList.toggle("critical", remaining <= 60 && remaining > 0);
        
        if (state === 'expired' || (remaining <= 0 && timerType !== 'you-are-up' && timerType !== 'ready')) {
            timerEl.classList.add("expired");
        }
    }

    // Helper function to update timer info display
    function updateTimerInfoDisplay(infoEl, data) {
        if (!infoEl) return;

        if (data.no_attempts) {
            infoEl.innerHTML = '<p>' + (data.message || 'No attempt left') + '</p>';
            return;
        }

        const sportTypeEl = infoEl.querySelector('.sport-type');
        const liftTypeEl = infoEl.querySelector('.lift-type');
        const weightEl = infoEl.querySelector('.weight');
        const attemptOrderEl = infoEl.querySelector('.attempt-order');

        if (sportTypeEl) sportTypeEl.textContent = data.event?.sport_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'N/A';
        if (liftTypeEl) liftTypeEl.textContent = data.lift_type || 'N/A';
        if (weightEl) weightEl.textContent = data.weight || 0;
        if (attemptOrderEl) attemptOrderEl.textContent = data.order || 1;
    }

    // Start local countdown timer
    function startLocalCountdown(initialSeconds, timerType, attemptInfo) {
        console.log('🎬 startLocalCountdown called:', { initialSeconds, timerType });
        
        // Clear any existing countdown
        if (timerCountdownInterval) {
            clearInterval(timerCountdownInterval);
            timerCountdownInterval = null;
            console.log('⚠️ Cleared existing countdown interval');
        }
        
        // Don't countdown for "you-are-up" state
        if (timerType === 'you-are-up') {
            updateTimerDisplay(0, 'you-are-up', '');
            currentAttemptTimeRemaining = 0;
            updateWeightInputAvailability(); // Update restrictions
            return;
        }
        
        timerTargetSeconds = initialSeconds;
        timerLastUpdate = Date.now();
        currentAttemptTimeRemaining = initialSeconds;
        
        // Update immediately
        updateTimerDisplay(timerTargetSeconds, timerType, '');
        checkAndNotify(timerTargetSeconds, timerType, attemptInfo);
        updateWeightInputAvailability(); // Update restrictions
        
        // Save initial state
        saveTimerState();
        
        // Start countdown interval (update every second)
        timerCountdownInterval = setInterval(() => {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - timerLastUpdate) / 1000);
            
            if (elapsedSeconds > 0) {
                timerTargetSeconds = Math.max(0, timerTargetSeconds - elapsedSeconds);
                timerLastUpdate = now;
                currentAttemptTimeRemaining = timerTargetSeconds;
                
                updateTimerDisplay(timerTargetSeconds, timerType, '');
                checkAndNotify(timerTargetSeconds, timerType, attemptInfo);
                updateWeightInputAvailability(); // Update restrictions every second
                
                // Save state every second
                saveTimerState();
                
                // Stop countdown when reaching 0
                if (timerTargetSeconds <= 0) {
                    console.log('⏱️ Countdown complete - stopping interval');
                    clearInterval(timerCountdownInterval);
                    timerCountdownInterval = null;
                    currentAttemptTimeRemaining = 0;
                    
                    // Mark timer as expired
                    timerHasExpired = true;
                    console.log('✅ Timer expired flag SET - timerHasExpired =', timerHasExpired);
                    
                    // Show "Ready!" message at 0
                    updateTimerDisplay(0, 'ready', '');
                    console.log('⏱️ Timer now at READY state');
                    
                    updateWeightInputAvailability(); // Final update
                    
                    // Save expired state
                    saveTimerState();
                }
            }
        }, 1000);
        
        console.log('✅ Countdown interval started');
    }
    // Timer initialization - polling system handles all timer updates
    function startCountdown(el) {
        // No-op: Timer updates are handled by initializePollingTimerUpdates
    }

    async function handleWeightFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const weightDisplay = form.closest('.weight-display');
        const weightValue = weightDisplay.querySelector('.weight-value');
        const formData = new FormData(form);
        const submitBtn = form.querySelector('.submit-weight');
        const originalText = submitBtn.textContent;
        
        const weightInput = form.querySelector('input[name="weight"]');
        const newWeight = parseFloat(weightInput.value);
        
        if (!validateWeightSelection(form, newWeight)) {
            return;
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
                weightValue.textContent = newWeight + 'kg';
                toggleForm(weightValue);
                
                if (form.closest('.opening-weights-section')) {
                    updateAttempt1Display(form, newWeight);
                }
                
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

        const weightEl = infoEl.querySelector('.weight');
        if (weightEl && attempt.requested_weight) {
            weightEl.textContent = attempt.requested_weight;
        }
    }

    function updateAttempt1Display(openingWeightForm, newWeight) {
        const movementSection = openingWeightForm.closest('.movement-section');
        if (!movementSection) return;

        const attemptsSection = movementSection.querySelector('.attempts-section');
        if (!attemptsSection) return;

        const attempt1Elements = attemptsSection.querySelectorAll('.attempt');
        attempt1Elements.forEach(attemptEl => {
            const weightNote = attemptEl.querySelector('.weight-note');
            if (weightNote && weightNote.textContent.includes('Opening Weight')) {
                const weightValue = attemptEl.querySelector('.weight-value');
                if (weightValue) {
                    weightValue.textContent = newWeight + 'kg';
                }
            }
        });
    }

    function validateWeightSelection(form, newWeight) {
        if (form.closest('.opening-weights-section')) {
            return true;
        }

        const movementSection = form.closest('.movement-section');
        if (!movementSection) return true;

        const attemptsSection = movementSection.querySelector('.attempts-section');
        if (!attemptsSection) return true;

        const attempts = [];
        const attemptElements = attemptsSection.querySelectorAll('.attempt');
        
        attemptElements.forEach(attemptEl => {
            const attemptText = attemptEl.textContent;
            const attemptMatch = attemptText.match(/Attempt (\d+):/);
            if (!attemptMatch) return;
            
            const attemptNum = parseInt(attemptMatch[1]);
            const weightMatch = attemptText.match(/(\d+(?:\.\d+)?)kg/);
            const weight = weightMatch ? parseFloat(weightMatch[1]) : 0;
            
            const statusEl = attemptEl.querySelector('.status');
            const resultEl = attemptEl.querySelector('.result');
            const status = statusEl ? statusEl.textContent.trim().toLowerCase() : 'waiting';
            const result = resultEl ? resultEl.textContent.trim().toLowerCase().replace(/\s+/g, '_') : null;
            
            attempts.push({
                number: attemptNum,
                weight: weight,
                status: status,
                result: result,
                isCompleted: status === 'finished',
                isSuccessful: result === 'good_lift'
            });
        });

        attempts.sort((a, b) => a.number - b.number);

        const attemptIdInput = form.querySelector('input[name="attempt_id"]');
        if (!attemptIdInput) return true;

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

        const validationResult = applyWeightValidationRules(attempts, currentAttemptNum, newWeight);
        
        if (!validationResult.isValid) {
            alert(validationResult.message);
            return false;
        }

        return true;
    }

    function applyWeightValidationRules(attempts, currentAttemptNum, newWeight) {
        const firstSuccessfulAttempt = attempts.find(a => a.isCompleted && a.isSuccessful);
        if (firstSuccessfulAttempt && newWeight < firstSuccessfulAttempt.weight) {
            return {
                isValid: false,
                message: `Cannot select a weight lighter than your first successful attempt (${firstSuccessfulAttempt.weight}kg)`
            };
        }

        const previousAttempt = attempts.find(a => a.number === currentAttemptNum - 1);
        if (previousAttempt) {
            if (previousAttempt.isCompleted) {
                if (previousAttempt.isSuccessful) {
                    const suggestedWeight = previousAttempt.weight + 2.5;
                    if (newWeight < suggestedWeight) {
                        const confirmMsg = `Previous lift was successful. Suggested weight is ${suggestedWeight}kg (2.5kg increase). Continue with ${newWeight}kg?`;
                        if (!confirm(confirmMsg)) {
                            return { isValid: false, message: 'Weight selection cancelled' };
                        }
                    }
                } else {
                    if (newWeight < previousAttempt.weight) {
                        return {
                            isValid: false,
                            message: `Previous lift failed. You can repeat the same weight (${previousAttempt.weight}kg) or go heavier, but cannot go lighter.`
                        };
                    }
                    
                    if (newWeight === previousAttempt.weight) {
                        const confirmMsg = `Repeating the same weight (${newWeight}kg) after a failed attempt. Continue?`;
                        if (!confirm(confirmMsg)) {
                            return { isValid: false, message: 'Weight selection cancelled' };
                        }
                    }
                }
            } else {
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

        // Check if weight can be updated
    function canUpdateWeight(isOpeningWeight, attemptId = null) {
        if (isOpeningWeight) {
            // Opening weights can only be updated before event starts
            if (eventStarted) {
                return {
                    allowed: false,
                    message: 'Opening weights cannot be changed after the event has started.'
                };
            }
            return { allowed: true };
        }
        
        // For attempt weights
        if (currentAttemptTimeRemaining !== null) {
            // Check if this is the next attempt
            const isNextAttempt = attemptId && String(attemptId) === String(currentCountdownAttemptId);
            
            if (isNextAttempt) {
                // Cannot update if less than 3 minutes (180 seconds) remaining
                if (currentAttemptTimeRemaining < 180) {
                    const minutes = Math.floor(currentAttemptTimeRemaining / 60);
                    const seconds = currentAttemptTimeRemaining % 60;
                    return {
                        allowed: false,
                        message: `Cannot update weight with less than 3 minutes remaining. Current time: ${minutes}:${seconds.toString().padStart(2, '0')}`
                    };
                }
            }
        }
        
        return { allowed: true };
    }

    // Disable weight inputs based on restrictions
    function updateWeightInputAvailability() {
        // Handle opening weights
        document.querySelectorAll('.opening-weights-section .weight-display').forEach(display => {
            const weightValue = display.querySelector('.weight-value');
            const form = display.querySelector('.weight-form');
            
            if (!weightValue || !form) return;
            
            const canUpdate = canUpdateWeight(true);
            
            if (!canUpdate.allowed) {
                // Disable clicking to edit
                weightValue.style.cursor = 'not-allowed';
                weightValue.style.opacity = '0.6';
                weightValue.title = canUpdate.message;
                
                // Remove click handler
                const newWeightValue = weightValue.cloneNode(true);
                weightValue.parentNode.replaceChild(newWeightValue, weightValue);
                
                // Hide form if it's showing
                if (form.style.display !== 'none') {
                    newWeightValue.style.display = 'inline';
                    form.style.display = 'none';
                }
            } else {
                weightValue.style.cursor = 'pointer';
                weightValue.style.opacity = '1';
                weightValue.title = 'Click to edit';
            }
        });
        
        // Handle attempt weights
        document.querySelectorAll('.attempts-section .weight-display').forEach(display => {
            const weightValue = display.querySelector('.weight-value');
            const form = display.querySelector('.weight-form');
            const attemptEl = display.closest('.attempt');
            
            if (!weightValue || !form || !attemptEl) return;
            
            const attemptId = attemptEl.dataset.attemptId;
            const isOpeningWeight = display.querySelector('.weight-note')?.textContent.includes('Opening Weight');
            
            // Skip if this is showing opening weight (Attempt 1)
            if (isOpeningWeight) {
                const canUpdate = canUpdateWeight(true);
                if (!canUpdate.allowed) {
                    weightValue.style.cursor = 'not-allowed';
                    weightValue.style.opacity = '0.6';
                    weightValue.title = canUpdate.message;
                    
                    const newWeightValue = weightValue.cloneNode(true);
                    weightValue.parentNode.replaceChild(newWeightValue, weightValue);
                    
                    if (form.style.display !== 'none') {
                        newWeightValue.style.display = 'inline';
                        form.style.display = 'none';
                    }
                }
                return;
            }
            
            const canUpdate = canUpdateWeight(false, attemptId);
            
            if (!canUpdate.allowed) {
                weightValue.style.cursor = 'not-allowed';
                weightValue.style.opacity = '0.6';
                weightValue.title = canUpdate.message;
                
                // Remove click handler by cloning
                const newWeightValue = weightValue.cloneNode(true);
                weightValue.parentNode.replaceChild(newWeightValue, weightValue);
                
                // Hide form if showing
                if (form.style.display !== 'none') {
                    newWeightValue.style.display = 'inline';
                    form.style.display = 'none';
                }
            } else {
                weightValue.style.cursor = 'pointer';
                weightValue.style.opacity = '1';
                weightValue.title = 'Click to edit';
            }
        });
    }

    // Detect event start from server data
    function updateEventStatus(data) {
        // Event is considered started if there's any timer activity or completed attempts
        if (data.timer_active || data.has_completed_attempts) {
            if (!eventStarted) {
                eventStarted = true;
                console.log('🏁 Event has started - opening weights now locked');
                updateWeightInputAvailability();
            }
        }
    }
    // Form initialization
    function initializeForms(container = document) {
        container.querySelectorAll('.weight-display').forEach(display => {
            const weightValue = display.querySelector('.weight-value');
            const form = display.querySelector('.weight-form');
            
            if (!weightValue || !form) return;

            weightValue.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleForm(weightValue);
            });

            form.addEventListener('submit', handleWeightFormSubmit);
        });
    }

    // Initialize when DOM ready
    document.addEventListener("DOMContentLoaded", () => {
        const notificationBtn = document.getElementById('enable-notifications');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', enableNotifications);
        }
        
        const buttons = bySelAll(".event-button");
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                const target = this.dataset.target;
                showEvent(target);
            });
        });

        const firstButton = document.querySelector('.event-button.active') || document.querySelector('.event-button');
        if (firstButton) {
            const target = firstButton.dataset.target;
            showEvent(target);
            firstButton.classList.add('active');
        }
        
        initializeForms();
        
        // Restore timer state before initializing WebSocket/polling
        const restored = restoreTimerState();
        if (restored) {
            console.log('✅ Timer state restored from previous session');
        }
        
        initializeWebSocket();
        updateWeightInputAvailability(); // Initialize restrictions on page load
    });

    // WebSocket connection
    function initializeWebSocket() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO not available - falling back to polling');
            initializePollingTimerUpdates();
            return;
        }

        const socket = io();
        
        socket.on('connect', () => {
            console.log('Connected to real-time server');
            
            const competitionMeta = window.competitionData;
            if (competitionMeta && competitionMeta.id) {
                socket.emit('join_competition', {
                    competition_id: competitionMeta.id,
                    user_type: 'athlete'
                });
            }
        });

        socket.on('timer_update', (data) => {
            // Normalize fields from websocket payload to the polling schema
            const serverTime = (data.remaining !== undefined) ? data.remaining : (data.time !== undefined ? data.time : null);
            const serverTimerType = data.type || data.timer_type || null;

            // Attempt id may come as attempt_id or encoded in timer_id like 'attempt_123'
            let serverAttemptId = data.attempt_id || null;
            if (!serverAttemptId && data.timer_id && typeof data.timer_id === 'string' && data.timer_id.startsWith('attempt_')) {
                serverAttemptId = data.timer_id.split('_')[1];
            }

            // If we don't have a usable time/type, fallback to simple display update
            if (serverTime === null || serverTimerType === null) {
                if (serverTime !== null && serverTimerType !== null) {
                    updateTimerDisplay(serverTime, serverTimerType, data.state);
                }
                return;
            }

            // Use similar restart/resync logic as polling handler so websocket-driven changes
            // (for example: attempt order updates) will start the countdown even when the
            // client previously showed 'ready' (timerHasExpired = true).
            checkAndNotify(serverTime, serverTimerType, currentAttemptInfo);

            const noCountdown = !timerCountdownInterval;
            const differentAttempt = String(currentCountdownAttemptId) !== String(serverAttemptId);
            const differentType = lastTimerType !== serverTimerType;
            const significantTimeChange = timerCountdownInterval && lastServerTime !== null && Math.abs(serverTime - lastServerTime) > 30;

            // If the timer had previously expired, allow websocket to restart it.
            const needRestart = noCountdown || differentAttempt || differentType || significantTimeChange || timerHasExpired;

            if (needRestart) {
                if (significantTimeChange) {
                    console.log(`⚡ [WS] Queue changed - restarting timer: old=${lastServerTime}s, new=${serverTime}s, diff=${Math.abs(serverTime - lastServerTime)}s`);
                } else {
                    console.log(`🔄 [WS] Timer START: attempt=${serverAttemptId}, type=${serverTimerType}, time=${serverTime}s`);
                }

                timerHasExpired = false;
                startLocalCountdown(serverTime, serverTimerType, currentAttemptInfo);
                currentCountdownAttemptId = serverAttemptId;
                lastTimerType = serverTimerType;
                lastServerTime = serverTime;
            } else {
                // Lightweight update - don't restart interval but refresh the last server time
                lastServerTime = serverTime;
                updateTimerDisplay(serverTime, serverTimerType, data.state);
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from real-time server');
            initializePollingTimerUpdates();
        });

        socket.on('connect_error', () => {
            console.warn('WebSocket failed - falling back to polling');
            initializePollingTimerUpdates();
        });
    }

    // Polling-based timer updates (works without WebSocket)
    function initializePollingTimerUpdates() {
        console.log('Using polling for timer updates');
        
        let connectionFailures = 0;
        const maxFailures = 3;
        let pollingIntervalId = null;
        let activeEventId = null;
        let isInitialized = false;
        
        // Grace period to prevent overwriting restored state
        const restoredFromStorage = !!timerCountdownInterval;
        let gracePeriodActive = restoredFromStorage;
        let gracePeriodEnd = restoredFromStorage ? Date.now() + 5000 : 0; // 5 second grace period
        
        if (restoredFromStorage) {
            console.log('🛡️ Timer restored - activating 5s grace period to prevent restart');
        }
        
        async function getActiveEvent() {
            try {
                const response = await fetch('/athlete/get-active-event');
                if (response.ok) {
                    const eventData = await response.json();
                    if (eventData.active_event) {
                        activeEventId = eventData.active_event.id;
                    }
                }
            } catch (error) {
                // Silent fail
            }
            isInitialized = true;
        }
        
        getActiveEvent().then(startPolling).catch(startPolling);
        
        function startPolling() {
            // Poll every 3 seconds (reduced frequency to minimize restarts)
            pollingIntervalId = setInterval(async () => {
                try {
                    // CRITICAL: Check if timer has expired BEFORE making any requests
                    if (timerHasExpired) {
                        console.log('🛑 Timer expired - staying at GET READY, skipping poll');
                        // Still update the info display if we have current attempt info
                        const infoEl = document.querySelector('.next-attempt-info');
                        if (infoEl && currentAttemptInfo) {
                            updateTimerInfoDisplay(infoEl, {
                                event: currentAttemptInfo.event,
                                lift_type: currentAttemptInfo.lift_type,
                                order: currentAttemptInfo.order,
                                weight: currentAttemptInfo.weight,
                                no_attempts: false
                            });
                        }
                        return; // Exit without fetching new data
                    }
                    
                    let url = '/athlete/next-attempt-timer';
                    if (activeEventId) {
                        url += `?event_id=${activeEventId}`;
                    }
                    
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const data = await response.json();
                    // If we restored state from localStorage, but the server now reports a
                    // different event/attempt, drop the restored state so the UI follows
                    // the live server data. This prevents stale "GET READY" from persisting
                    // across event/flight changes.
                    if (typeof restoredFromStorage !== 'undefined' && restoredFromStorage) {
                        try {
                            const restoredEventId = currentAttemptInfo && currentAttemptInfo.event && currentAttemptInfo.event.id;
                            const serverEventId = data.event && data.event.id;
                            const restoredAttemptId = currentCountdownAttemptId;
                            const serverAttemptId = data.attempt_id || null;

                            // If server reports a different event or a different attempt id,
                            // clear any restored countdown so polling logic can start fresh.
                            if ((restoredEventId && serverEventId && String(restoredEventId) !== String(serverEventId)) ||
                                (restoredAttemptId && serverAttemptId && String(restoredAttemptId) !== String(serverAttemptId))) {
                                console.log('🧹 Discarding restored timer state because server reports a different event/attempt');
                                if (timerCountdownInterval) {
                                    clearInterval(timerCountdownInterval);
                                    timerCountdownInterval = null;
                                }
                                timerHasExpired = false;
                                currentAttemptInfo = null;
                                currentCountdownAttemptId = null;
                                lastTimerType = null;
                                restoredFromStorage = false;
                            }
                        } catch (e) {
                            console.warn('Error reconciling restored state with server data:', e);
                        }
                    }

                    updateEventStatus(data);
                    connectionFailures = 0;
                    
                    // Refresh event context every 5 minutes
                    if (Date.now() % 300000 < 3000) {
                        getActiveEvent();
                    }
                    
                    const infoEl = document.querySelector('.next-attempt-info');
                    
                    if (!isInitialized) {
                        updateTimerDisplay(0, 'inactive', 'inactive');
                        if (infoEl) infoEl.innerHTML = '<p>Loading...</p>';
                        return;
                    }
                    
                    // Store attempt info with full event data for display when expired
                    if (data.event && data.lift_type) {
                        currentAttemptInfo = {
                            event: data.event,
                            lift_type: data.lift_type,
                            order: data.order,
                            weight: data.weight
                        };
                    }
                    
                    if (data.no_attempts) {
                        currentAttemptInfo = null;
                        currentCountdownAttemptId = null;
                        lastTimerType = null;
                        timerHasExpired = false; // Reset on no attempts
                        if (timerCountdownInterval) {
                            clearInterval(timerCountdownInterval);
                            timerCountdownInterval = null;
                        }
                        updateTimerDisplay(0, 'inactive', 'inactive');
                        if (infoEl) infoEl.innerHTML = '<p>' + (data.message || 'No attempt left') + '</p>';
                    } else if (!data.error && data.is_first_in_queue) {
                        // Athlete is first in queue - show "YOU ARE UP"
                        currentAttemptInfo = null;
                        currentCountdownAttemptId = data.attempt_id || null;
                        lastTimerType = 'you-are-up';
                        timerHasExpired = false;
                        
                        if (timerCountdownInterval) {
                            clearInterval(timerCountdownInterval);
                            timerCountdownInterval = null;
                        }
                        
                        updateTimerDisplay(0, 'you-are-up', '');
                        updateTimerInfoDisplay(infoEl, data);
                    } else if (!data.error && data.timer_active && data.time !== null) {
                        checkAndNotify(data.time, data.timer_type, currentAttemptInfo);

                        const serverAttemptId = data.attempt_id || null;
                        const serverTimerType = data.timer_type || null;
                        const serverTime = data.time;

                        const noCountdown = !timerCountdownInterval;
                        const differentAttempt = String(currentCountdownAttemptId) !== String(serverAttemptId);
                        const differentType = lastTimerType !== serverTimerType;
                        
                        // Detect significant time changes (queue changed, attempt order updated, status changed)
                        // Only check if countdown is running and we have a previous server time
                        // Increase threshold to 30 seconds to avoid restarts from network delays
                        const significantTimeChange = timerCountdownInterval && 
                                                    lastServerTime !== null && 
                                                    Math.abs(serverTime - lastServerTime) > 30; // 30+ second difference

                        const needRestart = noCountdown || differentAttempt || differentType || significantTimeChange;

                        if (needRestart) {
                            if (significantTimeChange) {
                                console.log(`⚡ Queue changed - restarting timer: old=${lastServerTime}s, new=${serverTime}s, diff=${Math.abs(serverTime - lastServerTime)}s`);
                            } else {
                                console.log(`🔄 Timer START: attempt=${serverAttemptId}, type=${serverTimerType}, time=${serverTime}s`);
                            }
                            
                            timerHasExpired = false; // Reset expired flag when starting new timer
                            startLocalCountdown(serverTime, data.timer_type, currentAttemptInfo);
                            currentCountdownAttemptId = serverAttemptId;
                            lastTimerType = serverTimerType;
                            lastServerTime = serverTime; // Track this server time
                        } else {
                            // Update lastServerTime for next comparison (but don't restart)
                            lastServerTime = serverTime;
                        }

                        updateTimerInfoDisplay(infoEl, data);
                    } else {
                        currentAttemptInfo = null;
                        currentCountdownAttemptId = null;
                        lastTimerType = null;
                        timerHasExpired = false; // Reset on inactive
                        if (timerCountdownInterval) {
                            clearInterval(timerCountdownInterval);
                            timerCountdownInterval = null;
                        }
                        updateTimerDisplay(0, 'inactive', 'inactive');
                        if (infoEl) infoEl.innerHTML = '<p>No upcoming attempts</p>';
                    }
                } catch (error) {
                    connectionFailures++;
                    console.warn(`Polling failed (${connectionFailures}/${maxFailures}):`, error.message);
                    
                    if (connectionFailures >= maxFailures) {
                        console.log('Max failures reached. Stopping polling.');
                        if (pollingIntervalId) {
                            clearInterval(pollingIntervalId);
                            pollingIntervalId = null;
                        }
                        
                        updateTimerDisplay(0, 'disconnected', 'disconnected');
                        const infoEl = document.querySelector('.next-attempt-info');
                        if (infoEl) infoEl.innerHTML = '<p>Server disconnected</p>';
                    } else {
                        updateTimerDisplay(0, 'error', 'error');
                    }
                }
            }, 3000); // Poll every 3 seconds
        }
    }

    // Make functions globally available
    window.showEvent = showEvent;
    window.toggleForm = toggleForm;

    
})();