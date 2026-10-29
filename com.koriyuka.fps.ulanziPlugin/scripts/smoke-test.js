// End-to-end check without UlanziStudio: starts a fake host on a local WebSocket,
// launches plugin/app.js against it, adds one key of each kind, presses a key,
// and confirms each key gets a valid SVG image back.
// Usage: npm run smoke                                  (tests this source folder)
//        node scripts/smoke-test.js <pluginDir> [node.exe] (tests an unpacked release)
// MSI Afterburner should be running.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExe = process.argv[3] || process.execPath;
const PLUGIN = 'com.koriyuka.ulanzistudio.sysmon';
const KINDS = ['fps', 'gpu', 'cpu', 'ram', 'combined'];
const PORT = 39147;

const images = {}; // key -> count of state messages received
let failures = 0;

function check(ok, message) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) failures++;
}

const server = new WebSocketServer({ host: '127.0.0.1', port: PORT });

server.on('connection', socket => {
  socket.on('message', raw => {
    const msg = JSON.parse(raw.toString());

    if (msg.cmd === 'connected') {
      check(msg.uuid === PLUGIN, `plugin registered as ${msg.uuid}`);
      KINDS.forEach((kind, i) => {
        socket.send(JSON.stringify({ cmd: 'add', uuid: `${PLUGIN}.${kind}`, key: `0_${i}`, actionid: `a${i}`, param: null }));
      });
      // Press the FPS key once to flip it to page 2.
      setTimeout(() => socket.send(JSON.stringify({ cmd: 'run', uuid: `${PLUGIN}.fps`, key: '0_0', actionid: 'a0', param: null })), 1500);
      return;
    }

    if (msg.cmd === 'state') {
      for (const s of msg.param.statelist) {
        const svg = Buffer.from(s.data.replace('data:image/svg+xml;base64,', ''), 'base64').toString();
        const valid = s.type === 1 && svg.startsWith('<svg') && svg.endsWith('</svg>');
        if (!valid) check(false, `key ${s.key} sent an invalid image`);
        images[s.key] = (images[s.key] || 0) + 1;
      }
    }
  });
});

const child = spawn(nodeExe, ['plugin/app.js', '127.0.0.1', String(PORT), 'en'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
console.log(`Testing ${root}\n  with ${nodeExe}\n`);
let stderr = '';
child.stderr.on('data', d => { stderr += d; });

setTimeout(() => {
  KINDS.forEach((kind, i) => check(images[`0_${i}`] > 0, `${kind} key received ${images[`0_${i}`] || 0} image update(s)`));
  check(images['0_0'] >= 2, 'pressing the FPS key redrew it (page flip)');
  check(child.exitCode === null, 'plugin process still running');

  child.kill();
  server.close();
  if (failures && stderr.trim()) console.log('\nplugin stderr (last lines):\n' + stderr.trim().split('\n').slice(-15).join('\n'));
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}, 4000);
