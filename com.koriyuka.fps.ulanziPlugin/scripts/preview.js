// Renders every key page to preview/index.html so they can be checked by eye.
// Usage: npm run preview
// Uses live Afterburner data, plus a fake in-game sample so the FPS pages show numbers.
// Tiles are drawn at 200px and again at 72px (roughly the size of a key on the deck).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import SensorCollector from '../plugin/sensor-collector.js';
import { PAGES, renderKey } from '../plugin/display-manager.js';
import { defaultsFor } from '../plugin/settings.js';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview');

const collector = new SensorCollector();
const live = collector.poll();
collector.close();

function wave(base, swing, dip = 0) {
  return Array.from({ length: 60 }, (_, i) => base + swing * Math.sin(i / 5) - (i === 41 ? dip : 0));
}

function fakeGame(base) {
  const metrics = {
    ...base.metrics,
    fps: 144, frametime: 6.9, fpsAvg: 138, fpsMin: 41, fpsMax: 165, fps1Low: 97, fps01Low: 26,
    gpuTemp: 71, gpuUsage: 98, gpuPower: 286.4, gpuCoreClock: 2715, gpuMemClock: 10501,
    vramUsed: 9830, vramProcess: 7270, cpuTemp: 84, cpuUsage: 47, ramProcess: 6450
  };
  const history = {};
  for (const [key, value] of Object.entries(metrics)) {
    history[key] = value === null || value === undefined ? [] : wave(value, value * 0.06, key === 'fps' ? 55 : 0);
  }
  return { available: true, metrics, history };
}

const samples = [
  ['Live data', live],
  ['In game (fake values)', live.available ? fakeGame(live) : null],
  ['Afterburner closed', { available: false, metrics: {}, history: {} }]
].filter(([, data]) => data);

let html = '<!doctype html><meta charset="utf-8"><title>Key preview</title>'
  + '<style>body{background:#2b2b2b;color:#ddd;font-family:Segoe UI,sans-serif;padding:16px}'
  + 'h2{font-weight:600;margin:20px 0 8px}h3{font-weight:400;margin:10px 0 4px;color:#aaa}'
  + '.row{display:flex;flex-wrap:wrap;gap:10px}'
  + 'img{border-radius:10px;display:block}.big img{width:200px;height:200px}.small img{width:72px;height:72px}</style>';

for (const [label, data] of samples) {
  html += `<h2>${label}</h2>`;
  for (const [size, cls] of [['72px (deck size)', 'small'], ['200px', 'big']]) {
    if (label === 'Afterburner closed' && cls === 'big') continue;
    html += `<h3>${size}</h3><div class="row ${cls}">`;
    for (const [kind, pages] of Object.entries(PAGES)) {
      if (label === 'Afterburner closed' && kind !== 'fps') continue;
      pages.forEach((_, page) => {
        html += `<img title="${kind} ${page + 1}" src="${renderKey(kind, page, data, defaultsFor(kind))}">`;
      });
    }
    html += '</div>';
  }
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`Wrote ${path.join(outDir, 'index.html')}`);
