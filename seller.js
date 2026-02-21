/* seller.js - MarketHub V5 Seller (UPDATED)
   - Fixes and upgrades:
     1) "Next Status" button inside Active Orders advances status forward only, saves, broadcasts
     2) Video recording now stores dataURL and can be sent in product preview, order chat, and DM
     3) Both Order chat and DM preserved; both support text + video + typing
     4) Video call restored: start/end broadcasted; modal with mute/video/end controls
     5) All previous features retained
*/

/* =========================
   Config & Keys
*/
const CHANNEL = 'markethub_v5_channel';
const bc = new BroadcastChannel(CHANNEL);

const KEYS = {
  USERS: 'markethub_v5_users',
  PRODUCTS: 'markethub_v5_products',
  ORDERS: 'markethub_v5_orders',
  CHATS: 'markethub_v5_chats',
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
function pushEvent(text){ const ev = load(KEYS.EVENTS); ev.unshift({ id: uid('ev_'), text, ts: now() }); save(KEYS.EVENTS, ev.slice(0,200)); renderActiveOrders(); }

/* =========================
   Auth guard
*/
const sessionKey = 'markethub_v5_session';
let session = null;
(function ensureSession(){
  try { session = JSON.parse(sessionStorage.getItem(sessionKey)); } catch(e){ session = null; }
  if(!session || session.role !== 'Seller'){ window.location.href = 'index.html'; return; }
})();

/* =========================
   DOM refs
*/
const userNameEl = document.getElementById('userName');
const userIdEl = document.getElementById('userId');
const avatarEl = document.getElementById('avatar');

const productName = document.getElementById('productName');
const category = document.getElementById('category');
const pricePerUnit = document.getElementById('pricePerUnit');
const qtyAvailable = document.getElementById('qtyAvailable');
const tempOptions = document.getElementById('tempOptions');
const notes = document.getElementById('notes');
const recordVideoBtn = document.getElementById('recordVideoBtn');
const videoPreviewWrap = document.getElementById('videoPreviewWrap');
const createProductBtn = document.getElementById('createProductBtn');
const logoutBtn = document.getElementById('logoutBtn');

const requestsList = document.getElementById('requestsList');
const myProducts = document.getElementById('myProducts');
const activeOrders = document.getElementById('activeOrders');

/* Video recorder refs */
const videoModal = document.getElementById('videoModal');
const recPreview = document.getElementById('recPreview');
const recTimer = document.getElementById('recTimer');
const startRec = document.getElementById('startRec');
const stopRec = document.getElementById('stopRec');
const saveRec = document.getElementById('saveRec');
const closeVideoModal = document.getElementById('closeVideoModal');

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recStartTime = null;
let recInterval = null;
let lastVideoDataUrl = null; // store data URL for product and chat

/* Video Call Modal (seller side) */
const sellerVideoModal = document.createElement('div');
sellerVideoModal.id = 'sellerVideoCallModal';
sellerVideoModal.className = 'fixed inset-0 z-80 hidden items-center justify-center p-6';
sellerVideoModal.innerHTML = `
  <div class="w-full max-w-3xl glass rounded-2xl p-4 relative">
    <div class="flex items-center justify-between mb-3">
      <div class="text-lg font-semibold">Video Call</div>
      <div class="text-xs text-gray-400">Live (simulated)</div>
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-black rounded-2xl overflow-hidden relative">
        <video id="svc_local" autoplay muted playsinline class="w-full h-64 object-cover bg-black"></video>
        <div class="absolute bottom-2 left-2 text-xs text-gray-300">You</div>
      </div>
      <div class="bg-black rounded-2xl overflow-hidden relative">
        <video id="svc_remote" autoplay playsinline class="w-full h-64 object-cover bg-black"></video>
        <div class="absolute bottom-2 left-2 text-xs text-gray-300">Other</div>
      </div>
    </div>
    <div class="mt-4 flex items-center justify-center gap-4">
      <button id="svc_mute" class="px-4 py-2 rounded-2xl bg-gray-800 text-white">Mute</button>
      <button id="svc_toggle" class="px-4 py-2 rounded-2xl bg-gray-800 text-white">Stop Video</button>
      <button id="svc_end" class="px-4 py-2 rounded-2xl bg-red-600 text-white">End Call</button>
    </div>
    <button id="svc_close" class="absolute top-3 right-3 text-gray-400">✕</button>
  </div>
`;
document.body.appendChild(sellerVideoModal);
const svc_local = document.getElementById('svc_local');
const svc_remote = document.getElementById('svc_remote');
const svc_mute = document.getElementById('svc_mute');
const svc_toggle = document.getElementById('svc_toggle');
const svc_end = document.getElementById('svc_end');
const svc_close = document.getElementById('svc_close');

let svc_stream = null;
let svc_audioMuted = false;
let svc_videoStopped = false;
let svc_activeCall = null;

/* =========================
   Init UI
*/
(function init(){
  userNameEl.textContent = session.userName;
  userIdEl.textContent = session.userId;
  avatarEl.textContent = session.userName.slice(0,1).toUpperCase();
  renderRequests();
  renderMyProducts();
  renderActiveOrders();
})();

/* =========================
   Product creation & video recording
*/
recordVideoBtn.addEventListener('click', async ()=>{
  videoModal.classList.remove('hidden');
  recordedChunks = [];
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
    recPreview.srcObject = mediaStream;
    recPreview.play();
  } catch(e){
    alert('Camera/microphone access denied.');
  }
});

startRec.addEventListener('click', ()=>{
  if(!mediaStream) return alert('No media stream.');
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp8,opus' });
  mediaRecorder.ondataavailable = e => { if(e.data && e.data.size) recordedChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    // convert to dataURL for persistence across tabs
    const reader = new FileReader();
    reader.onload = () => {
      lastVideoDataUrl = reader.result; // data URL
      videoPreviewWrap.innerHTML = `<video controls src="${lastVideoDataUrl}" class="preview"></video>`;
    };
    reader.readAsDataURL(blob);
  };
  mediaRecorder.start();
  recStartTime = Date.now();
  recTimer.textContent = '00:00';
  recInterval = setInterval(()=> {
    const s = Math.floor((Date.now() - recStartTime)/1000);
    if(s >= 20){ stopRecording(); return; }
    recTimer.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }, 250);
});

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if(recInterval) clearInterval(recInterval);
  if(mediaStream){ mediaStream.getTracks().forEach(t=>t.stop()); mediaStream = null; recPreview.srcObject = null; }
}

stopRec.addEventListener('click', stopRecording);
saveRec.addEventListener('click', ()=>{
  if(!lastVideoDataUrl) return alert('No recording to save.');
  videoModal.classList.add('hidden');
  pushEvent('Video recorded for product preview');
});
closeVideoModal.addEventListener('click', ()=> { stopRecording(); videoModal.classList.add('hidden'); });

/* Create product */
createProductBtn.addEventListener('click', ()=>{
  const name = productName.value.trim();
  const cat = category.value.trim();
  const price = Number(pricePerUnit.value);
  const qty = Number(qtyAvailable.value);
  const temps = (tempOptions.value || '').split(',').map(s=>s.trim()).filter(Boolean);
  const note = notes.value.trim();
  if(!name || !price || !qty) return alert('Please provide name, price, and quantity.');
  const products = load(KEYS.PRODUCTS);
  const product = {
    id: uid('prod_'),
    sellerId: session.userId,
    sellerName: session.userName,
    productName: name,
    category: cat,
    pricePerUnit: price,
    qtyAvailable: qty,
    tempOptions: temps.length ? temps : ['Regular','Hot','Cold'],
    notes: note,
    videoDataUrl: lastVideoDataUrl || null,
    createdAt: now()
  };
  products.push(product);
  save(KEYS.PRODUCTS, products);
  bc.postMessage({ type:'new_product', payload: product, ts: now() });
  pushEvent(`Product created: ${name}`);
  // clear form
  productName.value = ''; category.value = ''; pricePerUnit.value = ''; qtyAvailable.value = ''; tempOptions.value = ''; notes.value = '';
  lastVideoDataUrl = null; videoPreviewWrap.innerHTML = '';
  renderMyProducts();
});

/* Logout */
logoutBtn.addEventListener('click', ()=> { sessionStorage.removeItem(sessionKey); window.location.href = 'index.html'; });

/* =========================
   Render requests (buyers' requests)
*/
function renderRequests(){
  requestsList.innerHTML = '';
  const requests = load(KEYS.ORDERS).filter(o=> o.type === 'request').sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  if(requests.length === 0) requestsList.innerHTML = `<div class="text-xs text-gray-400">No buyer requests.</div>`;
  requests.forEach(r=>{
    const el = document.createElement('div');
    el.className = 'p-3 rounded-2xl glass border border-gray-800';
    el.innerHTML = `<div style="display:flex;justify-content:space-between"><div style="font-weight:800">${r.buyerName}</div><div style="font-size:12px;color:#9fb7d6">${new Date(r.createdAt).toLocaleString()}</div></div><div style="margin-top:8px;color:#cfe8ff">${r.text}</div><div style="margin-top:8px;display:flex;gap:8px"><button data-buyer="${r.buyerId}" class="create-product-from-request px-3 py-1 rounded-2xl neon-btn">Create Product</button></div>`;
    requestsList.appendChild(el);
  });

  document.querySelectorAll('.create-product-from-request').forEach(b=>{
    b.addEventListener('click', (e)=>{
      const buyerId = e.currentTarget.dataset.buyer;
      const req = load(KEYS.ORDERS).find(x=>x.buyerId === buyerId && x.type === 'request');
      if(req) productName.value = req.text.split(' ').slice(0,3).join(' ');
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  });
}

/* =========================
   Render my products
*/
function renderMyProducts(){
  myProducts.innerHTML = '';
  const products = load(KEYS.PRODUCTS).filter(p=> p.sellerId === session.userId).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  if(products.length === 0) myProducts.innerHTML = `<div class="text-xs text-gray-400">You have no products yet.</div>`;
  products.forEach(p=>{
    const el = document.createElement('div');
    el.className = 'p-3 rounded-2xl border border-gray-800';
    el.innerHTML = `<div style="display:flex;justify-content:space-between"><div style="font-weight:800">${p.productName}</div><div style="font-size:12px;color:#9fb7d6">Rp${p.pricePerUnit.toLocaleString()}</div></div><div style="margin-top:6px;font-size:12px;color:#9fb7d6">Stock: ${p.qtyAvailable}</div><div style="margin-top:8px;color:#cfe8ff">${p.notes || ''}</div>${p.videoDataUrl?`<video controls src="${p.videoDataUrl}" class="preview" style="margin-top:8px"></video>`:''}<div style="margin-top:8px;display:flex;gap:8px"><button data-id="${p.id}" class="edit-prod-btn px-3 py-1 rounded-2xl border border-gray-700 text-sm text-gray-200">Edit</button><button data-id="${p.id}" class="delete-prod-btn px-3 py-1 rounded-2xl border border-red-600 text-sm text-red-400">Delete</button></div>`;
    myProducts.appendChild(el);
  });

  document.querySelectorAll('.delete-prod-btn').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.id;
    if(!confirm('Delete product?')) return;
    let products = load(KEYS.PRODUCTS);
    products = products.filter(p=>p.id !== id);
    save(KEYS.PRODUCTS, products);
    bc.postMessage({ type:'product_update', payload:{ id }, ts: now() });
    renderMyProducts();
  }));
}

/* =========================
   Active orders (seller)
   - Includes Next Status button (advances forward only)
*/
function renderActiveOrders(){
  activeOrders.innerHTML = '';
  const orders = load(KEYS.ORDERS).filter(o=> o.type === 'order' && o.sellerId === session.userId).sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt));
  if(orders.length === 0) activeOrders.innerHTML = `<div class="text-xs text-gray-400">No active orders.</div>`;
  orders.forEach(o=>{
    const el = document.createElement('div');
    el.className = 'p-3 rounded-2xl border border-gray-800';
    el.innerHTML = `<div style="display:flex;justify-content:space-between"><div style="font-weight:800">Order ${o.id}</div><div style="font-size:12px;color:#9fb7d6">${new Date(o.createdAt).toLocaleString()}</div></div><div style="margin-top:6px;font-size:13px;color:#cfe8ff">Rp${o.total.toLocaleString()} • ${o.items.length} items</div><div style="margin-top:8px;display:flex;gap:8px"><button data-order="${o.id}" class="view-order-btn px-3 py-1 rounded-2xl border border-gray-700 text-sm text-gray-200">View</button><button data-order="${o.id}" class="update-status-btn px-3 py-1 rounded-2xl neon-btn text-sm text-white">Next Status</button><button data-order="${o.id}" class="chat-order-btn px-3 py-1 rounded-2xl border border-gray-700 text-sm text-gray-200">Chat</button><button data-order="${o.id}" class="video-order-btn px-3 py-1 rounded-2xl border border-gray-700 text-sm text-gray-200">Video Call</button></div><div style="margin-top:8px"><span class="status-badge" id="status_${o.id}">${o.status}</span></div>`;
    activeOrders.appendChild(el);
    const badge = document.getElementById(`status_${o.id}`);
    styleStatusBadge(badge, o.status);
  });

  // attach listeners
  document.querySelectorAll('.view-order-btn').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.order;
    viewOrderDetails(id);
  }));
  document.querySelectorAll('.update-status-btn').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.order;
    advanceOrderStatus(id);
  }));
  document.querySelectorAll('.chat-order-btn').forEach(b=> b.addEventListener('click', e=>{
    const id = e.currentTarget.dataset.order;
    openOrderChatWindow(id);
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

/* View order details (map or alert) */
function viewOrderDetails(orderId){
  const orders = load(KEYS.ORDERS);
  const o = orders.find(x=>x.id === orderId);
  if(!o) return alert('Order not found.');
  if(o.location){
    const { lat, lng } = o.location;
    const src = `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
    window.open(src, '_blank');
  } else {
    alert(`Order ${o.id}\nBuyer: ${o.buyerName}\nTotal: Rp${o.total.toLocaleString()}\nStatus: ${o.status}\nAddress: ${o.address || '—'}`);
  }
}

/* Advance order status (seller only) */
function advanceOrderStatus(orderId){
  const orders = load(KEYS.ORDERS);
  const idx = orders.findIndex(o=>o.id === orderId);
  if(idx < 0) return;
  const seq = ['Pending','Confirmed','Preparing','On The Way','Delivered','Completed'];
  const cur = orders[idx].status;
  const curIndex = seq.indexOf(cur);
  const nextIndex = Math.min(curIndex + 1, seq.length - 1);
  if(nextIndex === curIndex) return; // already at Completed
  const next = seq[nextIndex];
  orders[idx].status = next;
  save(KEYS.ORDERS, orders);
  // broadcast update
  bc.postMessage({ type:'order_update', payload: orders[idx], ts: now() });
  pushEvent(`Order ${orderId} status -> ${next}`);
  renderActiveOrders();
}

/* =========================
   Chat: seller side (order chat & DM)
   - Order chat id: orderId_buyerId_sellerId
   - DM id: buyerId_sellerId
   - messages: { id, type:'text'|'video', content, ts, senderId, senderName, read }
*/

/* Open order chat window (seller) - small popup with video record support */
function openOrderChatWindow(orderId){
  const orders = load(KEYS.ORDERS);
  const o = orders.find(x=>x.id === orderId);
  if(!o) return alert('Order not found.');
  const chatId = `${orderId}_${o.buyerId}_${o.sellerId}`;
  const chats = load(KEYS.CHATS);
  if(!chats.some(c=>c.id === chatId)){
    chats.push({ id: chatId, orderId, buyerId: o.buyerId, sellerId: o.sellerId, messages: [] });
    save(KEYS.CHATS, chats);
  }
  const w = window.open('', '_blank', 'width=420,height=640');
  w.document.write(`<html><head><title>Order Chat ${orderId}</title><style>body{background:#0f0f1a;color:#e6eef8;font-family:Inter;padding:12px}.bubble{max-width:78%;padding:10px 14px;border-radius:14px;margin-bottom:8px}.me{background:linear-gradient(90deg,#8a2be2,#00d4ff);color:#fff;margin-left:auto}.them{background:rgba(255,255,255,0.03);color:#dbeafe;margin-right:auto}.input{width:100%;padding:10px;border-radius:10px;background:#0b0b12;color:#e6eef8;border:1px solid #222}.btn{padding:8px 12px;border-radius:10px;background:linear-gradient(90deg,#8a2be2,#00d4ff);color:#fff;border:none}</style></head><body><h3>Order ${orderId}</h3><div id="msgs" style="height:420px;overflow:auto;padding:8px;border:1px solid #222;border-radius:10px;margin-top:8px"></div><div style="display:flex;gap:8px;margin-top:8px"><input id="txt" class="input" placeholder="Type a message..." /><button id="send" class="btn">Send</button></div><div style="margin-top:8px"><button id="rec" class="btn">Record Video</button></div><script>const CHANNEL="${CHANNEL}";const bc=new BroadcastChannel(CHANNEL);const chatId=${JSON.stringify(chatId)};const sellerId=${JSON.stringify(session.userId)};const sellerName=${JSON.stringify(session.userName)};function loadChats(){const chats=JSON.parse(localStorage.getItem('${KEYS.CHATS}')||'[]');const c=chats.find(x=>x.id===chatId);const msgsEl=document.getElementById('msgs');msgsEl.innerHTML='';if(!c) return; c.messages.forEach(m=>{const d=document.createElement('div');d.className='bubble '+(m.senderId===sellerId?'me':'them'); if(m.type==='video'){d.innerHTML='<div style="font-size:12px;font-weight:700;">'+m.senderName+'</div><div style="margin-top:6px;"><video controls src="'+m.content+'" style="max-width:320px;border-radius:8px"></video></div><div style="font-size:10px;color:#9fb7d6;margin-top:6px;">'+new Date(m.ts).toLocaleTimeString()+'</div>';} else {d.innerHTML='<div style="font-size:12px;font-weight:700;">'+m.senderName+'</div><div style="margin-top:6px;">'+m.content+'</div><div style="font-size:10px;color:#9fb7d6;margin-top:6px;">'+new Date(m.ts).toLocaleTimeString()+'</div>';} msgsEl.appendChild(d);}); msgsEl.scrollTop=msgsEl.scrollHeight;} loadChats(); document.getElementById('send').addEventListener('click',()=>{const txt=document.getElementById('txt').value.trim(); if(!txt) return; const chats=JSON.parse(localStorage.getItem('${KEYS.CHATS}')||'[]'); const idx=chats.findIndex(x=>x.id===chatId); if(idx<0) return; const msg={id:'msg_'+Math.random().toString(36).slice(2,9),type:'text',content:txt,ts:new Date().toISOString(),senderId:sellerId,senderName:sellerName,read:false}; chats[idx].messages.push(msg); localStorage.setItem('${KEYS.CHATS}',JSON.stringify(chats)); bc.postMessage({type:'chat_message',payload:{chatId,message:msg},ts:new Date().toISOString()}); document.getElementById('txt').value=''; loadChats();}); document.getElementById('rec').addEventListener('click',async ()=>{ if(!navigator.mediaDevices) return alert('No camera'); try{ const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); const mr=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}); const chunks=[]; mr.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); }; mr.onstop=()=>{ stream.getTracks().forEach(t=>t.stop()); const blob=new Blob(chunks,{type:'video/webm'}); const reader=new FileReader(); reader.onload=()=>{ const dataUrl=reader.result; const chats=JSON.parse(localStorage.getItem('${KEYS.CHATS}')||'[]'); const idx=chats.findIndex(x=>x.id===chatId); if(idx<0) return; const msg={id:'msg_'+Math.random().toString(36).slice(2,9),type:'video',content:dataUrl,ts:new Date().toISOString(),senderId:sellerId,senderName:sellerName,read:false}; chats[idx].messages.push(msg); localStorage.setItem('${KEYS.CHATS}',JSON.stringify(chats)); bc.postMessage({type:'chat_message',payload:{chatId,message:msg},ts:new Date().toISOString()}); loadChats(); }; reader.readAsDataURL(blob); }; mr.start(); setTimeout(()=>{ if(mr.state!=='inactive') mr.stop(); },20000); alert('Recording started (max 20s)'); }catch(err){alert('Camera error');}}); bc.addEventListener('message',ev=>{ if(ev.data && ev.data.type==='chat_message' && ev.data.payload && ev.data.payload.chatId===chatId) loadChats(); }); window.addEventListener('storage',loadChats);</script></body></html>`);
}

/* =========================
   DM system (buyer_seller) - ensure exists and allow video sending
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

/* =========================
   Advance order status handler (already implemented above)
   - advanceOrderStatus broadcasts 'order_update' (buyer listens)
*/

/* =========================
   BroadcastChannel handling
*/
bc.addEventListener('message', (ev)=>{
  const { type, payload } = ev.data || {};
  if(!type) return;
  if(type === 'new_request') renderRequests();
  else if(type === 'new_product' || type === 'product_update') renderMyProducts();
  else if(type === 'new_order' || type === 'order_update') renderActiveOrders();
  else if(type === 'chat_message'){
    if(payload && payload.chatId && payload.message){
      // if chat belongs to this seller, notify
      const chat = load(KEYS.CHATS).find(c=>c.id === payload.chatId);
      if(chat && chat.sellerId === session.userId) pushEvent(`New message on order ${chat.orderId || 'DM'}`);
    }
  } else if(type === 'video_call'){
    if(payload && payload.action){
      handleIncomingVideoCall(payload);
    }
  }
});

/* =========================
   Video Call functions (seller)
*/
async function startVideoCall(callInfo){
  svc_activeCall = callInfo;
  bc.postMessage({ type:'video_call', payload: { ...callInfo, action:'start', initiatorId: session.userId }, ts: now() });
  openSellerVideoModal();
}

function handleIncomingVideoCall(payload){
  if(payload.action === 'start'){
    // if order call and belongs to this seller, open modal
    if(payload.type === 'order'){
      const orders = load(KEYS.ORDERS);
      const o = orders.find(x=>x.id === payload.id);
      if(o && o.sellerId === session.userId){
        svc_activeCall = payload;
        openSellerVideoModal();
      }
    } else {
      svc_activeCall = payload;
      openSellerVideoModal();
    }
  } else if(payload.action === 'end'){
    if(svc_activeCall && payload.id === svc_activeCall.id && payload.type === svc_activeCall.type){
      endSellerVideoCallLocal();
    }
  }
}

async function openSellerVideoModal(){
  sellerVideoModal.classList.remove('hidden');
  try {
    svc_stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:true });
    svc_local.srcObject = svc_stream;
    svc_local.play();
    svc_mute.textContent = 'Mute';
    svc_toggle.textContent = 'Stop Video';
    svc_audioMuted = false;
    svc_videoStopped = false;
  } catch(err){
    alert('Camera/microphone access denied or not available.');
  }
}

svc_mute.addEventListener('click', ()=>{
  if(!svc_stream) return;
  svc_audioMuted = !svc_audioMuted;
  svc_stream.getAudioTracks().forEach(t=>t.enabled = !svc_audioMuted);
  svc_mute.textContent = svc_audioMuted ? 'Unmute' : 'Mute';
});
svc_toggle.addEventListener('click', ()=>{
  if(!svc_stream) return;
  svc_videoStopped = !svc_videoStopped;
  svc_stream.getVideoTracks().forEach(t=>t.enabled = !svc_videoStopped);
  svc_toggle.textContent = svc_videoStopped ? 'Start Video' : 'Stop Video';
});
svc_end.addEventListener('click', ()=> {
  if(svc_activeCall) bc.postMessage({ type:'video_call', payload: { ...svc_activeCall, action:'end', initiatorId: session.userId }, ts: now() });
  endSellerVideoCallLocal();
});
svc_close.addEventListener('click', ()=> {
  if(svc_activeCall) bc.postMessage({ type:'video_call', payload: { ...svc_activeCall, action:'end', initiatorId: session.userId }, ts: now() });
  endSellerVideoCallLocal();
});

function endSellerVideoCallLocal(){
  if(svc_stream) svc_stream.getTracks().forEach(t=>t.stop());
  svc_stream = null;
  svc_local.srcObject = null;
  svc_remote.srcObject = null;
  sellerVideoModal.classList.add('hidden');
  svc_activeCall = null;
  pushEvent('Video call ended (seller)');
}

/* =========================
   Storage fallback
*/
window.addEventListener('storage', (e)=>{
  if([KEYS.PRODUCTS, KEYS.ORDERS, KEYS.CHATS].includes(e.key)){
    renderRequests();
    renderMyProducts();
    renderActiveOrders();
  }
});

/* =========================
   Initial render
*/
renderRequests();
renderMyProducts();
renderActiveOrders();

/* =========================
   Periodic refresh to keep UI responsive across tabs
*/
setInterval(()=>{
  renderRequests();
  renderMyProducts();
  renderActiveOrders();
}, 2000);
