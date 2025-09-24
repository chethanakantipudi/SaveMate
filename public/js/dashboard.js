document.addEventListener('DOMContentLoaded', () => {
    // Check if chart data is available before initializing
    if (typeof chart_labels !== 'undefined' && typeof chart_data !== 'undefined') {
        initializeDashboardChart();
    }

    // --- [FIX] ATTACH EVENT LISTENERS ---
    // Find all buttons that should open the "Add Goal" modal by their class
    const addGoalButtons = document.querySelectorAll('.js-add-goal-btn');
    
    // Loop through each button found and add the click event listener
    addGoalButtons.forEach(button => {
        button.addEventListener('click', showAddGoalModal);
    });

    // Animate progress bars on load
    const progressFills = document.querySelectorAll('.progress-fill');
    progressFills.forEach(fill => {
        const progress = fill.getAttribute('data-progress');
        fill.style.width = progress + '%';
    });
});


// Initialize Dashboard Chart
function initializeDashboardChart() {
    const ctx = document.getElementById('savingsChart')?.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'hsla(217, 81%, 50%, 0.2)');
    gradient.addColorStop(1, 'hsla(217, 81%, 50%, 0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: JSON.parse(chart_labels),
            datasets: [{
                label: 'Total Savings',
                data: JSON.parse(chart_data),
                borderColor: 'hsl(217, 81%, 50%)',
                backgroundColor: gradient,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: 'hsl(217, 81%, 50%)',
                pointRadius: 0,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            interaction: { intersect: false, mode: 'index' },
            scales: {
                y: { beginAtZero: false, grid: { borderDash: [4, 4] } },
                x: { grid: { display: false } }
            }
        }
    });
}

// MODAL FUNCTIONS
function showAddGoalModal() {
    const modalHTML = `
        <div class="modal animate-fade-in">
            <h2 class="card-title"><i class="fas fa-plus-circle"></i> Add New Goal</h2>
            <form id="addGoalForm" action="/add_goal" method="POST" novalidate>
                <div class="form-group">
                    <label for="goal_name" class="form-label">Goal Name</label>
                    <input type="text" id="goal_name" name="goal_name" class="form-input" required placeholder="e.g., Vacation Fund">
                </div>
                <div class="form-group">
                    <label for="goal_amount" class="form-label">Target Amount</label>
                    <input type="number" id="goal_amount" name="goal_amount" class="form-input" step="0.01" min="1" required placeholder="1000">
                </div>
                <div class="form-group">
                    <label for="goal_date" class="form-label">Target Date</label>
                    <input type="date" id="goal_date" name="goal_date" class="form-input" required>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">
                        <i class="fas fa-plus-circle"></i> Create Goal
                    </button>
                    <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="closeModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    createModal(modalHTML);

    const form = document.getElementById('addGoalForm');
    form.addEventListener('submit', handleAddGoalSubmit);

    document.getElementById('goal_date').min = new Date().toISOString().split('T')[0];
}

async function handleAddGoalSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const response = await fetch('/add_goal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goal_name: form.goal_name.value.trim(),
                goal_amount: parseFloat(form.goal_amount.value),
                goal_date: form.goal_date.value
            })
        });

        if (response.ok) {
            showToast('Goal created successfully!', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            let error = null;
            if (contentType.includes('application/json')) {
                error = await response.json();
            }
            showToast((error && error.message) || 'Failed to create goal.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    } catch (error) {
        console.error('Error creating goal:', error);
        showToast('A network error occurred. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

function showAddTransactionModal(goalId) {
    const modalHTML = `
        <div class="modal animate-fade-in">
            <h2 class="card-title"><i class="fas fa-exchange-alt"></i> Add Transaction</h2>
            <form action="/goal/${goalId}/transaction" method="POST">
                <div class="form-group">
                    <label for="amount" class="form-label">Amount</label>
                    <input type="number" id="amount" name="amount" class="form-input" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="type" class="form-label">Transaction Type</label>
                    <select id="type" name="type" class="form-input" required>
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                    </select>
                </div>
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">Add Transaction</button>
                    <button type="button" class="btn btn-secondary" style="flex: 1;" onclick="closeModal()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    createModal(modalHTML);
}

function createModal(innerHTML) {
    closeModal(); 
    
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = innerHTML;
    document.body.appendChild(modalOverlay);

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}

function closeModal() {
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
        modalOverlay.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => modalOverlay.remove(), 300);
    }
}

