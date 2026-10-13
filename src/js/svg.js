const files = import.meta.glob('../svg/*.svg', { query: '?raw', import: 'default', eager: true });

export const SVG = Object.fromEntries(
  Object.entries(files).map(([path, raw]) => [path.split('/').pop().replace('.svg', ''), raw]),
);

// Fill every [data-svg] placeholder with its inline SVG so it can be coloured and animated.
export function injectSvgs(root = document) {
  root.querySelectorAll('[data-svg]').forEach((el) => {
    if (el.firstElementChild) return;
    const raw = SVG[el.dataset.svg];
    if (raw) el.innerHTML = raw.replace('<svg ', '<svg aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet" ');
  });
}

export function svgUrl(name) {
  return URL.createObjectURL(new Blob([SVG[name]], { type: 'image/svg+xml' }));
}
