// یه نمودار خطی خیلی ساده و سبک، بدون کتابخونهٔ خارجی — برای روند نمره‌ها در طول زمان.
// points: [{ x: label, y: number }], renders into the given container element.
function renderLineChart(container, points, opts) {
  opts = opts || {};
  const color = opts.color || 'var(--leaf)';
  const w = opts.width || 320, h = opts.height || 140, pad = 28;

  if (!points.length) {
    container.innerHTML = `<div style="text-align:center; color:var(--ink-soft); font-size:.85rem; padding:20px 0;">${opts.emptyText || 'هنوز داده‌ای نیست.'}</div>`;
    return;
  }

  const ys = points.map(p => p.y);
  const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 100);
  const xStep = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const scaleY = (y) => h - pad - ((y - minY) / (maxY - minY || 1)) * (h - pad * 2);

  const coords = points.map((p, i) => [pad + i * xStep, scaleY(p.y)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;

  const dots = coords.map(([x, y], i) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${color}"><title>${points[i].label || points[i].y}</title></circle>`
  ).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:${h}px; overflow:visible;">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="var(--line)" stroke-width="1"/>
      <path d="${areaPath}" fill="${color}" opacity="0.12"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
    </svg>`;
}
