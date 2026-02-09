// Sample Product Data
const products = [
    {
        id: 'prod_001',
        name: 'Fender Stratocaster',
        category: 'guitar',
        price: 8500000,
        skillLevel: 'intermediate',
        brand: 'Fender',
        description: 'iconic electric guitar, perfect for rock vibes 🎸',
        stock: 5
    },
    {
        id: 'prod_002',
        name: 'Yamaha F310',
        category: 'guitar',
        price: 1500000,
        skillLevel: 'beginner',
        brand: 'Yamaha',
        description: 'perfect starter acoustic, sounds great ✨',
        stock: 10
    },
    {
        id: 'prod_003',
        name: 'Gibson Les Paul',
        category: 'guitar',
        price: 25000000,
        skillLevel: 'advanced',
        brand: 'Gibson',
        description: 'legendary tone, pro level beast 🔥',
        stock: 2
    },
    {
        id: 'prod_004',
        name: 'Ibanez RG Series',
        category: 'guitar',
        price: 4500000,
        skillLevel: 'intermediate',
        brand: 'Ibanez',
        description: 'shred machine, metal vibes 🤘',
        stock: 7
    },
    {
        id: 'prod_005',
        name: 'Yamaha P-45',
        category: 'piano',
        price: 6500000,
        skillLevel: 'beginner',
        brand: 'Yamaha',
        description: 'digital piano, apartment friendly 🎹',
        stock: 4
    },
    {
        id: 'prod_006',
        name: 'Roland FP-30X',
        category: 'piano',
        price: 9500000,
        skillLevel: 'intermediate',
        brand: 'Roland',
        description: 'authentic feel, pro sound 🎼',
        stock: 3
    },
    {
        id: 'prod_007',
        name: 'Pearl Export Series',
        category: 'drums',
        price: 12000000,
        skillLevel: 'intermediate',
        brand: 'Pearl',
        description: 'full drum kit, ready to rock 🥁',
        stock: 2
    },
    {
        id: 'prod_008',
        name: 'Fender Jazz Bass',
        category: 'bass',
        price: 7500000,
        skillLevel: 'intermediate',
        brand: 'Fender',
        description: 'smooth grooves, classic tone 🎵',
        stock: 5
    },
    {
        id: 'prod_009',
        name: 'Yamaha YAS-280',
        category: 'saxophone',
        price: 15000000,
        skillLevel: 'beginner',
        brand: 'Yamaha',
        description: 'alto sax, jazzy vibes 🎷',
        stock: 3
    },
    {
        id: 'prod_010',
        name: 'Squier Affinity Strat',
        category: 'guitar',
        price: 2500000,
        skillLevel: 'beginner',
        brand: 'Squier',
        description: 'budget strat, great starter 💫',
        stock: 12
    }
];

// User Cart (stored in localStorage)
let userCart = [];

// Current User
let currentUser = null;

// Conversations Storage (simulating real-time chat)
let conversations = {};

// Format price to Indonesian Rupiah
function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(price);
}

// Get current timestamp
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// Generate conversation ID
function generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}