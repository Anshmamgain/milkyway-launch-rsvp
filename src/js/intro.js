import gsap from 'gsap';

/* -------------------------------------------------------------------------- */
/* Countdown preloader: T-minus 10 to 0, then the flow opens                  */
/* -------------------------------------------------------------------------- */
export function runLoader({ reduced, quick }) {
  const loader = document.getElementById('loader');
  const count = document.getElementById('loaderCount');
  const bar = document.getElementById('loaderBar');
  return new Promise((resolve) => {
    if (reduced) { loader.remove(); resolve(); return; }
    const n = { v: 10 };
    const fontsReady = Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
    const tl = gsap.timeline({ paused: true });
    tl.to(n, {
      v: 0, duration: quick ? 0.7 : 1.7, ease: 'power2.in',
      onUpdate() { count.textContent = Math.ceil(n.v); },
    })
      .to(bar, { scaleX: 1, duration: quick ? 0.7 : 1.7, ease: 'power2.in' }, 0)
      .to(count, { scale: 1.25, duration: 0.18, ease: 'power2.out' })
      .to(count, { yPercent: -120, opacity: 0, duration: 0.45, ease: 'power3.in' })
      .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'expo.inOut' }, '-=0.15')
      .add(() => { loader.remove(); resolve(); }, '-=0.35');
    loader.addEventListener('click', () => tl.timeScale(4));
    fontsReady.then(() => tl.play());
  });
}
