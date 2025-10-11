/**
 * Public Stage Display - Horizontal Scrolling Table
 * Layout: Flights vertically stacked, Events horizontally expanded
 */

// Global state
let competitionId = null;
let allEventsData = [];
let updateInterval = null;
const UPDATE_INTERVAL_MS = 1000;
let timerSynchronizer = null;
let collapsedEvents = new Set(); // Track collapsed events by index
let athleteGenderMap = new Map(); // Map athlete IDs to gender

class TimerSynchronizer {
    constructor({ pollInterval = 1000, renderInterval = 100 } = {}) {
        this.pollIntervalMs = pollInterval;
        this.renderIntervalMs = renderInterval;
        this.timerDisplay = document.getElementById('timerDisplay');

        this.pollHandle = null;
        this.renderHandle = null;

        this.lastState = null;
        this.lastSyncTimestamp = 0;
        this.lastKnownSeconds = 0;
        this.mode = 'countdown';
        this.isRunning = false;
    }

    start() {
        if (!this.timerDisplay) {
            return;
        }

        this.stop();
        this.fetchState();
        this.pollHandle = setInterval(() => this.fetchState(), this.pollIntervalMs);
        this.renderHandle = setInterval(() => this.render(), this.renderIntervalMs);
    }

    stop() {
        if (this.pollHandle) {
            clearInterval(this.pollHandle);
            this.pollHandle = null;
        }
        if (this.renderHandle) {
            clearInterval(this.renderHandle);
            this.renderHandle = null;
        }
    }

    async fetchState() {
        try {
            const response = await fetch('/display/api/timer-state', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const state = await response.json();
            console.log('[Timer] Fetched state:', state);
            this.applyState(state);
        } catch (error) {
            console.warn('Timer sync fetch failed:', error);
            this.applyState(null, true);
        }
    }

    applyState(state, isError = false) {
        if (!state || isError || state.error) {
            this.lastState = null;
            this.lastSyncTimestamp = 0;
            this.lastKnownSeconds = 0;
            this.isRunning = false;
            this.mode = 'countdown';
            this.render(true);
            return;
        }

        const numericSeconds = Number(state.timer_seconds);
        this.lastState = state;
        this.lastSyncTimestamp = Date.now();
        this.lastKnownSeconds = Number.isFinite(numericSeconds) ? numericSeconds : 0;
        const rawMode = typeof state.timer_mode === 'string' ? state.timer_mode.toLowerCase() : '';
        this.mode = (rawMode === 'countup' || rawMode === 'countdown') ? rawMode : 'countdown';
        this.isRunning = Boolean(state.timer_running);

        // Debug log
        console.log('[Timer] State updated:', {
            seconds: this.lastKnownSeconds,
            running: this.isRunning,
            mode: this.mode,
            timestamp: new Date(state.timestamp).toLocaleTimeString()
        });

        this.render(true);
    }

    computeSeconds() {
        if (!this.lastState) {
            return null;
        }

        let seconds = this.lastKnownSeconds;
        if (this.isRunning && this.lastSyncTimestamp) {
            const elapsed = (Date.now() - this.lastSyncTimestamp) / 1000;
            if (this.mode === 'countup') {
                seconds += elapsed;
            } else {
                seconds = Math.max(0, seconds - elapsed);
            }
        }
        return seconds;
    }

    render(force = false) {
        if (!this.timerDisplay) {
            return;
        }

        const seconds = this.computeSeconds();
        if (seconds === null) {
            if (force) {
                this.timerDisplay.textContent = '00:00';
                this.updateClasses('idle');
            }
            return;
        }

        const formatted = this.formatSeconds(seconds);
        if (force || this.timerDisplay.textContent !== formatted) {
            this.timerDisplay.textContent = formatted;
            if (force) {
                console.log('[Timer] Rendered:', formatted, 'seconds:', seconds.toFixed(2), 'running:', this.isRunning);
            }
        }

        let status = 'paused';
        if (seconds <= 0.5 && this.mode === 'countdown') {
            status = 'expired';
        } else if (this.isRunning) {
            status = 'running';
        }
        this.updateClasses(status, seconds);
    }

    updateClasses(status, seconds = 0) {
        if (!this.timerDisplay) {
            return;
        }

        this.timerDisplay.classList.remove('warning', 'expired');

        if (status === 'expired') {
            this.timerDisplay.classList.add('expired');
            return;
        }

        if (this.mode === 'countdown' && seconds <= 15 && seconds > 0.5) {
            this.timerDisplay.classList.add('warning');
        }
    }

    formatSeconds(seconds) {
        const total = Math.max(0, Math.floor(seconds));
        const minutes = Math.floor(total / 60);
        const secs = total % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    getLatestState() {
        return this.lastState;
    }
}

/**
 * Initialize
 */
document.addEventListener('DOMContentLoaded', function() {
    const competitionIdInput = document.getElementById('competitionId');
    if (competitionIdInput) {
        competitionId = parseInt(competitionIdInput.value);
    }

    if (!competitionId) {
        showError('No competition ID provided');
        return;
    }

    timerSynchronizer = new TimerSynchronizer();
    timerSynchronizer.start();

    // Initial fetch
    fetchAndDisplayData();

    // Set up periodic updates
    updateInterval = setInterval(fetchAndDisplayData, UPDATE_INTERVAL_MS);
});

/**
 * Fetch competition data
 */
async function fetchAndDisplayData() {
    try {
        const response = await fetch(`/display/api/competition/${competitionId}/flights-data`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch data');
        }

        // Store events data
        allEventsData = data.events || [];

        // Update UI
        updateCompetitionTitle(data.competition);
        renderEventTabs();
        renderMainTable();

        // Update status bar
        await updateStatusBar();

    } catch (error) {
        console.error('Error fetching competition data:', error);
        showError(`Failed to load data: ${error.message}`);
    }
}

/**
 * Update competition title
 */
function updateCompetitionTitle(competition) {
    const titleElement = document.getElementById('competitionTitle');
    if (titleElement && competition) {
        titleElement.textContent = competition.name || 'Small Goods Throwdown';
    }
}

/**
 * Render event tabs
 */
function renderEventTabs() {
    const tabsContainer = document.getElementById('eventTabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    if (allEventsData.length === 0) {
        return;
    }

    allEventsData.forEach((event, index) => {
        const tab = document.createElement('button');
        tab.className = 'event-tab';
        tab.textContent = event.name || `Event ${index + 1}`;
        tab.dataset.eventIndex = index;

        // All tabs active by default (showing all events)
        tab.classList.add('active');

        tabsContainer.appendChild(tab);
    });
}

/**
 * Render main table - 3 independent Flight cards with horizontal scrolling
 */
function renderMainTable() {
    const flightsContainer = document.getElementById('flightsContainer');
    if (!flightsContainer) return;

    // Clear existing content
    flightsContainer.innerHTML = '';

    if (allEventsData.length === 0) {
        flightsContainer.innerHTML = '<div class="empty-state">No events available</div>';
        return;
    }

    // Build flight map: collect all athletes by flight across all events
    const flightMap = new Map();

    allEventsData.forEach(event => {
        event.flights.forEach(flight => {
            if (!flightMap.has(flight.id)) {
                flightMap.set(flight.id, {
                    name: flight.name,
                    athletes: []
                });
            }

            // Add athletes with event data
            flight.athletes.forEach(athlete => {
                // Store gender in map
                if (athlete.gender) {
                    athleteGenderMap.set(athlete.id, athlete.gender);
                    athleteGenderMap.set(athlete.name, athlete.gender); // Also map by name
                }

                const existing = flightMap.get(flight.id).athletes.find(a => a.id === athlete.id);
                if (existing) {
                    // Add event data to existing athlete
                    existing.eventData = existing.eventData || {};
                    existing.eventData[event.name || event.id] = {
                        attempts: athlete.attempts,
                        best: athlete.best
                    };
                } else {
                    // New athlete
                    const newAthlete = {
                        id: athlete.id,
                        name: athlete.name,
                        class: athlete.class,
                        gender: athlete.gender,
                        is_current: athlete.is_current,
                        total: athlete.total,
                        eventData: {}
                    };
                    newAthlete.eventData[event.name || event.id] = {
                        attempts: athlete.attempts,
                        best: athlete.best
                    };
                    flightMap.get(flight.id).athletes.push(newAthlete);
                }
            });
        });
    });

    // Render each flight as a separate card
    flightMap.forEach((flightData, flightId) => {
        const flightCard = createFlightCard(flightData);
        flightsContainer.appendChild(flightCard);
    });

    // If no flights
    if (flightMap.size === 0) {
        flightsContainer.innerHTML = '<div class="empty-state">No flights available</div>';
    }
}

/**
 * Create a Flight card with horizontally scrolling table
 */
function createFlightCard(flightData) {
    // Flight card container
    const card = document.createElement('div');
    card.className = 'flight-card';

    // Flight header
    const header = document.createElement('div');
    header.className = 'flight-header';
    const title = document.createElement('h2');
    title.className = 'flight-title';
    title.textContent = flightData.name;
    header.appendChild(title);
    card.appendChild(header);

    // Table wrapper (horizontal scroll container)
    const wrapper = document.createElement('div');
    wrapper.className = 'flight-table-wrapper';

    // Table
    const table = document.createElement('table');
    table.className = 'flight-table';

    // Table header
    const thead = document.createElement('thead');

    // Header row 1: Group headers (Athletes | Events... | Comp Results)
    const headerRow1 = document.createElement('tr');
    const athletesGroup = createHeaderCell('Athletes', 'event-header-group');
    athletesGroup.colSpan = 2; // Name + Class
    headerRow1.appendChild(athletesGroup);

    allEventsData.forEach((event, index) => {
        const eventHeader = document.createElement('th');
        eventHeader.className = 'event-header-group';
        eventHeader.colSpan = 4; // Att.1, Att.2, Att.3, Best
        eventHeader.dataset.eventIndex = index;

        // Create wrapper for text and icon
        const headerContent = document.createElement('div');
        headerContent.className = 'event-header-content';

        const headerText = document.createElement('span');
        headerText.textContent = event.name || 'Event';

        const collapseIcon = document.createElement('span');
        collapseIcon.className = collapsedEvents.has(index) ? 'collapse-icon collapsed' : 'collapse-icon';
        collapseIcon.innerHTML = '&#9658;'; // Right arrow ►

        headerContent.appendChild(headerText);
        headerContent.appendChild(collapseIcon);
        eventHeader.appendChild(headerContent);

        // Add click handler
        eventHeader.style.cursor = 'pointer';
        eventHeader.addEventListener('click', () => toggleEventCollapse(index));

        headerRow1.appendChild(eventHeader);
    });

    const compResultsGroup = createHeaderCell('Comp Results', 'event-header-group');
    compResultsGroup.colSpan = 1; // Total
    headerRow1.appendChild(compResultsGroup);
    thead.appendChild(headerRow1);

    // Header row 2: Att. 1-3, Best sub-headers
    const headerRow2 = document.createElement('tr');
    headerRow2.appendChild(createHeaderCell('', 'col-name'));
    headerRow2.appendChild(createHeaderCell('', 'col-class'));

    allEventsData.forEach((event, index) => {
        const att1 = createHeaderCell('Att. 1', 'col-att');
        const att2 = createHeaderCell('Att. 2', 'col-att');
        const att3 = createHeaderCell('Att. 3', 'col-att');
        const best = createHeaderCell('Best', 'col-best');

        att1.dataset.eventIndex = index;
        att2.dataset.eventIndex = index;
        att3.dataset.eventIndex = index;
        best.dataset.eventIndex = index;

        if (collapsedEvents.has(index)) {
            att1.classList.add('event-collapsed');
            att2.classList.add('event-collapsed');
            att3.classList.add('event-collapsed');
            best.classList.add('event-collapsed');
        }

        headerRow2.appendChild(att1);
        headerRow2.appendChild(att2);
        headerRow2.appendChild(att3);
        headerRow2.appendChild(best);
    });

    headerRow2.appendChild(createHeaderCell('', 'col-total'));
    thead.appendChild(headerRow2);

    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');

    if (flightData.athletes && flightData.athletes.length > 0) {
        flightData.athletes.forEach(athlete => {
            const row = createAthleteRow(athlete);
            tbody.appendChild(row);
        });
    } else {
        // Show empty state message
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 2 + (allEventsData.length * 4) + 1; // All columns
        emptyCell.className = 'empty-state';
        emptyCell.textContent = 'No athletes in this flight';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
    }

    table.appendChild(tbody);

    wrapper.appendChild(table);
    card.appendChild(wrapper);

    return card;
}

/**
 * Create header cell
 */
function createHeaderCell(text, className) {
    const th = document.createElement('th');
    th.textContent = text;
    if (className) {
        th.className = className;
    }
    return th;
}

/**
 * Create athlete row
 */
function createAthleteRow(athlete) {
    const row = document.createElement('tr');
    row.className = 'athlete-row';
    row.dataset.athleteId = athlete.id;

    if (athlete.is_current) {
        row.classList.add('current');
    }

    // Sticky left columns
    const nameCell = document.createElement('td');
    nameCell.className = 'col-name';
    nameCell.textContent = athlete.name || 'Unknown';
    row.appendChild(nameCell);

    const classCell = document.createElement('td');
    classCell.className = 'col-class';
    classCell.textContent = athlete.class || '-';
    row.appendChild(classCell);

    // Event columns (scrollable middle section)
    allEventsData.forEach((event, index) => {
        const eventName = event.name || event.id;
        const eventData = athlete.eventData[eventName];

        if (eventData && eventData.attempts) {
            // Att 1, 2, 3
            for (let i = 0; i < 3; i++) {
                const attCell = document.createElement('td');
                attCell.className = 'col-att';
                attCell.dataset.eventIndex = index;

                const attempt = eventData.attempts[i];
                if (attempt && attempt.weight !== null) {
                    attCell.textContent = attempt.weight;

                    if (attempt.result === 'success') {
                        attCell.classList.add('attempt-success');
                    } else if (attempt.result === 'fail') {
                        attCell.classList.add('attempt-fail');
                    } else {
                        attCell.classList.add('attempt-pending');
                    }
                } else {
                    attCell.textContent = '-';
                    attCell.classList.add('attempt-pending');
                }

                if (collapsedEvents.has(index)) {
                    attCell.classList.add('event-collapsed');
                }

                row.appendChild(attCell);
            }

            // Best
            const bestCell = document.createElement('td');
            bestCell.className = 'col-best';
            bestCell.dataset.eventIndex = index;
            bestCell.textContent = eventData.best !== null && eventData.best !== undefined ? eventData.best : '-';

            if (collapsedEvents.has(index)) {
                bestCell.classList.add('event-collapsed');
            }

            row.appendChild(bestCell);
        } else {
            // Empty cells for this event
            for (let i = 0; i < 4; i++) {
                const emptyCell = document.createElement('td');
                emptyCell.className = i < 3 ? 'col-att' : 'col-best';
                emptyCell.dataset.eventIndex = index;
                emptyCell.textContent = '-';
                emptyCell.classList.add('attempt-pending');

                if (collapsedEvents.has(index)) {
                    emptyCell.classList.add('event-collapsed');
                }

                row.appendChild(emptyCell);
            }
        }
    });

    // Sticky right column - Total
    const totalCell = document.createElement('td');
    totalCell.className = 'col-total';
    totalCell.textContent = athlete.total !== null && athlete.total !== undefined ? athlete.total : '0';
    row.appendChild(totalCell);

    return row;
}

/**
 * Update status bar
 */
async function updateStatusBar() {
    try {
        const response = await fetch(`/display/api/competition/${competitionId}/state`);

        if (!response.ok) {
            return;
        }

        const data = await response.json();

        if (!data.success) {
            return;
        }

        const timerState = timerSynchronizer ? timerSynchronizer.getLatestState() : null;

        // Update current athlete
        const currentAthleteEl = document.getElementById('currentAthlete');
        if (currentAthleteEl) {
            let athleteName = '';
            if (timerState && timerState.athlete_name) {
                athleteName = timerState.athlete_name;
            } else if (data.current_attempt && data.current_attempt.athlete) {
                athleteName = data.current_attempt.athlete.name;
            }
            currentAthleteEl.textContent = athleteName || 'Awaiting Athlete';
        }

        // Update current weight
        const currentWeightEl = document.getElementById('currentWeight');
        if (currentWeightEl) {
            let weightValue = null;
            if (timerState && timerState.attempt_weight) {
                weightValue = timerState.attempt_weight;
            } else if (data.current_attempt) {
                weightValue = data.current_attempt.weight;
            }
            currentWeightEl.textContent = formatWeightDisplay(weightValue);
        }

        // Update gender icon
        const genderIconEl = document.getElementById('genderIcon');
        if (genderIconEl) {
            let gender = null;

            // Try to get gender from athleteGenderMap using athlete name
            if (athleteName && athleteGenderMap.has(athleteName)) {
                gender = athleteGenderMap.get(athleteName);
            }

            // Display gender icon
            if (gender === 'M' || gender === 'Male' || gender === 'm' || gender === 'male') {
                genderIconEl.innerHTML = '&#9794;'; // ♂ Male symbol
                genderIconEl.style.display = 'inline-block';
            } else if (gender === 'F' || gender === 'Female' || gender === 'f' || gender === 'female') {
                genderIconEl.innerHTML = '&#9792;'; // ♀ Female symbol
                genderIconEl.style.display = 'inline-block';
            } else {
                genderIconEl.innerHTML = '';
                genderIconEl.style.display = 'none';
            }
        }

    } catch (error) {
        console.error('Error updating status bar:', error);
    }
}

function formatWeightDisplay(rawValue) {
    if (rawValue === null || rawValue === undefined) {
        return '—';
    }

    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue)) {
        if (numericValue === 0) {
            return '0';
        }
        return Number.isInteger(numericValue) ? numericValue.toString() : numericValue.toFixed(1);
    }

    const stringValue = String(rawValue).trim();
    return stringValue.length > 0 ? stringValue : '—';
}

/**
 * Show error
 */
function showError(message) {
    const flightsContainer = document.getElementById('flightsContainer');
    if (flightsContainer) {
        flightsContainer.innerHTML = `
            <div class="error-state">
                <p>${escapeHtml(message)}</p>
                <p>Please refresh the page or contact support.</p>
            </div>
        `;
    }

    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

/**
 * Toggle event collapse state
 */
function toggleEventCollapse(eventIndex) {
    if (collapsedEvents.has(eventIndex)) {
        collapsedEvents.delete(eventIndex);
    } else {
        collapsedEvents.add(eventIndex);
    }

    // Re-render the table
    renderMainTable();
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Clean up
 */
window.addEventListener('beforeunload', function() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    if (timerSynchronizer) {
        timerSynchronizer.stop();
        timerSynchronizer = null;
    }
});
