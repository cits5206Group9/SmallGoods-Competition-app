/**
 * Real-time Timer Component for Competition Management
 */
class RealTimeTimer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Timer container ${containerId} not found`);
            return;
        }

        this.options = {
            duration: options.duration || 60,
            type: options.type || 'attempt',
            showControls: options.showControls !== false,
            showProgress: options.showProgress !== false,
            autoStart: options.autoStart || false,
            ...options
        };

        // Timer state
        this.currentTime = this.options.duration;
        this.totalTime = this.options.duration;
        this.isRunning = false;
        this.isPaused = false;

        // WebSocket client reference
        this.wsClient = options.wsClient || null;

        // Callbacks
        this.onTick = options.onTick || null;
        this.onComplete = options.onComplete || null;
        this.onStateChange = options.onStateChange || null;

        this.init();
    }

    init() {
        this.createTimerUI();
        this.setupEventListeners();

        if (this.wsClient) {
            this.setupWebSocketListeners();
        }

        if (this.options.autoStart) {
            this.start();
        }
    }

    createTimerUI() {
        this.container.innerHTML = `
            <div class="real-time-timer">
                <div class="timer-display">
                    <div class="timer-time" id="${this.container.id}-time">
                        ${this.formatTime(this.currentTime)}
                    </div>
                    <div class="timer-type">${this.options.type.toUpperCase()}</div>
                </div>

                ${this.options.showProgress ? `
                    <div class="timer-progress">
                        <div class="timer-progress-bar" id="${this.container.id}-progress"></div>
                    </div>
                ` : ''}

                ${this.options.showControls ? `
                    <div class="timer-controls">
                        <button class="timer-btn timer-start" id="${this.container.id}-start">
                            ▶️ Start
                        </button>
                        <button class="timer-btn timer-pause" id="${this.container.id}-pause" disabled>
                            ⏸️ Pause
                        </button>
                        <button class="timer-btn timer-stop" id="${this.container.id}-stop" disabled>
                            ⏹️ Stop
                        </button>
                        <button class="timer-btn timer-reset" id="${this.container.id}-reset">
                            🔄 Reset
                        </button>
                    </div>
                ` : ''}

                <div class="timer-status" id="${this.container.id}-status">
                    Ready
                </div>
            </div>
        `;

        this.addTimerStyles();
        this.updateDisplay();
    }

    addTimerStyles() {
        if (document.getElementById('real-time-timer-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'real-time-timer-styles';
        styles.textContent = `
            .real-time-timer {
                background: #f8f9fa;
                border: 2px solid #dee2e6;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 300px;
                margin: 0 auto;
            }

            .timer-display {
                margin-bottom: 15px;
            }

            .timer-time {
                font-size: 3rem;
                font-weight: bold;
                color: #333;
                margin-bottom: 5px;
                font-family: 'Courier New', monospace;
            }

            .timer-time.warning {
                color: #ffc107;
            }

            .timer-time.danger {
                color: #dc3545;
                animation: pulse 1s infinite;
            }

            .timer-type {
                font-size: 0.9rem;
                color: #6c757d;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .timer-progress {
                width: 100%;
                height: 8px;
                background: #e9ecef;
                border-radius: 4px;
                margin-bottom: 15px;
                overflow: hidden;
            }

            .timer-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #28a745, #ffc107, #dc3545);
                transition: width 0.1s ease-out;
                border-radius: 4px;
            }

            .timer-controls {
                display: flex;
                gap: 8px;
                justify-content: center;
                margin-bottom: 15px;
                flex-wrap: wrap;
            }

            .timer-btn {
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                background: #007bff;
                color: white;
                cursor: pointer;
                font-size: 0.85rem;
                transition: all 0.2s ease;
            }

            .timer-btn:hover:not(:disabled) {
                background: #0056b3;
                transform: translateY(-1px);
            }

            .timer-btn:disabled {
                background: #6c757d;
                cursor: not-allowed;
                opacity: 0.6;
            }

            .timer-start { background: #28a745; }
            .timer-start:hover:not(:disabled) { background: #1e7e34; }

            .timer-pause { background: #ffc107; color: #212529; }
            .timer-pause:hover:not(:disabled) { background: #e0a800; }

            .timer-stop { background: #dc3545; }
            .timer-stop:hover:not(:disabled) { background: #c82333; }

            .timer-reset { background: #6c757d; }
            .timer-reset:hover:not(:disabled) { background: #545b62; }

            .timer-status {
                font-size: 0.9rem;
                color: #6c757d;
                padding: 8px;
                background: #e9ecef;
                border-radius: 4px;
                font-weight: 500;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }

            .timer-expired {
                border-color: #dc3545;
                background: #f8d7da;
            }

            .timer-running {
                border-color: #28a745;
                background: #d4edda;
            }

            .timer-paused {
                border-color: #ffc107;
                background: #fff3cd;
            }
        `;
        document.head.appendChild(styles);
    }

    setupEventListeners() {
        if (!this.options.showControls) return;

        const startBtn = document.getElementById(`${this.container.id}-start`);
        const pauseBtn = document.getElementById(`${this.container.id}-pause`);
        const stopBtn = document.getElementById(`${this.container.id}-stop`);
        const resetBtn = document.getElementById(`${this.container.id}-reset`);

        if (startBtn) startBtn.addEventListener('click', () => this.start());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pause());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stop());
        if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
    }

    setupWebSocketListeners() {
        if (!this.wsClient) return;

        this.wsClient.on('timer_update', (data) => {
            this.handleTimerUpdate(data);
        });
    }

    handleTimerUpdate(data) {
        console.log('Timer update received:', data);

        switch (data.action) {
            case 'start':
                this.syncStart(data);
                break;
            case 'pause':
                this.syncPause(data);
                break;
            case 'stop':
                this.syncStop(data);
                break;
            case 'reset':
                this.syncReset(data);
                break;
            default:
                // Regular update
                if (data.remaining !== undefined) {
                    this.currentTime = data.remaining;
                    this.updateDisplay();
                }
        }
    }

    syncStart(data) {
        this.isRunning = true;
        this.isPaused = false;
        this.updateControlStates();
        this.updateStatus('Running');

        if (data.duration) {
            this.totalTime = data.duration;
            this.currentTime = data.duration;
        }

        this.startLocalCountdown();
    }

    syncPause(data) {
        this.isRunning = false;
        this.isPaused = true;
        this.updateControlStates();
        this.updateStatus('Paused');
        this.stopLocalCountdown();
    }

    syncStop(data) {
        this.isRunning = false;
        this.isPaused = false;
        this.updateControlStates();
        this.updateStatus('Stopped');
        this.stopLocalCountdown();
    }

    syncReset(data) {
        this.currentTime = this.totalTime;
        this.isRunning = false;
        this.isPaused = false;
        this.updateControlStates();
        this.updateStatus('Ready');
        this.updateDisplay();
        this.stopLocalCountdown();
    }

    start() {
        if (this.isRunning) return;

        if (this.wsClient) {
            this.wsClient.startTimer({
                duration: this.isPaused ? undefined : this.totalTime,
                type: this.options.type
            });
        } else {
            this.syncStart({ duration: this.totalTime });
        }
    }

    pause() {
        if (!this.isRunning) return;

        if (this.wsClient) {
            this.wsClient.stopTimer(); // Using stop for pause in WebSocket
        } else {
            this.syncPause({});
        }
    }

    stop() {
        if (this.wsClient) {
            this.wsClient.stopTimer();
        } else {
            this.syncStop({});
        }
    }

    reset() {
        if (this.wsClient) {
            this.wsClient.resetTimer();
        } else {
            this.syncReset({});
        }
    }

    startLocalCountdown() {
        this.stopLocalCountdown();

        this.countdown = setInterval(() => {
            if (this.isRunning && this.currentTime > 0) {
                this.currentTime--;
                this.updateDisplay();

                if (this.onTick) {
                    this.onTick(this.currentTime);
                }

                if (this.currentTime <= 0) {
                    this.handleExpiration();
                }
            }
        }, 1000);
    }

    stopLocalCountdown() {
        if (this.countdown) {
            clearInterval(this.countdown);
            this.countdown = null;
        }
    }

    handleExpiration() {
        this.isRunning = false;
        this.updateControlStates();
        this.updateStatus('Time Expired!');
        this.container.querySelector('.real-time-timer').classList.add('timer-expired');

        if (this.onComplete) {
            this.onComplete();
        }

        this.stopLocalCountdown();
    }

    updateDisplay() {
        const timeElement = document.getElementById(`${this.container.id}-time`);
        const progressElement = document.getElementById(`${this.container.id}-progress`);

        if (timeElement) {
            timeElement.textContent = this.formatTime(this.currentTime);

            // Color coding
            timeElement.classList.remove('warning', 'danger');
            if (this.currentTime <= 10 && this.currentTime > 5) {
                timeElement.classList.add('warning');
            } else if (this.currentTime <= 5) {
                timeElement.classList.add('danger');
            }
        }

        if (progressElement && this.totalTime > 0) {
            const percentage = (this.currentTime / this.totalTime) * 100;
            progressElement.style.width = `${percentage}%`;
        }

        // Update container classes
        const timer = this.container.querySelector('.real-time-timer');
        timer.classList.remove('timer-running', 'timer-paused', 'timer-expired');

        if (this.currentTime <= 0) {
            timer.classList.add('timer-expired');
        } else if (this.isRunning) {
            timer.classList.add('timer-running');
        } else if (this.isPaused) {
            timer.classList.add('timer-paused');
        }
    }

    updateControlStates() {
        if (!this.options.showControls) return;

        const startBtn = document.getElementById(`${this.container.id}-start`);
        const pauseBtn = document.getElementById(`${this.container.id}-pause`);
        const stopBtn = document.getElementById(`${this.container.id}-stop`);

        if (startBtn) startBtn.disabled = this.isRunning;
        if (pauseBtn) pauseBtn.disabled = !this.isRunning;
        if (stopBtn) stopBtn.disabled = !this.isRunning && !this.isPaused;
    }

    updateStatus(status) {
        const statusElement = document.getElementById(`${this.container.id}-status`);
        if (statusElement) {
            statusElement.textContent = status;
        }

        if (this.onStateChange) {
            this.onStateChange(status, {
                isRunning: this.isRunning,
                isPaused: this.isPaused,
                currentTime: this.currentTime
            });
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    setDuration(duration) {
        this.totalTime = duration;
        this.currentTime = duration;
        this.updateDisplay();
    }

    getCurrentTime() {
        return this.currentTime;
    }

    getState() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentTime: this.currentTime,
            totalTime: this.totalTime
        };
    }

    destroy() {
        this.stopLocalCountdown();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealTimeTimer;
}