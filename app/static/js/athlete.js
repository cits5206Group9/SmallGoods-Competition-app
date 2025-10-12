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
    let lastServerTime = null;
    let currentAttemptInfo = null;

    let eventStarted = false; // Track if event has started
    let currentAttemptTimeRemaining = null; // Track time until next attempt
    let readyPollingIntervalId = null;
    const READY_POLL_INTERVAL_MS = 3000;
    
    // NEW: Grace period and GET READY timeout
    let gracePeriodActive = false;
    let gracePeriodEnd = 0;
    const GRACE_PERIOD_DURATION = 5000; // 5 seconds after restore
    
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
                currentAttemptInfo,
                hasInterval: !!timerCountdownInterval,
                savedAt: Date.now()
            };
            localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save timer state:', e);
        }
    }
    
    // UPDATED: Restore timer state from localStorage - never restore expired states
    function restoreTimerState() {
        try {
            const stored = localStorage.getItem(TIMER_STATE_KEY);
            if (!stored) return false;
            
            const state = JSON.parse(stored);
            
            // Don't restore if state is too old (15 minutes)
            const stateAge = Date.now() - state.savedAt;
            if (stateAge > 15 * 60 * 1000) {
                console.log('🧹 Stored state too old (>15min) - discarding');
                localStorage.removeItem(TIMER_STATE_KEY);
                return false;
            }
            
            // NEVER restore expired states
            if (state.timerHasExpired) {
                console.log('🧹 Not restoring expired state');
                localStorage.removeItem(TIMER_STATE_KEY);
                return false;
            }
            
            // Only restore if countdown was actually running
            if (!state.hasInterval || !state.timerTargetSeconds || state.timerTargetSeconds <= 0) {
                console.log('🧹 No valid countdown to restore');
                localStorage.removeItem(TIMER_STATE_KEY);
                return false;
            }
            
            // Calculate current remaining time
            const elapsedSinceLastUpdate = Math.floor((Date.now() - state.timerLastUpdate) / 1000);
            timerTargetSeconds = Math.max(0, state.timerTargetSeconds - elapsedSinceLastUpdate);
            
            // Don't restore if time has expired
            if (timerTargetSeconds <= 0) {
                console.log('🧹 Timer would be expired - not restoring');
                localStorage.removeItem(TIMER_STATE_KEY);
                return false;
            }
            
            // Restore state
            timerHasExpired = false;
            currentCountdownAttemptId = state.currentCountdownAttemptId;
            lastTimerType = state.lastTimerType;
            lastServerTime = state.lastServerTime;
            currentAttemptInfo = state.currentAttemptInfo;
            timerLastUpdate = Date.now();
            
            console.log(`🔄 Restored timer: ${timerTargetSeconds}s remaining (was ${state.timerTargetSeconds}s, ${elapsedSinceLastUpdate}s ago)`);
            
            // Activate grace period to prevent immediate restart
            gracePeriodActive = true;
            gracePeriodEnd = Date.now() + GRACE_PERIOD_DURATION;
            console.log(`🛡️ Grace period activated for ${GRACE_PERIOD_DURATION/1000}s`);
            
            // Restart countdown
            startLocalCountdown(timerTargetSeconds, state.lastTimerType, currentAttemptInfo);
            
            // Restore UI
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
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';
            btn.disabled = true;
            btn.style.display = 'block';
        } else {
            btn.textContent = '🔔';
            btn.style.background = '#4CAF50';
            btn.style.opacity = '0.6';
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

        if (remaining <= 0 && timerType !== 'you-are-up' && timerType !== 'ready' && timerType !== 'break_between_flights') {
            timerEl.textContent = '--:--';
        } else if (timerType === 'you-are-up') {
            timerEl.textContent = 'YOU ARE UP!';
            timerEl.classList.add('you-are-up');
        } else if (timerType === 'ready') {
            timerEl.textContent = 'GET READY!';
            timerEl.classList.add('ready');
            timerEl.classList.remove('you-are-up');
        } else if (timerType === 'break_between_flights') {
            if (remaining <= 0) {
                timerEl.textContent = 'YOU ARE UP!';
                timerEl.classList.add('you-are-up');
                timerEl.classList.remove('break-timer');
            } else {
                const m = Math.floor(remaining / 60);
                const s = Math.floor(remaining % 60);
                timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
                timerEl.classList.add('break-timer');
                timerEl.classList.remove('you-are-up', 'ready');
            }
        } else {
            const m = Math.floor(remaining / 60);
            const s = Math.floor(remaining % 60);
            timerEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
            timerEl.classList.remove('you-are-up', 'ready', 'break-timer');
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

    // UPDATED: Start local countdown timer
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
            updateWeightInputAvailability();
            return;
        }
        
        // Handle break timer - should countdown normally but with special display
        if (timerType === 'break_between_flights') {
            console.log('🔄 Starting break timer countdown:', initialSeconds);
        }
        
        timerTargetSeconds = initialSeconds;
        timerLastUpdate = Date.now();
        currentAttemptTimeRemaining = initialSeconds;
        
        // Update immediately
        updateTimerDisplay(timerTargetSeconds, timerType, '');
        checkAndNotify(timerTargetSeconds, timerType, attemptInfo);
        updateWeightInputAvailability();
        
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
                updateWeightInputAvailability();
                
                // Save state every second
                saveTimerState();
                
                // Stop countdown when reaching 0
                if (timerTargetSeconds <= 0) {
                    console.log('⏱️ Countdown complete - stopping interval');
                    clearInterval(timerCountdownInterval);
                    timerCountdownInterval = null;
                    currentAttemptTimeRemaining = 0;
                    
                    // Handle expiry
                    handleExpiredTimer();
                }
            }
        }, 1000);
        
        console.log('✅ Countdown interval started');
    }

    // Timer initialization - polling system handles all timer updates
    function startCountdown(el) {
        // No-op: Timer updates are handled by initializePollingTimerUpdates
    }

    // Fetch the next-attempt timer data from server
    async function refreshNextAttemptFromServer() {
        try {
            let url = '/athlete/next-attempt-timer';
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();

            try { updateEventStatus(data); } catch (e) { /* ignore */ }
            return data;
        } catch (e) {
            console.warn('refreshNextAttemptFromServer failed:', e);
            return null;
        }
    }

    function stopReadyPolling() {
        if (readyPollingIntervalId) {
            clearInterval(readyPollingIntervalId);
            readyPollingIntervalId = null;
        }
    }

    function handleExpiredTimer() {
        timerHasExpired = true;
        
        // Check the timer type to determine what to show after expiration
        if (lastTimerType === 'break_between_flights') {
            // Break timer expired - show YOU ARE UP immediately
            updateTimerDisplay(0, 'you-are-up', '');
            console.log('Break timer expired - transitioning to YOU ARE UP');
        } else {
            // Regular timer expired - show GET READY as default
            // The polling will detect is_first_of_flight and transition appropriately
            updateTimerDisplay(0, 'ready', '');
            console.log('Timer expired - showing GET READY (will check for first-of-flight status)');
        }
        
        updateWeightInputAvailability();
        saveTimerState();
        scheduleReadyPolling();
    }
    function scheduleReadyPolling() {
        stopReadyPolling();
        checkServerForUpdate();
        
        // Poll every 3 seconds - NO timeout
        readyPollingIntervalId = setInterval(async () => {
            try {
                if (!timerHasExpired) {
                    stopReadyPolling();
                    return;
                }
                await checkServerForUpdate();
            } catch (e) {
                console.warn('Ready polling error:', e);
            }
        }, READY_POLL_INTERVAL_MS);
    }

    // Check server for state changes during GET READY
    async function checkServerForUpdate() {
        try {
            const data = await refreshNextAttemptFromServer();
            if (!data) return;
            
            // Transition to YOU ARE UP when:
            // 1. Status is in-progress, OR
            // 2. First in queue (regardless of first-of-flight status after timer expires)
            if (data.status === 'in-progress') {
                console.log('âœ… Attempt in-progress - transitioning to YOU ARE UP');
                timerHasExpired = false;
                stopReadyPolling();
                
                currentCountdownAttemptId = data.attempt_id;
                lastTimerType = 'you-are-up';
                updateTimerDisplay(0, 'you-are-up', '');
                
                const infoEl = document.querySelector('.next-attempt-info');
                if (infoEl) updateTimerInfoDisplay(infoEl, data);
            }
            else if (data.is_first_in_queue) {
                console.log('âœ… First in queue after timer expiry - showing YOU ARE UP');
                timerHasExpired = false;
                stopReadyPolling();
                
                currentCountdownAttemptId = data.attempt_id;
                lastTimerType = 'you-are-up';
                updateTimerDisplay(0, 'you-are-up', '');
                
                const infoEl = document.querySelector('.next-attempt-info');
                if (infoEl) updateTimerInfoDisplay(infoEl, data);
            }
            else if (data.attempt_id && String(data.attempt_id) !== String(currentCountdownAttemptId)) {
                console.log('âœ… New attempt loaded - restarting countdown');
                timerHasExpired = false;
                stopReadyPolling();
                
                currentAttemptInfo = {
                    event: data.event,
                    lift_type: data.lift_type,
                    order: data.order,
                    weight: data.weight
                };
            }
            // Keep showing attempt info during GET READY
            else {
                const infoEl = document.querySelector('.next-attempt-info');
                if (infoEl && data.lift_type) {
                    updateTimerInfoDisplay(infoEl, {
                        event: data.event,
                        lift_type: data.lift_type,
                        order: data.order,
                        weight: data.weight,
                        no_attempts: false
                    });
                }
            }
            
        } catch (e) {
            console.warn('Server check failed:', e);
        }
    }
    // Only restart when attempt/details change
    function shouldRestartTimer(serverData) {
        // Never restart during grace period
        if (gracePeriodActive && Date.now() < gracePeriodEnd) {
            console.log('Grace period active - preventing restart');
            return false;
        }
        
        // Always restart if no countdown is running
        if (!timerCountdownInterval) {
            console.log('No countdown running - restart needed');
            return true;
        }
        
        // Check if attempt ID changed (queue order changed)
        const serverAttemptId = serverData.attempt_id;
        if (String(currentCountdownAttemptId) !== String(serverAttemptId)) {
            console.log(`Attempt ID changed: ${currentCountdownAttemptId} → ${serverAttemptId}`);
            return true;
        }
        
        // Check if attempt details changed (weight or order updated)
        if (currentAttemptInfo) {
            const weightChanged = currentAttemptInfo.weight !== serverData.weight;
            const orderChanged = currentAttemptInfo.order !== serverData.order;
            const liftTypeChanged = currentAttemptInfo.lift_type !== serverData.lift_type;
            
            if (weightChanged) {
                console.log(`Weight changed: ${currentAttemptInfo.weight} → ${serverData.weight}`);
                return true;
            }
            
            if (orderChanged) {
                console.log(`Order changed: ${currentAttemptInfo.order} → ${serverData.order}`);
                return true;
            }

            if (liftTypeChanged) {
            console.log(`Lift type changed: ${currentAttemptInfo.lift_type} → ${serverData.lift_type}`);
            return true;
        }
        }
        // Check if the estimated time has changed significantly (more than 10 seconds)
        if (serverData.time && lastServerTime) {
            const timeDiff = Math.abs(serverData.time - lastServerTime);
            // If server time differs by more than 10 seconds from what we expect, restart
            if (timeDiff > 10) {
                console.log(`Time jumped significantly: ${lastServerTime}s → ${serverData.time}s (diff: ${timeDiff}s)`);
                return true;
            }
        }
        
        // No restart needed - continue current countdown
        return false;
    }
    function handleActiveTimer(data, infoEl) {
    const serverTime = data.time;
    const isFirstOfFlight = data.is_first_of_flight;
    const isFirstInQueue = data.is_first_in_queue;
    
    console.log(`Active timer: time=${serverTime}s, first_in_queue=${isFirstInQueue}, first_of_flight=${isFirstOfFlight}`);
    
    checkAndNotify(serverTime, data.timer_type, currentAttemptInfo);
    
    // ALWAYS update currentAttemptInfo with latest data from server
    if (data.event && data.lift_type) {
        currentAttemptInfo = {
            event: data.event,
            lift_type: data.lift_type,
            order: data.order,
            weight: data.weight
        };
    }
    
    // Special handling for first attempt of flight
    if (isFirstOfFlight && isFirstInQueue) {
        if (serverTime <= 0) {
            console.log('First attempt timer expired - transitioning to YOU ARE UP');
            handleYouAreUp(data, infoEl);
            return;
        }
        
        if (shouldRestartTimer(data)) {
            console.log(`Restarting first-attempt countdown: time=${serverTime}s`);
            
            timerHasExpired = false;
            startLocalCountdown(serverTime, data.timer_type, currentAttemptInfo);
            currentCountdownAttemptId = data.attempt_id;
            lastTimerType = data.timer_type;
            lastServerTime = serverTime;
        } else {
            lastServerTime = serverTime;
        }
        
        updateTimerInfoDisplay(infoEl, data);
        return;
    }
    
    // Normal timer handling for non-first attempts
    if (shouldRestartTimer(data)) {
        console.log(`Restarting timer: attempt=${data.attempt_id}, time=${serverTime}s`);
        
        timerHasExpired = false;
        startLocalCountdown(serverTime, data.timer_type, currentAttemptInfo);
        currentCountdownAttemptId = data.attempt_id;
        lastTimerType = data.timer_type;
        lastServerTime = serverTime;
    } else {
        lastServerTime = serverTime;
    }
    
    // ALWAYS update the display with latest data
    updateTimerInfoDisplay(infoEl, data);
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

    // UPDATED: Check if weight can be updated - separate logic for opening vs attempt weights
    function canUpdateWeight(isOpeningWeight, attemptId = null) {
        if (isOpeningWeight) {
            // Opening weights blocked ONLY when event has actually started
            // (when ANY attempt goes to in-progress status)
            // NOT affected by timer countdowns or "YOU ARE UP" states
            if (eventStarted) {
                return {
                    allowed: false,
                    message: 'Opening weights cannot be changed after the first attempt has started.'
                };
            }
            return { allowed: true };
        }
        
        // For attempt weights - check 3-minute rule for THIS specific attempt
        if (attemptId && currentAttemptTimeRemaining !== null) {
            // Only restrict if this IS the next attempt
            const isNextAttempt = String(attemptId) === String(currentCountdownAttemptId);
            
            if (isNextAttempt && currentAttemptTimeRemaining < 180) {
                const minutes = Math.floor(currentAttemptTimeRemaining / 60);
                const seconds = currentAttemptTimeRemaining % 60;
                return {
                    allowed: false,
                    message: `Cannot update weight with less than 3 minutes remaining. Current time: ${minutes}:${seconds.toString().padStart(2, '0')}`
                };
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

    // UPDATED: Detect event start from server data - only in-progress sets eventStarted
    function updateEventStatus(data) {
        // Event is started ONLY when has_in_progress_attempts flag is true
        // Timer countdowns do NOT affect opening weight availability
        if (data.has_in_progress_attempts) {
            if (!eventStarted) {
                eventStarted = true;
                console.log('🏁 Event has started (in-progress attempts detected) - opening weights now locked');
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
            console.log('Timer state restored from previous session');
        }
        
        initializeWebSocket();
        updateWeightInputAvailability(); // Initialize restrictions on page load
    });

    // UPDATED: WebSocket connection with simplified restart logic
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
            console.log('WebSocket timer update:', data);
            
            // Normalize websocket data to match polling format
            const serverTime = data.remaining !== undefined ? data.remaining : data.time;
            const serverTimerType = data.type || data.timer_type;
            const serverAttemptId = data.attempt_id;
            
            // Handle paused state
            if (data.state === 'paused' && data.source === 'timekeeper') {
                console.log('⏸Timer paused by timekeeper');
                if (timerCountdownInterval) {
                    clearInterval(timerCountdownInterval);
                    timerCountdownInterval = null;
                }
                updateTimerDisplay(serverTime, 'paused', 'paused');
                return;
            }
            
            // Build normalized data object
            const normalizedData = {
                attempt_id: serverAttemptId,
                time: serverTime,
                timer_type: serverTimerType,
                timer_active: serverTime > 0,
                is_first_in_queue: serverTimerType === 'you-are-up',
                status: data.status || 'waiting',
                weight: data.weight || (currentAttemptInfo ? currentAttemptInfo.weight : 0),
                order: data.order || (currentAttemptInfo ? currentAttemptInfo.order : 1),
                lift_type: data.lift_type || (currentAttemptInfo ? currentAttemptInfo.lift_type : ''),
                event: currentAttemptInfo ? currentAttemptInfo.event : null
            };
            
            // Use same restart logic as polling
            if (normalizedData.is_first_in_queue) {
                handleYouAreUp(normalizedData, document.querySelector('.next-attempt-info'));
            } else if (shouldRestartTimer(normalizedData)) {
                console.log('[WebSocket] Restarting timer');
                timerHasExpired = false;
                readyStateStartTime = null;
                startLocalCountdown(serverTime, serverTimerType, currentAttemptInfo);
                currentCountdownAttemptId = serverAttemptId;
                lastTimerType = serverTimerType;
                lastServerTime = serverTime;
            } else {
                lastServerTime = serverTime;
            }
        });

        socket.on('attempt_result', (payload) => {
            console.log('[WebSocket] Attempt result received', payload);
            // Refresh next-attempt info when an attempt completes
            refreshNextAttemptFromServer().then(() => {
                if (!timerHasExpired) stopReadyPolling();
            });
        });

        socket.on('disconnect', (reason) => {
            console.warn('🔌 Socket disconnected:', reason);
            clearTimerStateForDisconnect();
            updateTimerDisplay(0, 'disconnected', 'disconnected');
            const infoEl = document.querySelector('.next-attempt-info');
            if (infoEl) infoEl.innerHTML = '<p>Server disconnected</p>';
            
            // Fallback to polling
            initializePollingTimerUpdates();
        });

        socket.on('connect_error', (err) => {
            console.warn('🔌 WebSocket connection error:', err);
            clearTimerStateForDisconnect();
            updateTimerDisplay(0, 'disconnected', 'disconnected');
            const infoEl = document.querySelector('.next-attempt-info');
            if (infoEl) infoEl.innerHTML = '<p>Server disconnected</p>';
            
            initializePollingTimerUpdates();
        });
        
        function clearTimerStateForDisconnect() {
            if (timerCountdownInterval) {
                clearInterval(timerCountdownInterval);
                timerCountdownInterval = null;
            }
            timerHasExpired = false;
            readyStateStartTime = null;
            currentCountdownAttemptId = null;
            lastTimerType = null;
            stopReadyPolling();
            try { localStorage.removeItem(TIMER_STATE_KEY); } catch (e) {}
        }
        
        function handleYouAreUp(data, infoEl) {
            if (timerCountdownInterval) {
                clearInterval(timerCountdownInterval);
                timerCountdownInterval = null;
            }
            
            currentCountdownAttemptId = data.attempt_id || null;
            lastTimerType = 'you-are-up';
            timerHasExpired = false;
            readyStateStartTime = null;
            
            updateTimerDisplay(0, 'you-are-up', '');
            updateTimerInfoDisplay(infoEl, data);
            updateWeightInputAvailability();
        }
    }

    // UPDATED: Polling-based timer updates with simplified restart logic
    function initializePollingTimerUpdates() {
        console.log('Using polling for timer updates');
        
        let connectionFailures = 0;
        const maxFailures = 3;
        let pollingIntervalId = null;
        let activeEventId = null;
        let isInitialized = false;
        
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
            // Poll every 3 seconds
            pollingIntervalId = setInterval(async () => {
                try {
                    // End grace period if expired
                    if (gracePeriodActive && Date.now() >= gracePeriodEnd) {
                        gracePeriodActive = false;
                        console.log('Grace period ended');
                    }
                    
                    // If in expired state, let ready polling handle it
                    if (timerHasExpired) {
                        return;
                    }
                    
                    // Fetch server data
                    let url = '/athlete/next-attempt-timer';
                    if (activeEventId) {
                        url += `?event_id=${activeEventId}`;
                    }
                    
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    // Update event status (for opening weight restrictions)
                    updateEventStatus(data);
                    connectionFailures = 0;
                    
                    const infoEl = document.querySelector('.next-attempt-info');
                    
                    if (!isInitialized) {
                        updateTimerDisplay(0, 'inactive', 'inactive');
                        if (infoEl) infoEl.innerHTML = '<p>Loading...</p>';
                        return;
                    }
                    
                    // Store current attempt info
                    if (data.event && data.lift_type) {
                        currentAttemptInfo = {
                            event: data.event,
                            lift_type: data.lift_type,
                            order: data.order,
                            weight: data.weight
                        };
                    }
                    
                    // Handle different response states
                    if (data.no_attempts) {
                        // No attempts left
                        handleNoAttempts(data, infoEl);
                        
                    } else if (data.timer_active && data.time !== null && data.time >= 0) {
                        // Active countdown (including break timers)
                        handleActiveTimer(data, infoEl);
                        
                    } else if (data.is_first_in_queue || data.status === 'in-progress') {
                        // Athlete is up - show YOU ARE UP (only when no active timer)
                        handleYouAreUp(data, infoEl);
                        
                    } else {
                        // Inactive state
                        handleInactive(infoEl);
                    }
                    
                } catch (error) {
                    connectionFailures++;
                    console.warn(`Polling failed (${connectionFailures}/${maxFailures}):`, error.message);
                    
                    if (connectionFailures >= maxFailures) {
                        handleDisconnection(pollingIntervalId);
                    } else {
                        updateTimerDisplay(0, 'error', 'error');
                    }
                }
            }, 3000); // Poll every 3 seconds
        }
        
        function handleNoAttempts(data, infoEl) {
            console.log('📭 No attempts left');
            clearTimerState();
            updateTimerDisplay(0, 'inactive', 'inactive');
            if (infoEl) infoEl.innerHTML = '<p>' + (data.message || 'No attempts left') + '</p>';
        }
        
        function handleYouAreUp(data, infoEl) {
            console.log('YOU ARE UP');
            
            // Clear any running countdown
            if (timerCountdownInterval) {
                clearInterval(timerCountdownInterval);
                timerCountdownInterval = null;
            }
            
            currentCountdownAttemptId = data.attempt_id || null;
            lastTimerType = 'you-are-up';
            timerHasExpired = false;
            readyStateStartTime = null;
            
            updateTimerDisplay(0, 'you-are-up', '');
            updateTimerInfoDisplay(infoEl, data);
            updateWeightInputAvailability();
        }
        
        function handleActiveTimer(data, infoEl) {
            const serverTime = data.time;
            const isFirstOfFlight = data.is_first_of_flight;
            const isFirstInQueue = data.is_first_in_queue;
            
            console.log(`ðŸ"µ Active timer: time=${serverTime}s, first_in_queue=${isFirstInQueue}, first_of_flight=${isFirstOfFlight}`);
            
            checkAndNotify(serverTime, data.timer_type, currentAttemptInfo);
            
            // Special handling for first attempt of flight
            if (isFirstOfFlight && isFirstInQueue) {
                // This is the first attempt of the flight AND athlete is first in queue
                // Show countdown timer until it expires, then transition to YOU ARE UP
                
                if (serverTime <= 0) {
                    // Timer has expired - transition to YOU ARE UP
                    console.log('First attempt timer expired - transitioning to YOU ARE UP');
                    handleYouAreUp(data, infoEl);
                    return;
                }
                
                // Continue countdown
                if (shouldRestartTimer(data)) {
                    console.log(`Restarting first-attempt countdown: time=${serverTime}s`);
                    
                    timerHasExpired = false;
                    readyStateStartTime = null;
                    startLocalCountdown(serverTime, data.timer_type, currentAttemptInfo);
                    currentCountdownAttemptId = data.attempt_id;
                    lastTimerType = data.timer_type;
                    lastServerTime = serverTime;
                } else {
                    lastServerTime = serverTime;
                }
                
                updateTimerInfoDisplay(infoEl, data);
                return;
            }
            
            // Normal timer handling for non-first attempts
            if (shouldRestartTimer(data)) {
                console.log(`Restarting timer: attempt=${data.attempt_id}, time=${serverTime}s`);
                
                timerHasExpired = false;
                readyStateStartTime = null;
                startLocalCountdown(serverTime, data.timer_type, currentAttemptInfo);
                currentCountdownAttemptId = data.attempt_id;
                lastTimerType = data.timer_type;
                lastServerTime = serverTime;
            } else {
                lastServerTime = serverTime;
            }
            
            updateTimerInfoDisplay(infoEl, data);
        }        
        function handleInactive(infoEl) {
            console.log('Inactive state');
            clearTimerState();
            updateTimerDisplay(0, 'inactive', 'inactive');
            if (infoEl) infoEl.innerHTML = '<p>No upcoming attempts</p>';
        }
        
        function clearTimerState() {
            currentAttemptInfo = null;
            currentCountdownAttemptId = null;
            lastTimerType = null;
            timerHasExpired = false;
            readyStateStartTime = null;
            
            if (timerCountdownInterval) {
                clearInterval(timerCountdownInterval);
                timerCountdownInterval = null;
            }
            
            try {
                localStorage.removeItem(TIMER_STATE_KEY);
            } catch (e) {}
        }
        
        function handleDisconnection(intervalId) {
            console.log('❌ Max failures reached - server disconnected');
            
            if (intervalId) {
                clearInterval(intervalId);
            }
            
            clearTimerState();
            stopReadyPolling();
            
            updateTimerDisplay(0, 'disconnected', 'disconnected');
            const infoEl = document.querySelector('.next-attempt-info');
            if (infoEl) infoEl.innerHTML = '<p>Server disconnected</p>';
        }
    }

    // Make functions globally available
    window.showEvent = showEvent;
    window.toggleForm = toggleForm;
})();