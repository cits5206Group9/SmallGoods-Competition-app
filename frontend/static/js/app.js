/**
 * Main Application Entry Point
 * Initializes the competition management system
 */

class CompetitionApp {
    constructor() {
        this.config = window.APP_CONFIG || {};
        this.initialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }
    
    async init() {
        try {
            console.log('Initializing Competition App...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.start());
            } else {
                this.start();
            }
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize application');
        }
    }
    
    async start() {
        try {
            // Initialize core systems
            await this.initializeStorage();
            await this.initializeUI();
            await this.initializeNetworking();
            await this.initializeStateBindings();
            
            // Load initial data
            await this.loadInitialData();
            
            // Start real-time updates
            await this.startRealtimeConnection();
            
            this.initialized = true;
            console.log('Competition App initialized successfully');
            
            // Notify that app is ready
            document.dispatchEvent(new CustomEvent('app:ready'));
            
        } catch (error) {
            console.error('Failed to start app:', error);
            this.showError('Failed to start application');
        }
    }
    
    async initializeStorage() {
        // Storage manager is already initialized globally
        // Just verify it's working
        if (!window.storageManager) {
            throw new Error('Storage manager not available');
        }
        
        // Load user settings
        const theme = await storageManager.getSetting('theme', 'light');
        document.documentElement.setAttribute('data-theme', theme);
        
        console.log('Storage initialized');
    }
    
    async initializeUI() {
        // Initialize UI components
        this.initializeOfflineIndicator();
        this.initializeLoadingIndicator();
        this.initializeErrorHandling();
        this.initializeKeyboardHandlers();
        
        // Initialize page-specific UI
        const currentPage = this.getCurrentPage();
        if (currentPage) {
            await this.initializePageUI(currentPage);
        }
        
        console.log('UI initialized');
    }
    
    initializeOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            const updateStatus = () => {
                const isOffline = !navigator.onLine || !stateManager.getState('network.connected');
                indicator.classList.toggle('hidden', !isOffline);
            };
            
            // Listen for online/offline events
            window.addEventListener('online', updateStatus);
            window.addEventListener('offline', updateStatus);
            
            // Listen for connection status changes
            stateManager.subscribe('network.connected', updateStatus);
            
            updateStatus();
        }
    }
    
    initializeLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            stateManager.subscribe('ui.loading', (loading) => {
                indicator.classList.toggle('hidden', !loading);
            });
        }
    }
    
    initializeErrorHandling() {
        const errorContainer = document.getElementById('error-messages');
        const successContainer = document.getElementById('success-messages');
        
        // Error messages
        stateManager.subscribe('ui.errors', (errors) => {
            if (errorContainer) {
                errorContainer.innerHTML = '';
                errors.forEach(error => {
                    const div = document.createElement('div');
                    div.className = 'error-message';
                    div.textContent = error.message;
                    div.addEventListener('click', () => stateManager.removeError(error.id));
                    errorContainer.appendChild(div);
                });
            }
        });
        
        // Success messages
        stateManager.subscribe('ui.messages', (messages) => {
            if (successContainer) {
                successContainer.innerHTML = '';
                messages.forEach(msg => {
                    const div = document.createElement('div');
                    div.className = 'success-message';
                    div.textContent = msg.message;
                    div.addEventListener('click', () => stateManager.removeMessage(msg.id));
                    successContainer.appendChild(div);
                });
            }
        });
        
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            stateManager.addError(`Application error: ${event.error.message}`);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            stateManager.addError(`Promise error: ${event.reason}`);
        });
    }
    
    initializeKeyboardHandlers() {
        document.addEventListener('keydown', (event) => {
            // Global keyboard shortcuts
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 's':
                        event.preventDefault();
                        this.saveCurrentState();
                        break;
                    case 'r':
                        if (event.shiftKey) {
                            event.preventDefault();
                            location.reload();
                        }
                        break;
                }
            }
            
            // Escape key handlers
            if (event.key === 'Escape') {
                this.closeModals();
            }
        });
    }
    
    async initializePageUI(page) {
        switch (page) {
            case 'admin':
                await this.initializeAdminUI();
                break;
            case 'referee':
                await this.initializeRefereeUI();
                break;
            case 'timekeeper':
                await this.initializeTimekeeperUI();
                break;
            case 'athlete':
                await this.initializeAthleteUI();
                break;
            case 'display':
                await this.initializeDisplayUI();
                break;
            case 'network':
                await this.initializeNetworkUI();
                break;
        }
    }
    
    async initializeNetworking() {
        // Initialize WebSocket connection if available
        if (window.WebSocketManager) {
            this.wsManager = new WebSocketManager();
        }
        
        // Initialize API client
        this.apiClient = new APIClient();
        
        console.log('Networking initialized');
    }
    
    async initializeStateBindings() {
        // Set up user state from config
        if (this.config.role) {
            stateManager.updateState('user.role', this.config.role);
        }
        
        if (this.config.competitionId) {
            stateManager.updateState('competition.id', this.config.competitionId);
        }
        
        // Bind timer updates to UI
        stateManager.subscribe('timer.remaining', this.updateTimerDisplays.bind(this));
        stateManager.subscribe('timer.isRunning', this.updateTimerControls.bind(this));
        
        // Bind queue updates to UI
        stateManager.subscribe('queue.order', this.updateQueueDisplays.bind(this));
        stateManager.subscribe('queue.current', this.updateCurrentAthleteDisplay.bind(this));
        
        console.log('State bindings initialized');
    }
    
    async loadInitialData() {
        stateManager.updateState('ui.loading', true);
        
        try {
            // Load competition data
            const competitionId = this.config.competitionId;
            if (competitionId) {
                await this.loadCompetitionData(competitionId);
            }
            
            // Load user-specific data
            const userRole = this.config.role;
            if (userRole && userRole !== 'public') {
                await this.loadUserData(userRole);
            }
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            stateManager.addError('Failed to load competition data');
        } finally {
            stateManager.updateState('ui.loading', false);
        }
    }
    
    async loadCompetitionData(competitionId) {
        try {
            // Try to load from network first, fall back to offline data
            let athletes, queue, leaderboard;
            
            if (navigator.onLine) {
                try {
                    // Load from API
                    athletes = await this.apiClient.getAthletes(competitionId);
                    queue = await this.apiClient.getQueue(competitionId);
                    leaderboard = await this.apiClient.getLeaderboard(competitionId);
                } catch (networkError) {
                    console.warn('Network error, loading offline data:', networkError);
                }
            }
            
            // Fall back to offline data if needed
            if (!athletes) athletes = await storageManager.getAthletes(competitionId);
            if (!queue) queue = await storageManager.getQueue(competitionId);
            
            // Update state
            if (athletes) {
                stateManager.updateState('athletes.list', athletes);
                
                // Create byId lookup
                const byId = {};
                athletes.forEach(athlete => {
                    byId[athlete.id] = athlete;
                });
                stateManager.updateState('athletes.byId', byId);
            }
            
            if (queue) {
                stateManager.updateState('queue.order', queue.order || []);
                stateManager.updateState('queue.current', queue.current);
            }
            
            if (leaderboard) {
                stateManager.updateState('leaderboard.rankings', leaderboard.rankings || []);
                stateManager.updateState('leaderboard.lastUpdated', leaderboard.lastUpdated);
            }
            
        } catch (error) {
            console.error('Failed to load competition data:', error);
            throw error;
        }
    }
    
    async startRealtimeConnection() {
        if (this.wsManager) {
            try {
                await this.wsManager.connect();
                stateManager.updateState('network.connected', true);
                this.reconnectAttempts = 0;
            } catch (error) {
                console.error('Failed to connect WebSocket:', error);
                this.scheduleReconnect();
            }
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
            console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
            
            setTimeout(async () => {
                this.reconnectAttempts++;
                await this.startRealtimeConnection();
            }, delay);
        } else {
            console.log('Max reconnect attempts reached');
            stateManager.addError('Connection lost. Working in offline mode.');
        }
    }
    
    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('/admin')) return 'admin';
        if (path.includes('/ref')) return 'referee';
        if (path.includes('/tc') || path.includes('/timekeeper')) return 'timekeeper';
        if (path.includes('/athlete')) return 'athlete';
        if (path.includes('/display')) return 'display';
        if (path.includes('/network') || path.includes('/qr')) return 'network';
        return null;
    }
    
    // UI Update Methods
    updateTimerDisplays(remaining) {
        const displays = document.querySelectorAll('[id*="timer"]');
        displays.forEach(display => {
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (display.classList.contains('time') || display.id === 'timer-value') {
                display.textContent = timeString;
            }
        });
    }
    
    updateTimerControls(isRunning) {
        const startBtns = document.querySelectorAll('[data-action="start"]');
        const pauseBtns = document.querySelectorAll('[data-action="pause"]');
        
        startBtns.forEach(btn => {
            btn.disabled = isRunning;
            btn.style.display = isRunning ? 'none' : 'inline-flex';
        });
        
        pauseBtns.forEach(btn => {
            btn.disabled = !isRunning;
            btn.style.display = isRunning ? 'inline-flex' : 'none';
        });
    }
    
    updateQueueDisplays(queue) {
        const displays = document.querySelectorAll('#queue-list, .queue-display');
        displays.forEach(display => {
            if (queue && queue.length > 0) {
                display.innerHTML = queue.map((athlete, index) => `
                    <div class="queue-item" data-athlete-id="${athlete.id}">
                        <span class="position">${index + 1}</span>
                        <span class="name">${athlete.name}</span>
                        <span class="weight">${athlete.currentWeight || '--'} kg</span>
                    </div>
                `).join('');
            } else {
                display.innerHTML = '<div class="placeholder">No athletes in queue</div>';
            }
        });
    }
    
    updateCurrentAthleteDisplay(athlete) {
        const displays = document.querySelectorAll('#current-athlete-info, .current-athlete');
        displays.forEach(display => {
            if (athlete) {
                display.innerHTML = `
                    <div class="athlete-name">${athlete.name}</div>
                    <div class="athlete-details">
                        <span class="weight">${athlete.currentWeight || '--'} kg</span>
                        <span class="attempt">${athlete.currentAttempt || '--'}</span>
                    </div>
                `;
            } else {
                display.innerHTML = '<div class="placeholder">No active athlete</div>';
            }
        });
    }
    
    // Utility methods
    async saveCurrentState() {
        try {
            await storageManager.exportData();
            stateManager.addMessage('State saved successfully', 'success');
        } catch (error) {
            console.error('Failed to save state:', error);
            stateManager.addError('Failed to save current state');
        }
    }
    
    closeModals() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            modal.classList.add('hidden');
        });
    }
    
    showError(message, timeout = 5000) {
        stateManager.addError(message, timeout);
    }
    
    showMessage(message, type = 'info', timeout = 3000) {
        stateManager.addMessage(message, type, timeout);
    }
    
    // Development helpers
    debug() {
        return {
            config: this.config,
            state: stateManager.getState(),
            storage: storageManager,
            initialized: this.initialized
        };
    }
}

// Simple API Client
class APIClient {
    constructor() {
        this.baseURL = window.APP_CONFIG?.apiEndpoint || '/api';
        this.timeout = 10000; // 10 seconds
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    async getAthletes(competitionId) {
        return await this.request(`/athletes?competitionId=${competitionId}`);
    }
    
    async getQueue(competitionId) {
        return await this.request(`/queue?competitionId=${competitionId}`);
    }
    
    async getLeaderboard(competitionId) {
        return await this.request(`/leaderboard?competitionId=${competitionId}`);
    }
    
    async submitDecision(decision) {
        return await this.request('/referee/decision', {
            method: 'POST',
            body: JSON.stringify(decision)
        });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.competitionApp = new CompetitionApp();
});

// Make it available globally for debugging
window.CompetitionApp = CompetitionApp;