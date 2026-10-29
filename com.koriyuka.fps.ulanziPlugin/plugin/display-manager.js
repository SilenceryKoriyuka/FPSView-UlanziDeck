// Draws the key images as SVG strings. The deck accepts them as base64 data URLs,
// so no canvas or native image library is needed.
//
// Every page shows exactly one stat: a title, a big number, and optionally a
// history graph. The physical key is small, so nothing on it is grey and the
// number itself carries the status color.

const SIZE = 200;
const FONT = 'Segoe UI';
const SURFACE = '#000000';
const WHITE = '#ffffff';
const SOFT = '#d6d6d6';     // titles and units: still near-white on the LCD
const DIM = '#5c5c5c';      // inactive page dots
const STATUS = { good: '#22d34a', warning: '#ffc21a', critical: '#ff4d4d' };
const GRAPH = { line: '#898781', baseline: '#2c2c2a', dot: '#3987e5' };

const fmt = {
  int: v => Math.round(v).toString(),
  one: v => v.toFixed(1),
  ghz: mhz => (mhz / 1000).toFixed(2),
  gb: mb => (mb / 1024).toFixed(1)
};

// Every metric a page can show. `status` names the threshold rule that colors it.
const METRICS = {
  fps: { title: 'FPS', unit: '', format: fmt.int, status: 'fps' },
  frametime: { title: 'Frametime', unit: 'ms', format: fmt.one },
  fpsAvg: { title: 'FPS avg', unit: '', format: fmt.int, status: 'fps' },
  fpsMin: { title: 'FPS min', unit: '', format: fmt.int, status: 'fps' },
  fpsMax: { title: 'FPS max', unit: '', format: fmt.int },
  fps1Low: { title: '1% low', unit: '', format: fmt.int, status: 'fps' },
  fps01Low: { title: '0.1% low', unit: '', format: fmt.int, status: 'fps' },
  gpuTemp: { title: 'GPU temp', unit: '°C', format: fmt.int, status: 'gpuTemp' },
  gpuUsage: { title: 'GPU usage', unit: '%', format: fmt.int },
  gpuPower: { title: 'GPU power', unit: 'W', format: fmt.int },
  gpuCoreClock: { title: 'GPU clock', unit: 'GHz', format: fmt.ghz },
  gpuMemClock: { title: 'VRAM clock', unit: 'GHz', format: fmt.ghz },
  vramUsed: { title: 'VRAM used', unit: 'GB', format: fmt.gb },
  vramProcess: { title: 'VRAM game', unit: 'GB', format: fmt.gb },
  cpuTemp: { title: 'CPU temp', unit: '°C', format: fmt.int, status: 'cpuTemp' },
  cpuUsage: { title: 'CPU usage', unit: '%', format: fmt.int },
  cpuClock: { title: 'CPU clock', unit: 'GHz', format: fmt.ghz },
  cpuPower: { title: 'CPU power', unit: 'W', format: fmt.int },
  ramUsed: { title: 'RAM used', unit: 'GB', format: fmt.gb },
  ramProcess: { title: 'RAM game', unit: 'GB', format: fmt.gb }
};

// Pages per action, in order. Pressing the key goes to the next one.
export const PAGES = {
  fps: ['fps', 'frametime', 'fpsAvg', 'fps1Low', 'fps01Low', 'fpsMin', 'fpsMax'],
  gpu: ['gpuTemp', 'gpuUsage', 'gpuPower', 'gpuCoreClock', 'vramUsed', 'vramProcess', 'gpuMemClock'],
  cpu: ['cpuTemp', 'cpuUsage', 'cpuClock', 'cpuPower'],
  ram: ['ramUsed', 'ramProcess'],
  combined: ['fps', 'fps1Low', 'gpuTemp', 'gpuUsage', 'cpuTemp', 'cpuUsage', 'ramUsed']
};

function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Approximate Segoe UI Bold advance widths (in em), used to shrink text that would overflow.
function textWidth(text, size) {
  let em = 0;
  for (const ch of text) {
    if (/[0-9]/.test(ch)) em += 0.58;
    else if (' .,'.includes(ch)) em += 0.28;
    else if (ch === '%') em += 0.9;
    else if (ch === '°') em += 0.42;
    else if (/[MWmw]/.test(ch)) em += 0.92;
    else if (/[A-Z]/.test(ch)) em += 0.68;
    else em += 0.56;
  }
  return em * size;
}

function statusOf(kind, value, settings) {
  if (!kind || value === null || value === undefined || !settings.colorCoding) return null;
  if (kind === 'fps') {
    if (value >= settings.fpsGood) return 'good';
    return value >= settings.fpsWarn ? 'warning' : 'critical';
  }
  const hot = kind === 'gpuTemp' ? settings.gpuHot : settings.cpuHot;
  if (value >= hot) return 'critical';
  return value >= hot - 10 ? 'warning' : 'good';
}

function text(x, y, content, { size, fill = WHITE, weight = 'bold', anchor = 'middle' }) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${content}</text>`;
}

// Title shrinks to fit the key width.
function title(label, y) {
  const size = Math.min(34, Math.floor(34 * (SIZE - 16) / textWidth(label, 34)));
  return text(SIZE / 2, y, escapeXml(label), { size, fill: SOFT });
}

// Big value with its unit, both in the status color, sized to fill the key width.
function bigValue(key, value, y, maxSize, settings) {
  const def = METRICS[key];
  if (value === null || value === undefined) {
    return text(SIZE / 2, y, '—', { size: maxSize, fill: SOFT });
  }
  const color = STATUS[statusOf(def.status, value, settings)] || WHITE;
  const number = def.format(value);
  const unit = def.unit;
  const unitRatio = 0.48;
  const gap = unit && unit !== '%' && !unit.startsWith('°') ? 0.12 : 0.02;

  const width = textWidth(number, maxSize) + (unit ? textWidth(unit, maxSize * unitRatio) + gap * maxSize : 0);
  const size = Math.min(maxSize, Math.floor(maxSize * (SIZE - 16) / width));
  const unitMarkup = unit
    ? `<tspan dx="${Math.round(gap * size)}" font-size="${Math.round(size * unitRatio)}">${escapeXml(unit)}</tspan>`
    : '';
  return text(SIZE / 2, y, `${escapeXml(number)}${unitMarkup}`, { size, fill: color });
}

// Grey history line with a blue dot marking the latest sample.
function sparkline(values, x, y, w, h) {
  const present = values.filter(v => v !== null);
  if (present.length < 2) return '';

  let lo = Math.min(...present);
  let hi = Math.max(...present);
  if (hi - lo < 1) {
    lo -= 0.5;
    hi += 0.5;
  }
  const px = i => (x + (i / (values.length - 1)) * w).toFixed(1);
  const py = v => (y + h - ((v - lo) / (hi - lo)) * h).toFixed(1);

  // Break the line wherever a sample is missing.
  const segments = [];
  let current = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push(i);
    }
  });
  if (current.length) segments.push(current);

  let out = `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${GRAPH.baseline}" stroke-width="1"/>`;
  for (const seg of segments) {
    if (seg.length < 2) continue;
    const line = seg.map((i, n) => `${n ? 'L' : 'M'}${px(i)},${py(values[i])}`).join(' ');
    out += `<path d="${line} L${px(seg[seg.length - 1])},${y + h} L${px(seg[0])},${y + h} Z" fill="${GRAPH.line}" fill-opacity="0.15"/>`;
    out += `<path d="${line}" fill="none" stroke="${GRAPH.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const last = values.length - 1;
  if (values[last] !== null) {
    out += `<circle cx="${px(last)}" cy="${py(values[last])}" r="4" fill="${GRAPH.dot}" stroke="${SURFACE}" stroke-width="2"/>`;
  }
  return out;
}

function pageDots(page, count) {
  if (count < 2) return '';
  const spacing = Math.min(18, (SIZE - 40) / (count - 1));
  const start = SIZE / 2 - (count - 1) * spacing / 2;
  let out = '';
  for (let i = 0; i < count; i++) {
    out += `<circle cx="${(start + i * spacing).toFixed(1)}" cy="189" r="${i === page ? 5 : 4}" fill="${i === page ? WHITE : DIM}"/>`;
  }
  return out;
}

function renderPage(key, data, settings) {
  const value = data.metrics[key];
  const history = data.history[key] || [];
  const graph = settings.showGraph && history.filter(v => v !== null).length >= 2;

  let out = title(METRICS[key].title, 38);
  if (graph) {
    out += bigValue(key, value, 114, 76, settings);
    out += sparkline(history, 14, 130, SIZE - 28, 40);
  } else {
    out += bigValue(key, value, 134, 92, settings);
  }
  return out;
}

function toDataUrl(body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="${SURFACE}"/>${body}</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

export function pageCount(kind) {
  return (PAGES[kind] || PAGES.fps).length;
}

// data: result of SensorCollector.poll(); returns a data URL for setBaseDataIcon.
export function renderKey(kind, page, data, settings) {
  if (!data.available) {
    return toDataUrl(
      text(SIZE / 2, 84, 'Afterburner', { size: 30, fill: STATUS.critical })
      + text(SIZE / 2, 126, 'not running', { size: 30 })
    );
  }
  const pages = PAGES[kind] || PAGES.fps;
  const index = page % pages.length;
  return toDataUrl(renderPage(pages[index], data, settings) + pageDots(index, pages.length));
}
