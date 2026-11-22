/* ─── Gift Quest — three.js scene + app logic (person-centric) ───────────── */
const CFG = window.GIFTQUEST_CONFIG;
const rand = (v) => 'R' + v.toLocaleString('en-ZA', { maximumFractionDigits: 0 });

let state = { gifts: [], contributions: [], people: [], selectedPerson: null, selectedEvent: null, activeTab: 'wishes' };

/* ─── Data layer (n8n → Airtable, falls back to demo) ───────────────────── */
async function loadData() {
  if (CFG.N8N_BASE) {
    try {
      const res = await fetch(CFG.N8N_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'state' }) });
      let data = await res.json();
      if (Array.isArray(data)) data = data[0] || {};   // n8n responds with an array wrapper
      state.gifts = data.gifts || [];
      state.contributions = data.contributions || [];
      state.people = data.people || [];
      return;
    } catch (e) { console.warn('n8n unavailable, using demo data', e); }
  }
  state.gifts = CFG.DEMO_GIFTS.map(g => ({ ...g }));
  state.contributions = CFG.DEMO_CONTRIBUTIONS.map(c => ({ ...c }));
  state.people = CFG.PEOPLE.map(p => ({ ...p }));
}

async function saveContribution(c) {
  if (CFG.N8N_BASE) {
    try { await fetch(CFG.N8N_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'contribute', ...c }) }); }
    catch (e) { console.warn('save failed', e); }
  }
  state.contributions.push(c);
}

/* ─── Person-centric helpers ─────────────────────────────────────────────── */
// Group gifts by person+event. Each person+event combo has one unified target
// (the max of their gift prices — covers the most expensive option; minor
// fluctuations across the three options are absorbed).
function personGroups() {
  const groups = {};
  state.gifts.forEach(g => {
    const key = `${g.person}|${g.event}`;
    if (!groups[key]) groups[key] = { person: g.person, event: g.event, gifts: [], target: 0 };
    groups[key].gifts.push(g);
    groups[key].target = Math.max(groups[key].target, Number(g.price) || 0);
  });
  return Object.values(groups);
}

function groupRaised(gr) {
  return state.contributions
    .filter(c => c.personId === gr.person && c.event === gr.event && c.done)
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
}
function groupPledged(gr) {
  return state.contributions
    .filter(c => c.personId === gr.person && c.event === gr.event && !c.done)
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
}
function personName(id) {
  const p = state.people.find(x => x.id === id);
  return p ? p.name : (id || 'Someone');
}
function personEmoji(id) {
  const p = state.people.find(x => x.id === id);
  return p ? (p.emoji || '🎁') : '🎁';
}
function personEmail(id) {
  const p = state.people.find(x => x.id === id);
  return p ? p.email : '';
}

/* ─── Three.js scene ─────────────────────────────────────────────────────── */
const canvas = document.getElementById('bg');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.Fog(0x0a0a1a, 18, 55);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 7, 16);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffd9a0, 1.1);
dir.position.set(6, 12, 8);
scene.add(dir);
const accent = new THREE.PointLight(0xffd166, 1.4, 40);
accent.position.set(-6, 5, 4);
scene.add(accent);
const accent2 = new THREE.PointLight(0x74b9ff, 0.9, 40);
accent2.position.set(7, 4, -4);
scene.add(accent2);

// Ground
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(30, 64),
  new THREE.MeshStandardMaterial({ color: 0x14142e, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Stars
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 600; i++) {
  starPos.push((Math.random() - 0.5) * 90, Math.random() * 45 + 4, (Math.random() - 0.5) * 90);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.8 })));

// Name label sprite above each gift box
function makeLabel(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,10,26,0.75)';
  roundRect(ctx, 6, 6, 500, 116, 24);
  ctx.fill();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 4;
  roundRect(ctx, 6, 6, 500, 116, 24);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 54px Segoe UI, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  spr.scale.set(2.6, 0.65, 1);
  return spr;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Gift boxes — one box per PERSON (grouped), labelled with their name
const giftMeshes = [];
const giftColors = [0xffd166, 0xff6b6b, 0x74b9ff, 0x55efc4, 0xff9ff3, 0xa29bfe];
const giftGroup = new THREE.Group();
scene.add(giftGroup);

function buildGiftBoxes() {
  giftGroup.clear();
  giftMeshes.length = 0;
  const groups = personGroups();
  const n = groups.length;
  if (!n) return;
  const radius = Math.max(7, n * 1.9);
  groups.forEach((gr, i) => {
    const angle = (i / n) * Math.PI * 2;
    const col = giftColors[i % giftColors.length];
    const box = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.4, 1.6),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.15 })
    );
    box.add(body);
    const ribbon = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 1.5, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    box.add(ribbon);
    const ribbon2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.5, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    box.add(ribbon2);
    const bow = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.22, 0.07, 64, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    bow.position.y = 0.85;
    box.add(bow);

    // Progress glow ring under the box
    const raised = groupRaised(gr);
    const pct = gr.target ? Math.round((raised / gr.target) * 100) : 0;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.06, 8, 48),
      new THREE.MeshBasicMaterial({ color: pct >= 100 ? 0x00b894 : 0xffd166, transparent: true, opacity: pct >= 100 ? 1 : 0.45 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.85;
    if (pct >= 100) ring.scale.setScalar(1.25);
    box.add(ring);

    // Name label above the box
    const label = makeLabel(`${personEmoji(gr.person)} ${personName(gr.person)}`);
    label.position.y = 1.6;
    box.add(label);

    // Event tag below the label
    const evLabel = makeLabel(gr.event === 'birthday' ? '🎂 Birthday' : '🎄 Christmas');
    evLabel.scale.set(1.9, 0.45, 1);
    evLabel.position.y = -1.35;
    box.add(evLabel);

    box.position.set(Math.cos(angle) * radius, 1.1, Math.sin(angle) * radius);
    box.userData = { group: gr, baseY: 1.1, phase: Math.random() * Math.PI * 2 };
    giftMeshes.push(box);
    giftGroup.add(box);
  });
}

// Orbit controls (simple custom drag orbit — no extra deps)
let drag = false, prevX = 0, prevY = 0, orbitAngle = 0, camHeight = 7, camDist = 16;
canvas.addEventListener('pointerdown', e => { drag = true; prevX = e.clientX; prevY = e.clientY; });
window.addEventListener('pointerup', () => drag = false);
window.addEventListener('pointermove', e => {
  if (!drag) return;
  orbitAngle += (e.clientX - prevX) * 0.005;
  camHeight = Math.min(18, Math.max(3, camHeight + (e.clientY - prevY) * 0.02));
  prevX = e.clientX; prevY = e.clientY;
});
canvas.addEventListener('wheel', e => { camDist = Math.min(40, Math.max(8, camDist + e.deltaY * 0.02)); }, { passive: true });

// Raycast click on gift boxes
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
canvas.addEventListener('click', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(giftMeshes, true);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && !obj.userData.group) obj = obj.parent;
    if (obj) { selectPerson(obj.userData.group.person, obj.userData.group.event); openPanel(); }
  }
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  giftMeshes.forEach(m => {
    m.position.y = m.userData.baseY + Math.sin(t * 1.6 + m.userData.phase) * 0.15;
    m.rotation.y = t * 0.4 + m.userData.phase;
  });
  if (!drag) orbitAngle += 0.0006;
  camera.position.x = Math.cos(orbitAngle) * camDist;
  camera.position.z = Math.sin(orbitAngle) * camDist;
  camera.position.y = camHeight;
  camera.lookAt(0, 1.2, 0);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ─── UI helpers ─────────────────────────────────────────────────────────── */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function toast3d(msg) {
  const el = document.getElementById('toast3d');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1600);
}
function confetti() {
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = giftColors[i % giftColors.length].toString(16).padStart(6, '0');
    c.style.animationDuration = (2 + Math.random() * 2) + 's';
    c.style.animationDelay = (Math.random() * 0.6) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 5000);
  }
}

function openPanel() { document.getElementById('panel').classList.remove('hidden'); }
function closePanel() { document.getElementById('panel').classList.add('hidden'); }
function switchTab(tab) {
  state.activeTab = tab;
  ['wishes', 'contribute', 'wefund'].forEach(t =>
    document.getElementById('tab-' + t).style.display = t === tab ? '' : 'none');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  render();
}

function selectPerson(personId, event) {
  state.selectedPerson = personId;
  state.selectedEvent = event;
  switchTab('contribute');
}

function currentGroup() {
  return personGroups().find(g => g.person === state.selectedPerson && g.event === state.selectedEvent);
}

/* ─── Renderers ──────────────────────────────────────────────────────────── */
function render() {
  renderWishes();
  renderContribute();
  renderWefund();
  buildGiftBoxes();
}

function renderWishes() {
  const el = document.getElementById('tab-wishes');
  const groups = personGroups();
  const rows = groups.map(gr => {
    const raised = groupRaised(gr);
    const pct = gr.target ? Math.min(100, Math.round((raised / gr.target) * 100)) : 0;
    const short = Math.max(0, gr.target - raised);
    const giftList = gr.gifts.map(g =>
      `<div style="font-size:.8rem;opacity:.8;margin-top:4px">• ${g.title} <a href="${g.link}" target="_blank" rel="noopener" style="color:#74b9ff">🔗</a></div>`).join('');
    return `<div class="gift-card" onclick="selectPerson('${gr.person}','${gr.event}')">
      <div class="name">${personEmoji(gr.person)} ${personName(gr.person)} — ${gr.event === 'birthday' ? '🎂 Birthday' : '🎄 Christmas'}</div>
      <div class="price">Pool: ${rand(gr.target)} · ${gr.gifts.length} option${gr.gifts.length > 1 ? 's' : ''}</div>
      ${giftList}
      <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="meta">${pct >= 100 ? '🎉 Fully funded!' : `${pct}% funded · ${rand(short)} to go`}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<h2>🎁 Who are we spoiling?</h2>
    <p style="font-size:.8rem;opacity:.7;margin-bottom:10px">Contribute to a person's gift pool — they choose which of their listed gifts to buy with the money.</p>
    <button class="btn btn-blue" style="width:100%;margin-bottom:12px" onclick="showAddWish()">➕ Add my wish</button>
    <div id="addWishForm" style="display:none">
      <div class="field"><label>Who are you?</label><select id="wPerson">${(state.people.length ? state.people : CFG.PEOPLE).map(p => `<option value="${p.id}">${p.emoji || ''} ${p.name}</option>`).join('')}</select></div>
      <div class="field"><label>Event</label><select id="wEvent"><option value="birthday">🎂 Birthday</option><option value="christmas">🎄 Christmas</option></select></div>
      <div class="field"><label>Gift title</label><input id="wTitle" placeholder="e.g. Kindle Paperwhite"></div>
      <div class="field"><label>Price (Rands)</label><input id="wPrice" type="number" placeholder="e.g. 1000"></div>
      <div class="field"><label>Why you want it</label><textarea id="wDesc" placeholder="Your inspiration…"></textarea></div>
      <div class="field"><label>Product link (Takealot / Amazon.co.za)</label><input id="wLink" placeholder="https://…"></div>
      <div class="field"><label>Store</label><select id="wSource"><option>Takealot</option><option>Amazon.co.za</option><option>Other</option></select></div>
      <button class="btn btn-gold" style="width:100%" onclick="addWish()">✨ Add wish</button>
    </div>
    ${rows}`;
}

function showAddWish() { const f = document.getElementById('addWishForm'); f.style.display = f.style.display === 'none' ? '' : 'none'; }

async function addWish() {
  const g = {
    id: 'g' + Date.now(), person: document.getElementById('wPerson').value,
    event: document.getElementById('wEvent').value, title: document.getElementById('wTitle').value || 'Untitled gift',
    price: parseInt(document.getElementById('wPrice').value) || 0, description: document.getElementById('wDesc').value || '',
    link: document.getElementById('wLink').value || '', source: document.getElementById('wSource').value,
  };
  if (!g.price) { toast('Please enter a price in Rands'); return; }
  if (CFG.N8N_BASE) {
    try { await fetch(CFG.N8N_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add-wish', ...g }) }); }
    catch (e) { console.warn(e); }
  }
  state.gifts.push(g);
  toast('✨ Wish added to the table!');
  confetti();
  render();
}

function renderContribute() {
  const el = document.getElementById('tab-contribute');
  const gr = currentGroup();
  if (!gr) { el.innerHTML = `<h2>💸 Contribute</h2><p style="opacity:.7">Pick a person's gift box from the 🎁 Wishes tab first.</p>`; return; }
  const raised = groupRaised(gr);
  const pledged = groupPledged(gr);
  const pct = gr.target ? Math.min(100, Math.round((raised / gr.target) * 100)) : 0;
  const short = Math.max(0, gr.target - raised);
  const list = state.contributions
    .filter(c => c.personId === gr.person && c.event === gr.event)
    .map(c => `
    <div class="contrib-item ${c.done ? 'done' : ''}">
      <span class="who">${c.person || c.payerName || 'Someone'}</span>
      <span>${rand(c.amount)} ${c.done ? '✅ paid' : '⏳ pending'}</span>
    </div>`).join('');
  const payUrl = `pay.html?personId=${gr.person}&person=${encodeURIComponent(personName(gr.person))}&event=${gr.event}&target=${gr.target}&raised=${raised}`;
  el.innerHTML = `<h2>💸 Contribute to ${personName(gr.person)}'s ${gr.event === 'birthday' ? 'birthday' : 'Christmas'} fund</h2>
    <div style="opacity:.8;margin-bottom:8px;font-size:.85rem">Their wish list:
      ${gr.gifts.map(g => `<a href="${g.link}" target="_blank" rel="noopener" style="color:#74b9ff">${g.title}</a> (${rand(g.price)})`).join(' · ')}
    </div>
    <div class="stat-row"><span>Pool target</span><span class="val">${rand(gr.target)}</span></div>
    <div class="stat-row"><span>Raised (paid)</span><span class="val">${rand(raised)}</span></div>
    <div class="stat-row"><span>Pledged (awaiting payment)</span><span class="val">${rand(pledged)}</span></div>
    <div class="stat-row short"><span>Still needed</span><span class="val">${rand(short)}</span></div>
    <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="banking">
      <div class="row"><span>Bank</span><span>${CFG.BANKING.bank}</span></div>
      <div class="row"><span>Account name</span><span>${CFG.BANKING.accountName}</span></div>
      <div class="row"><span>Account no.</span><span>${CFG.BANKING.accountNumber}</span></div>
      <div class="row"><span>Branch code</span><span>${CFG.BANKING.branchCode}</span></div>
      <div class="row"><span>Reference</span><span>${CFG.BANKING.reference}</span></div>
    </div>
    <a href="${payUrl}" class="btn btn-gold" style="width:100%;margin-top:12px;text-align:center">💳 Pay with PayFast</a>
    <div class="contrib-list" style="margin-top:12px">${list || '<div style="opacity:.5;font-size:.8rem">No contributions yet — be the first!</div>'}</div>
    ${short > 0 ? `<div style="margin-top:12px;padding:10px;background:rgba(255,107,107,.15);border-radius:10px;font-size:.8rem">
      ⚠️ There's a ${rand(short)} shortfall. ${personName(gr.person)} can top up the remainder, or the group can keep contributing.</div>` : ''}`;
}

function renderWefund() {
  const el = document.getElementById('tab-wefund');
  const rows = personGroups().map(gr => {
    const raised = groupRaised(gr);
    const pct = gr.target ? Math.min(100, Math.round((raised / gr.target) * 100)) : 0;
    const short = Math.max(0, gr.target - raised);
    return `<div class="gift-card" onclick="selectPerson('${gr.person}','${gr.event}'); switchTab('contribute')">
      <div class="name">${personEmoji(gr.person)} ${personName(gr.person)} — ${gr.event === 'birthday' ? '🎂' : '🎄'}</div>
      <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="meta">${pct >= 100 ? '🎉 Fully funded — they can buy their pick!' : `${pct}% funded · ${rand(short)} to go`}</div>
    </div>`;
  }).join('');
  el.innerHTML = `<h2>🤝 Live group fund</h2>
    <p style="font-size:.8rem;opacity:.7;margin-bottom:10px">See where everyone stands. If there's a shortfall, the wisher can top it up — or email the group.</p>
    ${rows}
    <button class="btn btn-green" style="width:100%;margin-top:10px" onclick="sendWhatsApp()">📧 Email the group</button>
    <button class="btn btn-blue" style="width:100%;margin-top:8px" onclick="sendThankYou()">📸 Send thank-you photo</button>
    <div style="margin-top:10px;font-size:.75rem;opacity:.6">Notifications are sent by email from brad@grace2learn.co.za via n8n.</div>`;
}

function sendWhatsApp() {
  const gr = currentGroup();
  const msg = gr ? `🎁 Gift Quest update: ${personName(gr.person)}'s ${gr.event} fund (${rand(gr.target)}) still needs R${Math.max(0, gr.target - groupRaised(gr))}. Check the board and chip in! 🙏` : `🎁 Gift Quest update: new wishes need funding! Check the board. 🙏`;
  if (CFG.N8N_BASE) {
    fetch(CFG.N8N_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notify', message: msg }) })
      .then(() => toast('📧 Email notification sent'))
      .catch(() => toast('⚠️ Could not reach server'));
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    toast('📲 Opening WhatsApp share…');
  }
}

function sendThankYou() {
  const gr = currentGroup();
  const msg = gr ? `📸 Thank you everyone! My gift fund came together and I'm so grateful. 🎉` : `📸 Thank you everyone for the gifts! 🎉`;
  if (CFG.N8N_BASE) {
    fetch(CFG.N8N_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notify', message: msg }) })
      .then(() => toast('📧 Thank-you email sent'))
      .catch(() => toast('⚠️ Could not reach server'));
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    toast('📸 Opening WhatsApp share…');
  }
}

/* ─── Boot ───────────────────────────────────────────────────────────────── */
loadData().then(() => { render(); animate(); });
