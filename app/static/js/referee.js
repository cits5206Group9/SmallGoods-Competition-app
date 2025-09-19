// Referee Panel JavaScript
class RefereePanel {
    constructor() {
        this.currentCompetition = null;
        this.currentEvent = null;
        this.currentAthlete = null;
        this.athletesQueue = [];
        this.timerInterval = null;
        this.timerSeconds = 60;
        this.refereeVotes = {};
        this.currentAttemptData = {};
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadCompetitions();
        this.initTimer();
    }

    bindEvents() {
        // Competition selection
        document.getElementById('competition-select').addEventListener('change', (e) => {
            this.selectCompetition(e.target.value);
        });

        document.getElementById('event-select').addEventListener('change', (e) => {
            this.selectEvent(e.target.value);
        });

        // Timer controls
        document.getElementById('start-timer').addEventListener('click', () => {
            this.startTimer();
        });

        document.getElementById('reset-timer').addEventListener('click', () => {
            this.resetTimer();
        });

        // Result buttons
        document.querySelectorAll('.result-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectResult(e.currentTarget.dataset.result);
            });
        });

        // Referee votes
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.recordRefereeVote(
                    e.currentTarget.dataset.referee,
                    e.currentTarget.dataset.vote
                );
            });
        });

        // Action buttons
        document.getElementById('submit-decision').addEventListener('click', () => {
            this.submitDecision();
        });

        document.getElementById('next-athlete').addEventListener('click', () => {
            this.nextAthlete();
        });

        // Queue controls
        document.getElementById('load-athletes').addEventListener('click', () => {
            this.loadAthletes();
        });

        document.getElementById('randomize-order').addEventListener('click', () => {
            this.randomizeOrder();
        });

        // Emergency controls
        document.getElementById('emergency-stop').addEventListener('click', () => {
            this.emergencyStop();
        });

        document.getElementById('technical-break').addEventListener('click', () => {
            this.technicalBreak();
        });

        // Technical decisions checkboxes
        document.querySelectorAll('.violation-checkboxes input').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateTechnicalViolations();
            });
        });
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
            this.clearEventSelect();
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
            this.showNotification(`Loaded: ${this.currentCompetition.name}`, 'success');
        } catch (error) {
            console.error('Error loading competition:', error);
            this.showNotification(`Error loading competition details: ${error.message}`, 'error');
        }
    }

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
            return;
        }

        this.currentEvent = this.currentCompetition.events[eventIndex];
        document.getElementById('current-event').textContent = this.currentEvent.name;
        
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
            
            this.renderAthletsQueue();
            this.updateProgress();
            
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
        
        this.renderAthletsQueue();
        this.updateProgress();
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
        this.highlightCurrentAthlete();
        
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

    randomizeOrder() {
        // Fisher-Yates shuffle
        for (let i = this.athletesQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.athletesQueue[i], this.athletesQueue[j]] = [this.athletesQueue[j], this.athletesQueue[i]];
        }
        
        this.renderAthletsQueue();
        this.loadCurrentAthlete();
        this.showNotification('Athlete order randomized', 'success');
    }

    initTimer() {
        this.updateTimerDisplay();
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            this.updateTimerDisplay();
            
            if (this.timerSeconds <= 0) {
                this.timeExpired();
            }
        }, 1000);
        
        document.getElementById('start-timer').textContent = 'Stop Timer';
        document.getElementById('start-timer').onclick = () => this.stopTimer();
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        document.getElementById('start-timer').textContent = 'Start Timer';
        document.getElementById('start-timer').onclick = () => this.startTimer();
    }

    resetTimer() {
        this.stopTimer();
        this.timerSeconds = this.currentEvent?.timer?.attempt_seconds || 60;
        this.updateTimerDisplay();
        
        document.getElementById('start-timer').textContent = 'Start Timer';
        document.getElementById('start-timer').onclick = () => this.startTimer();
    }

    updateTimerDisplay() {
        const timerElement = document.getElementById('attempt-timer');
        timerElement.textContent = this.timerSeconds;
        
        // Change color based on time remaining
        if (this.timerSeconds <= 10) {
            timerElement.style.background = '#e74c3c';
            timerElement.classList.add('pulse');
        } else if (this.timerSeconds <= 30) {
            timerElement.style.background = '#f39c12';
            timerElement.classList.remove('pulse');
        } else {
            timerElement.style.background = '#2c3e50';
            timerElement.classList.remove('pulse');
        }
    }

    timeExpired() {
        this.stopTimer();
        this.showNotification('Time expired! Recording as No Lift', 'warning');
        this.selectResult('no-lift');
        
        // Auto-submit after time expires
        setTimeout(() => {
            this.submitDecision();
        }, 2000);
    }

    selectResult(result) {
        // Clear previous selections
        document.querySelectorAll('.result-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Select current result
        const selectedBtn = document.querySelector(`[data-result="${result}"]`);
        selectedBtn.classList.add('selected');
        
        // Show/hide technical violations
        const technicalDiv = document.getElementById('technical-decisions');
        if (result === 'no-lift') {
            technicalDiv.classList.add('show');
        } else {
            technicalDiv.classList.remove('show');
            // Clear technical violations if good lift
            document.querySelectorAll('.violation-checkboxes input').forEach(cb => {
                cb.checked = false;
            });
        }
        
        this.currentAttemptData.result = result;
        this.checkSubmissionReady();
    }

    recordRefereeVote(refereeNum, vote) {
        // Clear previous vote for this referee
        document.querySelectorAll(`[data-referee="${refereeNum}"]`).forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Select new vote
        const selectedBtn = document.querySelector(`[data-referee="${refereeNum}"][data-vote="${vote}"]`);
        selectedBtn.classList.add('selected');
        
        this.refereeVotes[refereeNum] = vote;
        this.updateFinalDecision();
        this.checkSubmissionReady();
    }

    updateFinalDecision() {
        const votes = Object.values(this.refereeVotes);
        const goodVotes = votes.filter(vote => vote === 'good').length;
        const noLiftVotes = votes.filter(vote => vote === 'no-lift').length;
        
        let decision = 'Pending';
        if (votes.length === 3) {
            decision = goodVotes >= 2 ? 'Good Lift' : 'No Lift';
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
        const hasAllVotes = Object.keys(this.refereeVotes).length === 3;
        
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
            this.updateProgress();
            this.renderAthletsQueue();
            
            // Enable next athlete button
            document.getElementById('next-athlete').disabled = false;
            
        } catch (error) {
            console.error('Error submitting decision:', error);
            this.showNotification('Error submitting decision', 'error');
        }
    }

    async saveAttempt(attemptData) {
        // For demo purposes, just log the data
        console.log('Saving attempt:', attemptData);
        
        // In a real implementation, this would save to the database
        // const response = await fetch('/admin/api/attempts', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(attemptData)
        // });
        // return response.json();
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

    emergencyStop() {
        this.stopTimer();
        this.showNotification('EMERGENCY STOP ACTIVATED', 'error');
        
        // Disable all controls
        document.querySelectorAll('button:not(#emergency-stop)').forEach(btn => {
            btn.disabled = true;
        });
        
        // You could add additional emergency procedures here
    }

    technicalBreak() {
        this.stopTimer();
        this.showNotification('Technical break initiated', 'warning');
        
        // Add additional break time
        this.timerSeconds += 60; // Add 1 minute
        this.updateTimerDisplay();
    }

    clearEventSelect() {
        const select = document.getElementById('event-select');
        select.innerHTML = '<option value="">Select Event</option>';
        select.disabled = true;
        document.getElementById('current-event').textContent = 'No Event Selected';
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