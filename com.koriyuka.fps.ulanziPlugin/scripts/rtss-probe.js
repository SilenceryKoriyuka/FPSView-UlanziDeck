// Watches the live FPS the plugin would show, from both sources, for 5 seconds.
// Usage: npm run rtss   (have a game open and in front; it's fine to alt-tab back here)

import MAHMReader from '../plugin/mahm-reader.js';
import RTSSReader from '../plugin/rtss-reader.js';
import SensorCollector from '../plugin/sensor-collector.js';

const rtss = new RTSSReader();
const mahm = new MAHMReader();
const collector = new SensorCollector();

if (!rtss.memory.open()) {
  console.error('RTSSSharedMemoryV2 not found. Is RivaTuner Statistics Server running?');
  process.exit(1);
}

console.log('time    RTSS fps   RTSS frametime   Afterburner fps   -> deck shows');
let samples = 0;

const timer = setInterval(() => {
  const live = rtss.read();
  const ab = mahm.read()?.entries.find(e => e.srcId === 0x50)?.value;
  const abShown = ab !== undefined && ab < 1e30 ? ab.toFixed(1) : '-';
  const deck = collector.poll().metrics;

  const rtssFps = live ? `${live.fps.toFixed(1)} (pid ${live.pid})` : 'no game drawing';
  const rtssFt = live && live.frametime !== null ? `${live.frametime.toFixed(2)} ms` : '-';
  const shown = deck.fps === null || deck.fps === undefined ? '—' : Math.round(deck.fps);
  console.log(`${String(samples * 250).padStart(4)}ms  ${rtssFps.padEnd(22)} ${rtssFt.padEnd(16)} ${abShown.padEnd(17)} ${shown} (${deck.fpsSource})`);

  if (++samples >= 20) {
    clearInterval(timer);
    rtss.close();
    mahm.close();
    collector.close();
  }
}, 250);
