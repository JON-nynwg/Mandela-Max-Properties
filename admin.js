const V = window.FB_VERSION, base = 'https://www.gstatic.com/firebasejs/' + V + '/';
const $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const A = n => /^https?:/.test(n) ? n : 'assets/' + n;
const TOWN_PLACES = {
  Syokimau: ['Katani', 'Gateway Mall', 'SGR Area', 'Mombasa Road', 'Quarry Road', 'Mwananchi', 'Parliament'],
  Kitengela: ['Kitengela Town', 'Milimani', 'New Valley', 'Yukos', 'Chuna', 'Noonkopir', 'Acacia', 'Kyangombe']
};
let listings = [], type = 'rent', editing = null, imgs = [], fb = null;
const log = (m, add) => { $('log').textContent = add ? $('log').textContent + '\n' + m : m; };

/* ---------- Firebase ---------- */
async function startFirebase() {
  if (!window.fbConfigured()) { $('login-msg').textContent = 'Firebase is not set up yet. Open firebase-config.js, paste your project settings, then reload (see FIREBASE-SETUP.md).'; $('login').hidden = true; return; }
  try {
    const [app, auth, fs, st] = await Promise.all(['app', 'auth', 'firestore', 'storage'].map(m => import(base + 'firebase-' + m + '.js')));
    const a = app.initializeApp(window.FIREBASE_CONFIG);
    fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), st: st.getStorage(a), A: auth, F: fs, S: st };
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
    const urls = [], t = Date.now().toString(36);
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].blob) {
        log(`Uploading photo ${i + 1} of ${imgs.length}…`);
        const r = fb.S.ref(fb.st, `listings/${o.id}-${t}-${i + 1}.webp`);
        await fb.S.uploadBytes(r, imgs[i].blob, { contentType: 'image/webp' });
        urls.push(await fb.S.getDownloadURL(r));
      } else urls.push(imgs[i].name);
    }
    o.image = urls[0]; if (urls.length > 1) o.images = urls; else delete o.images;
    await fb.F.setDoc(fb.F.doc(fb.db, 'listings', o.id), clean(o));
    await refresh(); reset(); log('✓ Published. It is live on the website now.');
  } catch (x) { log('Failed: ' + x.message + (/permission/i.test(x.message) ? '\nCheck that your email is in the Firestore and Storage rules.' : '')); }
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
      for (const n of (x.images && x.images.length ? x.images : [x.image])) if (/^https?:/.test(n)) { try { await fb.S.deleteObject(fb.S.ref(fb.st, n)); } catch {} }
      log('✓ Removed.'); await refresh();
    } catch (err) { log('Failed: ' + err.message); }
  }
};
syncCat(); fillTowns(); renderThumbs();
startFirebase();
