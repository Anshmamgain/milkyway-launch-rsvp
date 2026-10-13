import gsap from 'gsap';

export function initFaq({ reduced }) {
  const sheet = document.getElementById('faqSheet');
  const panel = sheet.querySelector('.sheet__panel');
  const openBtn = document.getElementById('faqOpen');
  function open() {
    sheet.hidden = false;
    if (!reduced) { gsap.fromTo(panel, { yPercent: 100 }, { yPercent: 0, duration: 0.55, ease: 'expo.out' }); gsap.fromTo(sheet.querySelector('.sheet__scrim'), { opacity: 0 }, { opacity: 1, duration: 0.3 }); }
    sheet.querySelector('summary')?.focus();
  }
  function close() {
    const done = () => { sheet.hidden = true; openBtn.focus(); };
    if (reduced) return done();
    gsap.to(panel, { yPercent: 100, duration: 0.35, ease: 'power3.in', onComplete: done });
  }
  openBtn.addEventListener('click', open);
  sheet.querySelectorAll('[data-close-sheet]').forEach((b) => b.addEventListener('click', close));
  sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  sheet.querySelectorAll('details').forEach((d) => {
    const s = d.querySelector('summary'), a = d.querySelector('.q__a');
    s.addEventListener('click', (e) => {
      if (reduced) return;
      e.preventDefault();
      if (d.open) gsap.to(a, { height: 0, duration: 0.3, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(a, { clearProps: 'height' }); } });
      else { d.open = true; gsap.from(a, { height: 0, duration: 0.45, ease: 'power3.out' }); }
    });
  });
}
