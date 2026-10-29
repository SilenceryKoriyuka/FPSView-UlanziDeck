// Writes the static action/plugin icons to assets/icons/.
// Usage: npm run icons

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'icons');

function icon(label, sub) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">`
    + `<rect width="200" height="200" fill="#1a1a19"/>`
    + `<text x="100" y="${sub ? 110 : 122}" font-family="Segoe UI" font-size="${label.length > 3 ? 46 : 64}" font-weight="bold" fill="#ffffff" text-anchor="middle">${label}</text>`
    + (sub ? `<text x="100" y="146" font-family="Segoe UI" font-size="22" fill="#898781" text-anchor="middle">${sub}</text>` : '')
    + `<rect x="40" y="168" width="120" height="4" rx="2" fill="#3987e5"/>`
    + `</svg>`;
}

const icons = {
  'plugin.svg': icon('SYS', 'monitor'),
  'fps.svg': icon('FPS'),
  'gpu.svg': icon('GPU'),
  'cpu.svg': icon('CPU'),
  'ram.svg': icon('RAM'),
  'combined.svg': icon('ALL', 'overview')
};

fs.mkdirSync(outDir, { recursive: true });
for (const [name, svg] of Object.entries(icons)) {
  fs.writeFileSync(path.join(outDir, name), svg);
}
console.log(`Wrote ${Object.keys(icons).length} icons to ${outDir}`);
