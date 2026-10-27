/* Loads listings from Firebase (Firestore) when configured; otherwise, or if anything fails, from listings.json. */
window.FB_VERSION = '10.12.2';
window.fbConfigured = () => { const c = window.FIREBASE_CONFIG; return !!(c && c.apiKey && !/^YOUR/.test(c.apiKey)); };
window.loadListings = async function () {
  if (window.fbConfigured()) {
    try {
      const base = 'https://www.gstatic.com/firebasejs/' + window.FB_VERSION + '/';
      const [{ initializeApp }, fs] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-firestore.js')]);
      const snap = await fs.getDocs(fs.collection(fs.getFirestore(initializeApp(window.FIREBASE_CONFIG)), 'listings'));
      const rows = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      if (rows.length) return rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch (e) { console.warn('Firebase unavailable, using listings.json', e); }
  }
  const r = await fetch('listings.json');
  if (!r.ok) throw new Error('listings.json');
  return r.json();
};
