// SYAJ-style rows: picture then text fly in from the right and fade up from nothing.
// Replays every time the cursor comes near a row (or a row reaches mid-screen on touch).
(() => {
 const rows = [...document.querySelectorAll('.service-item')];
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 const near = 70; // px of "around" the row that counts as the cursor being close
 const states = new WeakMap();
 function fly(el, delay) {
  if (!el || !el.animate) return [];
  return [el.animate([
   {transform: 'translate3d(100%,0,0)', opacity: 0},
   {transform: 'translate3d(0,0,0)', opacity: 1}
  ], {duration: 1000, delay, easing: 'ease-out', fill: 'backwards'})];
 }
 function replay(row) {
  if (motion.matches) return;
  const state = states.get(row);
  state.animations.forEach(a => a.cancel());
  state.animations = [
   ...fly(row.querySelector('.service-img'), 0),
   ...fly(row.querySelector('.service-text'), 300)
  ];
 }
 let pending = false, pointer = null;
 function check() {
  pending = false;
  const top = innerHeight * 0.18, bottom = innerHeight * 0.82;
  rows.forEach(row => {
   const r = row.getBoundingClientRect(), state = states.get(row);
   const center = (r.top + r.bottom) / 2;
   const scrolledIn = center >= top && center <= bottom;
   const cursorNear = !!pointer && pointer.x >= r.left - near && pointer.x <= r.right + near &&
                      pointer.y >= r.top - near && pointer.y <= r.bottom + near;
   if ((cursorNear && !state.near) || (scrolledIn && !state.scrolledIn)) replay(row);
   state.near = cursorNear;
   state.scrolledIn = scrolledIn;
  });
 }
 function schedule() { if (!pending) { pending = true; requestAnimationFrame(check); } }
 rows.forEach(row => states.set(row, {animations: [], near: false, scrolledIn: false}));
 addEventListener('pointermove', e => {
  pointer = e.pointerType === 'touch' ? null : {x: e.clientX, y: e.clientY};
  schedule();
 }, {passive: true});
 document.addEventListener('pointerleave', () => { pointer = null; schedule(); });
 addEventListener('scroll', schedule, {passive: true});
 addEventListener('resize', schedule, {passive: true});
 addEventListener('load', schedule);
 schedule();
})();
if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&window.WOW)new WOW({live:false}).init();
const carousel=document.getElementById('header-carousel');if(carousel&&matchMedia('(prefers-reduced-motion: reduce)').matches)bootstrap.Carousel.getOrCreateInstance(carousel).pause();
const back=document.querySelector('.back-to-top');if(back){window.addEventListener('scroll',()=>back.style.display=scrollY>400?'inline-flex':'none',{passive:true});back.addEventListener('click',e=>{e.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})})}
