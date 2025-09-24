/**
 * Real-time Dashboard JavaScript
 */
class RealTimeDashboard {
    constructor() {
        this.wsClient = null;
        this.currentCompetitionId = null;
        this.timer = null;
        this.stats = {
            connectedClients: 0,
            activeAthletes: 0,
            activeTimers: 0,
            activeReferees: 0
        };

        // Performance monitoring
        this.startTime = Date.now();
        this.messageCount = 0;
        this.latencyHistory = [];

        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.setupTimer();
        this.startPerformanceMonitoring();
        this.initializeConnectionStatus();
    }

    setupWebSocket() {
        // Initialize WebSocket client
        this.wsClient = new WebSocketClient({
            maxReconnectAttempts: 10,
            reconnectInterval: 2000
        });

        // Connection events
        this.wsClient.on('connect', () => {
            this.addActivityMessage('System', 'Connected to real-time server', 'system');
            this.updateConnectionStatus('connected');
        });

        this.wsClient.on('disconnect', (reason) => {
            this.addActivityMessage('System', `Disconnected: ${reason}`, 'system');
            this.updateConnectionStatus('disconnected');
        });

        // Real-time data events
        this.wsClient.on('timer_update', (data) => {
            this.handleTimerUpdate(data);
        });

        this.wsClient.on('referee_decision', (data) => {
            this.handleRefereeDecision(data);
        });

        this.wsClient.on('attempt_result', (data) => {
            this.handleAttemptResult(data);
        });

        this.wsClient.on('competition_status_update', (data) => {
            this.handleCompetitionStatus(data);
        });

        this.wsClient.on('athlete_queue_update', (data) => {
            this.handleAthleteQueue(data);
        });

        this.wsClient.on('error', (error) => {
            this.addActivityMessage('System', `Error: ${error.message}`, 'system');
        });
    }

    setupEventListeners() {
        // Competition selection
        const competitionSelect = document.getElementById('dashboard-competition-select');
        const joinBtn = document.getElementById('join-competition-btn');

        competitionSelect.addEventListener('change', (e) => {
            const competitionId = e.target.value;
            joinBtn.disabled = !competitionId;
        });

        joinBtn.addEventListener('click', () => {
            const competitionId = competitionSelect.value;
            if (competitionId) {
                this.joinCompetition(competitionId);
            }
        });

        // Timer controls
        const durationSelect = document.getElementById('timer-duration-select');
        durationSelect.addEventListener('change', (e) => {
            const duration = parseInt(e.target.value);
            if (this.timer) {
                this.timer.setDuration(duration);
            }
        });

        // Emergency controls
        document.getElementById('emergency-pause-all').addEventListener('click', () => {
            this.emergencyPauseAll();
        });

        document.getElementById('emergency-stop-all').addEventListener('click', () => {
            this.emergencyStopAll();
        });

        document.getElementById('emergency-reset-all').addEventListener('click', () => {
            this.emergencyResetAll();
        });

        // System actions
        document.getElementById('test-connection-btn').addEventListener('click', () => {
            this.testConnection();
        });

        document.getElementById('broadcast-test-btn').addEventListener('click', () => {
            this.broadcastTest();
        });

        // Activity feed controls
        document.getElementById('clear-activity-btn').addEventListener('click', () => {
            this.clearActivityFeed();
        });
    }

    setupTimer() {
        // Initialize main competition timer
        this.timer = new RealTimeTimer('main-competition-timer', {
            duration: 60,
            type: 'competition',
            showControls: true,
            showProgress: true,
            wsClient: this.wsClient,
            onTick: (timeRemaining) => {
                this.updateTimerStats(timeRemaining);
            },
            onComplete: () => {
                this.addActivityMessage('Timer', 'Competition timer expired', 'timer');
            },
            onStateChange: (state, data) => {
                this.addActivityMessage('Timer', `Timer ${state.toLowerCase()}`, 'timer');
            }
        });
    }

    initializeConnectionStatus() {
        // Initialize connection status indicator
        this.connectionStatus = new ConnectionStatus('connection-status');
        this.updateConnectionStatus('disconnected');
    }

    joinCompetition(competitionId) {
        this.currentCompetitionId = competitionId;

        if (this.wsClient.joinCompetition(competitionId, 'admin')) {
            this.addActivityMessage('System', `Joined competition ${competitionId}`, 'system');
            this.updateCompetitionInfo(competitionId);
        }
    }

    // Event Handlers
    handleTimerUpdate(data) {
        this.messageCount++;
        this.addActivityMessage('Timer',
            `Timer ${data.action}: ${data.remaining || 0}s remaining`, 'timer');

        // Update timer display if it's for current competition
        if (data.competition_id == this.currentCompetitionId) {
            // Timer will be updated via WebSocket integration
        }
    }

    handleRefereeDecision(data) {
        this.messageCount++;
        this.addActivityMessage('Referee',
            `Referee ${data.referee_id} decision: ${data.decision}`, 'referee');

        this.addRecentDecision(data);
        this.updateRefereeStatus(data.referee_id, 'active');
    }

    handleAttemptResult(data) {
        this.messageCount++;
        this.addActivityMessage('Athlete',
            `Athlete ${data.athlete_id} result: ${data.result}`, 'athlete');

        this.updateAthleteProgress(data);
    }

    handleCompetitionStatus(data) {
        this.messageCount++;
        this.addActivityMessage('System',
            `Competition status: ${data.status}`, 'system');

        this.updateCompetitionProgress(data);
    }

    handleAthleteQueue(data) {
        this.messageCount++;
        this.updateAthleteQueue(data.queue_data);
    }

    // UI Updates
    updateStats() {
        document.getElementById('connected-clients').textContent = this.stats.connectedClients;
        document.getElementById('active-athletes').textContent = this.stats.activeAthletes;
        document.getElementById('active-timers').textContent = this.stats.activeTimers;
        document.getElementById('active-referees').textContent = this.stats.activeReferees;
    }

    updateConnectionStatus(status) {
        this.connectionStatus.updateStatus(status);

        if (status === 'connected') {
            this.stats.connectedClients = 1; // At least this client
        } else {
            this.stats.connectedClients = 0;
        }

        this.updateStats();
    }

    updateCompetitionInfo(competitionId) {
        const select = document.getElementById('dashboard-competition-select');
        const selectedOption = select.options[select.selectedIndex];

        if (selectedOption) {
            document.getElementById('current-event-name').textContent =
                `Active: ${selectedOption.text}`;
        }
    }

    updateTimerStats(timeRemaining) {
        if (timeRemaining > 0) {
            this.stats.activeTimers = 1;
        } else {
            this.stats.activeTimers = 0;
        }
        this.updateStats();
    }

    updateRefereeStatus(refereeId, status) {
        const refereeGrid = document.getElementById('referee-status-grid');

        let refereeCard = refereeGrid.querySelector(`[data-referee-id="${refereeId}"]`);

        if (!refereeCard) {
            refereeCard = document.createElement('div');
            refereeCard.className = 'referee-card';
            refereeCard.setAttribute('data-referee-id', refereeId);
            refereeCard.innerHTML = `
                <div class="referee-name">Referee ${refereeId}</div>
                <div class="referee-status">${status}</div>
            `;
            refereeGrid.appendChild(refereeCard);
        }

        refereeCard.className = `referee-card ${status === 'active' ? 'online' : 'offline'}`;
        refereeCard.querySelector('.referee-status').textContent = status;

        // Update stats
        this.stats.activeReferees = refereeGrid.querySelectorAll('.referee-card.online').length;
        this.updateStats();
    }

    updateAthleteProgress(data) {
        this.stats.activeAthletes++; // Simplified increment
        this.updateStats();
    }

    updateCompetitionProgress(data) {
        // Update overall progress based on competition status
        const progressElement = document.getElementById('overall-progress');
        const progressText = document.getElementById('overall-progress-text');

        let progress = 0;

        switch (data.status) {
            case 'warming_up':
                progress = 10;
                break;
            case 'in_progress':
                progress = 50;
                break;
            case 'break':
                progress = 75;
                break;
            case 'completed':
                progress = 100;
                break;
        }

        progressElement.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
    }

    updateAthleteQueue(queueData) {
        const queueContainer = document.querySelector('.athlete-queue');

        queueContainer.innerHTML = '';

        if (queueData && queueData.length > 0) {
            queueData.slice(0, 5).forEach((athlete, index) => {
                const athleteElement = document.createElement('div');
                athleteElement.className = 'athlete-item';
                athleteElement.innerHTML = `
                    <strong>${index + 1}.</strong> ${athlete.name}
                    <span style="color: #666;">(${athlete.event})</span>
                `;
                queueContainer.appendChild(athleteElement);
            });
        } else {
            queueContainer.innerHTML = '<div class="athlete-item">No athletes in queue</div>';
        }
    }

    addRecentDecision(data) {
        const decisionsList = document.getElementById('recent-decisions');

        const decisionElement = document.createElement('div');
        decisionElement.className = 'decision-item slide-in';
        decisionElement.innerHTML = `
            <div class="decision-header">
                <span class="decision-athlete">Athlete ${data.athlete_id || 'Unknown'}</span>
                <span class="decision-time">${new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="decision-result ${data.decision === 'good_lift' ? 'good' : 'no-lift'}">
                ${data.decision.replace('_', ' ').toUpperCase()}
            </div>
        `;

        decisionsList.insertBefore(decisionElement, decisionsList.firstChild);

        // Keep only last 10 decisions
        while (decisionsList.children.length > 10) {
            decisionsList.removeChild(decisionsList.lastChild);
        }
    }

    addActivityMessage(type, message, category = 'system') {
        const activityFeed = document.getElementById('activity-feed');
        const timestamp = new Date().toLocaleTimeString();

        const activityItem = document.createElement('div');
        activityItem.className = `activity-item ${category} slide-in`;
        activityItem.innerHTML = `
            <span class="activity-time">[${timestamp}]</span>
            <span class="activity-message"><strong>${type}:</strong> ${message}</span>
        `;

        activityFeed.insertBefore(activityItem, activityFeed.firstChild);

        // Keep only last 50 messages
        while (activityFeed.children.length > 50) {
            activityFeed.removeChild(activityFeed.lastChild);
        }

        // Auto-scroll to latest message
        activityFeed.scrollTop = 0;
    }

    clearActivityFeed() {
        const activityFeed = document.getElementById('activity-feed');
        activityFeed.innerHTML = '';
        this.addActivityMessage('System', 'Activity feed cleared', 'system');
    }

    // Emergency Controls
    emergencyControls() {
        // Main emergency controls method
        return {
            pauseAll: () => this.emergencyPauseAll(),
            stopAll: () => this.emergencyStopAll(),
            resetAll: () => this.emergencyResetAll()
        };
    }

    emergencyPauseAll() {
        if (this.timer) {
            this.timer.pause();
        }
        this.addActivityMessage('Emergency', 'All timers paused', 'system');
    }

    emergencyStopAll() {
        if (this.timer) {
            this.timer.stop();
        }
        this.addActivityMessage('Emergency', 'All timers stopped', 'system');
    }

    emergencyResetAll() {
        if (this.timer) {
            this.timer.reset();
        }
        this.addActivityMessage('Emergency', 'All timers reset', 'system');
    }

    // System Monitoring
    startPerformanceMonitoring() {
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 1000);
    }

    updatePerformanceMetrics() {
        // Update uptime
        const uptime = Date.now() - this.startTime;
        const hours = Math.floor(uptime / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((uptime % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((uptime % 60000) / 1000).toString().padStart(2, '0');

        document.getElementById('system-uptime').textContent = `${hours}:${minutes}:${seconds}`;

        // Update message rate
        document.getElementById('message-rate').textContent = `${this.messageCount} msg/s`;
        this.messageCount = 0; // Reset for next second

        // Update connection quality based on latency
        const avgLatency = this.latencyHistory.length > 0
            ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
            : 0;

        const qualityElement = document.getElementById('connection-quality');

        if (avgLatency < 100) {
            qualityElement.textContent = 'Excellent';
            qualityElement.className = 'status-good';
        } else if (avgLatency < 300) {
            qualityElement.textContent = 'Good';
            qualityElement.className = 'status-warning';
        } else {
            qualityElement.textContent = 'Poor';
            qualityElement.className = 'status-error';
        }
    }

    testConnection() {
        const startTime = Date.now();

        this.wsClient.ping();

        // Simulate latency measurement
        setTimeout(() => {
            const latency = Date.now() - startTime;
            this.latencyHistory.push(latency);

            if (this.latencyHistory.length > 10) {
                this.latencyHistory.shift();
            }

            document.getElementById('websocket-latency').textContent = `${latency} ms`;
            this.addActivityMessage('System', `Connection test: ${latency}ms latency`, 'system');
        }, 50);
    }

    broadcastTest() {
        // Send a test message through WebSocket
        if (this.wsClient && this.currentCompetitionId) {
            this.wsClient.socket.emit('competition_status_update', {
                competition_id: this.currentCompetitionId,
                status: 'test_broadcast',
                timestamp: Date.now()
            });

            this.addActivityMessage('System', 'Test broadcast sent', 'system');
        } else {
            this.addActivityMessage('System', 'Cannot broadcast: not connected to competition', 'system');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new RealTimeDashboard();
});

// Export for debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeDashboard;
}