(()=>{
 const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
 document.querySelectorAll('.navbar .nav-link').forEach(a=>{
  const h=a.getAttribute('href').toLowerCase();
  if(h===page||(page===''&&h==='index.html')){a.classList.add('active');a.setAttribute('aria-current','page')}
 });
 document.querySelectorAll('img:not([loading]):not(.video-banner)').forEach(i=>i.loading='lazy');
 const m=document.querySelector('main')||document.getElementById('OurProjects')||document.querySelector('.page-header2');
})();
