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