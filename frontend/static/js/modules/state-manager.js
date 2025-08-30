/**
 * State Management System
 * Centralized state management using Observer pattern
 */

class StateManager {
    constructor() {
        this.state = {
            competition: {
                id: null,
                name: 'Small Goods Competition',
                status: 'idle',
                currentEvent: null
            },
            timer: {
                remaining: 120000, // 2 minutes in milliseconds
                isRunning: false,
                startTime: null,
                duration: 120000
            },
            queue: {
                current: null,
                upcoming: [],
                order: []
            },
            athletes: {
                list: [],
                current: null,
                byId: {}
            },
            attempts: {
                current: null,
                history: [],
                byAthleteId: {}
            },
            leaderboard: {
                rankings: [],
                lastUpdated: null
            },
            user: {
                role: 'public',
                id: null,
                authenticated: false
            },
            network: {
                online: navigator.onLine,
                connected: false,
                lastSync: null
            },
            ui: {
                activeSection: 'overview',
                loading: false,
                errors: [],
                messages: []
            }
        };
        
        this.observers = new Map();
        this.persistKeys = ['competition', 'athletes', 'attempts', 'leaderboard', 'user'];
        
        this.init();
    }
    
    init() {
        // Load persisted state from localStorage
        this.loadState();
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.updateState('network.online', true));
        window.addEventListener('offline', () => this.updateState('network.online', false));
        
        // Auto-save state changes
        this.subscribe('*', () => this.saveState());
    }
    
    /**
     * Subscribe to state changes
     * @param {string} path - State path to watch (e.g., 'timer.remaining' or '*' for all)
     * @param {Function} callback - Function to call when state changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.observers.has(path)) {
            this.observers.set(path, new Set());
        }
        
        this.observers.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.observers.get(path);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }
    
    /**
     * Get state value by path
     * @param {string} path - State path (e.g., 'timer.remaining')
     * @returns {any} State value
     */
    getState(path = '') {
        if (!path) return this.state;
        
        return path.split('.').reduce((obj, key) => {
            return obj && obj[key] !== undefined ? obj[key] : null;
        }, this.state);
    }
    
    /**
     * Update state and notify observers
     * @param {string} path - State path to update
     * @param {any} value - New value
     * @param {boolean} merge - Whether to merge objects (default: false)
     */
    updateState(path, value, merge = false) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        // Navigate to parent object
        const parent = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.state);
        
        // Update value
        if (merge && typeof parent[lastKey] === 'object' && typeof value === 'object') {
            parent[lastKey] = { ...parent[lastKey], ...value };
        } else {
            parent[lastKey] = value;
        }
        
        // Notify observers
        this.notifyObservers(path, value);
    }
    
    /**
     * Batch update multiple state values
     * @param {Object} updates - Object with paths as keys and values as values
     */
    batchUpdate(updates) {
        Object.entries(updates).forEach(([path, value]) => {
            this.updateState(path, value);
        });
    }
    
    /**
     * Notify observers of state changes
     * @param {string} path - Changed state path
     * @param {any} value - New value
     */
    notifyObservers(path, value) {
        // Notify specific path observers
        const pathObservers = this.observers.get(path);
        if (pathObservers) {
            pathObservers.forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error('Observer callback error:', error);
                }
            });
        }
        
        // Notify wildcard observers
        const wildcardObservers = this.observers.get('*');
        if (wildcardObservers) {
            wildcardObservers.forEach(callback => {
                try {
                    callback(value, path);
                } catch (error) {
                    console.error('Wildcard observer callback error:', error);
                }
            });
        }
    }
    
    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const stored = localStorage.getItem('competitionState');
            if (stored) {
                const data = JSON.parse(stored);
                
                // Only load specific keys to avoid loading temporary UI state
                this.persistKeys.forEach(key => {
                    if (data[key]) {
                        this.state[key] = { ...this.state[key], ...data[key] };
                    }
                });
            }
        } catch (error) {
            console.warn('Failed to load state from localStorage:', error);
        }
    }
    
    /**
     * Save state to localStorage
     */
    saveState() {
        try {
            const persistState = {};
            this.persistKeys.forEach(key => {
                persistState[key] = this.state[key];
            });
            
            localStorage.setItem('competitionState', JSON.stringify(persistState));
        } catch (error) {
            console.warn('Failed to save state to localStorage:', error);
        }
    }
    
    /**
     * Clear all state and localStorage
     */
    clearState() {
        this.state = {
            competition: { id: null, name: 'Small Goods Competition', status: 'idle', currentEvent: null },
            timer: { remaining: 120000, isRunning: false, startTime: null, duration: 120000 },
            queue: { current: null, upcoming: [], order: [] },
            athletes: { list: [], current: null, byId: {} },
            attempts: { current: null, history: [], byAthleteId: {} },
            leaderboard: { rankings: [], lastUpdated: null },
            user: { role: 'public', id: null, authenticated: false },
            network: { online: navigator.onLine, connected: false, lastSync: null },
            ui: { activeSection: 'overview', loading: false, errors: [], messages: [] }
        };
        
        localStorage.removeItem('competitionState');
        this.notifyObservers('*', this.state);
    }
    
    /**
     * Timer-specific methods
     */
    startTimer() {
        if (!this.state.timer.isRunning) {
            this.updateState('timer.isRunning', true);
            this.updateState('timer.startTime', Date.now());
            this.timerInterval = setInterval(() => this.updateTimer(), 100);
        }
    }
    
    pauseTimer() {
        if (this.state.timer.isRunning) {
            this.updateState('timer.isRunning', false);
            clearInterval(this.timerInterval);
        }
    }
    
    resetTimer(duration = null) {
        clearInterval(this.timerInterval);
        const newDuration = duration || this.state.timer.duration;
        this.batchUpdate({
            'timer.remaining': newDuration,
            'timer.duration': newDuration,
            'timer.isRunning': false,
            'timer.startTime': null
        });
    }
    
    updateTimer() {
        if (this.state.timer.isRunning && this.state.timer.startTime) {
            const elapsed = Date.now() - this.state.timer.startTime;
            const remaining = Math.max(0, this.state.timer.duration - elapsed);
            
            this.updateState('timer.remaining', remaining);
            
            if (remaining === 0) {
                this.pauseTimer();
                this.notifyObservers('timer.expired', true);
            }
        }
    }
    
    /**
     * Queue management methods
     */
    addToQueue(athlete) {
        const currentQueue = this.getState('queue.order');
        const newQueue = [...currentQueue, athlete];
        this.updateState('queue.order', newQueue);
    }
    
    removeFromQueue(athleteId) {
        const currentQueue = this.getState('queue.order');
        const newQueue = currentQueue.filter(athlete => athlete.id !== athleteId);
        this.updateState('queue.order', newQueue);
    }
    
    reorderQueue(newOrder) {
        this.updateState('queue.order', newOrder);
    }
    
    setCurrentAthlete(athlete) {
        this.batchUpdate({
            'queue.current': athlete,
            'athletes.current': athlete
        });
    }
    
    /**
     * Error and message handling
     */
    addError(message, timeout = 5000) {
        const error = { id: Date.now(), message, timestamp: new Date() };
        const currentErrors = this.getState('ui.errors');
        this.updateState('ui.errors', [...currentErrors, error]);
        
        if (timeout > 0) {
            setTimeout(() => this.removeError(error.id), timeout);
        }
        
        return error.id;
    }
    
    removeError(errorId) {
        const currentErrors = this.getState('ui.errors');
        const filteredErrors = currentErrors.filter(error => error.id !== errorId);
        this.updateState('ui.errors', filteredErrors);
    }
    
    addMessage(message, type = 'info', timeout = 3000) {
        const msg = { id: Date.now(), message, type, timestamp: new Date() };
        const currentMessages = this.getState('ui.messages');
        this.updateState('ui.messages', [...currentMessages, msg]);
        
        if (timeout > 0) {
            setTimeout(() => this.removeMessage(msg.id), timeout);
        }
        
        return msg.id;
    }
    
    removeMessage(messageId) {
        const currentMessages = this.getState('ui.messages');
        const filteredMessages = currentMessages.filter(msg => msg.id !== messageId);
        this.updateState('ui.messages', filteredMessages);
    }
    
    /**
     * Development helper - expose state to console
     */
    debug() {
        console.log('Current State:', this.state);
        console.log('Observers:', this.observers);
        return this.state;
    }
}

// Create global instance
window.stateManager = new StateManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}