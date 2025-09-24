document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.querySelector('form[action="/signup"]');
    if (!signupForm) return; // Exit if not on the signup page

    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const strengthMeter = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');
    const submitBtn = signupForm.querySelector('button[type="submit"]');

    /**
     * Checks password strength based on multiple criteria.
     * @param {string} password - The password to check.
     * @returns {object} - An object with strength details.
     */
    function checkPasswordStrength(password) {
        let strength = 0;
        const feedback = [];

        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/)) strength++;
        if (password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++; // Special characters

        let color = 'var(--danger-color)';
        let message = 'Very Weak';

        switch (strength) {
            case 1:
                message = 'Weak';
                break;
            case 2:
                message = 'Fair';
                color = '#f59e0b'; // Amber
                break;
            case 3:
                message = 'Good';
                color = 'var(--secondary-color)';
                break;
            case 4:
            case 5:
                message = 'Strong';
                color = '#047857'; // A darker green
                break;
        }

        return {
            strengthPercent: (strength / 5) * 100,
            color,
            message
        };
    }

    // --- EVENT LISTENERS ---

    // 1. Password Strength and Validation
    if (passwordInput && strengthMeter && strengthText) {
        passwordInput.addEventListener('input', () => {
            const { strengthPercent, color, message } = checkPasswordStrength(passwordInput.value);
            strengthMeter.style.width = `${strengthPercent}%`;
            strengthMeter.style.backgroundColor = color;
            strengthText.textContent = `Strength: ${message}`;
            strengthText.style.color = color;

            // Trigger confirmation check when the main password changes
            validatePasswordConfirmation();
        });
    }
    
    // 2. Password Confirmation Validation
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', validatePasswordConfirmation);
    }
    
    function validatePasswordConfirmation() {
        if (confirmPasswordInput.value !== passwordInput.value) {
            confirmPasswordInput.setCustomValidity('Passwords do not match.');
        } else {
            confirmPasswordInput.setCustomValidity('');
        }
    }

    // 3. AJAX Form Submission
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (passwordInput.value !== confirmPasswordInput.value) {
            showToast('Passwords do not match. Please check again.', 'error');
            return;
        }

        const originalButtonText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

        try {
            const response = await fetch('/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: signupForm.username.value.trim(),
                    password: passwordInput.value
                })
            });

            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            let data = null;
            if (contentType.includes('application/json')) {
                data = await response.json();
            }

            if (response.ok) {
                // Success! Redirect to the dashboard.
                if (data && data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                } else {
                    window.location.href = '/dashboard';
                }
            } else {
                // Show error message from the server (e.g., "Username taken")
                showToast((data && data.message) || 'Failed to create account. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalButtonText;
            }
        } catch (error) {
            console.error('Signup fetch error:', error);
            showToast('An network error occurred. Please check your connection and try again.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalButtonText;
        }
    });

    /**
     * Adds a password visibility toggle icon next to a password input.
     * @param {HTMLInputElement} input - The password input field.
     */
    function addVisibilityToggle(input) {
        if (!input) return;
        const parent = input.parentElement;
        parent.style.position = 'relative';

        const toggle = document.createElement('i');
        toggle.className = 'fas fa-eye';
        toggle.style.cssText = `
            position: absolute;
            right: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            cursor: pointer;
            transition: color 0.2s;
        `;

        toggle.addEventListener('click', () => {
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            toggle.className = `fas ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
        });
        
        parent.appendChild(toggle);
    }

    // Add toggles to both password fields
    addVisibilityToggle(passwordInput);
    addVisibilityToggle(confirmPasswordInput);
});
