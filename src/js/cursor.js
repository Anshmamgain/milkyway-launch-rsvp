import gsap from 'gsap';

// A small Explore star replaces the pointer on desktop. Elements with data-cursor="Label"
// make it say what a click will do.
export function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const el = document.getElementById('cursor');
  const label = document.getElementById('cursorLabel');
  const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3.out' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3.out' });
  let rot = 0;
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, label, summary, [data-cursor], .world, .road__track');
    el.classList.toggle('is-hover', !!t);
    const text = t?.dataset.cursor;
    el.classList.toggle('has-label', !!text);
    if (text) label.textContent = text;
  });
  gsap.ticker.add(() => { rot += 0.6; el.firstElementChild.style.rotate = `${rot}deg`; });
}
