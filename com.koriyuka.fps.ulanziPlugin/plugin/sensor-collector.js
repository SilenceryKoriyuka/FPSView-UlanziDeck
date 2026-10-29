// Turns raw MAHM entries into named metrics and keeps short histories for sparklines.
// FPS and frametime come from RTSS when it's running (see rtss-reader.js).

import os from 'os';
import MAHMReader from './mahm-reader.js';
import RTSSReader from './rtss-reader.js';

// Afterburner source IDs (dwSrcId), confirmed against a live MAHMSharedMemory dump.
const SRC = {
  gpuTemp: 0x00,
  gpuCoreClock: 0x20,
  gpuMemClock: 0x22,
  gpuUsage: 0x30,
  vramUsed: 0x31,        // MB
  vramProcess: 0x35,     // MB
  gpuPower: 0x61,        // W
  cpuTemp: 0x80,
  cpuUsage: 0x90,
  ramUsed: 0x91,         // MB
  ramProcess: 0x93,      // MB
  cpuClock: 0xA0,        // MHz
  cpuPower: 0x100,       // W
  fps: 0x50,
  frametime: 0x51,       // ms
  fpsMin: 0x52,
  fpsAvg: 0x53,
  fpsMax: 0x54,
  fps1Low: 0x55,
  fps01Low: 0x56
};

const GPU_SOURCES = new Set(['gpuTemp', 'gpuCoreClock', 'gpuMemClock', 'gpuUsage', 'vramUsed', 'vramProcess', 'gpuPower']);
const HISTORY_KEYS = Object.keys(SRC);
const HISTORY_LENGTH = 60;          // samples
const HISTORY_INTERVAL_MS = 1000;   // one graph point per second, however often we poll

// Afterburner reports "no data" as FLT_MAX.
function clean(value) {
  return Number.isFinite(value) && value < 1e30 ? value : null;
}

export default class SensorCollector {
  constructor(gpuIndex = 0) {
    this.reader = new MAHMReader();
    this.rtss = new RTSSReader();
    this.gpuIndex = gpuIndex;
    this.history = Object.fromEntries(HISTORY_KEYS.map(k => [k, []]));
    this.lastRecordAt = 0;
  }

  // Returns { available, metrics, history }.
  poll() {
    const snapshot = this.reader.read();
    if (!snapshot) {
      return { available: false, metrics: {}, history: this.history };
    }

    const metrics = { ramTotal: os.totalmem() / (1024 * 1024) };
    for (const [name, srcId] of Object.entries(SRC)) {
      const matches = snapshot.entries.filter(e => e.srcId === srcId);
      const entry = GPU_SOURCES.has(name)
        ? matches.find(e => e.gpu === this.gpuIndex) ?? matches[0]
        : matches[0];
      metrics[name] = entry ? clean(entry.value) : null;
    }

    // Frametime reads 0 when Afterburner has no frame data, even while a framerate is shown.
    if (metrics.fps === null || metrics.frametime === 0) metrics.frametime = null;

    // Live FPS and frametime straight from RTSS, which updates every frame instead of
    // once per Afterburner polling period. Min/avg/max and the lows stay on Afterburner.
    const live = this.rtss.read();
    metrics.fpsSource = this.rtss.memory.isOpen ? 'rtss' : 'afterburner';
    if (live) {
      metrics.fps = live.fps;
      metrics.frametime = live.frametime;
    } else if (this.rtss.memory.isOpen) {
      // RTSS is running but no game is drawing frames (minimized, paused, or closed).
      metrics.fps = null;
      metrics.frametime = null;
    }

    const now = Date.now();
    if (now - this.lastRecordAt >= HISTORY_INTERVAL_MS) {
      this.lastRecordAt = now;
      for (const key of HISTORY_KEYS) {
        const buffer = this.history[key];
        buffer.push(metrics[key]);
        if (buffer.length > HISTORY_LENGTH) buffer.shift();
      }
    }

    return { available: true, metrics, history: this.history };
  }

  close() {
    this.reader.close();
    this.rtss.close();
  }
}
