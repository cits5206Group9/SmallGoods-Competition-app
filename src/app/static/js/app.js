/**
 * Small Goods Competition App - Main JavaScript
 * Handles real-time updates, UI interactions, and competition management
 */

// Global variables
let currentCompetitionId = null;
let userRole = null;
let timerInterval = null;
let notificationPermission = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  initializeApp();
  requestNotificationPermission();
});

/**
 * Initialize the application
 */
function initializeApp() {
  // Extract competition ID from URL if present
  const pathParts = window.location.pathname.split('/');
  const competitionIndex = pathParts.indexOf('competition');
  if (competitionIndex !== -1 && pathParts[competitionIndex + 1]) {
    currentCompetitionId = parseInt(pathParts[competitionIndex + 1]);
  }
  
  // Determine user role from URL
  if (window.location.pathname.includes('/admin')) {
    userRole = 'admin';
  } else if (window.location.pathname.includes('/referee')) {
    userRole = 'referee';
  } else if (window.location.pathname.includes('/athlete')) {
    userRole = 'athlete';
  } else if (window.location.pathname.includes('/timekeeper')) {
    userRole = 'timekeeper';
  } else if (window.location.pathname.includes('/display')) {
    userRole = 'display';
  }
  
  // Join competition room if we have both competition ID and role
  if (currentCompetitionId && userRole && typeof socket !== 'undefined') {
    socket.emit('join_competition', {
      competition_id: currentCompetitionId,
      role: userRole
    });
  }
  
  // Initialize page-specific functionality
  initializePageFunctionality();
}

/**
 * Initialize page-specific functionality based on current page
 */
function initializePageFunctionality() {
  const pathname = window.location.pathname;
  
  if (pathname.includes('/referee/competition/')) {
    initializeRefereeInterface();
  } else if (pathname.includes('/timekeeper/competition/')) {
    initializeTimerInterface();
  } else if (pathname.includes('/display/competition/')) {
    initializeDisplayInterface();
  } else if (pathname.includes('/athlete')) {
    initializeAthleteInterface();
  }
}

/**
 * Referee Interface Functions
 */
function initializeRefereeInterface() {
  // Add click handlers to referee decision buttons
  document.querySelectorAll('.referee-btn').forEach(button => {
    button.addEventListener('click', function() {
      const decision = this.dataset.decision;
      const attemptId = this.dataset.attemptId;
      
      if (attemptId && decision) {
        submitRefereeDecision(attemptId, decision);
      }
    });
  });
}

function submitRefereeDecision(attemptId, decision) {
  const refereeId = getCurrentRefereeId(); // This would be set based on login/session
  
  if (typeof socket !== 'undefined') {
    socket.emit('referee_decision', {
      attempt_id: attemptId,
      referee_id: refereeId,
      decision: decision
    });
    
    // Provide immediate visual feedback
    showAlert(`Decision recorded: ${decision.replace('_', ' ').toUpperCase()}`, 'success');
    
    // Disable buttons temporarily to prevent double-clicks
    document.querySelectorAll('.referee-btn').forEach(btn => {
      btn.disabled = true;
      setTimeout(() => btn.disabled = false, 2000);
    });
  }
}

/**
 * Timer Interface Functions
 */
function initializeTimerInterface() {
  // Timer control buttons
  document.getElementById('start-timer')?.addEventListener('click', startTimer);
  document.getElementById('pause-timer')?.addEventListener('click', pauseTimer);
  document.getElementById('reset-timer')?.addEventListener('click', resetTimer);
  
  // Listen for timer updates
  if (typeof socket !== 'undefined') {
    socket.on('timer_started', updateTimerDisplay);
    socket.on('timer_paused', updateTimerDisplay);
    socket.on('timer_reset', updateTimerDisplay);
  }
}

function startTimer() {
  const eventId = getCurrentEventId();
  const duration = parseInt(document.getElementById('timer-duration')?.value) || 60;
  
  if (typeof socket !== 'undefined') {
    socket.emit('timer_start', {
      event_id: eventId,
      duration_seconds: duration
    });
  }
}

function pauseTimer() {
  const eventId = getCurrentEventId();
  
  if (typeof socket !== 'undefined') {
    socket.emit('timer_pause', {
      event_id: eventId
    });
  }
}

function resetTimer() {
  const eventId = getCurrentEventId();
  
  if (typeof socket !== 'undefined') {
    socket.emit('timer_reset', {
      event_id: eventId
    });
  }
}

function updateTimerDisplay(data) {
  const timerElement = document.querySelector('.timer-display');
  if (!timerElement) return;
  
  if (data.duration) {
    timerElement.textContent = formatTime(data.duration);
  }
  
  // Update timer classes based on state
  timerElement.classList.remove('running', 'paused', 'expired');
  
  if (data.started_at && !data.paused_at) {
    timerElement.classList.add('running');
    startTimerCountdown(data.duration, new Date(data.started_at));
  } else if (data.paused_at) {
    timerElement.classList.add('paused');
  }
}

function startTimerCountdown(duration, startTime) {
  if (timerInterval) clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 1000);
    const remaining = Math.max(0, duration - elapsed);
    
    const timerElement = document.querySelector('.timer-display');
    if (timerElement) {
      timerElement.textContent = formatTime(remaining);
      
      if (remaining === 0) {
        timerElement.classList.add('expired');
        clearInterval(timerInterval);
        playTimerExpiredSound();
      }
    }
  }, 100); // Update every 100ms for smooth countdown
}

/**
 * Display Interface Functions
 */
function initializeDisplayInterface() {
  // Request initial display data
  if (typeof socket !== 'undefined' && currentCompetitionId) {
    socket.emit('get_display_data', {
      competition_id: currentCompetitionId
    });
    
    // Listen for display updates
    socket.on('display_data', updateDisplayContent);
    socket.on('display_update', updateDisplayContent);
    socket.on('attempt_updated', updateDisplayContent);
    socket.on('timer_started', updateDisplayTimer);
    socket.on('timer_paused', updateDisplayTimer);
    socket.on('timer_reset', updateDisplayTimer);
    
    // Refresh display data every 30 seconds
    setInterval(() => {
      socket.emit('get_display_data', {
        competition_id: currentCompetitionId
      });
    }, 30000);
  }
}

function updateDisplayContent(data) {
  // Update current lifter information
  if (data.current_athlete) {
    updateElement('display-athlete-name', data.current_athlete.name);
    updateElement('display-team', data.current_athlete.team);
    updateElement('display-weight', `${data.current_athlete.weight}kg`);
    updateElement('display-attempt', `Attempt ${data.current_athlete.attempt_number}`);
    updateElement('display-lift', data.current_athlete.lift_name);
  }
  
  // Update next lifters
  if (data.next_athletes) {
    updateNextLifters(data.next_athletes);
  }
  
  // Update rankings
  if (data.rankings) {
    updateRankings(data.rankings);
  }
  
  // Update event information
  if (data.current_event) {
    updateElement('display-event-name', data.current_event.name);
    updateElement('display-event-category', data.current_event.weight_category);
  }
}

function updateDisplayTimer(data) {
  const timerElement = document.querySelector('.display-timer');
  if (timerElement && data.remaining_seconds !== undefined) {
    timerElement.textContent = formatTime(data.remaining_seconds);
    
    // Update timer styling based on state
    timerElement.classList.remove('running', 'paused', 'expired');
    
    if (data.is_running) {
      timerElement.classList.add('running');
    } else {
      timerElement.classList.add('paused');
    }
  }
}

/**
 * Athlete Interface Functions
 */
function initializeAthleteInterface() {
  // Listen for athlete notifications
  if (typeof socket !== 'undefined') {
    socket.on('athlete_notification', function(data) {
      showNotification(data.message, data.type);
      
      // Add to notification list if element exists
      const notificationList = document.getElementById('notification-list');
      if (notificationList) {
        addNotificationToList(notificationList, data);
      }
    });
    
    socket.on('attempt_updated', function(data) {
      // Refresh attempt status if this is the current athlete
      refreshAthleteAttempts();
    });
  }
}

/**
 * Utility Functions
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateElement(id, content) {
  const element = document.getElementById(id);
  if (element && content !== undefined) {
    element.textContent = content;
  }
}

function updateNextLifters(athletes) {
  const container = document.getElementById('next-lifters-list');
  if (!container) return;
  
  container.innerHTML = athletes.map((athlete, index) => `
    <div class="next-lifter-item d-flex justify-content-between align-items-center mb-2">
      <span class="lifter-name">${athlete.name}</span>
      <span class="lifter-weight badge bg-primary">${athlete.weight}kg</span>
    </div>
  `).join('');
}

function updateRankings(rankings) {
  const container = document.getElementById('rankings-list');
  if (!container) return;
  
  container.innerHTML = rankings.slice(0, 10).map((ranking, index) => `
    <tr>
      <td class="rank">${index + 1}</td>
      <td class="athlete-name">${ranking.athlete_name}</td>
      <td class="score">${ranking.score}kg</td>
      <td class="team">${ranking.team || '-'}</td>
    </tr>
  `).join('');
}

function getCurrentRefereeId() {
  // This would typically come from user session/authentication
  // For MVP, we'll use a simple approach
  return document.getElementById('referee-id')?.value || 1;
}

function getCurrentEventId() {
  return document.getElementById('current-event-id')?.value || 
         document.querySelector('[data-event-id]')?.dataset.eventId;
}

function showNotification(message, type = 'info') {
  // Try to show browser notification if permission granted
  if (notificationPermission && 'Notification' in window) {
    new Notification('Small Goods Competition', {
      body: message,
      icon: '/static/images/logo.png'
    });
  }
  
  // Always show in-app alert
  showAlert(message, type);
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(function(permission) {
      notificationPermission = permission === 'granted';
    });
  } else if (Notification.permission === 'granted') {
    notificationPermission = true;
  }
}

function playTimerExpiredSound() {
  // Create audio context for timer sound
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3); // Beep for 300ms
  } catch (e) {
    console.log('Audio not supported');
  }
}

function addNotificationToList(container, notification) {
  const notificationElement = document.createElement('div');
  notificationElement.className = `alert alert-${notification.type} alert-dismissible fade show`;
  notificationElement.innerHTML = `
    <strong>${new Date(notification.timestamp).toLocaleTimeString()}</strong>
    ${notification.message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  container.insertBefore(notificationElement, container.firstChild);
  
  // Remove old notifications (keep only last 10)
  while (container.children.length > 10) {
    container.removeChild(container.lastChild);
  }
}

function refreshAthleteAttempts() {
  // Refresh athlete attempt data from server
  if (currentCompetitionId) {
    fetch(`/api/athlete/attempts?competition_id=${currentCompetitionId}`)
      .then(response => response.json())
      .then(data => {
        // Update attempt status indicators
        updateAttemptStatusDisplay(data);
      })
      .catch(error => console.error('Error refreshing attempts:', error));
  }
}

function updateAttemptStatusDisplay(attemptData) {
  // Update attempt status indicators on athlete dashboard
  attemptData.forEach(attempt => {
    const indicator = document.querySelector(`[data-attempt-id="${attempt.id}"] .attempt-status`);
    if (indicator) {
      indicator.classList.remove('pending', 'good', 'failed');
      
      if (attempt.result === null) {
        indicator.classList.add('pending');
      } else if (attempt.result === 'good_lift') {
        indicator.classList.add('good');
      } else {
        indicator.classList.add('failed');
      }
    }
  });
}

/**
 * Competition Management Functions (Admin)
 */
function reorderAthletes(eventId, newOrder) {
  if (typeof socket !== 'undefined') {
    socket.emit('update_competition_model', {
      type: 'athlete_order',
      competition_id: currentCompetitionId,
      new_order: newOrder
    });
  }
}

function updateAthleteWeight(attemptId, newWeight) {
  if (typeof socket !== 'undefined') {
    socket.emit('update_competition_model', {
      type: 'weight_change',
      competition_id: currentCompetitionId,
      attempt_id: attemptId,
      new_weight: newWeight
    });
  }
}

/**
 * Error Handling
 */
window.addEventListener('error', function(e) {
  console.error('JavaScript error:', e.error);
  showAlert('An unexpected error occurred. Please refresh the page.', 'danger');
});

// Handle socket connection errors
if (typeof socket !== 'undefined') {
  socket.on('connect_error', function(error) {
    console.error('Socket connection error:', error);
    showAlert('Connection error. Attempting to reconnect...', 'warning');
  });
  
  socket.on('reconnect', function() {
    showAlert('Reconnected successfully!', 'success');
    
    // Rejoin competition room
    if (currentCompetitionId && userRole) {
      socket.emit('join_competition', {
        competition_id: currentCompetitionId,
        role: userRole
      });
    }
  });
}

console.log('Small Goods Competition App loaded successfully');
