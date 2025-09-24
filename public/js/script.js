// public/js/script.js

document.addEventListener('DOMContentLoaded', function() {
    // Apply progress bar widths on any page that has them
    document.querySelectorAll('.progress-fill[data-progress]').forEach(function(el) {
        const val = parseFloat(el.getAttribute('data-progress')) || 0;
        el.style.width = Math.min(100, val) + '%';
    });
});

// Global Toast Notification Function
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade-in`;
    toast.innerHTML = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}