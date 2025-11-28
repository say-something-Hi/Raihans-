class HumanChatbotUI {
    constructor() {
        this.userId = this.generateUserId();
        this.isTyping = false;
        this.initializeEventListeners();
        this.setInitialTime();
    }

    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    initializeEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const clearHistoryBtn = document.getElementById('clearHistory');
        const exportChatBtn = document.getElementById('exportChat');

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendButton.addEventListener('click', () => this.sendMessage());
        clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        exportChatBtn.addEventListener('click', () => this.exportChat());

        // Auto-focus input
        messageInput.focus();
    }

    setInitialTime() {
        const initialTime = document.getElementById('initialTime');
        initialTime.textContent = this.formatTime(new Date());
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();

        if (!message || this.isTyping) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        input.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    userId: this.userId
                })
            });

            const data = await response.json();

            // Simulate typing delay for more human-like interaction
            setTimeout(() => {
                this.hideTypingIndicator();
                this.addMessage(data.response, 'bot', data.timestamp);
            }, data.typingDelay || 1000);

        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage("Sorry, I'm having trouble connecting right now. Please try again.", 'bot');
        }
    }

    addMessage(text, sender, timestamp = null) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const avatarIcon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="${avatarIcon}"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(text)}</div>
                <div class="message-time">${timestamp ? this.formatTime(new Date(timestamp)) : this.formatTime(new Date())}</div>
            </div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
        this.isTyping = true;
        const typingIndicator = document.getElementById('typingIndicator');
        typingIndicator.style.display = 'flex';
        
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        this.isTyping = false;
        const typingIndicator = document.getElementById('typingIndicator');
        typingIndicator.style.display = 'none';
    }

    async clearHistory() {
        if (!confirm('Are you sure you want to clear the chat history?')) return;

        try {
            await fetch(`/api/history/${this.userId}`, {
                method: 'DELETE'
            });

            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.innerHTML = `
                <div class="message bot-message">
                    <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                        <div class="message-text">
                            Chat history cleared! I'm ready for a fresh conversation. What would you like to talk about?
                        </div>
                        <div class="message-time">${this.formatTime(new Date())}</div>
                    </div>
                </div>
            `;

            this.showNotification('Chat history cleared successfully!', 'success');
        } catch (error) {
            console.error('Error clearing history:', error);
            this.showNotification('Error clearing history', 'error');
        }
    }

    exportChat() {
        const messages = document.querySelectorAll('.message');
        let chatText = 'Human Chatbot Conversation Export\n';
        chatText += 'Generated on: ' + new Date().toLocaleString() + '\n\n';

        messages.forEach(message => {
            const isUser = message.classList.contains('user-message');
            const sender = isUser ? 'You' : 'Bot';
            const text = message.querySelector('.message-text').textContent;
            const time = message.querySelector('.message-time').textContent;
            
            chatText += `[${time}] ${sender}: ${text}\n`;
        });

        const blob = new Blob([chatText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chatbot-conversation-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Chat exported successfully!', 'success');
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour12: true, 
            hour: 'numeric', 
            minute: '2-digit' 
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyles);

// Initialize the chatbot UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new HumanChatbotUI();
});
