document.addEventListener('DOMContentLoaded', function() {
  // Auto-hide flash messages after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = 'background:none;border:none;font-size:1.2em;font-weight:bold;cursor:pointer;float:right;margin-left:10px;';
    closeBtn.onclick = () => alert.remove();
    alert.appendChild(closeBtn);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (alert.parentNode) {
        alert.style.opacity = '0';
        alert.style.transition = 'opacity 0.3s ease';
        setTimeout(() => alert.remove(), 300);
      }
    }, 5000);
  });

  const form = document.getElementById('loginForm');
  const contactInput = document.getElementById('contact');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const btnText = loginBtn.querySelector('.btn-text');
  const btnLoading = loginBtn.querySelector('.btn-loading');

  // Client-side validation
  function validateContact(value) {
    if (!value.trim()) {
      return 'Please enter your email address';
    }
    
    // Always validate as email for simplicity
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    
    return '';
  }
  
  function validatePassword(value) {
    // Password is optional - athletes can login with just email
    // Admins need both email and password, but validation is done server-side
    return '';
  }
  
  function showError(fieldId, message) {
    const errorElement = document.getElementById(fieldId + 'Error');
    const inputElement = document.getElementById(fieldId);
    
    if (errorElement) {
      errorElement.textContent = message;
    }
    
    if (inputElement) {
      if (message) {
        inputElement.classList.add('error');
      } else {
        inputElement.classList.remove('error');
      }
    }
  }
  
  // Real-time validation
  contactInput.addEventListener('blur', function() {
    const error = validateContact(this.value);
    showError('contact', error);
  });
  
  if (passwordInput) {
    passwordInput.addEventListener('blur', function() {
      const error = validatePassword(this.value);
      showError('password', error);
    });
  }
  
  // Clear errors on input
  contactInput.addEventListener('input', function() {
    if (this.classList.contains('error')) {
      showError('contact', '');
    }
  });
  
  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      if (this.classList.contains('error')) {
        showError('password', '');
      }
    });
  }
  
  // Form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Validate all fields
    const contactError = validateContact(contactInput.value);
    const passwordError = passwordInput ? validatePassword(passwordInput.value) : '';
    
    showError('contact', contactError);
    if (passwordInput) {
      showError('password', passwordError);
    }
    
    // If no errors, submit form
    if (!contactError && !passwordError) {
      // Show loading state
      loginBtn.disabled = true;
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      
      // Submit the form
      this.submit();
    }
  });
});