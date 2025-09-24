// Fixed viewgoal.js - Replace your existing viewgoal.js content with this

document.addEventListener('DOMContentLoaded', () => {
    // Animate progress bar on initial page load
    const progressFill = document.querySelector('.progress-fill');
    if (progressFill) {
        setTimeout(() => {
            const progress = progressFill.getAttribute('data-progress');
            progressFill.style.width = progress + '%';
        }, 300);
    }

    // Handle transaction form submission dynamically
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }

    // Handle delete goal button
    const deleteBtn = document.getElementById('deleteGoalBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteGoal);
    }
});

/**
 * Validates transaction form data
 */
function validateTransaction(amount, type, currentTotal) {
    if (!amount || amount <= 0) {
        return { valid: false, message: 'Please enter a valid amount greater than zero.' };
    }
    
    if (type === 'withdrawal' && amount > currentTotal) {
        return { valid: false, message: 'Withdrawal amount cannot exceed current savings.' };
    }
    
    return { valid: true };
}

/**
 * Handles the form submission using fetch and updates the UI dynamically.
 * @param {Event} e The form submission event.
 */
async function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const amountInput = form.querySelector('#amount');
    const typeSelect = form.querySelector('#type');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Get current total from the page
    const currentTotalText = document.querySelector('.progress-meta strong')?.textContent;
    const currentTotal = currentTotalText ? parseFloat(currentTotalText.replace(/[^\d.-]/g, '')) : 0;

    // Enhanced validation
    const amount = parseFloat(amountInput.value);
    const type = typeSelect.value;
    
    const validation = validateTransaction(amount, type, currentTotal);
    if (!validation.valid) {
        alert(validation.message);
        return;
    }

    const originalButtonHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        const payload = {
            amount: amount,
            type: type
        };

        const response = await fetch(form.action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const contentType = response.headers.get('content-type') || '';
        let result = null;
        
        if (contentType.includes('application/json')) {
            result = await response.json();
        }

        if (response.ok && result && result.success) {
            // --- SUCCESS: Update UI without reloading ---
            updateGoalProgress(result.updatedGoal);
            addTransactionToHistory(result.newTransaction);
            amountInput.value = ''; // Reset amount input
            typeSelect.value = 'deposit'; // Reset to default
            
            if (result.updatedGoal.achieved) {
                handleGoalAchieved(submitBtn);
            } else {
                submitBtn.innerHTML = originalButtonHTML;
                submitBtn.disabled = false;
            }

            // Show success message
            if (typeof showToast === 'function') {
                showToast(result.message || 'Transaction completed successfully!', 'success');
            } else {
                // Fallback alert if toast function doesn't exist
                alert(result.message || 'Transaction completed successfully!');
            }
        } else {
            // --- FAILURE: Show error and reset button ---
            throw new Error(result?.message || 'Transaction failed. Please try again.');
        }
    } catch (error) {
        console.error('Transaction Error:', error);
        alert(error.message);
        submitBtn.innerHTML = originalButtonHTML;
        submitBtn.disabled = false;
    }
}

/**
 * Updates the goal progress bar and text elements on the page.
 * @param {object} goal The updated goal object from the server.
 */
function updateGoalProgress(goal) {
    const currency = window.USER_CURRENCY || '$';
    const savedAmountEl = document.querySelector('.progress-meta strong');
    const percentEl = document.querySelector('.progress-percent');
    const progressFill = document.querySelector('.progress-fill');
    
    const progressPercent = Math.min(100, (goal.current_total / goal.end_total) * 100);

    if (savedAmountEl) {
        const formattedAmount = Number(goal.current_total).toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
        savedAmountEl.textContent = `${currency}${formattedAmount}`;
    }

    if (percentEl) {
        percentEl.textContent = `${Math.round(progressPercent)}%`;
    }

    if (progressFill) {
        progressFill.setAttribute('data-progress', progressPercent);
        progressFill.style.width = progressPercent + '%';
    }
}

/**
 * Prepends the new transaction to the history list.
 * @param {object} transaction The new transaction object from the server.
 */
function addTransactionToHistory(transaction) {
    const list = document.querySelector('.transaction-list');
    const emptyState = document.querySelector('.goal-history-card .empty-state');
    
    if (!list) return;

    // Remove empty state message if it exists
    if (emptyState) {
        emptyState.remove();
    }

    const currency = window.USER_CURRENCY || '$';
    const sign = transaction.type === 'deposit' ? '+' : '-';
    const amountClass = transaction.type === 'deposit' ? 'amount-positive' : 'amount-negative';
    const iconClass = transaction.type === 'deposit' ? 'fa-arrow-up' : 'fa-arrow-down';
    
    const formattedAmount = Number(transaction.amount).toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    
    const transactionDate = new Date(transaction.date).toLocaleDateString();
    const typeCapitalized = transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1);

    const newItem = document.createElement('li');
    newItem.className = 'transaction-item';
    newItem.innerHTML = `
        <div class="transaction-meta">
            <div class="transaction-icon ${transaction.type}">
                <i class="fas ${iconClass}"></i>
            </div>
            <div>
                <div class="transaction-name">${typeCapitalized}</div>
                <div class="transaction-date">${transactionDate}</div>
            </div>
        </div>
        <div class="transaction-amount ${amountClass}">
            ${sign}${currency}${formattedAmount}
        </div>
    `;

    list.prepend(newItem);

    // Remove items beyond the first 5 to maintain display limit
    const items = list.querySelectorAll('.transaction-item');
    if (items.length > 5) {
        for (let i = 5; i < items.length; i++) {
            items[i].remove();
        }
    }
}

/**
 * Handles the UI changes when a goal is marked as achieved.
 * @param {HTMLButtonElement} submitBtn The form's submit button.
 */
function handleGoalAchieved(submitBtn) {
    // Disable the button permanently and update its text
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Goal Achieved!';

    // Add a message below the button
    let messageEl = document.getElementById('form-feedback-message');
    if (!messageEl) {
        messageEl = document.createElement('small');
        messageEl.id = 'form-feedback-message';
        messageEl.style.cssText = 'display: block; text-align: center; margin-top: 0.5rem; color: var(--text-secondary);';
        submitBtn.parentNode.appendChild(messageEl);
    }
    messageEl.innerHTML = '<i class="fas fa-trophy"></i> Congratulations! This goal is complete.';

    // Add achievement message under the progress bar
    const progressCard = document.querySelector('.goal-progress-card');
    if (progressCard && !document.querySelector('.achieved-message')) {
        const achievedMessage = document.createElement('p');
        achievedMessage.className = 'achieved-message';
        achievedMessage.style.cssText = 'margin-top: 1rem; color: var(--secondary-color); font-weight: 500;';
        achievedMessage.innerHTML = '<i class="fas fa-trophy"></i> Congratulations, you\'ve achieved this goal!';
        progressCard.appendChild(achievedMessage);
    }
}

/**
 * Handles goal deletion
 */
async function handleDeleteGoal() {
    const goalId = window.location.pathname.split('/goal/')[1];
    
    if (!confirm('Are you sure you want to delete this goal? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/goal/${goalId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok && result.redirectUrl) {
            if (typeof showToast === 'function') {
                showToast('Goal deleted successfully!', 'success');
            }
            setTimeout(() => {
                window.location.href = result.redirectUrl;
            }, 1000);
        } else {
            throw new Error(result.message || 'Failed to delete goal');
        }
    } catch (error) {
        console.error('Delete goal error:', error);
        alert(error.message);
    }
}