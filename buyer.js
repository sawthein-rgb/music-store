/* buyer.js - MarketHub V5 Buyer (UPDATED)
   - Fixes and upgrades:
     1) Order status updates propagate from seller -> buyer via BroadcastChannel
     2) Video messages support in order chat and DM (type: "video" with dataURL content)
     3) Both Order-based chat and DM preserved; both support text + video + typing
     4) Video call restored: start/end broadcasted; modal with mute/video/end controls
     5) All changes keep previous features intact
*/

/* =========================
   Config & Keys
   ========================= */
const CHANNEL = 'markethub_v5_channel';
const bc = new BroadcastChannel(CHANNEL);

const KEYS = {
  USERS: 'markethub_v5_users',
  PRODUCTS: 'markethub_v5_products',
  ORDERS: 'markethub_v5_orders',
  CHATS: 'markethub_v5_chats', // contains both order chats and DMs
  PAYMENTS: 'markethub_v5_payments',
  EVENTS: 'markethub_v5_events'
};

/* =========================
   Utilities
*/
function uid(prefix='id_'){ return prefix + Math.random().toString(36).slice(2,9); }
function now(){ return new Date().toISOString(); }
function load(key){ try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){ return []; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val || [])); }
function pushEvent(text){ const ev = load(KEYS.EVENTS); ev.unshift({ id: uid('ev_'), text, ts: now() }); save(KEYS.EVENTS, ev.slice(0,200)); renderOrdersList(); }

/* =========================
   Auth guard
*/
const sessionKey = 'markethub_v5_session';
let session = null;
(function ensureSession(){
  try { session = JSON.parse(sessionStorage.getItem(sessionKey)); } catch(e){ session = null; }
  if(!session || session.role !== 'Buyer'){ window.location.href = 'index.html'; return; }
})();

/* =========================
   DOM refs
*/
const userNameEl = document.getElementById('userName');
const userIdEl = document.getElementById('userId');
const avatarEl = document.getElementById('avatar');

const requestText = document.getElementById('requestText');
const postRequestBtn = document.getElementById('postRequestBtn');
const logoutBtn = document.getElementById('logoutBtn');
const myRequestInfo = document.getElementById('myRequestInfo');
const reqTextEl = document.getElementById('reqText');
const dealStatusBadge = document.getElementById('dealStatusBadge');

const productsList = document.getElementById('productsList');
const cartList = document.getElementById('cartList');
const checkoutBtn = document.getElementById('checkoutBtn');
const shareLocationBtn = document.getElementById('shareLocationBtn');

const ordersList = document.getElementById('ordersList');

const floatingTotal = document.getElementById('floatingTotal');
const totalAmountEl = document.getElementById('totalAmount');
const viewCartBtn = document.getElementById('viewCartBtn');
const payNowBtn = document.getElementById('payNowBtn');

const checkoutModal = document.getElementById('checkoutModal');
const checkoutSummary = document.getElementById('checkoutSummary');
const buyerAddress = document.getElementById('buyerAddress');
const buyerNotes = document.getElementById('buyerNotes');
const paymentMethod = document.getElementById('paymentMethod');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const closeCheckout = document.getElementById('closeCheckout');

const orderChatModal = document.getElementById('orderChatModal');
const orderChatHeader = document.getElementById('orderChatHeader');
const orderChatStatus = document.getElementById('orderChatStatus');
const orderChatMessages = document.getElementById('orderChatMessages');
const orderChatInput = document.getElementById('orderChatInput');
const orderChatSend = document.getElementById('orderChatSend');
const closeOrderChat = document.getElementById('closeOrderChat');
const orderChatAttachVideo = document.createElement('button'); // created dynamically

const mapModal = document.getElementById('mapModal');
const mapFrameWrap = document.getElementById('mapFrameWrap');
const closeMap = document.getElementById('closeMap');

/* Video Call Modal (buyer side) */
const videoModal = document.createElement('div');
videoModal.id = 'videoCallModal';
videoModal.className = 'fixed inset-0 z-80 hidden items-center justify-center p-6';
videoModal.innerHTML = `
  <div class="w-full max-w-3xl glass rounded-2xl p-4 relative">
    <div class="flex items-center justify-between mb-3">
      <div class="text-lg font-semibold">Video Call</div>
      <div class="text-xs text-gray-400">Live (simulated)</div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-black rounded-2xl overflow-hidden relative">
        <video id="vc_local" autoplay muted playsinline class="w-full h-64 object-cover bg-black"></video>
        <div class="absolute bottom-2 left-2 text-xs text-gray-300">You</div>
      </div>
      <div class="bg-black rounded-2xl overflow-hidden relative">
        <video id="vc_remote" autoplay playsinline class="w-full h-64 object-cover bg-black"></video>
        <div class="absolute bottom-2 left-2 text-xs text-gray-300">Other</div>
      </div>
    </div>
    <div class="mt-4 flex items-center justify-center gap-4">
      <button id="vc_mute" class="px-4 py-2 rounded-2xl bg-gray-800 text-white">Mute</button>
      <button id="vc_toggle" class="px-4 py-2 rounded-2xl bg-gray-800 text-white">Stop Video</button>
      <button id="vc_end" class="px-4 py-2 rounded-2xl bg-red-600 text-white">End Call</button>
    </div>
    <button id="vc_close" class="absolute top-3 right-3 text-gray-400">✕</button>
  </div>
`;
document.body.appendChild(videoModal);
const vc_local = document.getElementById('vc_local');
const vc_remote = document.getElementById('vc_remote');
const vc_mute = document.getElementById('vc_mute');
const vc_toggle = document.getElementById('vc_toggle');
const vc_end = document.getElementById('vc_end');
const vc_close = document.getElementById('vc_close');

let vc_stream = null;
let vc_audioMuted = false;
let vc_videoStopped = false;
let vc_activeCall = null; // { type:'order'|'deal', id: orderId or dealId, initiatorId }

/* =========================
   Local state
*/
let cart = []; // { productId, sellerId, qty, tempOption, productName, pricePerUnit }
let myRequest = null;
let activeOrder = null;
let sharedLocation = null; // {lat,lng}
let activeChatKey = null; // order chat id or DM id
let dmActiveKey = null; // buyer_seller DM id
let typingTimeout = null;

/* =========================
   Init UI
*/
(function init(){
  userNameEl.textContent = session.userName;
  userIdEl.textContent = session.userId;
  avatarEl.textContent = session.userName.slice(0,1).toUpperCase();
  renderProducts();
  renderCart();
  renderOrdersList();
  renderMyRequest();
})();

/* =========================
   Request posting
*/
postRequestBtn.addEventListener('click', ()=>{
  const text = requestText.value.trim();
  if(!text) return alert('Please describe your request.');
  // ensure one request per buyer
  const requests = load(KEYS.ORDERS).filter(o=>o.buyerId === session.userId && o.type === 'request');
  if(requests.length) return alert('You already have an active request.');
  const req = { id: uid('req_'), type:'request', buyerId: session.userId, buyerName: session.userName, text, createdAt: now(), status:'Open' };
  const orders = load(KEYS.ORDERS);
  orders.push(req);
  save(KEYS.ORDERS, orders);
  bc.postMessage({ type:'new_request', payload:req, ts:now() });
  pushEvent(`Request posted: ${text}`);
  requestText.value = '';
  myRequest = req;
  renderMyRequest();
  renderOrdersList();
});

/* Logout */
logoutBtn.addEventListener('click', ()=>{
  sessionStorage.removeItem(sessionKey);
  window.location.href = 'index.html';
});

/* Render my request */
function renderMyRequest(){
  const orders = load(KEYS.ORDERS);
  myRequest = orders.find(o=>o.buyerId === session.userId && o.type === 'request') || null;
  if(!myRequest){ document.getElementById('myRequestInfo').classList.add('hidden'); return; }
  document.getElementById('myRequestInfo').classList.remove('hidden');
  reqTextEl.textContent = myRequest.text;
  updateDealBadge(myRequest.status || 'Open');
}

/* =========================
   Products rendering
*/
function renderProducts(){
  productsList.innerHTML = '';
  const products = load(KEYS.PRODUCTS).slice().sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  if(products.length === 0){
    productsList.innerHTML = `<div class="text-xs text-gray-400">No products yet. Sellers will add products.</div>`;
    return;
  }
  products.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'p-3 rounded-2xl glass border border-gray-800';
    card.innerHTML = `
      <div style="display:flex;gap:12px">
        <div style="width:72px;height:72px;border-radius:12px;background:linear-gradient(135deg,#8a2be2,#00d4ff);display:flex;align-items:center;justify-content:center;font-weight:800;color:white">${p.productName.slice(0,2).toUpperCase()}</div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between">
            <div>
              <div style="font-weight:800">${p.productName}</div>
              <div style="font-size:12px;color:#9fb7d6">${p.category || 'General'} • Seller: ${p.sellerName}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:800">Rp${formatNumber(p.pricePerUnit)}</div>
              <div style="font-size:12px;color:#9fb7d6">Stock: ${p.qtyAvailable}</div>
            </div>
          </div>
          <div style="margin-top:8px;color:#cfe8ff">${p.notes || ''}</div>
          ${p.videoDataUrl ? `<video controls src="${p.videoDataUrl}" style="margin-top:8px;width:220px;height:120px;object-fit:cover;border-radius:10px"></video>` : ''}
          <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
            <input data-id="${p.id}" type="number" min="0" value="0" style="width:80px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);color:#e6eef8" class="qty-input" />
            <select data-id="${p.id}" class="temp-select" style="padding:8px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);color:#e6eef8">
              <option value="">Temp</option>
              ${p.tempOptions && p.tempOptions.length ? p.tempOptions.map(t=>`<option value="${t}">${t}</option>`).join('') : '<option value="Regular">Regular</option>'}
            </select>
            <button data-id="${p.id}" class="add-cart-btn neon-btn">Add</button>
            <button data-seller="${p.sellerId}" data-product="${p.id}" class="ai-suggest-btn px-3 py-2 rounded-2xl border border-gray-800 text-sm text-gray-300">AI Suggest</button>
          </div>
        </div>
      </div>
    `;
    productsList.appendChild(card);
  });

  // attach listeners
  document.querySelectorAll('.add-cart-btn').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const id = e.currentTarget.dataset.id;
      const qtyInput = document.querySelector(`.qty-input[data-id="${id}"]`);
      const tempSelect = document.querySelector(`.temp-select[data-id="${id}"]`);
      const qty = Number(qtyInput.value || 0);
      const temp = tempSelect.value || '';
      if(qty <= 0) return alert('Enter quantity > 0');
      addToCart(id, qty, temp);
    });
  });

  document.querySelectorAll('.ai-suggest-btn').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const pid = e.currentTarget.dataset.product;
      aiSuggestBundle(pid);
    });
  });
}

/* Add to cart */
function addToCart(productId, qty, tempOption){
  const products = load(KEYS.PRODUCTS);
  const p = products.find(x=>x.id === productId);
  if(!p) return alert('Product not found.');
  if(qty > p.qtyAvailable) return alert('Quantity exceeds available stock.');
  const existing = cart.find(c=>c.productId === productId && c.tempOption === tempOption);
  if(existing) existing.qty += qty;
  else cart.push({ productId, sellerId: p.sellerId, productName: p.productName, pricePerUnit: p.pricePerUnit, qty, tempOption });
  renderCart();
  pushEvent(`Added to cart: ${p.productName} x${qty}`);
}

/* AI Suggest (simple bundle generator) */
function aiSuggestBundle(productId){
  const products = load(KEYS.PRODUCTS);
  const p = products.find(x=>x.id===productId);
  if(!p) return;
  if(p.qtyAvailable >= 3){
    const suggestedPrice = Math.round(p.pricePerUnit * 0.9);
    if(confirm(`AI Suggestion: Bundle 3 × ${p.productName} at Rp${formatNumber(suggestedPrice)} each. Add to cart?`)){
      addToCart(productId, 3, p.tempOptions && p.tempOptions[0] ? p.tempOptions[0] : '');
    }
  } else alert('No smart bundle available.');
}

/* Render cart */
function renderCart(){
  cartList.innerHTML = '';
  if(cart.length === 0){
    cartList.innerHTML = `<div class="text-xs text-gray-400">Cart is empty.</div>`;
    floatingTotal.classList.add('hidden');
    checkoutBtn.disabled = true;
    return;
  }
  cart.forEach((c, idx)=>{
    const row = document.createElement('div');
    row.className = 'p-2 rounded-2xl border border-gray-800 flex items-center justify-between';
    row.innerHTML = `<div>
      <div style="font-weight:700">${c.productName} ${c.tempOption ? '• '+c.tempOption : ''}</div>
      <div style="font-size:12px;color:#9fb7d6">Rp${formatNumber(c.pricePerUnit)} × ${c.qty}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <div style="font-weight:800">Rp${formatNumber(c.pricePerUnit * c.qty)}</div>
      <button data-idx="${idx}" class="remove-cart-btn px-3 py-1 rounded-2xl border border-gray-700 text-sm text-gray-200">Remove</button>
    </div>`;
    cartList.appendChild(row);
  });
  document.querySelectorAll('.remove-cart-btn').forEach(b=>b.addEventListener('click', e=>{
    const idx = Number(e.currentTarget.dataset.idx);
    cart.splice(idx,1);
    renderCart();
  }));
  updateFloatingTotal();
  checkoutBtn.disabled = false;
}

/* Floating total */
function updateFloatingTotal(){
  const total = cart.reduce((s,c)=> s + (c.pricePerUnit * c.qty), 0);
  totalAmountEl.textContent = `Rp${formatNumber(total)}`;
  floatingTotal.classList.remove('hidden');
}

/* Format number */
function formatNumber(n){ return n.toLocaleString('id-ID'); }

/* Checkout flow */
viewCartBtn.addEventListener('click', ()=> openCheckout());
payNowBtn.addEventListener('click', ()=> openCheckout());
checkoutBtn.addEventListener('click', ()=> openCheckout());

function openCheckout(){
  if(cart.length === 0) return alert('Cart empty.');
  checkoutSummary.innerHTML = cart.map(c=>`<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px dashed rgba(255,255,255,0.03)"><div>${c.productName} ${c.tempOption ? '• '+c.tempOption : ''} × ${c.qty}</div><div>Rp${formatNumber(c.pricePerUnit * c.qty)}</div></div>`).join('') + `<div style="padding:8px;display:flex;justify-content:space-between;font-weight:800">Total<div>Rp${formatNumber(cart.reduce((s,c)=>s+(c.pricePerUnit*c.qty),0))}</div></div>`;
  checkoutModal.classList.remove('hidden');
}

/* Place order */
placeOrderBtn.addEventListener('click', ()=>{
  const address = buyerAddress.value.trim();
  if(!address && !sharedLocation) return alert('Please enter address or share location.');
  const payment = paymentMethod.value;
  const notes = buyerNotes.value.trim();
  // create order per seller (group by seller)
  const grouped = {};
  cart.forEach(item=>{
    const key = item.sellerId;
    if(!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });
  const orders = load(KEYS.ORDERS);
  const payments = load(KEYS.PAYMENTS);
  Object.keys(grouped).forEach(sellerId=>{
    const items = grouped[sellerId];
    const orderId = uid('order_');
    const total = items.reduce((s,i)=> s + (i.pricePerUnit * i.qty), 0);
    const order = {
      id: orderId,
      type: 'order',
      buyerId: session.userId,
      buyerName: session.userName,
      sellerId,
      items,
      total,
      address: address || '',
      location: sharedLocation || null,
      notes,
      paymentMethod: payment,
      status: 'Pending', // Pending -> Confirmed -> Preparing -> On The Way -> Delivered -> Completed
      createdAt: now()
    };
    orders.push(order);
    // payment record (simulated)
    const pay = { id: uid('pay_'), orderId, buyerId: session.userId, sellerId, amount: total, method: payment, ts: now() };
    payments.push(pay);
    // create chat for order
    const chats = load(KEYS.CHATS);
    const chatKey = `${orderId}_${session.userId}_${sellerId}`;
    if(!chats.some(c=>c.id === chatKey)){
      chats.push({ id: chatKey, orderId, buyerId: session.userId, sellerId, messages: [] });
      save(KEYS.CHATS, chats);
    }
    save(KEYS.PAYMENTS, payments);
    bc.postMessage({ type:'new_order', payload: order, ts: now() });
    pushEvent(`Order placed: ${orderId} • Rp${formatNumber(total)}`);
  });
  save(KEYS.ORDERS, orders);
  // clear cart
  cart = [];
  renderCart();
  checkoutModal.classList.add('hidden');
  buyerAddress.value = '';
  buyerNotes.value = '';
  renderOrdersList();
});

/* Close checkout */
closeCheckout.addEventListener('click', ()=> checkoutModal.classList.add('hidden'));

/* =========================
   Orders rendering
*/
function renderOrdersList(){
  ordersList.innerHTML = '';
  const orders = load(KEYS.ORDERS).filter(o=> o.type === 'order' && o.buyerId === session.userId).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  if(orders.length === 0) ordersList.innerHTML = `<div class="text-xs text-gray-400">No orders yet.</div>`;
  orders.forEach(o=>{
    const el = document.createElement('div');
    el.className = 'p-3 rounded-2xl border border-gray-800';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:800">Order ${o.id}</div>
      <div style="font-size:12px;color:#9fb7d6">${new Date(o.createdAt).toLocaleString()}</div>
    </div>
    <div style="margin-top:8px;font-size:13px;color:#cfe8ff">Total: Rp${formatNumber(o.total)} • ${o.items.length} items</div>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button data-order="${o.id}" class="open-order-btn px-3 py-1 rounded-2xl border border-gray-700 text-sm text-gray-200">Details</button>
      <button data-order="${o.id}" class="chat-order-btn px-3 py-1 rounded-2xl neon-btn text-sm text-white">Chat</button>
      <button data-order="${o.id}" class="video-order-btn px-3 py-1 rounded-2xl border border-gray-700 text-sm text-gray-200">Video Call</button>
    </div>
    <div style="margin-top:8px"><span class="status-badge" id="status_${o.id}">${o.status}</span></div>`;
    ordersList.appendChild(el);
    // style status badge
    const badge = document.getElementById(`status_${o.id}`);
    styleStatusBadge(badge, o.status);
  });

  document.querySelectorAll('.open-order-btn').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.order;
    openOrderDetails(id);
  }));
  document.querySelectorAll('.chat-order-btn').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.order;
    openOrderChat(id);
  }));
  document.querySelectorAll('.video-order-btn').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.order;
    startVideoCall({ type:'order', id, initiatorId: session.userId });
  }));
}

/* Style status badge */
function styleStatusBadge(el, status){
  if(!el) return;
  el.className = 'status-badge';
  if(status === 'Pending') el.style.background = 'rgba(255,255,255,0.03)';
  else if(status === 'Confirmed') el.style.background = 'linear-gradient(90deg,#ffd166,#ffb86b)';
  else if(status === 'Preparing') el.style.background = 'linear-gradient(90deg,#ffb86b,#ffd166)';
  else if(status === 'On The Way') el.style.background = 'linear-gradient(90deg,#39ff14,#7cff5a)';
  else if(status === 'Delivered') el.style.background = 'linear-gradient(90deg,#00d4ff,#8a2be2)';
  else if(status === 'Completed') el.style.background = 'linear-gradient(90deg,#8a2be2,#00d4ff)';
  el.style.color = '#000';
}

/* Open order details (map preview or alert) */
function openOrderDetails(orderId){
  const orders = load(KEYS.ORDERS);
  const o = orders.find(x=>x.id === orderId);
  if(!o) return alert('Order not found.');
  if(o.location){
    const { lat, lng } = o.location;
    const src = `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
    mapFrameWrap.innerHTML = `<iframe width="100%" height="100%" frameborder="0" src="${src}"></iframe>`;
    mapModal.classList.remove('hidden');
  } else {
    alert(`Order ${orderId}\nAddress: ${o.address || '—'}\nTotal: Rp${formatNumber(o.total)}\nStatus: ${o.status}`);
  }
}

/* Map modal close */
closeMap.addEventListener('click', ()=> mapModal.classList.add('hidden'));

/* =========================
   Order Chat (order-based)
   - messages: { id, type: 'text'|'video', content: text or dataURL, ts, senderId, senderName, read }
*/
function openOrderChat(orderId){
  const chats = load(KEYS.CHATS);
  const chat = chats.find(c=>c.orderId === orderId && c.buyerId === session.userId);
  if(!chat) return alert('Chat not available.');
  activeChatKey = chat.id;
  activeOrder = load(KEYS.ORDERS).find(o=>o.id === orderId);
  orderChatHeader.textContent = `Order ${orderId} • ${activeOrder.items.length} items`;
  orderChatStatus.textContent = activeOrder.status;
  orderChatModal.classList.remove('hidden');
  // attach video attach button if not present
  if(!orderChatAttachVideo.id){
    orderChatAttachVideo.id = 'orderAttachVideo';
    orderChatAttachVideo.className = 'px-3 py-2 rounded-2xl border border-gray-800 text-sm text-gray-200';
    orderChatAttachVideo.textContent = 'Attach Video';
    orderChatAttachVideo.addEventListener('click', ()=> recordAndSendVideoMessage(activeChatKey));
    orderChatModal.querySelector('.mt-3').insertBefore(orderChatAttachVideo, orderChatModal.querySelector('.mt-3').children[0]);
  }
  renderOrderChatMessages();
}

/* Send order chat message (text) */
orderChatSend.addEventListener('click', sendOrderChatMessage);
orderChatInput.addEventListener('keydown', (e)=>{
  bc.postMessage({ type:'typing', payload:{ chatId: activeChatKey, senderId: session.userId }, ts:now() });
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendOrderChatMessage(); }
});

function sendOrderChatMessage(){
  const text = orderChatInput.value.trim();
  if(!text || !activeChatKey) return;
  const chats = load(KEYS.CHATS);
  const idx = chats.findIndex(c=>c.id === activeChatKey);
  if(idx < 0) return;
  const msg = { id: uid('msg_'), type:'text', content: text, ts: now(), senderId: session.userId, senderName: session.userName, read: false };
  chats[idx].messages.push(msg);
  save(KEYS.CHATS, chats);
  bc.postMessage({ type:'chat_message', payload:{ chatId: activeChatKey, message: msg }, ts: now() });
  orderChatInput.value = '';
  renderOrderChatMessages();
}

/* Record and send video message (order chat or DM)
   - Uses getUserMedia, records up to 20s, converts to dataURL and sends as type:'video'
*/
async function recordAndSendVideoMessage(chatId){
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert('Camera not available.');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks = [];
    mr.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(t=>t.stop());
      const blob = new Blob(chunks, { type: 'video/webm' });
      // convert to dataURL for persistence across tabs
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        // create message
        const chats = load(KEYS.CHATS);
        const idx = chats.findIndex(c=>c.id === chatId);
        if(idx < 0) return alert('Chat missing.');
        const msg = { id: uid('msg_'), type:'video', content: dataUrl, ts: now(), senderId: session.userId, senderName: session.userName, read: false };
        chats[idx].messages.push(msg);
        save(KEYS.CHATS, chats);
        bc.postMessage({ type:'chat_message', payload:{ chatId, message: msg }, ts: now() });
        // refresh UI if active
        if(activeChatKey === chatId) renderOrderChatMessages();
      };
      reader.readAsDataURL(blob);
    };
    mr.start();
    // auto-stop after 20s
    setTimeout(()=> { if(mr.state !== 'inactive') mr.stop(); }, 20000);
    alert('Recording started. It will auto-stop after 20 seconds. Click OK to continue.');
  } catch(err){
    console.error(err);
    alert('Unable to access camera/microphone.');
  }
}

/* Render order chat messages */
function renderOrderChatMessages(){
  orderChatMessages.innerHTML = '';
  if(!activeChatKey) return;
  const chats = load(KEYS.CHATS);
  const chat = chats.find(c=>c.id === activeChatKey);
  if(!chat) return;
  chat.messages.forEach(m=>{
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = m.senderId === session.userId ? 'flex-end' : 'flex-start';
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (m.senderId === session.userId ? 'me' : 'them');
    if(m.type === 'video'){
      bubble.innerHTML = `<div style="font-size:12px;font-weight:700">${m.senderName}</div><div style="margin-top:6px"><video controls src="${m.content}" style="max-width:320px;border-radius:8px"></video></div><div style="font-size:10px;color:#9fb7d6;margin-top:6px">${new Date(m.ts).toLocaleTimeString()}</div>`;
    } else {
      bubble.innerHTML = `<div style="font-size:12px;font-weight:700">${m.senderName}</div><div style="margin-top:6px">${escapeHtml(m.content)}</div><div style="font-size:10px;color:#9fb7d6;margin-top:6px">${new Date(m.ts).toLocaleTimeString()}</div>`;
    }
    div.appendChild(bubble);
    orderChatMessages.appendChild(div);
  });
  orderChatMessages.scrollTop = orderChatMessages.scrollHeight;
}

/* Close chat */
closeOrderChat.addEventListener('click', ()=> { orderChatModal.classList.add('hidden'); activeChatKey = null; activeOrder = null; });

/* =========================
   DM system (buyer_seller)
   - Keep existing DM functionality; support text + video + typing
*/
function ensureDM(buyerId, sellerId){
  const chats = load(KEYS.CHATS);
  const dmId = `${buyerId}_${sellerId}`;
  let dm = chats.find(c=>c.id === dmId && !c.orderId);
  if(!dm){
    dm = { id: dmId, buyerId, sellerId, messages: [] };
    chats.push(dm);
    save(KEYS.CHATS, chats);
  }
  return dm.id;
}

/* Open DM window (buyer side) - small popup */
function openDMWindow(sellerId, sellerName){
  const dmId = ensureDM(session.userId, sellerId);
  const w = window.open('', '_blank', 'width=420,height=640');
  w.document.write(`<html><head><title>DM — ${dmId}</title><style>body{background:#0f0f1a;color:#e6eef8;font-family:Inter;padding:12px}.bubble{max-width:78%;padding:10px 14px;border-radius:14px;margin-bottom:8px}.me{background:linear-gradient(90deg,#8a2be2,#00d4ff);color:#fff;margin-left:auto}.them{background:rgba(255,255,255,0.03);color:#dbeafe;margin-right:auto}.input{width:100%;padding:10px;border-radius:10px;background:#0b0b12;color:#e6eef8;border:1px solid #222}.btn{padding:8px 12px;border-radius:10px;background:linear-gradient(90deg,#8a2be2,#00d4ff);color:#fff;border:none}</style></head><body><h3>DM with ${sellerName}</h3><div id="msgs" style="height:420px;overflow:auto;padding:8px;border:1px solid #222;border-radius:10px;margin-top:8px;"></div><div style="display:flex;gap:8px;margin-top:8px"><input id="txt" class="input" placeholder="Type a message..." /><button id="send" class="btn">Send</button></div><div style="margin-top:8px"><button id="rec" class="btn">Record Video</button></div><script>const CHANNEL="${CHANNEL}";const bc=new BroadcastChannel(CHANNEL);const chatId=${JSON.stringify(dmId)};const buyerId=${JSON.stringify(session.userId)};const buyerName=${JSON.stringify(session.userName)};function loadChats(){const chats=JSON.parse(localStorage.getItem('${KEYS.CHATS}')||'[]');const c=chats.find(x=>x.id===chatId);const msgsEl=document.getElementById('msgs');msgsEl.innerHTML='';if(!c) return; c.messages.forEach(m=>{const d=document.createElement('div');d.className='bubble '+(m.senderId===buyerId?'me':'them'); if(m.type==='video'){d.innerHTML='<div style="font-size:12px;font-weight:700;">'+m.senderName+'</div><div style="margin-top:6px;"><video controls src="'+m.content+'" style="max-width:320px;border-radius:8px"></video></div><div style="font-size:10px;color:#9fb7d6;margin-top:6px;">'+new Date(m.ts).toLocaleTimeString()+'</div>';} else {d.innerHTML='<div style="font-size:12px;font-weight:700;">'+m.senderName+'</div><div style="margin-top:6px;">'+m.content+'</div><div style="font-size:10px;color:#9fb7d6;margin-top:6px;">'+new Date(m.ts).toLocaleTimeString()+'</div>';} msgsEl.appendChild(d);}); msgsEl.scrollTop=msgsEl.scrollHeight;} loadChats(); document.getElementById('send').addEventListener('click',()=>{const txt=document.getElementById('txt').value.trim(); if(!txt) return; const chats=JSON.parse(localStorage.getItem('${KEYS.CHATS}')||'[]'); const idx=chats.findIndex(x=>x.id===chatId); if(idx<0) return; const msg={id:'msg_'+Math.random().toString(36).slice(2,9),type:'text',content:txt,ts:new Date().toISOString(),senderId:buyerId,senderName:buyerName,read:false}; chats[idx].messages.push(msg); localStorage.setItem('${KEYS.CHATS}',JSON.stringify(chats)); bc.postMessage({type:'chat_message',payload:{chatId,message:msg},ts:new Date().toISOString()}); document.getElementById('txt').value=''; loadChats();}); document.getElementById('rec').addEventListener('click',async ()=>{ if(!navigator.mediaDevices) return alert('No camera'); try{ const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); const mr=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}); const chunks=[]; mr.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); }; mr.onstop=()=>{ stream.getTracks().forEach(t=>t.stop()); const blob=new Blob(chunks,{type:'video/webm'}); const reader=new FileReader(); reader.onload=()=>{ const dataUrl=reader.result; const chats=JSON.parse(localStorage.getItem('${KEYS.CHATS}')||'[]'); const idx=chats.findIndex(x=>x.id===chatId); if(idx<0) return; const msg={id:'msg_'+Math.random().toString(36).slice(2,9),type:'video',content:dataUrl,ts:new Date().toISOString(),senderId:buyerId,senderName:buyerName,read:false}; chats[idx].messages.push(msg); localStorage.setItem('${KEYS.CHATS}',JSON.stringify(chats)); bc.postMessage({type:'chat_message',payload:{chatId,message:msg},ts:new Date().toISOString()}); loadChats(); }; reader.readAsDataURL(blob); }; mr.start(); setTimeout(()=>{ if(mr.state!=='inactive') mr.stop(); },20000); alert('Recording started (max 20s)'); }catch(err){alert('Camera error');}}); bc.addEventListener('message',ev=>{ if(ev.data && ev.data.type==='chat_message' && ev.data.payload && ev.data.payload.chatId===chatId) loadChats(); }); window.addEventListener('storage',loadChats);</script></body></html>`);
}

/* =========================
   Typing indicator handling (order chat & DM)
*/
bc.addEventListener('message', (ev)=>{
  const { type, payload } = ev.data || {};
  if(type === 'typing'){
    if(!payload) return;
    // show typing indicator if matches active chat
    if(payload.chatId === activeChatKey || payload.chatId === dmActiveKey){
      const el = document.getElementById('typingIndicator');
      if(el) el.classList.remove('hidden');
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(()=> { if(el) el.classList.add('hidden'); }, 1200);
    }
  }
});

/* =========================
   BroadcastChannel handling for other events
*/
bc.addEventListener('message', (ev)=>{
  const { type, payload } = ev.data || {};
  if(!type) return;
  if(type === 'product_update' || type === 'new_product') renderProducts();
  else if(type === 'new_order' || type === 'order_update') {
    // update orders list and if order belongs to this buyer update UI
    renderOrdersList();
    if(payload && payload.id){
      // if order updated and belongs to me, update badge and chat header
      if(payload.buyerId === session.userId){
        // update status badge
        const badge = document.getElementById(`status_${payload.id}`);
        if(badge) styleStatusBadge(badge, payload.status);
        // if activeOrder matches, update status text
        if(activeOrder && activeOrder.id === payload.id){
          orderChatStatus.textContent = payload.status;
        }
      }
    }
  } else if(type === 'chat_message'){
    if(payload && payload.chatId && payload.message){
      // if active chat, render
      if(activeChatKey === payload.chatId) renderOrderChatMessages();
      // if DM window open in this tab? we can't detect other windows; push event
      pushEvent(`New message on chat`);
    }
  } else if(type === 'video_call'){
    // handle incoming call start/end
    if(payload && payload.action){
      handleIncomingVideoCall(payload);
    }
  }
});

/* =========================
   Storage fallback
*/
window.addEventListener('storage', (e)=>{
  if([KEYS.PRODUCTS, KEYS.ORDERS, KEYS.CHATS].includes(e.key)){
    renderProducts();
    renderOrdersList();
    renderOrderChatMessages();
  }
});

/* =========================
   Video Call functions
*/
async function startVideoCall(callInfo){
  // callInfo: { type:'order'|'deal', id, initiatorId }
  vc_activeCall = callInfo;
  // broadcast start
  bc.postMessage({ type:'video_call', payload: { ...callInfo, action:'start', initiatorId: session.userId }, ts: now() });
  openVideoModal();
}

function handleIncomingVideoCall(payload){
  // payload: { type, id, action, initiatorId }
  if(payload.action === 'start'){
    // show incoming notification and auto-open modal for buyer if relevant
    if(payload.type === 'order'){
      // if this order belongs to me (buyer)
      const orders = load(KEYS.ORDERS);
      const o = orders.find(x=>x.id === payload.id);
      if(o && o.buyerId === session.userId){
        vc_activeCall = payload;
        openVideoModal();
      }
    } else {
      // deals not implemented separately; open if initiator is other party
      openVideoModal();
    }
  } else if(payload.action === 'end'){
    // close modal if active and matches
    if(vc_activeCall && payload.id === vc_activeCall.id && payload.type === vc_activeCall.type){
      endVideoCallLocal();
    }
  }
}

async function openVideoModal(){
  videoModal.classList.remove('hidden');
  try {
    vc_stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
    vc_local.srcObject = vc_stream;
    vc_local.play();
    vc_mute.textContent = 'Mute';
    vc_toggle.textContent = 'Stop Video';
    vc_audioMuted = false;
    vc_videoStopped = false;
  } catch(err){
    alert('Camera/microphone access denied or not available.');
  }
}

vc_mute.addEventListener('click', ()=>{
  if(!vc_stream) return;
  vc_audioMuted = !vc_audioMuted;
  vc_stream.getAudioTracks().forEach(t=>t.enabled = !vc_audioMuted);
  vc_mute.textContent = vc_audioMuted ? 'Unmute' : 'Mute';
});
vc_toggle.addEventListener('click', ()=>{
  if(!vc_stream) return;
  vc_videoStopped = !vc_videoStopped;
  vc_stream.getVideoTracks().forEach(t=>t.enabled = !vc_videoStopped);
  vc_toggle.textContent = vc_videoStopped ? 'Start Video' : 'Stop Video';
});
vc_end.addEventListener('click', ()=> {
  // broadcast end
  if(vc_activeCall) bc.postMessage({ type:'video_call', payload: { ...vc_activeCall, action:'end', initiatorId: session.userId }, ts: now() });
  endVideoCallLocal();
});
vc_close.addEventListener('click', ()=> {
  if(vc_activeCall) bc.postMessage({ type:'video_call', payload: { ...vc_activeCall, action:'end', initiatorId: session.userId }, ts: now() });
  endVideoCallLocal();
});

function endVideoCallLocal(){
  if(vc_stream) vc_stream.getTracks().forEach(t=>t.stop());
  vc_stream = null;
  vc_local.srcObject = null;
  vc_remote.srcObject = null;
  videoModal.classList.add('hidden');
  vc_activeCall = null;
  pushEvent('Video call ended');
}

/* =========================
   Helpers
*/
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

/* =========================
   Update deal badge helper
*/
function updateDealBadge(status){
  dealStatusBadge.textContent = status;
  if(status === 'Pending') dealStatusBadge.style.background = 'rgba(255,255,255,0.03)';
  else if(status === 'Confirmed') dealStatusBadge.style.background = 'linear-gradient(90deg,#ffd166,#ffb86b)';
  else if(status === 'Preparing') dealStatusBadge.style.background = 'linear-gradient(90deg,#ffb86b,#ffd166)';
  else if(status === 'On The Way') dealStatusBadge.style.background = 'linear-gradient(90deg,#39ff14,#7cff5a)';
  else if(status === 'Delivered') dealStatusBadge.style.background = 'linear-gradient(90deg,#00d4ff,#8a2be2)';
  else dealStatusBadge.style.background = 'linear-gradient(90deg,#8a2be2,#00d4ff)';
}

/* =========================
   Geolocation
*/
shareLocationBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation) return alert('Geolocation not supported.');
  shareLocationBtn.textContent = 'Sharing...';
  navigator.geolocation.getCurrentPosition(pos=>{
    sharedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    shareLocationBtn.textContent = 'Location Shared';
    pushEvent('Location shared for delivery');
  }, err=>{
    alert('Unable to get location.');
    shareLocationBtn.textContent = 'Share Location';
  }, { enableHighAccuracy:true, timeout:10000 });
});

/* =========================
   Initial render calls
*/
renderMyRequest();
renderProducts();
renderCart();
renderOrdersList();
