const TOWN_PLACES = {
  Syokimau: ['Katani', 'Gateway Mall', 'SGR Area', 'Mombasa Road', 'Quarry Road', 'Mwananchi', 'Parliament'],
  Kitengela: ['Kitengela Town', 'Milimani', 'New Valley', 'Yukos', 'Chuna', 'Noonkopir', 'Acacia', 'Kyangombe']
};
const STEPS = {
  rent: [10000, 20000, 30000, 40000, 50000, 75000, 100000, 150000, 250000],
  sale: [2000000, 5000000, 7500000, 10000000, 15000000, 20000000, 50000000]
};
const S = { mode: 'all', town: 'all', place: 'all', beds: 'any', pmin: 0, pmax: 0 };
let L = [];
const $ = id => document.getElementById(id);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => 'KES ' + Number(n).toLocaleString('en-KE');
const short = n => n >= 1e6 ? 'KES ' + +(n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? 'KES ' + +(n / 1e3).toFixed(0) + 'K' : 'KES ' + n;
const lo = x => Number(x.price), hi = x => Number(x.priceMax || x.price);
const per = x => x.type === 'rent' ? ' / mo' : '';
const range = x => short(lo(x)) + (x.priceMax ? ' – ' + short(hi(x)) : '') + per(x);
function beds(x) { if (x.category && x.category !== 'house') return []; const m = String(x.beds ?? '').match(/\d+/g); return m ? m.map(Number) : []; }
function pass(x, skip = []) {
  if (!skip.includes('mode') && S.mode !== 'all' && x.type !== S.mode) return false;
  if (!skip.includes('town') && S.town !== 'all' && x.location !== S.town) return false;
  if (!skip.includes('place') && S.place !== 'all' && !(x.areas || []).includes(S.place)) return false;
  if (S.beds !== 'any' && !beds(x).some(n => S.beds === '5+' ? n >= 5 : n === +S.beds)) return false;
  if (S.pmin && hi(x) < S.pmin) return false;
  if (S.pmax && lo(x) > S.pmax) return false;
  return true;
}
function fillSelects() {
  const towns = [...new Set([...Object.keys(TOWN_PLACES), ...L.map(x => x.location)])].sort();
  $('d-town').innerHTML = '<option value="all">All locations</option>' + towns.map(t => `<option>${esc(t)}</option>`).join('');
  $('d-town').value = S.town;
  const pl = TOWN_PLACES[S.town] || [];
  $('d-place').innerHTML = `<option value="all">${pl.length ? 'All places in ' + esc(S.town) : 'Pick Syokimau or Kitengela first'}</option>` + pl.map(p => `<option>${esc(p)}</option>`).join('');
  $('d-place').disabled = !pl.length;
  if (!pl.includes(S.place)) S.place = 'all';
  $('d-place').value = S.place;
  const st = STEPS[S.mode] || [], u = S.mode === 'rent' ? ' / mo' : '';
  const o = v => `<option value="${v}">${money(v)}${u}</option>`;
  $('d-pmin').innerHTML = '<option value="0">No minimum</option>' + st.map(o).join('');
  $('d-pmax').innerHTML = '<option value="0">No maximum</option>' + st.map(o).join('');
  if (!st.includes(S.pmin)) S.pmin = 0; if (!st.includes(S.pmax)) S.pmax = 0;
  $('d-pmin').value = S.pmin; $('d-pmax').value = S.pmax;
  $('d-pmin').disabled = $('d-pmax').disabled = !st.length;
  $('d-beds').value = S.beds;
  $('d-hint').textContent = st.length ? '' : 'Choose Rent or Buy to set a price range';
  document.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === S.mode; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
}
function bars(rows, cls = '') {
  const max = Math.max(...rows.map(r => r.v), 1);
  return rows.map(r => `<${r.go ? 'button type="button" ' + r.go : 'div'} class="brow${r.active ? ' active' : ''}"><span class="bname" title="${esc(r.name)}">${esc(r.name)}</span><span class="btrack"><i class="${r.cls || cls}" style="width:${Math.max(4, r.v / max * 100)}%"></i></span><span class="bval">${r.label}</span></${r.go ? 'button' : 'div'}>`).join('');
}
function draw() {
  const items = L.filter(x => pass(x)).sort((a, b) => lo(a) - lo(b));
  // KPIs
  const types = new Set(items.map(x => x.type));
  const one = items.length && types.size === 1, u = one && items[0].type === 'rent' ? ' / mo' : '';
  const mids = items.map(x => (lo(x) + hi(x)) / 2);
  const kp = [['Matching listings', items.length], ['Towns covered', new Set(items.map(x => x.location)).size],
    ['Lowest price', one ? short(Math.min(...items.map(lo))) + u : '–'],
    ['Average price', one ? short(Math.round(mids.reduce((a, b) => a + b, 0) / mids.length)) + u : '–'],
    ['Highest price', one ? short(Math.max(...items.map(hi))) + u : '–']];
  $('kpis').innerHTML = kp.map(([l, v]) => `<div class="stat"><span class="stat-label">${l}</span><strong>${v}</strong></div>`).join('') +
    (items.length && !one ? '<p class="small muted w-100" style="grid-column:1/-1;margin:0">Rent and sale prices aren’t mixed. Choose Rent or Buy to compare prices.</p>' : '');
  // by place
  const pool = L.filter(x => pass(x, ['town', 'place']));
  const by = {};
  pool.forEach(x => { const ps = (x.areas && x.areas.length) ? x.areas : [null]; ps.forEach(p => { const k = x.location + '|' + (p || ''); by[k] = (by[k] || 0) + 1; }); });
  const rows = Object.entries(by).sort((a, b) => a[0].split('|')[0].localeCompare(b[0].split('|')[0]) || b[1] - a[1]).map(([k, v]) => {
    const [t, p] = k.split('|');
    return { name: p ? `${t} › ${p}` : `${t} · general`, v, label: v, active: S.town === t && (p ? S.place === p : S.place === 'all' && false), go: `data-go-town="${esc(t)}" data-go-place="${esc(p)}"` };
  });
  $('c-place').innerHTML = rows.length ? bars(rows, 'sale') : '<p class="muted">No listings match.</p>';
  // price bands
  const bandFor = t => {
    const st = STEPS[t], edges = [0, ...st, Infinity];
    return edges.slice(0, -1).map((a, i) => ({ a, b: edges[i + 1] })).map(r => ({ ...r, n: pool.concat([]).filter(x => x.type === t && pass(x, ['town', 'place']) && lo(x) >= r.a && lo(x) < r.b).length }));
  };
  const showT = S.mode === 'all' ? ['rent', 'sale'] : [S.mode];
  $('band-note').textContent = 'Each listing is counted by its starting price.';
  $('c-band').innerHTML = showT.map(t => {
    const bs = bandFor(t).filter(r => r.n > 0);
    const name = r => r.b === Infinity ? 'Over ' + short(r.a) : r.a === 0 ? 'Under ' + short(r.b) : short(r.a) + ' – ' + short(r.b);
    return `<h3 class="dashx-sub">${t === 'rent' ? 'Rent (per month)' : 'Buy'}</h3>` + (bs.length ? bars(bs.map(r => ({ name: name(r), v: r.n, label: r.n })), t) : '<p class="muted small">None.</p>');
  }).join('');
  // price per listing
  $('c-price').innerHTML = showT.map(t => {
    const rs = items.filter(x => x.type === t);
    return `<h3 class="dashx-sub">${t === 'rent' ? 'Rent (per month)' : 'Buy'}</h3>` + (rs.length ? bars(rs.map(x => ({ name: `${x.title} · ${x.location}`, v: hi(x), label: range(x) })), t) : '<p class="muted small">None.</p>');
  }).join('') || '<p class="muted">No listings match.</p>';
  // table
  $('rows').innerHTML = items.map(x => `<tr><td>${esc(x.title)}</td><td>${esc(x.location)}${x.areas ? ' › ' + esc(x.areas.join(', ')) : ''}</td><td><span class="tag ${x.type}">${x.type === 'sale' ? 'Sale' : 'Rent'}</span></td><td>${x.category === 'house' ? esc(x.beds ?? '–') : esc(x.size || x.category)}</td><td>${range(x)}</td><td><a href="properties.html?open=${encodeURIComponent(x.id)}">Details</a></td></tr>`).join('');
  const e = $('d-empty'); e.hidden = items.length > 0;
  if (!items.length) e.innerHTML = 'No listings match these filters. Call <a href="tel:+254722979636">0722 979 636</a> and we will tell you what is coming up.';
}
function change(fn) { fn(); fillSelects(); draw(); }
document.addEventListener('click', e => {
  const m = e.target.closest('[data-mode]'), g = e.target.closest('[data-go-town]');
  if (m) change(() => { S.mode = m.dataset.mode; S.pmin = S.pmax = 0; });
  if (g) change(() => { S.town = g.dataset.goTown; S.place = g.dataset.goPlace || 'all'; });
  if (e.target.id === 'd-reset') change(() => Object.assign(S, { mode: 'all', town: 'all', place: 'all', beds: 'any', pmin: 0, pmax: 0 }));
});
$('d-town').onchange = e => change(() => { S.town = e.target.value; S.place = 'all'; });
$('d-place').onchange = e => change(() => { S.place = e.target.value; });
$('d-beds').onchange = e => change(() => { S.beds = e.target.value; });
$('d-pmin').onchange = e => change(() => { S.pmin = +e.target.value; if (S.pmax && S.pmin > S.pmax) S.pmax = 0; });
$('d-pmax').onchange = e => change(() => { S.pmax = +e.target.value; if (S.pmin && S.pmax && S.pmax < S.pmin) S.pmin = 0; });
loadListings().then(d => { L = d; fillSelects(); draw(); })
  .catch(() => { $('dash').insertAdjacentHTML('beforeend', '<p>Dashboard data could not load. Please call <a href="tel:+254722979636">0722 979 636</a>.</p>'); });
