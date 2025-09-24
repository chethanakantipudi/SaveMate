// public/js/profile.js

function showUpdateProfileModal() {
    // Logic to create and show a modal with a form to update fname, lname, email
    console.log('Opening update profile modal...');
    showToast('This feature is coming soon!', 'info');
}

function showUpdatePasswordModal() {
    // Logic to create and show a modal for changing the password
    console.log('Opening update password modal...');
    showToast('This feature is coming soon!', 'info');
}

document.querySelectorAll('a[href="#update-profile"]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        showUpdateProfileModal();
    });
});

document.querySelectorAll('a[href="#update-password"]').forEach(el => {
    el.addEventListener('click', (e) => {
        e.preventDefault();
        showUpdatePasswordModal();
    });
});