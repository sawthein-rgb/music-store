// Admin.js - Admin Panel Logic

let currentAdmin = null;
let selectedConversationId = null;

// Admin login
function adminLogin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    
    if (!username || !password) {
        alert('please enter credentials! 😊');
        return;
    }
    
    // Simple admin check (for demo purposes)
    if (username.toLowerCase() !== 'admin') {
        alert('admin account only! try username: admin 😉');
        return;
    }
    
    currentAdmin = {
        id: 'admin_001',
        username: username,
        role: 'admin'
    };
    
    localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
    
    // Show admin screen
    document.getElementById('adminLoginScreen').classList.add('hidden');
    document.getElementById('adminScreen').classList.remove('hidden');
    document.getElementById('currentAdmin').textContent = username;
    
    // Load conversations
    loadActiveChats();
}

// Admin logout
function adminLogout() {
    if (confirm('logout from admin panel? 🤔')) {
        localStorage.removeItem('currentAdmin');
        currentAdmin = null;
        selectedConversationId = null;
        
        document.getElementById('adminScreen').classList.add('hidden');
        document.getElementById('adminLoginScreen').classList.remove('hidden');
        
        document.getElementById('adminUsername').value = '';
        document.getElementById('adminPassword').value = '';
    }
}

// Load active chats
function loadActiveChats() {
    const storedConversations = localStorage.getItem('conversations');
    if (!storedConversations) {
        return;
    }
    
    const convs = JSON.parse(storedConversations);
    const chatsList = document.getElementById('activeChatsList');
    
    const activeConvs = Object.values(convs).filter(conv => conv.status === 'active');
    
    if (activeConvs.length === 0) {
        chatsList.innerHTML = '<p class="no-chats">no active chats yet... 💤</p>';
        return;
    }
    
    chatsList.innerHTML = activeConvs.map(conv => {
        const lastMsg = conv.messages[conv.messages.length - 1];
        const needsAttention = conv.needsAttention || conv.type === 'seller';
        
        return `
            <div class="chat-item ${selectedConversationId === conv.id ? 'active' : ''}" 
                 onclick="selectConversation('${conv.id}')">
                <div class="chat-item-header">
                    <div class="chat-item-user">👤 ${conv.userName || 'User'}</div>
                    <button class="btn-delete-chat" onclick="event.stopPropagation(); deleteChat('${conv.id}')" title="Delete chat">🗑️</button>
                </div>
                <div class="chat-item-preview">${lastMsg ? lastMsg.content.substring(0, 50) : 'New chat'}...</div>
                ${needsAttention ? '<span class="chat-item-badge">🔔 needs attention</span>' : ''}
            </div>
        `;
    }).join('');
}

// Select conversation
function selectConversation(conversationId) {
    selectedConversationId = conversationId;
    
    const storedConversations = localStorage.getItem('conversations');
    if (!storedConversations) return;
    
    const convs = JSON.parse(storedConversations);
    const conversation = convs[conversationId];
    
    if (!conversation) return;
    
    // Update UI
    document.getElementById('noConversationSelected').classList.add('hidden');
    document.getElementById('conversationView').classList.remove('hidden');
    document.getElementById('selectedUserName').textContent = `Chat with ${conversation.userName || 'User'}`;
    
    // Load messages
    const messagesContainer = document.getElementById('adminMessages');
    messagesContainer.innerHTML = '';
    
    conversation.messages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${msg.sender}`;
        
        const avatar = msg.sender === 'ai' ? '🤖' : (msg.sender === 'admin' ? '👨‍💼' : '😎');
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-text">${msg.content}</div>
                <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Refresh chat list
    loadActiveChats();
}

// Send admin message
function sendAdminMessage() {
    if (!selectedConversationId) {
        alert('select a chat first! 😊');
        return;
    }
    
    const input = document.getElementById('adminMessageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Get conversations
    const storedConversations = localStorage.getItem('conversations');
    if (!storedConversations) return;
    
    const convs = JSON.parse(storedConversations);
    const conversation = convs[selectedConversationId];
    
    if (!conversation) return;
    
    // Add message to conversation
    const newMessage = {
        id: 'msg_' + Date.now(),
        sender: 'admin',
        senderId: currentAdmin.id,
        content: message,
        timestamp: new Date().toISOString()
    };
    
    conversation.messages.push(newMessage);
    
    // Save back to localStorage
    localStorage.setItem('conversations', JSON.stringify(convs));
    
    // Update UI
    const messagesContainer = document.getElementById('adminMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message admin';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">👨‍💼</div>
        <div class="message-content">
            <div class="message-text">${message}</div>
            <div class="message-time">${getTimestamp()}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Clear input
    input.value = '';
}

// Quick admin responses
function quickAdminResponse(message) {
    document.getElementById('adminMessageInput').value = message;
    sendAdminMessage();
}

// Poll for new messages and conversations
function pollConversations() {
    loadActiveChats();
    
    // If a conversation is selected, check for new messages
    if (selectedConversationId) {
        const storedConversations = localStorage.getItem('conversations');
        if (storedConversations) {
            const convs = JSON.parse(storedConversations);
            const conversation = convs[selectedConversationId];
            
            if (conversation) {
                const messagesContainer = document.getElementById('adminMessages');
                const currentMessageCount = messagesContainer.querySelectorAll('.message').length;
                
                if (conversation.messages.length > currentMessageCount) {
                    // Reload messages
                    selectConversation(selectedConversationId);
                }
            }
        }
    }
}

// Poll every 2 seconds
setInterval(pollConversations, 2000);

// Delete chat function
function deleteChat(conversationId) {
    if (!confirm('delete this chat? this cannot be undone! 🗑️')) {
        return;
    }
    
    const storedConversations = localStorage.getItem('conversations');
    if (!storedConversations) return;
    
    const convs = JSON.parse(storedConversations);
    
    // Delete the conversation
    delete convs[conversationId];
    
    // Save back to localStorage
    localStorage.setItem('conversations', JSON.stringify(convs));
    
    // If this was the selected conversation, clear the view
    if (selectedConversationId === conversationId) {
        selectedConversationId = null;
        document.getElementById('conversationView').classList.add('hidden');
        document.getElementById('noConversationSelected').classList.remove('hidden');
    }
    
    // Reload chat list
    loadActiveChats();
    
    alert('chat deleted! ✅');
}

// Clear all chats function
function clearAllChats() {
    if (!confirm('delete ALL chats? this cannot be undone! ⚠️')) {
        return;
    }
    
    localStorage.removeItem('conversations');
    selectedConversationId = null;
    
    document.getElementById('conversationView').classList.add('hidden');
    document.getElementById('noConversationSelected').classList.remove('hidden');
    
    loadActiveChats();
    
    alert('all chats cleared! ✅');
}

// Load admin on page load
window.addEventListener('load', () => {
    const storedAdmin = localStorage.getItem('currentAdmin');
    if (storedAdmin) {
        currentAdmin = JSON.parse(storedAdmin);
        
        // Auto login
        document.getElementById('adminLoginScreen').classList.add('hidden');
        document.getElementById('adminScreen').classList.remove('hidden');
        document.getElementById('currentAdmin').textContent = currentAdmin.username;
        
        loadActiveChats();
    }
});