/**
 * Admin Page JavaScript
 * Handles admin dashboard functionality
 */

class AdminPage {
    constructor() {
        this.currentSection = 'overview';
        this.currentTab = 'events';
        this.searchTimeout = null;
        this.editingCell = null;
        
        this.init();
    }
    
    init() {
        this.initializeNavigation();
        this.initializeSearch();
        this.initializeTabs();
        this.initializeTableActions();
        this.initializeTimerControls();
        this.bindStateUpdates();
        
        // Load initial data
        this.loadDashboardData();
        
        console.log('Admin page initialized');
    }
    
    initializeNavigation() {
        // Sidebar navigation
        const menuButtons = document.querySelectorAll('.menu-button');
        menuButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.switchSection(section);
            });
        });
        
        // Header navigation
        const navButtons = document.querySelectorAll('.nav-button');
        navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleNavAction(action);
            });
        });
    }
    
    initializeSearch() {
        const searchInput = document.getElementById('score-search');
        const searchButton = document.querySelector('.search-button');
        const searchResults = document.getElementById('search-results');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length >= 2) {
                    this.searchTimeout = setTimeout(() => {
                        this.performSearch(query);
                    }, 300); // Debounce search
                } else {
                    this.clearSearchResults();
                }
            });
            
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performSearch(e.target.value.trim());
                }
            });
        }
        
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                const query = searchInput.value.trim();
                if (query) {
                    this.performSearch(query);
                }
            });
        }
    }
    
    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });
    }
    
    initializeTableActions() {
        // Action buttons
        const actionButtons = document.querySelectorAll('.action-btn');
        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleTableAction(action);
            });
        });
    }
    
    initializeTimerControls() {
        const timerButtons = document.querySelectorAll('.timer-btn');
        timerButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleTimerAction(action);
            });
        });
    }
    
    bindStateUpdates() {
        // Listen for state changes and update UI accordingly
        if (window.stateManager) {
            stateManager.subscribe('queue.current', (athlete) => {
                this.updateCurrentAthleteDisplay(athlete);
            });
            
            stateManager.subscribe('timer.remaining', (remaining) => {
                this.updateTimerDisplay(remaining);
            });
            
            stateManager.subscribe('leaderboard.rankings', (rankings) => {
                this.updateLeaderboard(rankings);
            });
            
            stateManager.subscribe('queue.order', (queue) => {
                this.updateQueue(queue);
            });
        }
    }
    
    // Navigation methods
    switchSection(section) {
        // Update menu active state
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-section="${section}"]`).closest('.menu-item');
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        // Switch content sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        this.currentSection = section;
        
        // Load section-specific data
        this.loadSectionData(section);
    }
    
    switchTab(tab) {
        // Update tab active state
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeTab = document.querySelector(`[data-tab="${tab}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        this.currentTab = tab;
        this.loadTabData(tab);
    }
    
    handleNavAction(action) {
        switch (action) {
            case 'settings':
                this.openSettings();
                break;
            case 'logout':
                this.logout();
                break;
        }
    }
    
    // Search functionality
    async performSearch(query) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        
        stateManager.updateState('ui.loading', true);
        
        try {
            // Search in local storage first
            let results = [];
            if (window.storageManager) {
                results = await storageManager.searchAttempts(query);
            }
            
            this.displaySearchResults(results);
            
        } catch (error) {
            console.error('Search failed:', error);
            stateManager.addError('Search failed');
        } finally {
            stateManager.updateState('ui.loading', false);
        }
    }
    
    displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        if (!resultsContainer) return;
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="search-result">No results found</div>';
        } else {
            resultsContainer.innerHTML = results.map(result => `
                <div class="search-result" data-result-id="${result.id}">
                    <div class="result-athlete">${result.athleteName || 'Unknown Athlete'}</div>
                    <div class="result-details">
                        <span class="result-lift">${result.lift || 'Unknown'}</span>
                        <span class="result-weight">${result.weight || '--'} kg</span>
                        <span class="result-outcome ${result.result?.toLowerCase()}">${result.result || 'Unknown'}</span>
                    </div>
                    <div class="result-timestamp">${this.formatTimestamp(result.timestamp)}</div>
                </div>
            `).join('');
            
            // Add click handlers
            resultsContainer.querySelectorAll('.search-result').forEach(result => {
                result.addEventListener('click', (e) => {
                    const resultId = e.currentTarget.dataset.resultId;
                    this.viewSearchResult(resultId);
                });
            });
        }
        
        resultsContainer.classList.add('has-results');
    }
    
    clearSearchResults() {
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer) {
            resultsContainer.classList.remove('has-results');
            resultsContainer.innerHTML = '';
        }
    }
    
    // Table management
    handleTableAction(action) {
        switch (action) {
            case 'add-event':
                this.addEvent();
                break;
            case 'add-lift':
                this.addLift();
                break;
            case 'add-flight':
                this.addFlight();
                break;
            case 'add-athlete':
                this.addAthlete();
                break;
            case 'add-referee':
                this.addReferee();
                break;
        }
    }
    
    loadTabData(tab) {
        const tableContent = document.getElementById('model-table-content');
        if (!tableContent) return;
        
        // Show loading state
        tableContent.innerHTML = '<div class="loading-spinner"></div>';
        
        // Simulate loading data based on tab
        setTimeout(() => {
            switch (tab) {
                case 'events':
                    this.loadEventsTable();
                    break;
                case 'lifts':
                    this.loadLiftsTable();
                    break;
                case 'flights':
                    this.loadFlightsTable();
                    break;
                case 'athletes':
                    this.loadAthletesTable();
                    break;
                case 'referees':
                    this.loadRefereesTable();
                    break;
                default:
                    tableContent.innerHTML = '<div class="placeholder">Select a tab to view data</div>';
            }
        }, 300);
    }
    
    // Timer controls
    handleTimerAction(action) {
        if (!window.stateManager) return;
        
        switch (action) {
            case 'start':
                stateManager.startTimer();
                stateManager.addMessage('Timer started', 'success');
                break;
            case 'pause':
                stateManager.pauseTimer();
                stateManager.addMessage('Timer paused', 'info');
                break;
            case 'reset':
                stateManager.resetTimer();
                stateManager.addMessage('Timer reset', 'info');
                break;
        }
    }
    
    // Data loading methods
    async loadDashboardData() {
        try {
            // Load current competition state
            const competitionId = stateManager.getState('competition.id');
            if (competitionId && window.storageManager) {
                const athletes = await storageManager.getAthletes(competitionId);
                const queue = await storageManager.getQueue(competitionId);
                
                if (athletes) {
                    stateManager.updateState('athletes.list', athletes);
                }
                
                if (queue) {
                    stateManager.updateState('queue.order', queue.order || []);
                }
            }
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            stateManager.addError('Failed to load dashboard data');
        }
    }
    
    loadSectionData(section) {
        // Load data specific to the section
        console.log(`Loading data for section: ${section}`);
        
        switch (section) {
            case 'overview':
                this.refreshOverviewData();
                break;
            case 'model-builder':
                this.loadTabData(this.currentTab);
                break;
            // Add other sections as needed
        }
    }
    
    // Update methods for real-time data
    updateCurrentAthleteDisplay(athlete) {
        const displays = document.querySelectorAll('#current-athlete-info');
        displays.forEach(display => {
            if (athlete) {
                display.innerHTML = `
                    <div class="athlete-name">${athlete.name}</div>
                    <div class="athlete-details">
                        <span class="weight">${athlete.currentWeight || '--'} kg</span>
                        <span class="attempt">Attempt ${athlete.currentAttempt || '--'}</span>
                    </div>
                `;
                display.classList.remove('placeholder');
            } else {
                display.innerHTML = '<div class="placeholder">No active athlete</div>';
            }
        });
    }
    
    updateTimerDisplay(remaining) {
        // Timer display is handled by the main app
        // This is for any admin-specific timer updates
    }
    
    updateLeaderboard(rankings) {
        const leaderboardContainer = document.getElementById('ranking-list');
        if (!leaderboardContainer || !rankings) return;
        
        if (rankings.length === 0) {
            leaderboardContainer.innerHTML = '<div class="placeholder">No rankings available</div>';
            return;
        }
        
        leaderboardContainer.innerHTML = rankings.map((athlete, index) => `
            <div class="ranking-item">
                <span class="ranking-position">${index + 1}</span>
                <span class="ranking-name">${athlete.name}</span>
                <span class="ranking-score">${athlete.total || athlete.best || '--'}</span>
            </div>
        `).join('');
    }
    
    updateQueue(queue) {
        const queueContainer = document.getElementById('queue-list');
        if (!queueContainer || !queue) return;
        
        if (queue.length === 0) {
            queueContainer.innerHTML = '<div class="placeholder">No athletes in queue</div>';
            return;
        }
        
        queueContainer.innerHTML = queue.map((athlete, index) => `
            <div class="queue-item" data-athlete-id="${athlete.id}">
                <span class="position">${index + 1}</span>
                <span class="name">${athlete.name}</span>
                <span class="weight">${athlete.nextWeight || '--'} kg</span>
            </div>
        `).join('');
    }
    
    // Utility methods
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }
    
    // Placeholder methods for future implementation
    loadEventsTable() {
        document.getElementById('model-table-content').innerHTML = `
            <div class="placeholder">Events table will be implemented here</div>
        `;
    }
    
    loadLiftsTable() {
        document.getElementById('model-table-content').innerHTML = `
            <div class="placeholder">Lifts table will be implemented here</div>
        `;
    }
    
    loadFlightsTable() {
        document.getElementById('model-table-content').innerHTML = `
            <div class="placeholder">Flights table will be implemented here</div>
        `;
    }
    
    loadAthletesTable() {
        document.getElementById('model-table-content').innerHTML = `
            <div class="placeholder">Athletes table will be implemented here</div>
        `;
    }
    
    loadRefereesTable() {
        document.getElementById('model-table-content').innerHTML = `
            <div class="placeholder">Referees table will be implemented here</div>
        `;
    }
    
    addEvent() { console.log('Add event clicked'); }
    addLift() { console.log('Add lift clicked'); }
    addFlight() { console.log('Add flight clicked'); }
    addAthlete() { console.log('Add athlete clicked'); }
    addReferee() { console.log('Add referee clicked'); }
    
    openSettings() { console.log('Settings clicked'); }
    logout() { 
        if (confirm('Are you sure you want to logout?')) {
            window.location.href = '/logout';
        }
    }
    
    viewSearchResult(resultId) { console.log('View result:', resultId); }
    refreshOverviewData() { console.log('Refreshing overview data'); }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('admin-page')) {
        window.adminPage = new AdminPage();
    }
});