document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('chatbot-fab');
    const widget = document.getElementById('chatbot-widget');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const form = document.getElementById('chatbot-form');
    const input = document.getElementById('chatbot-input');
    const messagesContainer = document.getElementById('chatbot-messages');

    if (!fab || !widget || !closeBtn || !form) return;

    // --- Event Listeners ---
    fab.addEventListener('click', () => toggleWidget(true));
    closeBtn.addEventListener('click', () => toggleWidget(false));
    form.addEventListener('submit', handleFormSubmit);

    // --- Functions ---
    function toggleWidget(isOpen) {
        if (isOpen) {
            widget.classList.add('is-open');
            fab.style.display = 'none';
        } else {
            widget.classList.remove('is-open');
            fab.style.display = 'flex';
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const userMessage = input.value.trim();
        if (!userMessage) return;

        addMessage(userMessage, 'user');
        input.value = '';
        showTypingIndicator();

        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });
            
            removeTypingIndicator();

            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }

            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            let data = null;
            if (contentType.includes('application/json')) {
                data = await response.json();
            }

            if (data && data.reply) {
                addMessage(data.reply, 'bot');
            } else {
                addMessage('Sorry, I could not parse the assistant response.', 'bot');
            }

        } catch (error) {
            console.error('Chatbot fetch error:', error);
            addMessage('Sorry, something went wrong. Please try again.', 'bot');
        }
    }

    function addMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.className = `chatbot-message ${sender}`;
        
        const contentElement = document.createElement('div');
        contentElement.className = 'chatbot-message-content';
        contentElement.textContent = text;
        
        messageElement.appendChild(contentElement);
        messagesContainer.appendChild(messageElement);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'chatbot-message bot';
        indicator.innerHTML = `
            <div class="chatbot-message-content typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        messagesContainer.appendChild(indicator);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }



    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});