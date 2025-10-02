document.addEventListener('DOMContentLoaded', function() {
    // Add click animation to cards
    const cards = document.querySelectorAll('.admin-card');
    
    cards.forEach(card => {
        card.addEventListener('click', function() {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = 'translateY(-5px)';
            }, 100);
        });
    });
});

// Admin Dropdown Menu Functionality
document.addEventListener('DOMContentLoaded', function() {
    const adminMenuBtn = document.getElementById('adminMenuBtn');
    const adminDropdownMenu = document.getElementById('adminDropdownMenu');
    
    if (adminMenuBtn && adminDropdownMenu) {
        // Toggle dropdown menu
        adminMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isActive = adminMenuBtn.classList.contains('active');
            
            if (isActive) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            closeDropdown();
        });
        
        // Prevent dropdown from closing when clicking inside
        adminDropdownMenu.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        
        function openDropdown() {
            adminMenuBtn.classList.add('active');
            adminDropdownMenu.classList.add('show');
        }
        
        function closeDropdown() {
            adminMenuBtn.classList.remove('active');
            adminDropdownMenu.classList.remove('show');
        }
    }
});

// Account Settings Modal Functionality
document.addEventListener('DOMContentLoaded', function() {
    const accountSettingsBtn = document.getElementById('accountSettingsBtn');
    const accountModal = document.getElementById('accountModal');
    const closeModal = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelBtn');
    const accountForm = document.getElementById('accountForm');
    
    // Open modal
    if (accountSettingsBtn) {
        accountSettingsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (accountModal) {
                accountModal.style.display = 'block';
            }
        });
    }
    
    // Close modal functions
    function closeAccountModal() {
        if (accountModal) {
            accountModal.style.display = 'none';
        }
    }
    
    // Close modal when clicking X
    if (closeModal) {
        closeModal.addEventListener('click', closeAccountModal);
    }
    
    // Close modal when clicking Cancel
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAccountModal);
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === accountModal) {
            closeAccountModal();
        }
    });
    
    // Handle form submission
    if (accountForm) {
        accountForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(accountForm);
            
            fetch('/admin/update-account', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Account updated successfully!');
                    closeAccountModal();
                } else {
                    alert('Error updating account: ' + (data.error || 'Unknown error'));
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('An error occurred while updating your account.');
            });
        });
    }
});