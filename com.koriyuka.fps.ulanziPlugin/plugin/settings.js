// Default per-key settings. The property inspector sends strings ("60", "on"),
// so everything passes through normalizeSettings before use.

export const DEFAULT_SETTINGS = {
  showGraph: true,
  colorCoding: true,
  fpsGood: 60,
  fpsWarn: 30,
  gpuHot: 83,
  cpuHot: 90,
  refreshMs: 250,
  gpuIndex: 0,
  autoCycleSec: 0
};

// The Overview key flips through its pages on its own unless told otherwise.
export function defaultsFor(kind) {
  return { ...DEFAULT_SETTINGS, autoCycleSec: kind === 'combined' ? 5 : 0 };
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'on' || value === 'true';
}

function toNumber(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function normalizeSettings(raw = {}, kind) {
  const d = defaultsFor(kind);
  return {
    showGraph: toBool(raw.showGraph, d.showGraph),
    colorCoding: toBool(raw.colorCoding, d.colorCoding),
    fpsGood: toNumber(raw.fpsGood, d.fpsGood, 1, 1000),
    fpsWarn: toNumber(raw.fpsWarn, d.fpsWarn, 1, 1000),
    gpuHot: toNumber(raw.gpuHot, d.gpuHot, 40, 120),
    cpuHot: toNumber(raw.cpuHot, d.cpuHot, 40, 120),
    refreshMs: toNumber(raw.refreshMs, d.refreshMs, 250, 5000),
    gpuIndex: toNumber(raw.gpuIndex, d.gpuIndex, 0, 7),
    autoCycleSec: toNumber(raw.autoCycleSec, d.autoCycleSec, 0, 60)
  };
}
