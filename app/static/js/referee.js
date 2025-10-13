// Referee Panel JavaScript
class RefereePanel {
    constructor() {
        this.currentCompetition = null;
        this.currentEvent = null;
        this.currentAthlete = null;
        this.athletesQueue = [];
        this.timerInterval = null;
        this.timerSeconds = 60;
        this.timerRunning = false;
        this.refereeVotes = {};
        this.currentAttemptData = {};
        this.refereeConfig = null;
        this.timerMode = 'attempt';
        this.isBreakActive = false;
        this.initialTimerSeconds = null;
        this.timerStartTimestamp = null;
        this.selectionStorageKey = 'referee_panel.selection';
        this.timerStorageKey = 'referee_panel.timer';
        this.isRestoringState = false;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadCompetitions();
        this.initSyncedTimer();
        await this.restoreSelectionState();
        this.restoreTimerState();
    }

    bindEvents() {
        // Competition selection
        const compSelect = document.getElementById('competition-select');
        if (compSelect) {
            compSelect.addEventListener('change', (e) => {
                this.selectCompetition(e.target.value);
            });
        }

        const eventSelect = document.getElementById('event-select');
        if (eventSelect) {
            eventSelect.addEventListener('change', (e) => {
                this.selectEvent(e.target.value);
            });
        }

        // Timer controls removed - now using synchronized timer from timekeeper
        // No local timer controls needed

        // Result buttons - use event delegation since buttons are dynamic
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('result-btn') && e.target.dataset.result) {
                this.selectResult(e.target.dataset.result, e.target.dataset.label);
            }
        });

        // Referee votes - use event delegation since buttons are dynamic
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('vote-btn') && e.target.dataset.referee) {
                this.recordRefereeVote(
                    e.target.dataset.referee,
                    e.target.dataset.vote,
                    e.target.dataset.label
                );
            }
        });

        // Action buttons
        document.getElementById('submit-decision').addEventListener('click', () => {
            this.submitDecision();
        });

        document.getElementById('next-athlete').addEventListener('click', () => {
            this.nextAthlete();
        });

        // Referees Setting button
        document.getElementById('referees-setting-btn').addEventListener('click', () => {
            this.openRefereesSettings();
        });

        // Technical decisions checkboxes
        document.querySelectorAll('.violation-checkboxes input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateTechnicalViolations();
            });
        });
    }

    getAttemptDefault() {
        const attempt = Number(this.currentEvent?.timer?.attempt_seconds);
        return Number.isFinite(attempt) && attempt > 0 ? Math.round(attempt) : 60;
    }

    getBreakDefault() {
        const brk = Number(this.currentEvent?.timer?.break_seconds);
        return Number.isFinite(brk) && brk > 0 ? Math.round(brk) : 120;
    }

    getDefaultForCurrentMode() {
        return this.timerMode === 'break' ? this.getBreakDefault() : this.getAttemptDefault();
    }

    saveSelectionState() {
        const eventIndex = this.currentCompetition?.events && this.currentEvent
            ? this.currentCompetition.events.indexOf(this.currentEvent)
            : null;
        const payload = {
            competitionId: this.currentCompetition?.id || null,
            eventIndex: eventIndex >= 0 ? eventIndex : null
        };
        try {
            localStorage.setItem(this.selectionStorageKey, JSON.stringify(payload));
        } catch (err) {
            console.warn('Unable to persist referee selection state:', err);
        }
    }

    async restoreSelectionState() {
        let stored;
        try {
            stored = JSON.parse(localStorage.getItem(this.selectionStorageKey) || 'null');
        } catch (err) {
            stored = null;
        }

        if (!stored || !stored.competitionId) {
            this.updateBreakButtonLabel();
            return false;
        }

        const compSelect = document.getElementById('competition-select');
        if (compSelect) {
            compSelect.value = String(stored.competitionId);
        }

        this.isRestoringState = true;
        await this.selectCompetition(stored.competitionId);

        if (stored.eventIndex != null && this.currentCompetition?.events?.[stored.eventIndex]) {
            const eventSel = document.getElementById('event-select');
            if (eventSel) {
                eventSel.value = String(stored.eventIndex);
            }
            this.selectEvent(String(stored.eventIndex));
        }
        this.isRestoringState = false;

        this.updateBreakButtonLabel();
        return true;
    }

    applyEventTimerDefaults() {
        if (this.isRestoringState) {
            this.updateBreakButtonLabel();
            return;
        }

        if (!this.timerRunning && !this.isBreakActive) {
            this.timerMode = 'attempt';
            this.timerSeconds = this.getAttemptDefault();
            this.updateTimerDisplay();
            this.updateTimerButton();
            this.persistTimerState();
        }

        this.updateBreakButtonLabel();
    }

    async loadCompetitions() {
        try {
            const response = await fetch('/admin/api/competitions');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const competitions = await response.json();
            
            const select = document.getElementById('competition-select');
            select.innerHTML = '<option value="">Select Competition</option>';
            
            if (competitions.length === 0) {
                select.innerHTML = '<option value="">No competitions available</option>';
                this.showNotification('No competitions found. Please create a competition first.', 'warning');
                return;
            }
            
            competitions.forEach(comp => {
                const option = document.createElement('option');
                option.value = comp.id;
                option.textContent = comp.name;
                select.appendChild(option);
            });
            
            this.showNotification(`Found ${competitions.length} competition(s)`, 'info');
        } catch (error) {
            console.error('Error loading competitions:', error);
            this.showNotification(`Error loading competitions: ${error.message}`, 'error');
        }
    }

    async selectCompetition(competitionId) {
        if (!competitionId) {
            this.currentCompetition = null;
            this.currentEvent = null;
            this.clearEventSelect();
            this.stopTimer();
            this.isBreakActive = false;
            this.timerMode = 'attempt';
            this.timerSeconds = this.getAttemptDefault();
            this.updateTimerDisplay();
            this.updateTimerButton();
            this.updateBreakButtonLabel();
            this.saveSelectionState();
            this.persistTimerState();
            return;
        }

        try {
            const response = await fetch(`/admin/api/competitions/${competitionId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.currentCompetition = await response.json();
            
            document.getElementById('competition-name').textContent = this.currentCompetition.name;
            this.loadEvents();
            this.currentEvent = null;
            this.saveSelectionState();
            this.updateBreakButtonLabel();
            
            // Fetch and apply referee configuration
            await this.loadRefereeConfig(competitionId);
            
            this.showNotification(`Loaded: ${this.currentCompetition.name}`, 'success');
        } catch (error) {
            console.error('Error loading competition:', error);
            this.showNotification(`Error loading competition details: ${error.message}`, 'error');
        }
    }

    async loadRefereeConfig(competitionId) {
        try {
            console.log(`Fetching referee config for competition ${competitionId}`);
            const response = await fetch(`/admin/api/competitions/${competitionId}/referee-config`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.refereeConfig = await response.json();
            console.log('Loaded referee config:', this.refereeConfig);
            this.updateRefereePanel();
            
            this.showNotification(`Loaded referee config: ${this.refereeConfig.number_of_referees} referees`, 'success');
        } catch (error) {
            console.error('Error loading referee config:', error);
            // Use default config if loading fails
            this.refereeConfig = {
                number_of_referees: 3,
                decision_options: [
                    {'label': 'Good Lift', 'color': 'green', 'value': true},
                    {'label': 'No Lift', 'color': 'red', 'value': false}
                ]
            };
            console.log('Using default referee config:', this.refereeConfig);
            this.updateRefereePanel();
            this.showNotification('Using default referee config (3 referees)', 'warning');
        }
    }

    updateRefereePanel() {
        if (!this.refereeConfig) {
            console.log('No referee config available, using defaults');
            return;
        }
        
        console.log('Updating referee panel with config:', this.refereeConfig);
        
        // Update Lift Result buttons
        this.updateLiftResultButtons();
        
        // Update Referee Votes section
        this.updateRefereeVotesSection();
        
        console.log(`Generated ${this.refereeConfig.number_of_referees} referee rows with ${this.refereeConfig.decision_options.length} options each`);
    }

    updateLiftResultButtons() {
        const resultButtonsContainer = document.querySelector('.result-buttons');
        if (!resultButtonsContainer) {
            console.error('Result buttons container not found');
            return;
        }
        
        // Clear existing result buttons
        resultButtonsContainer.innerHTML = '';
        
        // Generate result buttons based on config
        this.refereeConfig.decision_options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = `result-btn option-${index}`;
            button.dataset.result = option.value;
            button.dataset.label = option.label;
            button.style.cssText = `
                background-color: ${option.color};
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-size: 1.2em;
                font-weight: bold;
                cursor: pointer;
                margin: 5px;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 10px;
            `;
            
            button.innerHTML = `
                <i class="icon-${option.value ? 'check' : 'x'}"></i>
                ${option.label}
            `;
            
            resultButtonsContainer.appendChild(button);
        });
        
        console.log(`Generated ${this.refereeConfig.decision_options.length} lift result buttons`);
    }

    updateRefereeVotesSection() {
        const votesContainer = document.querySelector('.votes-display');
        if (!votesContainer) {
            console.error('Votes container not found');
            return;
        }
        
        // Clear existing referee votes
        votesContainer.innerHTML = '';
        
        // Generate referee rows based on config - showing only vote results, not buttons
        for (let i = 1; i <= this.refereeConfig.number_of_referees; i++) {
            const refereeDiv = document.createElement('div');
            refereeDiv.className = 'referee-vote';
            
            refereeDiv.innerHTML = `
                <span style="min-width: 100px; display: inline-block; font-weight: 600;">Referee ${i}:</span>
                <span class="vote-result pending" id="referee-${i}-vote">-</span>
            `;
            
            votesContainer.appendChild(refereeDiv);
        }
        
        console.log(`Generated ${this.refereeConfig.number_of_referees} referee vote displays (results only)`);
    }

    // Removed bindVoteEvents method since we're using event delegation

    loadEvents() {
        const select = document.getElementById('event-select');
        select.innerHTML = '<option value="">Select Event</option>';
        select.disabled = false;

        if (this.currentCompetition && this.currentCompetition.events) {
            this.currentCompetition.events.forEach((event, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = event.name;
                select.appendChild(option);
            });
        }
    }

    selectEvent(eventIndex) {
        if (eventIndex === '') {
            this.currentEvent = null;
            document.getElementById('current-event').textContent = 'No Event Selected';
            this.stopTimer();
            this.isBreakActive = false;
            this.timerMode = 'attempt';
            this.timerSeconds = this.getAttemptDefault();
            this.updateTimerDisplay();
            this.updateTimerButton();
            this.updateBreakButtonLabel();
            this.saveSelectionState();
            this.persistTimerState();
            return;
        }

        this.currentEvent = this.currentCompetition.events[eventIndex];
        document.getElementById('current-event').textContent = this.currentEvent.name;

        this.applyEventTimerDefaults();
        this.saveSelectionState();
        
        // Show athlete and referee panels
        this.showRefereeInterface();
    }

    showRefereeInterface() {
        document.getElementById('current-athlete').style.display = 'block';
        document.getElementById('referee-panel').style.display = 'block';
        document.getElementById('results-summary').style.display = 'block';
        
        // Add fade-in animation
        document.getElementById('current-athlete').classList.add('fade-in');
        document.getElementById('referee-panel').classList.add('fade-in');
    }

    async loadAthletes() {
        if (!this.currentCompetition || !this.currentEvent) {
            this.showNotification('Please select a competition and event first', 'warning');
            return;
        }

        try {
            const response = await fetch(`/admin/api/competitions/${this.currentCompetition.id}/athletes`);
            const athletes = await response.json();
            
            this.athletesQueue = athletes.map(athlete => ({
                ...athlete,
                status: 'pending',
                attempts: [],
                currentAttempt: 1
            }));
            
            // this.renderAthletsQueue(); // UI removed
            // this.updateProgress(); // UI removed
            
            if (this.athletesQueue.length > 0) {
                this.loadCurrentAthlete();
            }
        } catch (error) {
            console.error('Error loading athletes:', error);
            // For demo purposes, create sample athletes
            this.createSampleAthletes();
        }
    }

    createSampleAthletes() {
        this.athletesQueue = [
            {
                id: 1,
                name: 'John Smith',
                weightClass: '73kg',
                team: 'Team A',
                status: 'pending',
                attempts: [],
                currentAttempt: 1,
                startingWeight: 120
            },
            {
                id: 2,
                name: 'Jane Doe',
                weightClass: '63kg',
                team: 'Team B',
                status: 'pending',
                attempts: [],
                currentAttempt: 1,
                startingWeight: 100
            },
            {
                id: 3,
                name: 'Mike Johnson',
                weightClass: '81kg',
                team: 'Team C',
                status: 'pending',
                attempts: [],
                currentAttempt: 1,
                startingWeight: 140
            }
        ];
        
        // this.renderAthletsQueue(); // UI removed
        // this.updateProgress(); // UI removed
        this.loadCurrentAthlete();
    }

    loadCurrentAthlete() {
        // Find next athlete who hasn't completed all attempts
        this.currentAthlete = this.athletesQueue.find(athlete => 
            athlete.status === 'pending' && athlete.currentAttempt <= 3
        );

        if (!this.currentAthlete) {
            this.showNotification('All athletes have completed their attempts', 'info');
            return;
        }

        // Update athlete display
        document.getElementById('athlete-name').textContent = this.currentAthlete.name;
        document.getElementById('athlete-weight-class').textContent = this.currentAthlete.weightClass;
        document.getElementById('athlete-team').textContent = this.currentAthlete.team;
        document.getElementById('current-lift').textContent = this.currentEvent.name;
        document.getElementById('attempt-number').textContent = `Attempt #${this.currentAthlete.currentAttempt}`;
        
        // Calculate attempt weight (starting weight + 2.5kg per attempt)
        const attemptWeight = this.currentAthlete.startingWeight + ((this.currentAthlete.currentAttempt - 1) * 2.5);
        document.getElementById('attempt-weight').textContent = `${attemptWeight}kg`;
        
        // Reset timer and decisions
        this.resetTimer();
        this.clearDecisions();
        
        // Highlight current athlete in queue
        // this.highlightCurrentAthlete(); // UI removed
        
        // Send current attempt to individual referee interfaces
        this.broadcastCurrentAttempt();
    }

    highlightCurrentAthlete() {
        document.querySelectorAll('.athlete-item').forEach(item => {
            item.classList.remove('current');
        });
        
        if (this.currentAthlete) {
            const currentItem = document.querySelector(`[data-athlete-id="${this.currentAthlete.id}"]`);
            if (currentItem) {
                currentItem.classList.add('current');
            }
        }
    }

    renderAthletsQueue() {
        const queueContainer = document.getElementById('athletes-queue');
        queueContainer.innerHTML = '';

        this.athletesQueue.forEach(athlete => {
            const athleteDiv = document.createElement('div');
            athleteDiv.className = `athlete-item ${athlete.status}`;
            athleteDiv.dataset.athleteId = athlete.id;
            
            athleteDiv.innerHTML = `
                <div>
                    <strong>${athlete.name}</strong>
                    <span style="margin-left: 10px;">${athlete.weightClass}</span>
                    <span style="margin-left: 10px;">${athlete.team}</span>
                </div>
                <div>
                    <span>Attempt ${athlete.currentAttempt}/3</span>
                    <span style="margin-left: 10px;" class="status-badge ${athlete.status}">${athlete.status}</span>
                </div>
            `;
            
            queueContainer.appendChild(athleteDiv);
        });
    }

    initTimer() {
        this.timerMode = 'attempt';
        this.timerSeconds = this.getAttemptDefault();
        this.updateTimerDisplay();
        this.updateTimerButton();
        this.updateBreakButtonLabel();
    }

    initSyncedTimer() {
        // Initialize the synchronized timer that pulls from timekeeper
        this.lastSyncedState = null;
        this.localTimerValue = 60;
        this.localTimerRunning = false;
        this.lastSyncTime = null;
        this.localTimerStartValue = null; // Value when we received last sync
        
        // Fetch timer state from server every 500ms
        this.syncTimerInterval = setInterval(() => {
            this.fetchTimerState();
        }, 500);
        
        // Update display every 100ms for smooth countdown between syncs
        this.displayUpdateInterval = setInterval(() => {
            this.updateLocalTimerDisplay();
        }, 100);
        
        // Poll for referee decisions every 2 seconds
        this.pollRefereeDecisions();
        this.decisionsInterval = setInterval(() => {
            this.pollRefereeDecisions();
        }, 2000);
        
        // Fetch immediately on init
        this.fetchTimerState();
    }
    
    async pollRefereeDecisions() {
        // Poll for referee decisions from other referees
        if (!this.currentCompetition?.id) return;
        
        try {
            const response = await fetch(`/admin/api/referee-decisions/${this.currentCompetition.id}`);
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.success && data.decisions) {
                // Update vote displays
                Object.entries(data.decisions).forEach(([refereeId, decisionData]) => {
                    const voteDisplay = document.getElementById(`referee-${refereeId}-vote`);
                    if (voteDisplay) {
                        voteDisplay.textContent = decisionData.decision_label || decisionData.decision_value;
                        voteDisplay.className = 'vote-result voted';
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to poll referee decisions:', error);
        }
    }

    async fetchTimerState() {
        try {
            const response = await fetch('/admin/api/timer-state');
            if (!response.ok) {
                throw new Error('Failed to fetch timer state');
            }
            
            const state = await response.json();
            this.updateSyncedTimerDisplay(state);
        } catch (error) {
            console.warn('Failed to fetch timer state:', error);
            this.updateSyncedTimerDisplay(null);
        }
    }

    updateLocalTimerDisplay() {
        // This runs every 100ms to provide smooth timer updates between server syncs
        if (!this.localTimerRunning || !this.lastSyncTime || this.localTimerStartValue === null) return;
        
        const timerDisplay = document.getElementById('synced-timer-display');
        if (!timerDisplay) return;
        
        // Calculate elapsed time since WE received the last sync (local interpolation only)
        const now = Date.now();
        const elapsedSeconds = (now - this.lastSyncTime) / 1000;
        
        // Interpolate from the value we received from timekeeper
        let currentValue;
        if (this.lastSyncedState.timer_mode === 'countdown') {
            currentValue = Math.max(0, this.localTimerStartValue - elapsedSeconds);
        } else {
            currentValue = this.localTimerStartValue + elapsedSeconds;
        }
        
        // Use Math.floor for consistent countdown behavior (no rounding flashing)
        const displayValue = Math.floor(currentValue);
        
        // Only update if the displayed value actually changed
        const currentDisplayText = timerDisplay.textContent;
        const minutes = Math.floor(displayValue / 60);
        const seconds = displayValue % 60;
        const timeStr = displayValue >= 60 
            ? `${minutes}:${seconds.toString().padStart(2, '0')}`
            : displayValue.toString();
        
        if (currentDisplayText !== timeStr) {
            timerDisplay.textContent = timeStr;
        }
    }

    updateSyncedTimerDisplay(state) {
        const timerDisplay = document.getElementById('synced-timer-display');
        const statusDot = document.getElementById('timer-status-indicator');
        const statusText = document.getElementById('timer-status-text');
        const athleteName = document.getElementById('athlete-name');
        const attemptNumber = document.getElementById('attempt-number');
        
        if (!timerDisplay) return;
        
        if (!state || !state.athlete_name) {
            // No active timer
            this.localTimerRunning = false;
            this.lastSyncedState = null;
            this.localTimerValue = 60;
            timerDisplay.textContent = '60';
            statusDot.className = 'status-dot waiting';
            statusText.textContent = 'Waiting for timekeeper...';
            if (athleteName) athleteName.textContent = 'Athlete Name';
            if (attemptNumber) attemptNumber.textContent = 'Attempt #1';
            return;
        }
        
        // Update synced state - capture the exact value from timekeeper
        this.lastSyncedState = state;
        this.lastSyncTime = Date.now(); // When WE received this data
        this.localTimerRunning = state.timer_running;
        this.localTimerValue = state.timer_seconds;
        this.localTimerStartValue = state.timer_seconds; // Start value for interpolation
        
        // Always update display immediately with the value from timekeeper
        const displayValue = Math.floor(state.timer_seconds);
        const minutes = Math.floor(displayValue / 60);
        const seconds = displayValue % 60;
        const timeStr = displayValue >= 60 
            ? `${minutes}:${seconds.toString().padStart(2, '0')}`
            : displayValue.toString();
        
        timerDisplay.textContent = timeStr;
        
        // Update athlete info
        if (athleteName && state.athlete_name) {
            athleteName.textContent = state.athlete_name;
        }
        if (attemptNumber && state.attempt_number) {
            attemptNumber.textContent = `Attempt #${state.attempt_number}`;
        }
        
        // Update status indicator
        if (state.timer_running) {
            statusDot.className = 'status-dot running';
            statusText.textContent = `Running (${state.timer_mode})`;
        } else {
            statusDot.className = 'status-dot paused';
            statusText.textContent = `Paused (${state.timer_mode})`;
        }
    }

    toggleTimer() {
        if (!this.currentEvent && !this.isBreakActive) {
            this.showNotification('Please select an event before starting the timer', 'warning');
            return;
        }

        if (this.timerRunning) {
            this.stopTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        if (this.timerRunning) {
            return;
        }

        if (!this.currentEvent && this.timerMode !== 'break') {
            this.showNotification('Select an event before starting the timer', 'warning');
            return;
        }

        if (this.timerSeconds <= 0) {
            this.timerSeconds = this.getDefaultForCurrentMode();
        }

        this.timerRunning = true;
        this.initialTimerSeconds = this.timerSeconds;
        this.timerStartTimestamp = Date.now();

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.timerStartTimestamp) / 1000);
            const remaining = Math.max(0, this.initialTimerSeconds - elapsed);

            if (remaining !== this.timerSeconds) {
                this.timerSeconds = remaining;
                this.updateTimerDisplay();
            }

            if (remaining <= 0) {
                this.timeExpired();
                return;
            }

            this.persistTimerState();
        }, 1000);

        this.updateTimerButton();
        this.persistTimerState();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        if (this.timerRunning && this.timerStartTimestamp != null) {
            const elapsed = Math.floor((Date.now() - this.timerStartTimestamp) / 1000);
            this.timerSeconds = Math.max(0, this.initialTimerSeconds - elapsed);
        }

        this.timerRunning = false;
        this.timerStartTimestamp = null;
        this.initialTimerSeconds = null;

        this.updateTimerDisplay();
        this.updateTimerButton();
        this.persistTimerState();
    }

    resetTimer() {
        this.stopTimer();
        this.isBreakActive = false;
        this.timerMode = 'attempt';
        this.timerSeconds = this.getAttemptDefault();
        this.updateTimerDisplay();
        this.updateTimerButton();
        this.updateBreakButtonLabel();
        this.persistTimerState();
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('attempt-timer');
        if (!timerElement) {
            console.error('Timer element not found');
            return;
        }

        const remaining = Math.max(0, Math.round(this.timerSeconds));
        timerElement.textContent = remaining;

        if (this.timerMode === 'break') {
            timerElement.style.background = '#f39c12';
            timerElement.style.color = 'white';
            timerElement.classList.remove('pulse');
        } else {
            if (remaining <= 10) {
                timerElement.style.background = '#e74c3c';
                timerElement.style.color = 'white';
                timerElement.classList.add('pulse');
            } else if (remaining <= 30) {
                timerElement.style.background = '#f39c12';
                timerElement.style.color = 'white';
                timerElement.classList.remove('pulse');
            } else {
                timerElement.style.background = '#2c3e50';
                timerElement.style.color = 'white';
                timerElement.classList.remove('pulse');
            }
        }

        timerElement.style.padding = '10px 20px';
        timerElement.style.borderRadius = '5px';
        timerElement.style.fontSize = '20px';
        timerElement.style.fontWeight = 'bold';
        timerElement.style.display = 'inline-block';
        timerElement.style.minWidth = '60px';
        timerElement.style.textAlign = 'center';
    }

    updateTimerButton() {
        const startButton = document.getElementById('start-timer');
        if (!startButton) {
            console.error('Start timer button not found');
            return;
        }

        const disable = !this.currentEvent && this.timerMode !== 'break';
        startButton.disabled = disable;
        startButton.style.opacity = disable ? '0.6' : '1';
        startButton.style.cursor = disable ? 'not-allowed' : 'pointer';

        if (this.timerMode === 'break') {
            startButton.style.background = '#f39c12';
            startButton.style.color = 'white';
            if (this.timerRunning) {
                startButton.textContent = 'Pause Break';
            } else if (this.isBreakActive) {
                startButton.textContent = 'Resume Break';
            } else {
                startButton.textContent = 'Start Timer';
                startButton.style.background = '#27ae60';
            }
        } else {
            startButton.textContent = this.timerRunning ? 'Stop Timer' : 'Start Timer';
            startButton.style.background = this.timerRunning ? '#e74c3c' : '#27ae60';
            startButton.style.color = 'white';
        }

        startButton.style.border = 'none';
        startButton.style.padding = '8px 16px';
        startButton.style.borderRadius = '4px';
    }

    updateBreakButtonLabel() {
        const breakBtn = document.getElementById('toggle-break');
        if (!breakBtn) {
            return;
        }

        if (!this.currentEvent) {
            breakBtn.textContent = 'Start Break';
            breakBtn.disabled = true;
            breakBtn.classList.remove('active');
            breakBtn.setAttribute('aria-pressed', 'false');
            return;
        }

        breakBtn.disabled = false;
        breakBtn.textContent = this.isBreakActive ? 'End Break' : 'Start Break';
        breakBtn.classList.toggle('active', this.isBreakActive);
        breakBtn.setAttribute('aria-pressed', this.isBreakActive ? 'true' : 'false');
    }

    toggleBreak() {
        if (!this.currentEvent && !this.isBreakActive) {
            this.showNotification('Select an event before starting a break', 'warning');
            return;
        }

        if (this.isBreakActive) {
            this.endBreak();
        } else {
            this.beginBreak();
        }
    }

    beginBreak({ silent = false } = {}) {
        this.stopTimer();
        this.timerMode = 'break';
        this.isBreakActive = true;
        this.timerSeconds = this.getBreakDefault();
        this.updateTimerDisplay();
        this.updateTimerButton();
        this.updateBreakButtonLabel();
        this.startTimer();
        if (!silent) {
            this.showNotification('Break started', 'info');
        }
        this.persistTimerState();
    }

    endBreak({ resetTimer = true, silent = false } = {}) {
        if (this.timerRunning) {
            this.stopTimer();
        }
        this.isBreakActive = false;
        this.timerMode = 'attempt';
        if (resetTimer) {
            this.timerSeconds = this.getAttemptDefault();
        }
        this.updateTimerDisplay();
        this.updateTimerButton();
        this.updateBreakButtonLabel();
        if (!silent) {
            this.showNotification('Break ended', 'info');
        }
        this.persistTimerState();
    }

    persistTimerState(extra = {}) {
        const payload = {
            timerMode: this.timerMode,
            isBreakActive: this.isBreakActive,
            timerSeconds: this.timerSeconds,
            timerRunning: this.timerRunning,
            initialTimerSeconds: this.initialTimerSeconds,
            timerStartTimestamp: this.timerStartTimestamp,
            updatedAt: Date.now(),
            ...extra
        };

        try {
            localStorage.setItem(this.timerStorageKey, JSON.stringify(payload));
        } catch (err) {
            console.warn('Unable to persist referee timer state:', err);
        }
    }

    restoreTimerState() {
        let stored;
        try {
            stored = JSON.parse(localStorage.getItem(this.timerStorageKey) || 'null');
        } catch (err) {
            stored = null;
        }

        if (!stored) {
            this.timerMode = 'attempt';
            this.isBreakActive = false;
            this.timerSeconds = this.getAttemptDefault();
            this.updateTimerDisplay();
            this.updateTimerButton();
            this.updateBreakButtonLabel();
            return;
        }

        this.timerMode = stored.timerMode || 'attempt';
        this.isBreakActive = !!stored.isBreakActive;

        let remaining = typeof stored.timerSeconds === 'number'
            ? stored.timerSeconds
            : this.getDefaultForCurrentMode();

        if (stored.timerRunning && stored.initialTimerSeconds && stored.timerStartTimestamp) {
            const elapsed = Math.floor((Date.now() - stored.timerStartTimestamp) / 1000);
            remaining = Math.max(0, stored.initialTimerSeconds - elapsed);
        }

        this.timerSeconds = remaining;
        this.timerRunning = false;
        this.initialTimerSeconds = null;
        this.timerStartTimestamp = null;

        this.updateTimerDisplay();
        this.updateTimerButton();
        this.updateBreakButtonLabel();

        if (stored.timerRunning && remaining > 0) {
            this.startTimer();
        } else if (stored.timerRunning && remaining <= 0) {
            this.timerSeconds = 0;
            this.updateTimerDisplay();
            if (this.timerMode === 'break') {
                this.endBreak({ silent: true });
            } else {
                this.timeExpired();
            }
        } else {
            this.persistTimerState();
        }
    }

    timeExpired() {
        this.stopTimer();
        if (this.timerMode === 'break') {
            this.endBreak({ resetTimer: true, silent: true });
            this.showNotification('Break finished', 'info');
            return;
        }

        this.showNotification('Time expired! Recording as No Lift', 'warning');
        this.selectResult('no-lift');
        
        // Auto-submit after time expires
        setTimeout(() => {
            this.submitDecision();
        }, 2000);
        this.persistTimerState();
    }

    selectResult(result, label) {
        // Clear previous selections
        document.querySelectorAll('.result-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Select current result
        const selectedBtn = document.querySelector(`[data-result="${result}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
        
        // Show/hide technical violations based on result
        const technicalDiv = document.getElementById('technical-decisions');
        
        // Check if this is a negative result (false value)
        const isNegativeResult = result === 'false' || result === false;
        
        if (isNegativeResult) {
            technicalDiv.classList.add('show');
        } else {
            technicalDiv.classList.remove('show');
            // Clear technical violations if positive result
            document.querySelectorAll('.violation-checkboxes input').forEach(cb => {
                cb.checked = false;
            });
        }
        
        this.currentAttemptData.result = result;
        this.currentAttemptData.resultLabel = label;
        this.checkSubmissionReady();
    }

    recordRefereeVote(refereeNum, vote, label) {
        // Update the vote result display
        const voteDisplay = document.getElementById(`referee-${refereeNum}-vote`);
        if (voteDisplay) {
            voteDisplay.textContent = label || vote;
            voteDisplay.className = 'vote-result voted';
        }
        
        this.refereeVotes[refereeNum] = {
            vote: vote,
            label: label
        };
        this.updateFinalDecision();
        this.checkSubmissionReady();
    }

    updateFinalDecision() {
        const votes = Object.values(this.refereeVotes);
        let decision = 'Pending';
        
        if (votes.length === this.refereeConfig.number_of_referees) {
            // Count votes by value (true/false)
            const positiveVotes = votes.filter(v => v.vote === 'true' || v.vote === true).length;
            const totalVotes = votes.length;
            const majority = Math.ceil(totalVotes / 2);
            
            if (positiveVotes >= majority) {
                // Find the positive decision label
                const positiveOption = this.refereeConfig.decision_options.find(opt => opt.value === true);
                decision = positiveOption ? positiveOption.label : 'Good Lift';
            } else {
                // Find the negative decision label
                const negativeOption = this.refereeConfig.decision_options.find(opt => opt.value === false);
                decision = negativeOption ? negativeOption.label : 'No Lift';
            }
        }
        
        document.getElementById('final-result').textContent = decision;
        this.currentAttemptData.finalDecision = decision;
    }

    updateTechnicalViolations() {
        const violations = [];
        document.querySelectorAll('.violation-checkboxes input:checked').forEach(cb => {
            violations.push(cb.value);
        });
        
        this.currentAttemptData.violations = violations;
    }

    checkSubmissionReady() {
        const hasResult = this.currentAttemptData.result;
        const expectedVotes = this.refereeConfig ? this.refereeConfig.number_of_referees : 3;
        const hasAllVotes = Object.keys(this.refereeVotes).length === expectedVotes;
        
        const submitBtn = document.getElementById('submit-decision');
        if (hasResult && hasAllVotes) {
            submitBtn.disabled = false;
        } else {
            submitBtn.disabled = true;
        }
    }

    async submitDecision() {
        if (!this.currentAthlete) return;
        
        this.stopTimer();
        
        // Compile attempt data
        const attemptData = {
            athleteId: this.currentAthlete.id,
            attemptNumber: this.currentAthlete.currentAttempt,
            weight: parseFloat(document.getElementById('attempt-weight').textContent),
            result: this.currentAttemptData.result,
            finalDecision: this.currentAttemptData.finalDecision,
            refereeVotes: this.refereeVotes,
            violations: this.currentAttemptData.violations || [],
            timestamp: new Date().toISOString()
        };
        
        try {
            // Save attempt to server
            await this.saveAttempt(attemptData);
            
            // Update athlete's attempts
            this.currentAthlete.attempts.push(attemptData);
            this.currentAthlete.currentAttempt++;
            
            // Check if athlete is done
            if (this.currentAthlete.currentAttempt > 3) {
                this.currentAthlete.status = 'completed';
            }
            
            this.showNotification('Decision submitted successfully', 'success');
            // this.updateProgress(); // UI removed
            // this.renderAthletsQueue(); // UI removed
            
            // Enable next athlete button
            document.getElementById('next-athlete').disabled = false;
            
        } catch (error) {
            console.error('Error submitting decision:', error);
            this.showNotification('Error submitting decision', 'error');
        }
    }

    async saveAttempt(attemptData) {
        // Log the data for debugging
        console.log('Saving attempt:', attemptData);
        
        // Submit referee decisions via API
        if (this.refereeVotes && Object.keys(this.refereeVotes).length > 0) {
            try {
                // Submit each referee decision
                const promises = [];
                for (const [refereeId, voteData] of Object.entries(this.refereeVotes)) {
                    const decisionData = {
                        referee_id: parseInt(refereeId),
                        competition_id: this.currentCompetition?.id,
                        attempt_id: attemptData.attemptId, // Use the attempt ID from the data
                        decision: voteData.label || (voteData.vote === 'true' || voteData.vote === true ? 'good_lift' : 'no_lift'),
                        timestamp: attemptData.timestamp,
                        notes: JSON.stringify(attemptData.violations || [])
                    };
                    
                    const promise = fetch('/admin/api/referee-decision', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(decisionData)
                    });
                    
                    promises.push(promise);
                }
                
                // Wait for all referee decisions to be submitted
                const responses = await Promise.all(promises);
                
                // Check if all responses are successful
                for (const response of responses) {
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to submit referee decision');
                    }
                }
                
                console.log('All referee decisions submitted successfully');
                return { success: true };
                
            } catch (error) {
                console.error('Error submitting referee decisions:', error);
                throw error; // Re-throw to trigger the catch block in submitDecision
            }
        } else {
            console.log('No referee votes to submit');
            return { success: true };
        }
    }

    nextAthlete() {
        this.clearCurrentAttempt();
        this.loadCurrentAthlete();
        document.getElementById('next-athlete').disabled = true;
    }

    clearDecisions() {
        // Clear result selection
        document.querySelectorAll('.result-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Clear referee votes
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Clear technical violations
        document.querySelectorAll('.violation-checkboxes input').forEach(cb => {
            cb.checked = false;
        });
        
        // Hide technical decisions
        document.getElementById('technical-decisions').classList.remove('show');
        
        // Reset data
        this.refereeVotes = {};
        this.currentAttemptData = {};
        
        // Reset final decision
        document.getElementById('final-result').textContent = 'Pending';
        
        // Disable action buttons
        document.getElementById('submit-decision').disabled = true;
        document.getElementById('next-athlete').disabled = true;
    }

    updateProgress() {
        const totalAthletes = this.athletesQueue.length;
        const completedAthletes = this.athletesQueue.filter(a => a.status === 'completed').length;
        const remainingAthletes = totalAthletes - completedAthletes;
        
        const totalAttempts = this.athletesQueue.reduce((sum, athlete) => sum + athlete.attempts.length, 0);
        const progressPercent = totalAthletes > 0 ? (completedAthletes / totalAthletes) * 100 : 0;
        
        document.getElementById('athletes-remaining').textContent = remainingAthletes;
        document.getElementById('completed-attempts').textContent = totalAttempts;
        document.getElementById('progress-fill').style.width = `${progressPercent}%`;
        document.getElementById('progress-text').textContent = `${Math.round(progressPercent)}% Complete`;
    }

    clearEventSelect() {
        const select = document.getElementById('event-select');
        select.innerHTML = '<option value="">Select Event</option>';
        select.disabled = true;
        document.getElementById('current-event').textContent = 'No Event Selected';
        this.updateBreakButtonLabel();
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        // Set background color based on type
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };
        notification.style.background = colors[type] || colors.info;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Integration with individual referee interfaces
    async broadcastCurrentAttempt() {
        if (!this.currentAthlete || !this.currentEvent) return;
        
        const attemptWeight = this.currentAthlete.startingWeight + ((this.currentAthlete.currentAttempt - 1) * 2.5);
        
        const attemptData = {
            athleteName: this.currentAthlete.name,
            weightClass: this.currentAthlete.weightClass,
            team: this.currentAthlete.team,
            attemptNumber: this.currentAthlete.currentAttempt,
            weight: attemptWeight,
            liftType: this.currentEvent.name,
            timerSeconds: this.timerSeconds
        };
        
        try {
            await fetch('/admin/api/current-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(attemptData)
            });
        } catch (error) {
            console.error('Error broadcasting attempt:', error);
        }
    }

    async clearCurrentAttempt() {
        try {
            await fetch('/admin/api/clear-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('Error clearing attempt:', error);
        }
    }

    openRefereesSettings() {
        // Navigate to referee settings page
        window.location.href = '/admin/referee-settings';
    }
}

// Initialize the referee panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.refereePanel = new RefereePanel();
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .notification {
        animation: slideIn 0.3s ease;
    }
`;
document.head.appendChild(style);