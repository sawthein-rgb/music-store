// Chat API - AI Response Logic
function getChatResponse(query) {
    const q = query.toLowerCase();
    
    // View cart
    if (q.includes('cart') || q.includes('my cart') || q.includes('shopping cart')) {
        return viewCart();
    }
    
    // Checkout
    if (q.includes('checkout') || q.includes('buy now') || q.includes('purchase')) {
        return checkout();
    }
    
    // Price queries
    if (q.match(/under|less than|cheaper|below|budget|juta|ribu|million/)) {
        return handlePrice(query);
    }
    
    // Skill level
    if (q.includes('beginner') || q.includes('start') || q.includes('first time') || q.includes('pemula')) {
        return showBySkill('beginner');
    }
    
    if (q.includes('advanced') || q.includes('professional') || q.includes('pro')) {
        return showBySkill('advanced');
    }
    
    // Add to cart
    if (q.includes('add') || q.includes('buy') || q.includes('get') || q.includes('cop')) {
        return addToCart(query);
    }
    
    // Categories
    if (q.includes('guitar') && !q.includes('bass')) {
        return showCategory('guitar');
    }
    
    if (q.includes('piano') || q.includes('keyboard')) {
        return showCategory('piano');
    }
    
    if (q.includes('drum')) {
        return showCategory('drums');
    }
    
    if (q.includes('bass')) {
        return showCategory('bass');
    }
    
    if (q.includes('sax') || q.includes('saxophone')) {
        return showCategory('saxophone');
    }
    
    // Show all
    if (q.includes('all') || q.includes('everything') || q.includes('catalog') || q.includes('show me')) {
        return showAll();
    }
    
    // Connect to seller
    if (q.includes('seller') || q.includes('admin') || q.includes('talk') || q.includes('speak') || q.includes('human')) {
        return offerSellerConnection();
    }
    
    // Thanks
    if (q.includes('thank') || q.includes('terima kasih')) {
        return 'you\'re welcome! 😊 need anything else?';
    }
    
    // Bye
    if (q.includes('bye') || q.includes('later') || q.includes('see ya')) {
        return 'catch you later! keep rockin\' 🎸✨';
    }
    
    // Default
    return 'hmm, not quite sure what you mean 🤔<br><br>try asking:<br>• "show me guitars"<br>• "under 5 million"<br>• "beginner friendly"<br>• "add fender to cart"<br>• "talk to seller"';
}

// Show all products
function showAll() {
    return {
        type: 'products',
        message: 'here\'s our full collection! 🎵✨',
        products: products
    };
}

// Show by category
function showCategory(category) {
    const filtered = products.filter(p => p.category === category);
    if (filtered.length === 0) {
        return `sorry, no ${category}s in stock right now 😔`;
    }
    return {
        type: 'products',
        message: `check out these ${category}s! 🔥`,
        products: filtered
    };
}

// Show by skill level
function showBySkill(skill) {
    const filtered = products.filter(p => p.skillLevel === skill);
    if (filtered.length === 0) {
        return `no ${skill} instruments right now 😔`;
    }
    return {
        type: 'products',
        message: `perfect for ${skill}s! 💪`,
        products: filtered
    };
}

// Handle price queries
function handlePrice(query) {
    // Extract price from query (simple regex)
    const priceMatch = query.match(/(\d+)\s*(juta|million|ribu|thousand|k)/i);
    let maxPrice = 5000000; // default 5 million
    
    if (priceMatch) {
        const num = parseInt(priceMatch[1]);
        const unit = priceMatch[2].toLowerCase();
        
        if (unit.includes('juta') || unit.includes('million')) {
            maxPrice = num * 1000000;
        } else if (unit.includes('ribu') || unit.includes('thousand') || unit === 'k') {
            maxPrice = num * 1000;
        }
    }
    
    const filtered = products.filter(p => p.price <= maxPrice);
    if (filtered.length === 0) {
        return `no instruments under ${formatPrice(maxPrice)} right now 😔`;
    }
    
    return {
        type: 'products',
        message: `under ${formatPrice(maxPrice)}! 💰`,
        products: filtered
    };
}

// Add to cart
function addToCart(query) {
    // Try to find product name in query
    const q = query.toLowerCase();
    let foundProduct = null;
    
    for (let product of products) {
        if (q.includes(product.name.toLowerCase()) || 
            q.includes(product.brand.toLowerCase())) {
            foundProduct = product;
            break;
        }
    }
    
    if (!foundProduct) {
        return 'which product do you wanna add? 🤔 try "add fender" or tell me the exact name!';
    }
    
    // Add to cart
    const existing = userCart.find(item => item.id === foundProduct.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        userCart.push({
            ...foundProduct,
            quantity: 1
        });
    }
    
    // Save to localStorage
    localStorage.setItem('userCart', JSON.stringify(userCart));
    
    return `added ${foundProduct.name} to cart! 🛒✨<br><br>say "show cart" to see your items or "checkout" to buy!`;
}

// View cart
function viewCart() {
    if (userCart.length === 0) {
        return 'your cart is empty! 🛒 browse some instruments and add them! 😊';
    }
    
    let total = userCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let cartHTML = '<strong>your cart 🛒</strong><br><br>';
    
    userCart.forEach(item => {
        cartHTML += `• ${item.name} (${item.quantity}x) - ${formatPrice(item.price * item.quantity)}<br>`;
    });
    
    cartHTML += `<br><strong>total: ${formatPrice(total)}</strong><br><br>`;
    cartHTML += 'say "checkout" to complete purchase or "talk to seller" to negotiate price! 💬';
    
    return cartHTML;
}

// Checkout
function checkout() {
    if (userCart.length === 0) {
        return 'your cart is empty! add some items first 😊';
    }
    
    let total = userCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
        type: 'checkout',
        message: `ready to checkout! 💳<br><br>total: ${formatPrice(total)}<br><br>wanna talk to seller first to negotiate price? or proceed to payment?`,
        offerSeller: true
    };
}

// Offer seller connection
function offerSellerConnection() {
    return {
        type: 'offer_seller',
        message: 'sure! i can connect you to our seller 👋<br><br>they can help with:<br>• price negotiation 💰<br>• product questions 🎸<br>• custom orders 🎵<br><br>wanna chat with them now?',
        offerSeller: true
    };
}