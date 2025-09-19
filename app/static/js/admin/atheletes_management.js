// Athletes Management JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const addAthleteBtn = document.getElementById('add-athlete-btn');
    const athleteModal = document.getElementById('athlete-modal');
    const athleteForm = document.getElementById('athlete-form');
    const deleteModal = document.getElementById('delete-modal');
    const athleteSearch = document.getElementById('athlete-search');
    const competitionFilter = document.getElementById('competition-filter');
    const genderFilter = document.getElementById('gender-filter');
    const statusFilter = document.getElementById('status-filter');
    
    let currentAthleteId = null;
    let deleteAthleteId = null;

    // Initialize
    init();

    function init() {
        bindEvents();
        setupSearch();
    }

    function bindEvents() {
        // Add athlete button
        addAthleteBtn.addEventListener('click', showAddAthleteModal);

        // Edit athlete buttons
        document.querySelectorAll('.edit-athlete').forEach(btn => {
            btn.addEventListener('click', handleEditAthlete);
        });

        // Delete athlete buttons
        document.querySelectorAll('.delete-athlete').forEach(btn => {
            btn.addEventListener('click', handleDeleteAthlete);
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', closeModals);
        });

        // Cancel buttons
        document.getElementById('cancel-btn').addEventListener('click', closeModals);
        document.getElementById('cancel-delete-btn').addEventListener('click', closeModals);

        // Form submission
        athleteForm.addEventListener('submit', handleFormSubmit);

        // Delete confirmation
        document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);

        // Click outside modal to close
        window.addEventListener('click', function(event) {
            if (event.target === athleteModal || event.target === deleteModal) {
                closeModals();
            }
        });

        // Filter changes
        competitionFilter.addEventListener('change', applyFilters);
        genderFilter.addEventListener('change', applyFilters);
        statusFilter.addEventListener('change', applyFilters);
    }

    function setupSearch() {
        let searchTimeout;
        athleteSearch.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 300);
        });
    }

    function showAddAthleteModal() {
        currentAthleteId = null;
        document.getElementById('modal-title').textContent = 'Add New Athlete';
        document.getElementById('save-btn').textContent = 'Save Athlete';
        athleteForm.reset();
        document.getElementById('is_active').checked = true;
        athleteModal.style.display = 'block';
        document.getElementById('first_name').focus();
    }

    function handleEditAthlete(event) {
        const athleteId = event.target.closest('button').dataset.athleteId;
        currentAthleteId = athleteId;
        
        document.getElementById('modal-title').textContent = 'Edit Athlete';
        document.getElementById('save-btn').textContent = 'Update Athlete';
        
        // Load athlete data
        loadAthleteData(athleteId);
        
        athleteModal.style.display = 'block';
    }

    function handleDeleteAthlete(event) {
        deleteAthleteId = event.target.closest('button').dataset.athleteId;
        const row = event.target.closest('tr');
        const athleteName = row.querySelector('td:first-child').textContent;
        
        document.getElementById('delete-athlete-name').textContent = athleteName;
        deleteModal.style.display = 'block';
    }

    async function loadAthleteData(athleteId) {
        try {
            showLoading(athleteForm);
            const response = await fetch(`/admin/athletes/${athleteId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load athlete data');
            }
            
            const athlete = await response.json();
            
            // Populate form fields
            document.getElementById('first_name').value = athlete.first_name || '';
            document.getElementById('last_name').value = athlete.last_name || '';
            document.getElementById('email').value = athlete.email || '';
            document.getElementById('phone').value = athlete.phone || '';
            document.getElementById('team').value = athlete.team || '';
            document.getElementById('gender').value = athlete.gender || '';
            document.getElementById('age').value = athlete.age || '';
            document.getElementById('bodyweight').value = athlete.bodyweight || '';
            document.getElementById('competition_id').value = athlete.competition_id || '';
            document.getElementById('is_active').checked = athlete.is_active;
            
        } catch (error) {
            console.error('Error loading athlete data:', error);
            showNotification('Error loading athlete data', 'error');
        } finally {
            hideLoading(athleteForm);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(athleteForm);
        
        // Validate form
        const errors = validateForm(formData);
        if (errors.length > 0) {
            showNotification(errors.join(', '), 'error');
            return;
        }
        
        const athleteData = {
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            team: formData.get('team'),
            gender: formData.get('gender'),
            age: formData.get('age') ? parseInt(formData.get('age')) : null,
            bodyweight: formData.get('bodyweight') ? parseFloat(formData.get('bodyweight')) : null,
            competition_id: formData.get('competition_id') ? parseInt(formData.get('competition_id')) : null,
            is_active: formData.has('is_active')
        };

        try {
            showLoading(athleteForm);
            
            const url = currentAthleteId 
                ? `/admin/athletes/${currentAthleteId}`
                : '/admin/athletes';
            
            const method = currentAthleteId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(athleteData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save athlete');
            }

            const result = await response.json();
            showNotification(result.message, 'success');
            closeModals();
            
            // Reload page to show updated data
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Error saving athlete:', error);
            showNotification(error.message, 'error');
        } finally {
            hideLoading(athleteForm);
        }
    }

    async function confirmDelete() {
        if (!deleteAthleteId) return;

        try {
            showLoading(deleteModal);
            
            const response = await fetch(`/admin/athletes/${deleteAthleteId}`, {
                method: 'DELETE',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete athlete');
            }

            const result = await response.json();
            showNotification(result.message, 'success');
            closeModals();
            
            // Reload the page to refresh data and pagination
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Error deleting athlete:', error);
            showNotification(error.message, 'error');
        } finally {
            hideLoading(deleteModal);
            deleteAthleteId = null;
        }
    }

    function applyFilters() {
        const searchTerm = athleteSearch.value.toLowerCase();
        const competitionId = competitionFilter.value;
        const gender = genderFilter.value;
        const status = statusFilter.value;

        const rows = document.querySelectorAll('#athletes-table tbody tr');
        
        rows.forEach(row => {
            const name = row.querySelector('td:nth-child(1)').textContent.toLowerCase();
            const email = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
            const team = row.querySelector('td:nth-child(4)').textContent.toLowerCase();
            const athleteGender = row.querySelector('td:nth-child(5)').textContent;
            const statusBadge = row.querySelector('.status-badge');
            const athleteStatus = statusBadge.classList.contains('active') ? 'active' : 'inactive';

            const matchesSearch = !searchTerm || 
                name.includes(searchTerm) || 
                email.includes(searchTerm) || 
                team.includes(searchTerm);
            
            const matchesGender = !gender || athleteGender === gender;
            const matchesStatus = !status || athleteStatus === status;
            
            // Note: Competition filter would need additional data attribute on rows
            // For now, just show all if no competition selected
            const matchesCompetition = !competitionId;

            if (matchesSearch && matchesGender && matchesStatus && matchesCompetition) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    function closeModals() {
        athleteModal.style.display = 'none';
        deleteModal.style.display = 'none';
        currentAthleteId = null;
        deleteAthleteId = null;
    }

    function showLoading(element) {
        element.classList.add('loading');
    }

    function hideLoading(element) {
        element.classList.remove('loading');
    }

    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            backgroundColor: type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8',
            color: 'white',
            borderRadius: '4px',
            zIndex: '9999',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Form validation
    function validateForm(formData) {
        const errors = [];

        if (!formData.get('first_name').trim()) {
            errors.push('First name is required');
        }

        if (!formData.get('last_name').trim()) {
            errors.push('Last name is required');
        }

        const email = formData.get('email');
        if (email && !isValidEmail(email)) {
            errors.push('Please enter a valid email address');
        }

        const age = formData.get('age');
        if (age && (age < 1 || age > 120)) {
            errors.push('Please enter a valid age (1-120)');
        }

        const bodyweight = formData.get('bodyweight');
        if (bodyweight && bodyweight <= 0) {
            errors.push('Please enter a valid bodyweight');
        }

        return errors;
    }

    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
});
