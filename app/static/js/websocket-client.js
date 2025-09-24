/**
 * WebSocket Client Base Class for Real-time Competition Data
 */
class WebSocketClient {
    constructor(options = {}) {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.competitionId = options.competitionId || null;
        this.userType = options.userType || 'spectator';

        // Event listeners
        this.eventListeners = {
            'connect': [],
            'disconnect': [],
            'timer_update': [],
            'referee_decision': [],
            'attempt_result': [],
            'competition_status_update': [],
            'athlete_queue_update': [],
            'error': []
        };

        // Auto-connect if socket.io is available
        if (typeof io !== 'undefined') {
            this.connect();
        } else {
            console.error('Socket.IO library not loaded');
        }
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        try {
            this.socket = io();
            this.setupEventHandlers();
            console.log('WebSocket connection initiated');
        } catch (error) {
            console.error('Failed to connect to WebSocket server:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Setup core WebSocket event handlers
     */
    setupEventHandlers() {
        if (!this.socket) return;

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connect');

            // Auto-join competition if specified
            if (this.competitionId) {
                this.joinCompetition(this.competitionId, this.userType);
            }
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from WebSocket server:', reason);
            this.isConnected = false;
            this.emit('disconnect', reason);

            if (reason === 'io server disconnect') {
                // Server disconnected, try to reconnect
                this.scheduleReconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.scheduleReconnect();
        });

        // Competition events
        this.socket.on('joined_competition', (data) => {
            console.log('Joined competition:', data);
            this.competitionId = data.competition_id;
            this.userType = data.user_type;
        });

        this.socket.on('left_competition', (data) => {
            console.log('Left competition:', data);
            this.competitionId = null;
        });

        // Real-time data events
        this.socket.on('timer_update', (data) => {
            this.emit('timer_update', data);
        });

        this.socket.on('referee_decision', (data) => {
            this.emit('referee_decision', data);
        });

        this.socket.on('attempt_result', (data) => {
            this.emit('attempt_result', data);
        });

        this.socket.on('competition_status_update', (data) => {
            this.emit('competition_status_update', data);
        });

        this.socket.on('athlete_queue_update', (data) => {
            this.emit('athlete_queue_update', data);
        });

        this.socket.on('error', (data) => {
            console.error('WebSocket error:', data);
            this.emit('error', data);
        });

        // Connection test
        this.socket.on('pong', (data) => {
            console.log('Pong received:', data);
        });
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectInterval * this.reconnectAttempts;

        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

        setTimeout(() => {
            if (!this.isConnected) {
                this.connect();
            }
        }, delay);
    }

    /**
     * Join a competition room
     */
    joinCompetition(competitionId, userType = 'spectator') {
        if (!this.socket || !this.isConnected) {
            console.warn('Cannot join competition: not connected');
            return false;
        }

        this.socket.emit('join_competition', {
            competition_id: competitionId,
            user_type: userType
        });

        this.competitionId = competitionId;
        this.userType = userType;
        return true;
    }

    /**
     * Leave current competition room
     */
    leaveCompetition() {
        if (!this.socket || !this.competitionId) {
            return false;
        }

        this.socket.emit('leave_competition', {
            competition_id: this.competitionId
        });

        return true;
    }

    /**
     * Send timer control commands
     */
    startTimer(timerData = {}) {
        if (!this.isValidConnection()) return false;

        this.socket.emit('timer_start', {
            competition_id: this.competitionId,
            timer_data: timerData,
            timestamp: Date.now()
        });
        return true;
    }

    stopTimer() {
        if (!this.isValidConnection()) return false;

        this.socket.emit('timer_stop', {
            competition_id: this.competitionId,
            stop_time: Date.now()
        });
        return true;
    }

    resetTimer() {
        if (!this.isValidConnection()) return false;

        this.socket.emit('timer_reset', {
            competition_id: this.competitionId,
            reset_time: Date.now()
        });
        return true;
    }

    /**
     * Send referee decision
     */
    submitRefereeDecision(refereeId, decision, attemptId) {
        if (!this.isValidConnection()) return false;

        this.socket.emit('referee_decision', {
            competition_id: this.competitionId,
            referee_id: refereeId,
            decision: decision,
            attempt_id: attemptId,
            timestamp: Date.now()
        });
        return true;
    }

    /**
     * Send attempt result
     */
    submitAttemptResult(athleteId, result) {
        if (!this.isValidConnection()) return false;

        this.socket.emit('attempt_result', {
            competition_id: this.competitionId,
            athlete_id: athleteId,
            result: result,
            timestamp: Date.now()
        });
        return true;
    }

    /**
     * Test connection with ping
     */
    ping() {
        if (!this.socket) return false;

        this.socket.emit('ping', { timestamp: Date.now() });
        return true;
    }

    /**
     * Add event listener
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
        if (!this.eventListeners[event]) return;

        const index = this.eventListeners[event].indexOf(callback);
        if (index > -1) {
            this.eventListeners[event].splice(index, 1);
        }
    }

    /**
     * Emit event to listeners
     */
    emit(event, data = null) {
        if (!this.eventListeners[event]) return;

        this.eventListeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    /**
     * Check if connection is valid for sending data
     */
    isValidConnection() {
        if (!this.socket || !this.isConnected) {
            console.warn('Cannot send data: not connected');
            return false;
        }

        if (!this.competitionId) {
            console.warn('Cannot send data: not joined to a competition');
            return false;
        }

        return true;
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            competitionId: this.competitionId,
            userType: this.userType,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.competitionId = null;
    }
}

// Connection status indicator
class ConnectionStatus {
    constructor(containerId = 'connection-status') {
        this.container = document.getElementById(containerId);
        this.status = 'disconnected';
        this.createStatusIndicator();
    }

    createStatusIndicator() {
        if (!this.container) {
            // Create default container if not provided
            this.container = document.createElement('div');
            this.container.id = 'connection-status';
            this.container.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(this.container);
        }

        this.updateStatus('disconnected');
    }

    updateStatus(status, message = '') {
        this.status = status;

        const statusConfig = {
            'connected': {
                text: '🟢 Connected',
                color: '#ffffff',
                background: '#28a745'
            },
            'connecting': {
                text: '🟡 Connecting...',
                color: '#ffffff',
                background: '#ffc107'
            },
            'disconnected': {
                text: '🔴 Disconnected',
                color: '#ffffff',
                background: '#dc3545'
            },
            'error': {
                text: '❌ Error',
                color: '#ffffff',
                background: '#dc3545'
            }
        };

        const config = statusConfig[status] || statusConfig['disconnected'];

        this.container.textContent = config.text + (message ? ` - ${message}` : '');
        this.container.style.color = config.color;
        this.container.style.backgroundColor = config.background;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebSocketClient, ConnectionStatus };
}