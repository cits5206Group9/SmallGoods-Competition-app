/**
 * UI Utilities Module
 * Common UI manipulation functions and helpers
 */

class UIManager {
    constructor() {
        this.modals = new Map();
        this.toasts = [];
        this.animations = new Set();
        
        this.init();
    }
    
    init() {
        this.setupGlobalHandlers();
        this.setupKeyboardShortcuts();
        console.log('UI Manager initialized');
    }
    
    setupGlobalHandlers() {
        // Click outside to close dropdowns/modals
        document.addEventListener('click', (e) => {
            this.handleGlobalClick(e);
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeTopModal();
            }
        });
        
        // Handle form submissions
        document.addEventListener('submit', (e) => {
            this.handleFormSubmission(e);
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when no input is focused
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '/':
                        e.preventDefault();
                        this.focusSearch();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.openCommandPalette();
                        break;
                }
            }
        });
    }
    
    /**
     * Modal Management
     */
    showModal(id, options = {}) {
        const modal = document.getElementById(id);
        if (!modal) {
            console.warn(`Modal with id "${id}" not found`);
            return null;
        }
        
        const modalData = {
            element: modal,
            options: options,
            onClose: options.onClose || null
        };
        
        this.modals.set(id, modalData);
        
        // Show modal
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        // Focus management
        const firstFocusable = modal.querySelector('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Animation
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });
        
        return modalData;
    }
    
    closeModal(id) {
        const modalData = this.modals.get(id);
        if (!modalData) return;
        
        const { element, onClose } = modalData;
        
        // Animation
        element.style.opacity = '0';
        element.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            element.classList.add('hidden');
            element.setAttribute('aria-hidden', 'true');
            
            // Restore body scroll
            if (this.modals.size === 1) {
                document.body.style.overflow = '';
            }
            
            // Call onClose callback
            if (onClose) onClose();
            
            this.modals.delete(id);
        }, 200);
    }
    
    closeTopModal() {
        if (this.modals.size > 0) {
            const topModalId = Array.from(this.modals.keys()).pop();
            this.closeModal(topModalId);
        }
    }
    
    /**
     * Toast Notifications
     */
    showToast(message, type = 'info', duration = 5000) {
        const toast = this.createToastElement(message, type);
        const container = this.getToastContainer();
        
        container.appendChild(toast);
        this.toasts.push(toast);
        
        // Animate in
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => {
                this.dismissToast(toast);
            }, duration);
        }
        
        return toast;
    }
    
    createToastElement(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${this.getToastIcon(type)}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" aria-label="Close notification">×</button>
            </div>
        `;
        
        // Close button handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.dismissToast(toast);
        });
        
        return toast;
    }
    
    dismissToast(toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }
    
    getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        return container;
    }
    
    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * Loading States
     */
    showLoading(target = null, message = 'Loading...') {
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <span class="loading-text">${message}</span>
            </div>
        `;
        
        if (target) {
            target.style.position = 'relative';
            target.appendChild(loader);
        } else {
            document.body.appendChild(loader);
        }
        
        return loader;
    }
    
    hideLoading(loader) {
        if (loader && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
    }
    
    /**
     * Form Utilities
     */
    handleFormSubmission(e) {
        const form = e.target;
        if (!form.classList.contains('ajax-form')) return;
        
        e.preventDefault();
        this.submitFormAjax(form);
    }
    
    async submitFormAjax(form) {
        const formData = new FormData(form);
        const url = form.action || window.location.href;
        const method = form.method || 'POST';
        
        const loader = this.showLoading(form, 'Submitting...');
        
        try {
            const response = await fetch(url, {
                method: method,
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.showToast(result.message || 'Form submitted successfully', 'success');
                if (result.redirect) {
                    window.location.href = result.redirect;
                }
            } else {
                throw new Error(result.message || 'Form submission failed');
            }
            
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            this.hideLoading(loader);
        }
    }
    
    /**
     * Animation Utilities
     */
    animate(element, animation, duration = 300) {
        return new Promise((resolve) => {
            const animationId = `anim_${Date.now()}`;
            this.animations.add(animationId);
            
            element.style.animation = `${animation} ${duration}ms ease-in-out`;
            
            const cleanup = () => {
                element.style.animation = '';
                this.animations.delete(animationId);
                resolve();
            };
            
            element.addEventListener('animationend', cleanup, { once: true });
            
            // Fallback timeout
            setTimeout(cleanup, duration + 100);
        });
    }
    
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.classList.remove('hidden');
        
        return this.animate(element, `fadeIn ${duration}ms`).then(() => {
            element.style.opacity = '1';
        });
    }
    
    fadeOut(element, duration = 300) {
        return this.animate(element, `fadeOut ${duration}ms`).then(() => {
            element.classList.add('hidden');
            element.style.opacity = '';
        });
    }
    
    slideDown(element, duration = 300) {
        element.style.height = '0';
        element.style.overflow = 'hidden';
        element.classList.remove('hidden');
        
        const targetHeight = element.scrollHeight + 'px';
        
        return this.animate(element, `slideDown ${duration}ms`).then(() => {
            element.style.height = targetHeight;
            element.style.overflow = '';
        });
    }
    
    slideUp(element, duration = 300) {
        element.style.overflow = 'hidden';
        element.style.height = element.offsetHeight + 'px';
        
        return this.animate(element, `slideUp ${duration}ms`).then(() => {
            element.classList.add('hidden');
            element.style.height = '';
            element.style.overflow = '';
        });
    }
    
    /**
     * DOM Utilities
     */
    createElement(tag, className, content) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (content) element.innerHTML = content;
        return element;
    }
    
    findParent(element, selector) {
        let parent = element.parentElement;
        while (parent && !parent.matches(selector)) {
            parent = parent.parentElement;
        }
        return parent;
    }
    
    toggleClass(element, className, condition = null) {
        if (condition === null) {
            element.classList.toggle(className);
        } else {
            element.classList.toggle(className, condition);
        }
    }
    
    /**
     * Event Utilities
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Utility Methods
     */
    handleGlobalClick(e) {
        // Close dropdowns when clicking outside
        const dropdowns = document.querySelectorAll('.dropdown.open');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }
    
    focusSearch() {
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
    
    openCommandPalette() {
        // Placeholder for command palette functionality
        console.log('Command palette triggered');
    }
    
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return Promise.resolve();
        }
    }
}

// Add CSS for toast notifications
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    .toast {
        pointer-events: auto;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        min-width: 300px;
        max-width: 500px;
    }
    
    .toast.show {
        transform: translateX(0);
    }
    
    .toast.hide {
        transform: translateX(100%);
    }
    
    .toast-content {
        display: flex;
        align-items: center;
        padding: 16px;
        gap: 12px;
    }
    
    .toast-icon {
        font-size: 20px;
        flex-shrink: 0;
    }
    
    .toast-message {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
    }
    
    .toast-close {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.5;
        flex-shrink: 0;
        padding: 0;
        width: 24px;
        height: 24px;
    }
    
    .toast-close:hover {
        opacity: 1;
    }
    
    .toast-success {
        border-left: 4px solid #34a853;
    }
    
    .toast-error {
        border-left: 4px solid #ea4335;
    }
    
    .toast-warning {
        border-left: 4px solid #fbbc04;
    }
    
    .toast-info {
        border-left: 4px solid #4285f4;
    }
    
    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    }
    
    .loading-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
    }
    
    .loading-text {
        font-size: 14px;
        color: #666;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
    
    @keyframes slideDown {
        from { height: 0; }
        to { height: var(--target-height, auto); }
    }
    
    @keyframes slideUp {
        from { height: var(--start-height, auto); }
        to { height: 0; }
    }
`;

document.head.appendChild(toastStyles);

// Create global instance
window.uiManager = new UIManager();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}