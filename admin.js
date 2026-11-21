const V = window.FB_VERSION, base = 'https://www.gstatic.com/firebasejs/' + V + '/';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const A = n => /^https?:/.test(n) ? n : 'assets/' + n;
const TOWN_PLACES = {
  Syokimau: ['Katani', 'Gateway Mall', 'SGR Area', 'Mombasa Road', 'Quarry Road', 'Mwananchi', 'Parliament'],
  Kitengela: ['Kitengela Town', 'Milimani', 'New Valley', 'Yukos', 'Chuna', 'Noonkopir', 'Acacia', 'Kyangombe']
};
/* Photos go to Cloudinary (free) instead of Firebase Storage (needs the paid Blaze plan). */
const CLOUD_NAME = 'fqyfkdbf', UPLOAD_PRESET = 'Properties';
async function uploadPhoto(blob) {
  const form = new FormData();
  form.append('file', blob);
  form.append('upload_preset', UPLOAD_PRESET);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 60000);
  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUD_NAME + '/image/upload', { method: 'POST', body: form, signal: ctl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Photo upload failed: ' + ((data.error && data.error.message) || res.status));
    return data.secure_url;
  } catch (x) {
    throw new Error(x.name === 'AbortError' ? 'Photo upload timed out. Check your internet and try again.' : x.message);
  } finally { clearTimeout(timer); }
}
let listings = [], type = 'rent', editing = null, imgs = [], fb = null;
const log = (m, add) => { $('log').textContent = add ? $('log').textContent + '\n' + m : m; };

/* ---------- Firebase ---------- */
async function startFirebase() {
  if (!window.fbConfigured()) { $('login-msg').textContent = 'Firebase is not set up yet. Open firebase-config.js, paste your project settings, then reload (see FIREBASE-SETUP.md).'; $('login').hidden = true; return; }
  try {
    const [app, auth, fs] = await Promise.all(['app', 'auth', 'firestore'].map(m => import(base + 'firebase-' + m + '.js')));
    const a = app.initializeApp(window.FIREBASE_CONFIG);
    fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
    fb.A.onAuthStateChanged(fb.auth, onUser);
  } catch (e) { $('login-err').textContent = 'Could not load Firebase: ' + e.message; }
}
async function onUser(u) {
  $('login-box').hidden = !!u; $('bar').hidden = !u; $('app').hidden = !u;
  if (!u) return;
  $('who').textContent = u.email;
  await refresh();
}
async function refresh() {
  try {
    const snap = await fb.F.getDocs(fb.F.collection(fb.db, 'listings'));
    listings = snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    $('seed').hidden = listings.length > 0; renderList(); fillTowns();
  } catch (e) { log('Could not read listings: ' + e.message); }
}
$('login').onsubmit = async e => {
  e.preventDefault(); $('login-err').textContent = '';
  try { await fb.A.signInWithEmailAndPassword(fb.auth, $('email').value.trim(), $('password').value); }
  catch (x) { $('login-err').textContent = /invalid|wrong|user-not-found/i.test(x.code + x.message) ? 'Wrong email or password.' : x.message; }
};
$('signout').onclick = () => fb.A.signOut(fb.auth);
$('seed').onclick = async () => {
  try {
    log('Importing…');
    const cur = await (await fetch('listings.json')).json();
    for (let i = 0; i < cur.length; i++) await fb.F.setDoc(fb.F.doc(fb.db, 'listings', cur[i].id), { ...clean(cur[i]), order: i });
    log('✓ Imported ' + cur.length + ' listings.'); await refresh();
  } catch (e) { log('Import failed: ' + e.message); }
};
const clean = o => JSON.parse(JSON.stringify(o));

/* ---------- images ---------- */
function toWebp(file) {
  return new Promise((res, rej) => {
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
      cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      cv.toBlob(b => { URL.revokeObjectURL(u); b ? res(b) : rej(new Error('Could not convert ' + file.name)); }, 'image/webp', 0.82);
    };
    im.onerror = () => rej(new Error('Could not read ' + file.name));
    im.src = u;
  });
}
function renderThumbs() {
  $('thumbs').innerHTML = imgs.map((m, i) => `<div class="thumb">${i === 0 ? '<span class="cover">Cover</span>' : ''}<img src="${esc(m.url)}" alt=""><div class="tb">${i ? `<button type="button" data-main="${i}">Cover</button>` : ''}<button type="button" data-rm="${i}">Remove</button></div></div>`).join('');
}
$('files').onchange = async e => {
  for (const f of e.target.files) { try { const blob = await toWebp(f); imgs.push({ blob, url: URL.createObjectURL(blob) }); } catch (x) { log(x.message); } }
  e.target.value = ''; renderThumbs();
};
$('thumbs').onclick = e => {
  const m = e.target.closest('[data-main]'), r = e.target.closest('[data-rm]');
  if (m) imgs.unshift(imgs.splice(+m.dataset.main, 1)[0]);
  if (r) imgs.splice(+r.dataset.rm, 1);
  renderThumbs();
};

/* ---------- form ---------- */
function fillTowns(sel) {
  const cur = $('town').value;
  const t = [...new Set([...Object.keys(TOWN_PLACES), ...listings.map(x => x.location)])].sort();
  $('town').innerHTML = t.map(x => `<option>${esc(x)}</option>`).join('') + '<option value="__other">Other…</option>';
  if (sel) { if (t.includes(sel)) $('town').value = sel; else { $('town').value = '__other'; $('town-other').value = sel; } }
  else if (t.includes(cur) || cur === '__other') $('town').value = cur;
  townChanged();
}
function townChanged(checked = []) {
  const t = $('town').value, pl = TOWN_PLACES[t] || [];
  $('town-other-w').hidden = t !== '__other'; $('places-w').hidden = !pl.length;
  $('places').innerHTML = pl.map(p => `<label><input type="checkbox" value="${esc(p)}" ${checked.includes(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('');
}
$('town').onchange = () => townChanged();
function syncCat() {
  const c = $('cat').value;
  $('beds-w').hidden = c !== 'house'; $('size-w').hidden = c === 'house';
  $('price-l').textContent = type === 'rent' ? 'Price per month (KES)' : 'Price (KES)';
}
$('cat').onchange = syncCat;
document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; document.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x === b)); syncCat(); });
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
function build() {
  const town = $('town').value === '__other' ? $('town-other').value.trim() : $('town').value;
  const id = editing ? editing.id : (() => { let b = slug($('title').value + '-' + town) || 'property', n = b, i = 2; while (listings.some(x => x.id === n)) n = b + '-' + i++; return n; })();
  const o = Object.assign({}, editing || {}, { id, title: $('title').value.trim(), location: town, type, category: $('cat').value, price: Number($('price').value) });
  const set = (k, v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete o[k]; else o[k] = v; };
  set('priceMax', $('pmax').value ? Number($('pmax').value) : '');
  set('priceNote', $('pnote').value.trim());
  const bd = $('beds').value.trim();
  set('beds', o.category === 'house' && bd ? (/^\d+$/.test(bd) ? Number(bd) : bd) : '');
  set('size', o.category === 'house' ? (editing && editing.size) || '' : $('size').value.trim());
  set('areas', [...$('places').querySelectorAll('input:checked')].map(i => i.value));
  o.description = $('desc').value.trim();
  if (!editing) o.order = Math.min(0, ...listings.map(x => x.order ?? 0)) - 1;   // newest first
  return o;
}
function validate() {
  if (!$('title').value.trim() || !$('desc').value.trim() || !$('price').value) return 'Fill in the title, price and description.';
  if ($('town').value === '__other' && !$('town-other').value.trim()) return 'Enter the town name.';
  if (!imgs.length) return 'Add at least one photo.';
  return '';
}
function reset() {
  editing = null; imgs = []; $('f').reset(); type = 'rent';
  document.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x.dataset.t === 'rent'));
  fillTowns(); syncCat(); renderThumbs(); $('form-title').textContent = 'New property'; $('cancel').hidden = true; $('publish').textContent = 'Publish property';
}
$('cancel').onclick = () => { reset(); log(''); };

/* ---------- publish ---------- */
$('f').onsubmit = async e => {
  e.preventDefault();
  const v = validate(); if (v) return log(v);
  const o = build(); $('publish').disabled = true;
  try {
    const urls = [];
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].blob) {
        log(`Uploading photo ${i + 1} of ${imgs.length}…`);
        urls.push(await uploadPhoto(imgs[i].blob));
      } else urls.push(imgs[i].name);
    }
    o.image = urls[0]; if (urls.length > 1) o.images = urls; else delete o.images;
    await fb.F.setDoc(fb.F.doc(fb.db, 'listings', o.id), clean(o));
    await refresh(); reset(); log('✓ Published. It is live on the website now.');
  } catch (x) { log('Failed: ' + x.message + (/permission/i.test(x.message) ? '\nCheck that your email is in the Firestore rules.' : '')); }
  $('publish').disabled = false;
};

/* ---------- list ---------- */
function renderList() {
  const n = k => listings.filter(x => (x.category || 'house') === k).length;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('k-total', listings.length); set('k-tab', listings.length);
  set('k-rent', listings.filter(x => x.type === 'rent').length); set('k-sale', listings.filter(x => x.type === 'sale').length);
  set('k-house', n('house')); set('k-godown', n('godown')); set('k-land', n('land'));
  $('list').innerHTML = listings.map(x => `<tr><td><img src="${esc(A(x.image))}" alt=""></td><td><b>${esc(x.title)}</b></td><td>${esc(x.location)}${x.areas && x.areas.length ? ' › ' + esc(x.areas.join(', ')) : ''}</td><td><span class="tag ${x.type}">${x.type === 'sale' ? 'Sale' : 'Rent'}</span></td><td>KES ${Number(x.price).toLocaleString('en-KE')}${x.priceMax ? ' – ' + Number(x.priceMax).toLocaleString('en-KE') : ''}${x.type === 'rent' ? ' / mo' : ''}</td><td><div class="rowbtns"><button type="button" data-edit="${esc(x.id)}">Edit</button><button type="button" class="del" data-del="${esc(x.id)}">Delete</button></div></td></tr>`).join('');
  $('list-empty').hidden = listings.length > 0;
}
function showTab(t) {
  $('tab-add').hidden = t !== 'add'; $('tab-manage').hidden = t !== 'manage';
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
}
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));
$('list').onclick = async e => {
  const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
  if (ed) {
    const x = listings.find(v => v.id === ed.dataset.edit); if (!x) return;
    reset(); editing = x; type = x.type;
    document.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === type));
    $('title').value = x.title; $('cat').value = x.category || 'house'; fillTowns(x.location); townChanged(x.areas || []); syncCat();
    $('price').value = x.price; $('pmax').value = x.priceMax || ''; $('pnote').value = x.priceNote || '';
    $('beds').value = x.beds ?? ''; $('size').value = x.size || ''; $('desc').value = x.description;
    imgs = (x.images && x.images.length ? x.images : [x.image]).map(n => ({ name: n, url: A(n) }));
    renderThumbs(); $('form-title').textContent = 'Editing: ' + x.title; $('cancel').hidden = false; $('publish').textContent = 'Save changes';
    showTab('add'); $('f').scrollIntoView({ behavior: 'smooth' });
  }
  if (dl) {
    const x = listings.find(v => v.id === dl.dataset.del); if (!x) return;
    if (!confirm('Remove “' + x.title + '” from the website?')) return;
    try {
      await fb.F.deleteDoc(fb.F.doc(fb.db, 'listings', x.id));
      log('✓ Removed.'); await refresh();
    } catch (err) { log('Failed: ' + err.message); }
  }
};

/* ---------- smart paste: reads pasted text and fills the form ---------- */
const NUM = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8};
const KNOWN_TOWNS = ['Syokimau','Kitengela','Kilimani','Mlolongo','Athi River','Ngong','Kiserian','Rongai','Nairobi','Machakos','Embakasi','Ruiru','Thika','Kahawa','Juja','Kileleshwa','Lavington','Westlands','Kasarani','Utawala','Ruaka','Kikuyu','Kajiado','Kitui'];
const money = (n, u) => { n = parseFloat(String(n).replace(/,/g, '')); if (!isFinite(n)) return NaN; u = (u || '').toLowerCase(); return Math.round(u === 'k' ? n * 1e3 : /^m/.test(u) ? n * 1e6 : n); };
function parseListing(raw) {
  const text = raw.replace(/\r/g, '').trim(), low = text.toLowerCase(), r = {};
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  // category
  r.category = /godown|warehouse|go-down/.test(low) ? 'godown' : /\b(land|plot|plots|acre|acres|parcel)\b/.test(low) && !/\bbed(room)?s?\b|\bbr\b/.test(low) ? 'land' : 'house';
  // sale or rent: whichever keyword appears first
  const iS = low.search(/for sale|\bselling\b|\bsale\b|\bbuy\b/), iR = low.search(/to let|for rent|\brent|\bper month\b|\bp\/m\b|\bmonthly\b|\bletting\b/);
  r.type = iS >= 0 && (iR < 0 || iS < iR) ? 'sale' : iR >= 0 ? 'rent' : (r.category === 'land' ? 'sale' : 'rent');
  // prices
  const prices = [], add = (n, u, i) => { const v = money(n, u); if (v >= 1000) prices.push({ v, i }); };
  let m, re = /(?:ksh?s?\.?|kes|shs?\.?)\s*([\d][\d,.]*)\s*(k|m|million)?\b/gi;
  while ((m = re.exec(text))) add(m[1], m[2], m.index);
  re = /\b([\d][\d,.]*)\s*(k|m|million)\b(?!\w)/gi; while ((m = re.exec(text))) if (!prices.some(p => p.v === money(m[1], m[2]))) add(m[1], m[2], m.index);
  re = /\b(\d{1,3}(?:,\d{3})+|\d{4,})\s*(?:\/=|\/-|per month|pm\b|p\/m|monthly)/gi; while ((m = re.exec(text))) if (!prices.some(p => p.v === money(m[1]))) add(m[1], '', m.index);
  prices.sort((a, b) => a.i - b.i);
  const vals = [...new Set(prices.map(p => p.v))];
  if (vals.length) { r.price = Math.min(...vals); if (vals.length > 1 && Math.max(...vals) / r.price < 5) r.priceMax = Math.max(...vals); else if (vals.length > 1) r.price = vals[0]; }
  if (/per acre|\/acre/.test(low) && r.price) r.priceNote = 'KES ' + r.price.toLocaleString('en-KE') + ' per acre';
  // bedrooms
  const w = '(\\d+|one|two|three|four|five|six|seven|eight)';
  m = low.match(new RegExp('\\b' + w + '\\s*(?:-|to|–)\\s*' + w + '\\s*(?:bed|br\\b)')) || low.match(new RegExp('\\b' + w + '\\s*(?:bed|br\\b)'));
  if (m) { const n = x => NUM[x] || Number(x); r.beds = m[2] ? n(m[1]) + '–' + n(m[2]) : n(m[1]); }
  else if (/bedsitter|bed-sitter|studio/.test(low)) r.beds = /studio/.test(low) ? 'Studio' : 'Bedsitter';
  // size
  m = text.match(/(\d+\s*\/\s*\d+|\d[\d,.]*)\s*(acres?|sq\.?\s?ft|sqft|sqm|sq\.?\s?m|m2|ha|hectares?)/i);
  if (m) r.size = m[1].replace(/\s/g, '') + ' ' + m[2].toLowerCase().replace(/\s|\./g, '').replace('sqft', 'sq ft').replace(/^acres?$/, /^1$/.test(m[1]) ? 'acre' : 'acres');
  else if (/eighth/.test(low)) r.size = '1/8 acre';
  else if (/quarter acre|1\/4/.test(low)) r.size = '1/4 acre';
  else if (/half (an )?acre/.test(low)) r.size = '1/2 acre';
  // location + areas
  const towns = [...new Set([...Object.keys(TOWN_PLACES), ...listings.map(x => x.location), ...KNOWN_TOWNS])];
  let best = null; for (const t of towns) { const i = low.indexOf(t.toLowerCase()); if (i >= 0 && (!best || i < best.i)) best = { t, i }; }
  r.areas = [];
  for (const t of Object.keys(TOWN_PLACES)) for (const p of TOWN_PLACES[t]) if (low.includes(p.toLowerCase()) && !/town$/i.test(p)) { r.areas.push(p); if (!best) best = { t, i: 0 }; }
  if (best) r.town = best.t;
  if (r.town && TOWN_PLACES[r.town]) r.areas = r.areas.filter(p => TOWN_PLACES[r.town].includes(p)); else r.areas = [];
  // title + description
  const first = lines[0] || '';
  const cat = { house: (r.beds && !isNaN(r.beds) ? r.beds + '-bedroom ' : '') + (/apartment|flat/.test(low) ? 'apartment' : /maisonette/.test(low) ? 'maisonette' : /bungalow/.test(low) ? 'bungalow' : 'house'), godown: 'Godown', land: (r.size ? r.size + ' ' : '') + 'plot of land' }[r.category];
  const auto = cat.charAt(0).toUpperCase() + cat.slice(1) + (r.type === 'sale' ? ' for sale' : ' to let') + (r.town ? ' in ' + r.town : '');
  const usable = first.length >= 8 && first.length <= 90 && !/\d{4,}|ksh|kes/i.test(first) && lines.length > 1;
  r.title = usable ? first.replace(/[*_#]+/g, '').trim() : auto;
  r.description = (usable ? lines.slice(1) : lines).join('\n').trim();
  return r;
}
/* Paste your Cloudflare Worker address here (see the setup steps). Leave empty to use the built-in rules only. */
const AI_URL = 'https://mandelamax-ai.maxmandelahomes.workers.dev';
async function askAI(text) {
  const tok = await fb.auth.currentUser.getIdToken();
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const towns = [...new Set([...Object.keys(TOWN_PLACES), ...listings.map(x => x.location)])];
    const res = await fetch(AI_URL, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ text, towns, areas: TOWN_PLACES }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.result) throw new Error(d.error || res.status);
    return d.result;
  } catch (x) { throw new Error(x.name === 'AbortError' ? 'timed out' : x.message); }
  finally { clearTimeout(timer); }
}
function mergeAI(r, a) {
  const o = { ...r }, str = v => (typeof v === 'string' ? v.trim() : ''), num = v => { v = Number(v); return isFinite(v) && v > 0 ? Math.round(v) : 0; };
  if (a.type === 'rent' || a.type === 'sale') o.type = a.type;
  if (['house', 'godown', 'land'].includes(a.category)) o.category = a.category;
  if (str(a.title)) o.title = str(a.title).slice(0, 90);
  if (str(a.town)) o.town = str(a.town);
  if (num(a.price)) o.price = num(a.price);
  if (num(a.priceMax) > (o.price || 0)) o.priceMax = num(a.priceMax); else if (num(a.price)) delete o.priceMax;
  if (str(a.priceNote)) o.priceNote = str(a.priceNote);
  if (a.beds != null && String(a.beds).trim() !== '') o.beds = a.beds;
  if (str(a.size)) o.size = str(a.size);
  if (str(a.description)) o.description = str(a.description);
  const pl = TOWN_PLACES[o.town] || [];
  const ar = Array.isArray(a.areas) ? a.areas.filter(x => pl.includes(x)) : [];
  o.areas = ar.length ? ar : pl.filter(p => (o.areas || []).includes(p));
  return o;
}
$('smart-go').onclick = async () => {
  const raw = $('smart').value; if (raw.trim().length < 5) { $('smart-msg').textContent = 'Paste the property details first.'; return; }
  let r = parseListing(raw), how = 'rules';
  if (AI_URL) {
    $('smart-msg').textContent = 'AI is reading your text…'; $('smart-go').disabled = true;
    try { r = mergeAI(r, await askAI(raw)); how = 'AI'; } catch (x) { how = 'rules, AI unavailable: ' + x.message; }
    $('smart-go').disabled = false;
  }
  const got = [], miss = [];
  type = r.type; document.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x.dataset.t === type));
  $('cat').value = r.category; syncCat();
  $('title').value = r.title; got.push('title');
  if (r.town) { fillTowns(); if ([...$('town').options].some(o => o.value === r.town)) $('town').value = r.town; else { $('town').value = '__other'; $('town-other').value = r.town; } townChanged(r.areas); got.push('location' + (r.areas.length ? ' + area' : '')); } else miss.push('location');
  if (r.price) { $('price').value = r.price; got.push('price'); } else miss.push('price');
  $('pmax').value = r.priceMax || ''; $('pnote').value = r.priceNote || '';
  if (r.category === 'house') { $('beds').value = r.beds ?? ''; if (r.beds == null) miss.push('bedrooms'); else got.push('bedrooms'); } else { $('size').value = r.size || ''; if (!r.size) miss.push('size'); else got.push('size'); }
  $('desc').value = r.description || raw.trim(); got.push('description');
  $('smart-msg').textContent = '(' + how + ') Filled: ' + got.join(', ') + (miss.length ? '. Please check: ' + miss.join(', ') : '') + '. Add photos, review, then publish.';
  $('f').scrollIntoView({ behavior: 'smooth' });
};

syncCat(); fillTowns(); renderThumbs();
startFirebase();
