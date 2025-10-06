/**
 * Scoreboard History - JavaScript functionality
 * Handles loading, filtering, editing, and exporting competition scores
 */

let allScores = [];
let competitions = [];
let events = [];

/**
 * Load initial data (competitions and scores)
 */
async function loadData() {
    try {
        // Load competitions
        const compResponse = await fetch('/admin/api/competitions');
        competitions = await compResponse.json();
        
        const compSelect = document.getElementById('competition-filter');
        competitions.forEach(comp => {
            const option = document.createElement('option');
            option.value = comp.id;
            option.textContent = comp.name;
            compSelect.appendChild(option);
        });
        
        // Load scores
        await loadScores();
        
        // Populate events and flights from loaded scores
        populateEventFilter();
        populateFlightFilter();
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loading').textContent = 'Error loading data. Please refresh the page.';
    }
}

/**
 * Populate event filter dropdown based on available scores
 */
function populateEventFilter() {
    const eventSelect = document.getElementById('event-filter');
    
    // Extract unique events from scores
    const uniqueEvents = new Map();
    allScores.forEach(score => {
        if (score.event_id && score.event_name) {
            uniqueEvents.set(score.event_id, score.event_name);
        }
    });
    
    // Clear existing options except "All Events"
    eventSelect.innerHTML = '<option value="">All Events</option>';
    
    // Add event options
    uniqueEvents.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        eventSelect.appendChild(option);
    });
}

/**
 * Update event filter when competition changes
 */
function updateEventFilter() {
    const compId = document.getElementById('competition-filter').value;
    const eventSelect = document.getElementById('event-filter');
    
    if (!compId) {
        // Show all events
        populateEventFilter();
        return;
    }
    
    // Filter events by selected competition
    const uniqueEvents = new Map();
    allScores.forEach(score => {
        if (score.competition_id == compId && score.event_id && score.event_name) {
            uniqueEvents.set(score.event_id, score.event_name);
        }
    });
    
    // Clear and repopulate event dropdown
    eventSelect.innerHTML = '<option value="">All Events</option>';
    uniqueEvents.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        eventSelect.appendChild(option);
    });
    
    // Reset event selection
    eventSelect.value = '';
}

/**
 * Populate flight filter with all unique flights from scores
 */
function populateFlightFilter() {
    const flightSelect = document.getElementById('flight-filter');
    
    // Extract unique flights
    const uniqueFlights = new Map();
    allScores.forEach(score => {
        if (score.flight_id && score.flight_name) {
            uniqueFlights.set(score.flight_id, score.flight_name);
        }
    });
    
    // Clear and populate flight dropdown
    flightSelect.innerHTML = '<option value="">All Flights</option>';
    uniqueFlights.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        flightSelect.appendChild(option);
    });
}

/**
 * Update flight filter based on selected competition and event
 */
function updateFlightFilter() {
    const compSelect = document.getElementById('competition-filter');
    const eventSelect = document.getElementById('event-filter');
    const flightSelect = document.getElementById('flight-filter');
    
    const compId = compSelect.value;
    const eventId = eventSelect.value;
    
    if (!compId && !eventId) {
        // Show all flights
        populateFlightFilter();
        return;
    }
    
    // Filter flights by selected competition and/or event
    const uniqueFlights = new Map();
    allScores.forEach(score => {
        const matchesComp = !compId || score.competition_id == compId;
        const matchesEvent = !eventId || score.event_id == eventId;
        
        if (matchesComp && matchesEvent && score.flight_id && score.flight_name) {
            uniqueFlights.set(score.flight_id, score.flight_name);
        }
    });
    
    // Clear and repopulate flight dropdown
    flightSelect.innerHTML = '<option value="">All Flights</option>';
    uniqueFlights.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        flightSelect.appendChild(option);
    });
    
    // Reset flight selection
    flightSelect.value = '';
}

/**
 * Load all scores from the API
 */
async function loadScores() {
    try {
        const response = await fetch('/admin/api/scores');
        allScores = await response.json();
        
        document.getElementById('loading').style.display = 'none';
        
        if (allScores.length === 0) {
            document.getElementById('no-data').style.display = 'block';
            document.getElementById('scores-table').style.display = 'none';
        } else {
            document.getElementById('no-data').style.display = 'none';
            document.getElementById('scores-table').style.display = 'table';
            displayScores(allScores);
        }
    } catch (error) {
        console.error('Error loading scores:', error);
        document.getElementById('loading').textContent = 'Error loading scores.';
    }
}

/**
 * Display scores in the table
 * @param {Array} scores - Array of score objects to display
 */
function displayScores(scores) {
    const tbody = document.getElementById('scores-tbody');
    tbody.innerHTML = '';
    
    scores.forEach(score => {
        const row = document.createElement('tr');
        
        const rankClass = score.rank === 1 ? 'rank-1' : score.rank === 2 ? 'rank-2' : score.rank === 3 ? 'rank-3' : '';
        
        row.innerHTML = `
            <td class="rank-cell ${rankClass}">${score.rank || '-'}</td>
            <td>${score.athlete_name}</td>
            <td>${score.event_name}</td>
            <td>${score.flight_name || '-'}</td>
            <td>${score.lift_type || '-'}</td>
            <td class="score-value">${score.best_attempt_weight || '-'}</td>
            <td class="score-value">${score.total_score || '-'}</td>
            <td>
                ${score.is_final ? 
                    '<span class="final-badge">FINAL</span>' : 
                    '<span class="provisional-badge">PROVISIONAL</span>'}
            </td>
            <td>${new Date(score.calculated_at).toLocaleString()}</td>
            <td>
                <button class="edit-btn" onclick="editScore(${score.id})">Edit</button>
                <button class="delete-btn" onclick="deleteScore(${score.id})">Delete</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

/**
 * Apply filters to the scores display
 */
function applyFilters() {
    const compId = document.getElementById('competition-filter').value;
    const eventId = document.getElementById('event-filter').value;
    const flightId = document.getElementById('flight-filter').value;
    const status = document.getElementById('status-filter').value;
    
    let filtered = allScores;
    
    if (compId) {
        filtered = filtered.filter(s => s.competition_id == compId);
    }
    
    if (eventId) {
        filtered = filtered.filter(s => s.event_id == eventId);
    }
    
    if (flightId) {
        filtered = filtered.filter(s => s.flight_id == flightId);
    }
    
    if (status === 'final') {
        filtered = filtered.filter(s => s.is_final);
    } else if (status === 'provisional') {
        filtered = filtered.filter(s => !s.is_final);
    }
    
    displayScores(filtered);
}

/**
 * Open edit modal for a specific score
 * @param {number} scoreId - ID of the score to edit
 */
function editScore(scoreId) {
    const score = allScores.find(s => s.id === scoreId);
    if (!score) return;
    
    document.getElementById('edit-score-id').value = score.id;
    document.getElementById('edit-athlete-name').value = score.athlete_name;
    document.getElementById('edit-best-weight').value = score.best_attempt_weight || '';
    document.getElementById('edit-total-score').value = score.total_score || '';
    document.getElementById('edit-rank').value = score.rank || '';
    document.getElementById('edit-is-final').checked = score.is_final;
    
    document.getElementById('edit-modal').style.display = 'block';
}

/**
 * Close the edit modal
 */
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

/**
 * Handle edit form submission
 */
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const scoreId = document.getElementById('edit-score-id').value;
        const data = {
            best_attempt_weight: parseFloat(document.getElementById('edit-best-weight').value) || null,
            total_score: parseFloat(document.getElementById('edit-total-score').value) || null,
            rank: parseInt(document.getElementById('edit-rank').value) || null,
            is_final: document.getElementById('edit-is-final').checked
        };
        
        try {
            const response = await fetch(`/admin/api/scores/${scoreId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('Score updated successfully!');
                closeEditModal();
                await loadScores();
            } else {
                alert('Failed to update score');
            }
        } catch (error) {
            console.error('Error updating score:', error);
            alert('Error updating score');
        }
    });
});

/**
 * Delete a score
 * @param {number} scoreId - ID of the score to delete
 */
async function deleteScore(scoreId) {
    if (!confirm('Are you sure you want to delete this score?')) return;
    
    try {
        const response = await fetch(`/admin/api/scores/${scoreId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Score deleted successfully!');
            await loadScores();
        } else {
            alert('Failed to delete score');
        }
    } catch (error) {
        console.error('Error deleting score:', error);
        alert('Error deleting score');
    }
}

/**
 * Export scores to CSV
 */
function exportScores() {
    const compId = document.getElementById('competition-filter').value;
    let url = '/admin/api/scores/export';
    if (compId) {
        url += `?competition_id=${compId}`;
    }
    window.open(url, '_blank');
}

/**
 * Close modal when clicking outside
 */
window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target === modal) {
        closeEditModal();
    }
}

/**
 * Initialize the page
 */
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    
    // Add event listener to competition filter to update events and flights
    const compSelect = document.getElementById('competition-filter');
    compSelect.addEventListener('change', function() {
        updateEventFilter();
        updateFlightFilter();
    });
    
    // Add event listener to event filter to update flights
    const eventSelect = document.getElementById('event-filter');
    eventSelect.addEventListener('change', updateFlightFilter);
});
