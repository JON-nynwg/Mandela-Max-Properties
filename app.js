let listings = [], filter = 'all', locationFilter = 'all';
const grid = document.getElementById('listing-grid');
const dialog = document.getElementById('detail');

/* ---------- categories and dashboard filters ---------- */
const CATEGORIES = { house: 'House', godown: 'Godown', land: 'Land' };
const FILTER_KEYS = ['house-rent', 'house-sale', 'godown-rent', 'godown-sale', 'land-sale'];
const FILTER_NAMES = {
  'house-rent': 'houses for rent', 'house-sale': 'houses for sale',
  'godown-rent': 'godowns for rent', 'godown-sale': 'godowns for sale',
  'land-sale': 'land for sale', house: 'houses', godown: 'godowns', land: 'land'
};

function cat(x) { return x.category || 'house'; }
function key(x) { return cat(x) + '-' + x.type; }
function typeLabel(x) { return x.type === 'sale' ? 'FOR SALE' : 'FOR RENT'; }
function badgeText(x) { return CATEGORIES[cat(x)].toUpperCase() + ' ' + typeLabel(x); }
function bedsText(x) { return x.beds + (Number(x.beds) === 1 ? ' bedroom' : ' bedrooms'); }
function metaText(x) {
  if (cat(x) === 'house' && x.beds !== undefined && x.beds !== '') return bedsText(x);
  return x.size || CATEGORIES[cat(x)];
}
function validFilter(f) {
  return f === 'all' || f === 'saved' || !!CATEGORIES[f] || FILTER_KEYS.includes(f);
}
function matches(x, f, ids) {
  if (f === 'all') return true;
  if (f === 'saved') return ids.includes(x.id);
  if (CATEGORIES[f]) return cat(x) === f;
  return key(x) === f;
}
function buttonActive(btnFilter, f) {
  return btnFilter === f || (!!CATEGORIES[f] && btnFilter.startsWith(f + '-'));
}

/* ---------- saved properties, money ---------- */
function saved() {
  try { const x = JSON.parse(localStorage.getItem('mandelamax-saved') || '[]'); return Array.isArray(x) ? x : []; }
  catch { return []; }
}
function money(x) { return 'KES ' + Number(x).toLocaleString('en-KE'); }
function price(x) {
  return money(x.price) + (x.priceMax ? ' – ' + money(x.priceMax) : '') + (x.type === 'rent' ? ' / month' : '') + (x.priceNote ? ' (' + x.priceNote + ')' : '');
}
function toggle(id) {
  let x = saved();
  x = x.includes(id) ? x.filter(v => v !== id) : [...x, id];
  try { localStorage.setItem('mandelamax-saved', JSON.stringify(x)); } catch {}
  render();
}

/* ---------- dashboard ---------- */
function updateDashboard(ids) {
  const inLocation = x => locationFilter === 'all' || x.location === locationFilter;
  const scoped = listings.filter(inLocation);
  document.querySelectorAll('[data-count]').forEach(el => {
    const k = el.dataset.count;
    el.textContent = scoped.filter(x => matches(x, k, ids)).length;
  });
  document.querySelectorAll('[data-filter]').forEach(b => {
    const on = buttonActive(b.dataset.filter, filter);
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
}
function fillLocations() {
  const sel = document.getElementById('location');
  if (!sel) return;
  const places = [...new Set(listings.map(x => x.location))].sort();
  sel.innerHTML = '<option value="all">All locations</option>' +
    places.map(p => `<option value="${p}">${p}</option>`).join('');
  sel.value = locationFilter;
}

/* ---------- listing cards ---------- */
function render() {
  if (!grid) return;
  const ids = saved();
  let items = listings.filter(x => matches(x, filter, ids) && (locationFilter === 'all' || x.location === locationFilter));
  if (grid.dataset.limit) items = items.slice(0, +grid.dataset.limit);
  grid.innerHTML = items.map(x => `<div class="col-lg-3 col-md-6"><article class="property-card team-item coastal-card"><div class="team-body"><div class="team-before" aria-hidden="true"><span>▱</span><span>⌂</span><span>KSh</span><span>◎</span></div><img src="assets/${x.image}" alt="Property gallery photograph" loading="lazy"><div class="team-after"><span>${metaText(x)}</span><span class="overlay-title">${x.title}</span><span class="overlay-price">${price(x)}</span><span class="overlay-note">Call to confirm availability</span><button data-detail="${x.id}">Property details</button></div><span class="badge">${badgeText(x)}</span><button class="save" data-save="${x.id}" aria-label="${ids.includes(x.id) ? 'Unsave' : 'Save'} ${x.title}" aria-pressed="${ids.includes(x.id)}">${ids.includes(x.id) ? '♥' : '♡'}</button></div><button class="location-caption" data-detail="${x.id}" aria-label="View ${x.title} in ${x.location}">${x.location}</button></article></div>`).join('');

  const empty = document.getElementById('empty');
  if (empty) {
    empty.hidden = items.length > 0;
    if (!items.length) {
      const what = filter === 'saved' ? 'saved properties' : (FILTER_NAMES[filter] || 'properties');
      empty.innerHTML = filter === 'saved'
        ? 'You have not saved any properties yet. Tap the heart on a property to save it.'
        : `No ${what} are listed right now. Call <a href="tel:+254722979636">0722 979 636</a> or <a href="https://wa.me/254722979636?text=${encodeURIComponent('Hello Mandelamax, do you have any ' + what + ' available?')}">WhatsApp us</a> and we will tell you what is coming up.`;
    }
  }
  const rc = document.getElementById('result-count');
  if (rc) rc.textContent = `Showing ${items.length} ${items.length === 1 ? 'property' : 'properties'}`;
  updateDashboard(ids);
}

/* ---------- property details and related properties ---------- */
function bedNumbers(x) {
  if (cat(x) !== 'house') return [];
  const m = String(x.beds === undefined ? '' : x.beds).match(/\d+/g);
  return m ? m.map(Number) : [];
}
function related(x) {
  const mine = bedNumbers(x);
  return listings.filter(v => v.id !== x.id).map(v => {
    let score = 0; const tags = [];
    if (mine.length && bedNumbers(v).some(n => mine.includes(n))) { score += 3; tags.push(bedsText(v)); }
    if (cat(v) === cat(x)) score += 2;
    if (v.type === x.type) { score += 2; tags.push(v.type === 'sale' ? 'Also for sale' : 'Also for rent'); }
    if (v.location === x.location) { score += 1; tags.push('Same area'); }
    if (!tags.length) tags.push(badgeText(v));
    return { v, score, tags: tags.slice(0, 2) };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}
function gallery(x) {
  if (!Array.isArray(x.images) || x.images.length < 2) return '';
  return `<div class="gallery" aria-label="More photos">${x.images.map((im, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-photo="assets/${im}" aria-label="Show photo ${i + 1} of ${x.images.length}"><img src="assets/${im}" alt="" loading="lazy"></button>`).join('')}</div>`;
}
function features(x) {
  if (!Array.isArray(x.featureGroups) || !x.featureGroups.length) return '';
  return x.featureGroups.map(g => `<h3 class="feature-title">${g.title}</h3><ul class="feature-list">${g.items.map(i => `<li>${i}</li>`).join('')}</ul>`).join('');
}
function detail(id) {
  const x = listings.find(v => v.id === id);
  if (!x) return;
  const facts = [metaText(x), ...(cat(x) === 'house' && x.size ? [x.size] : []), CATEGORIES[cat(x)] + ' ' + (x.type === 'sale' ? 'for sale' : 'for rent'), x.location];
  const rel = related(x);
  const relHtml = rel.length ? `<div class="related"><h3>Other properties you may like</h3><p class="muted">Matched by bedrooms, type and area.</p><div class="related-grid">${rel.map(r => `<button type="button" class="related-card" data-detail="${r.v.id}"><img src="assets/${r.v.image}" alt="" loading="lazy"><span class="r-body"><span class="r-title">${r.v.title}</span><span class="r-meta">${r.v.location} · ${metaText(r.v)}</span><span class="r-price">${price(r.v)}</span><span class="r-tags">${r.tags.map(t => `<em>${t}</em>`).join('')}</span></span></button>`).join('')}</div></div>` : '';
  document.getElementById('detail-content').innerHTML = `<img class="detail-image" id="detail-main" src="assets/${x.image}" alt="Property gallery photograph">${gallery(x)}<div class="detail-text"><span class="eyebrow">${x.location} · ${badgeText(x)}</span><h2>${x.title}</h2><p class="price">${price(x)}</p><ul class="facts">${facts.map(f => `<li>${f}</li>`).join('')}</ul><p>${x.description}</p>${features(x)}<p class="muted">Contact our team to confirm current availability and arrange a viewing.</p><p>Viewing fee: KES 2,000. Confirm arrangements with our team.</p><a class="button" href="https://wa.me/254722979636?text=${encodeURIComponent('Hello Mandelamax, I would like to enquire about ' + x.title + ' in ' + x.location + ' (' + price(x) + '). Please confirm availability and viewing details.')}">Enquire on WhatsApp</a></div>${relHtml}`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}

/* ---------- events ---------- */
function setFilter(f) {
  filter = f;
  if (grid && !grid.dataset.limit && window.history && history.replaceState) {
    try { history.replaceState(null, '', f === 'all' ? location.pathname : '?filter=' + f); } catch {}
  }
  render();
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-save]'), d = e.target.closest('[data-detail]'), f = e.target.closest('[data-filter]');
  const ph = e.target.closest('[data-photo]');
  if (ph) {
    const main = document.getElementById('detail-main');
    if (main) main.src = ph.dataset.photo;
    document.querySelectorAll('.gallery button').forEach(b => b.classList.toggle('active', b === ph));
    return;
  }
  if (s) toggle(s.dataset.save);
  if (d) detail(d.dataset.detail);
  if (f) setFilter(f.dataset.filter);
});
const closeBtn = document.getElementById('close');
if (closeBtn) closeBtn.onclick = () => dialog.close();
if (dialog) dialog.addEventListener('click', e => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  }
});
const menu = document.getElementById('menu');
if (menu) menu.onclick = function () {
  const open = document.getElementById('nav').classList.toggle('open');
  this.setAttribute('aria-expanded', String(open));
};
const loc = document.getElementById('location');
if (loc) loc.onchange = () => { locationFilter = loc.value; render(); };
const form = document.getElementById('enquiry');
if (form) form.onsubmit = e => {
  e.preventDefault();
  const x = new FormData(form);
  const text = 'Hello Mandelamax, my name is ' + x.get('name') + '. I am interested in ' + x.get('interest') + '. Preferred area: ' + x.get('area') + '. ' + x.get('message');
  window.location.href = 'https://wa.me/254722979636?text=' + encodeURIComponent(text);
};

/* ---------- load data ---------- */
if (grid) {
  const wanted = new URLSearchParams(location.search).get('filter');
  if (wanted && validFilter(wanted) && !grid.dataset.limit) filter = wanted;
  fetch('listings.json')
    .then(r => { if (!r.ok) throw Error(); return r.json(); })
    .then(x => { listings = x; fillLocations(); render(); })
    .catch(() => {
      grid.innerHTML = '<p>Property information could not load. Please call <a href="tel:+254722979636">0722 979 636</a> for current listings.</p>';
    });
}
