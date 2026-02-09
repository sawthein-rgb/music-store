// App.js - User Side Logic

// Initialize cart from localStorage
if (localStorage.getItem('userCart')) {
    userCart = JSON.parse(localStorage.getItem('userCart'));
}

// Current conversation ID
let currentConversationId = null;

// Login function
function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        alert('please enter username and password! 😊');
        return;
    }
    
    // Set current user
    currentUser = {
        id: 'user_' + Date.now(),
        username: username,
        role: 'user'
    };
    
    // Save to localStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Initialize conversation
    currentConversationId = generateConversationId();
    conversations[currentConversationId] = {
        id: currentConversationId,
        userId: currentUser.id,
        userName: currentUser.username,
        type: 'ai',
        messages: [],
        status: 'active'
    };
    
    // Save conversations
    localStorage.setItem('conversations', JSON.stringify(conversations));
    
    // Show chat screen
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.remove('hidden');
    document.getElementById('currentUser').textContent = username;
    
    // Welcome message
    addMessage('ai', 'system', `yo ${username}! 👋 welcome to vibebeats! i'm your ai assistant.<br><br>what kinda music gear are you looking for? 🎸✨`);
}

// Logout function
function logout() {
    if (confirm('sure you wanna logout? 🤔')) {
        localStorage.removeItem('currentUser');
        currentUser = null;
        currentConversationId = null;
        
        // Clear chat
        document.getElementById('chatMessages').innerHTML = '';
        document.getElementById('suggestedProducts').classList.add('hidden');
        
        // Show login
        document.getElementById('chatScreen').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        
        // Clear inputs
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }
}

// Add message to chat
function addMessage(sender, senderId, content, products = null) {
    const messagesContainer = document.getElementById('chatMessages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = sender === 'ai' ? '🤖' : (sender === 'admin' ? '👨‍💼' : '😎');
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-text">${content}</div>
            <div class="message-time">${getTimestamp()}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    // Store in conversation
    if (currentConversationId && conversations[currentConversationId]) {
        conversations[currentConversationId].messages.push({
            id: 'msg_' + Date.now(),
            sender: sender,
            senderId: senderId,
            content: content,
            timestamp: new Date().toISOString()
        });
        
        // Update conversation in localStorage
        localStorage.setItem('conversations', JSON.stringify(conversations));
    }
    
    // Show products if any
    if (products && products.length > 0) {
        showProducts(products);
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addMessage('user', currentUser.id, message);
    
    // Clear input
    input.value = '';
    
    // Get AI response
    const response = getChatResponse(message);
    
    // Handle different response types
    setTimeout(() => {
        if (typeof response === 'string') {
            addMessage('ai', 'system', response);
        } else if (response.type === 'products') {
            addMessage('ai', 'system', response.message);
            showProducts(response.products);
        } else if (response.type === 'checkout' || response.type === 'offer_seller') {
            addMessage('ai', 'system', response.message);
            if (response.offerSeller) {
                showSellerButton();
            }
        }
    }, 500);
}

// Quick message buttons
function quickMessage(message) {
    document.getElementById('messageInput').value = message;
    sendMessage();
}

// Show products
function showProducts(productList) {
    const container = document.getElementById('suggestedProducts');
    container.classList.remove('hidden');
    
    const gridHTML = productList.map(product => `
        <div class="product-card">
            <div class="product-name">${product.name}</div>
            <div class="product-category">${product.category} • ${product.skillLevel}</div>
            <div class="product-price">${formatPrice(product.price)}</div>
            <button class="btn-add-cart" onclick="quickAddToCart('${product.id}')">
                add to cart 🛒
            </button>
        </div>
    `).join('');
    
    container.innerHTML = `
        <h3 style="color: var(--neon-purple); margin-bottom: 12px;">check these out! ✨</h3>
        <div class="products-grid">${gridHTML}</div>
    `;
}

// Quick add to cart
function quickAddToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existing = userCart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        userCart.push({
            ...product,
            quantity: 1
        });
    }
    
    localStorage.setItem('userCart', JSON.stringify(userCart));
    
    addMessage('ai', 'system', `added ${product.name} to cart! 🛒✨<br><br>say "show cart" to see your items!`);
}

// Show seller connection button
function showSellerButton() {
    const messagesContainer = document.getElementById('chatMessages');
    
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'message ai';
    buttonDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <button class="btn-talk-seller" onclick="connectToSeller()">
                💬 yes, connect me to seller!
            </button>
        </div>
    `;
    
    messagesContainer.appendChild(buttonDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Connect to seller
function connectToSeller() {
    if (currentConversationId && conversations[currentConversationId]) {
        // Change conversation type
        conversations[currentConversationId].type = 'seller';
        conversations[currentConversationId].needsAttention = true;
        localStorage.setItem('conversations', JSON.stringify(conversations));
        
        addMessage('ai', 'system', 'connecting you to seller... 🔄<br><br>they\'ll be with you shortly! 👋');
        
        setTimeout(() => {
            addMessage('admin', 'admin_001', 'hi there! 👋 i\'m here to help! what can i do for you? 😊');
        }, 2000);
    }
}

// Check for new messages from admin
function checkForAdminMessages() {
    if (!currentConversationId) return;
    
    const storedConversations = localStorage.getItem('conversations');
    if (storedConversations) {
        const convs = JSON.parse(storedConversations);
        if (convs[currentConversationId]) {
            const conversation = convs[currentConversationId];
            const currentMessages = conversations[currentConversationId]?.messages || [];
            
            // Check if there are new messages from admin
            if (conversation.messages.length > currentMessages.length) {
                const newMessages = conversation.messages.slice(currentMessages.length);
                newMessages.forEach(msg => {
                    if (msg.sender === 'admin') {
                        const messagesContainer = document.getElementById('chatMessages');
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'message admin';
                        
                        messageDiv.innerHTML = `
                            <div class="message-avatar">👨‍💼</div>
                            <div class="message-content">
                                <div class="message-text">${msg.content}</div>
                                <div class="message-time">${getTimestamp()}</div>
                            </div>
                        `;
                        
                        messagesContainer.appendChild(messageDiv);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });
                
                // Update local conversation
                conversations[currentConversationId] = conversation;
            }
        }
    }
}

// Poll for admin messages every 2 seconds
setInterval(checkForAdminMessages, 2000);

// Load user on page load
window.addEventListener('load', () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        
        // Check if there are conversations
        const storedConversations = localStorage.getItem('conversations');
        if (storedConversations) {
            conversations = JSON.parse(storedConversations);
            
            // Find user's active conversation
            for (let convId in conversations) {
                if (conversations[convId].userId === currentUser.id) {
                    currentConversationId = convId;
                    break;
                }
            }
        }
        
        // Auto login if user exists
        if (currentConversationId) {
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('chatScreen').classList.remove('hidden');
            document.getElementById('currentUser').textContent = currentUser.username;
            
            // Reload messages
            const conversation = conversations[currentConversationId];
            conversation.messages.forEach(msg => {
                const messagesContainer = document.getElementById('chatMessages');
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
        }
    }
});