// Main service for the System Monitor plugin.
// UlanziStudio starts this with: node plugin/app.js <address> <port> <language>

import { UlanziApi } from './ulanzi-api/index.js';
import SensorCollector from './sensor-collector.js';
import { renderKey, pageCount } from './display-manager.js';
import { defaultsFor, normalizeSettings } from './settings.js';

const PLUGIN_UUID = 'com.koriyuka.ulanzistudio.sysmon';

const $UD = new UlanziApi();
const keys = {}; // context -> { kind, page, active, settings, lastImage }

let collector = new SensorCollector();
let timer = null;
let timerInterval = 0;

// "com.koriyuka.ulanzistudio.sysmon.gpu" -> "gpu"
function kindFromUuid(uuid) {
  return uuid.split('.').pop();
}

function draw(context, data) {
  const key = keys[context];
  if (!key || !key.active) return;

  const image = renderKey(key.kind, key.page, data, key.settings);
  if (image === key.lastImage) return;
  key.lastImage = image;
  $UD.setBaseDataIcon(context, image);
}

function tick() {
  const data = collector.poll();
  const now = Date.now();
  for (const context of Object.keys(keys)) {
    const key = keys[context];
    const cycleMs = key.settings.autoCycleSec * 1000;
    if (cycleMs > 0 && now - key.pageShownAt >= cycleMs) showPage(key, key.page + 1);
    draw(context, data);
  }
}

function showPage(key, page) {
  key.page = page % pageCount(key.kind);
  key.pageShownAt = Date.now();
  key.lastImage = null;
}

// One loop for every key, at the fastest rate any key asked for. Polling is cheap and
// draw() only sends an image when it changed, so a fast loop just means new
// Afterburner values reach the deck sooner.
function reschedule() {
  const contexts = Object.keys(keys);
  if (contexts.length === 0) {
    clearInterval(timer);
    timer = null;
    timerInterval = 0;
    collector.close();
    return;
  }

  const interval = Math.min(...contexts.map(c => keys[c].settings.refreshMs));
  const gpuIndex = keys[contexts[0]].settings.gpuIndex;
  if (collector.gpuIndex !== gpuIndex) collector.gpuIndex = gpuIndex;

  if (timer && interval === timerInterval) return;
  clearInterval(timer);
  timerInterval = interval;
  timer = setInterval(tick, interval);
}

function applySettings(context, param) {
  const key = keys[context];
  if (!key) return;
  key.settings = normalizeSettings(param || {}, key.kind);
  key.lastImage = null;
  reschedule();
  draw(context, collector.poll());
}

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => {
  console.log(`[sysmon] connected to UlanziStudio as ${PLUGIN_UUID}`);
});

$UD.onAdd(jsn => {
  const context = jsn.context;
  if (!keys[context]) {
    const kind = kindFromUuid(jsn.uuid);
    keys[context] = {
      kind,
      page: 0,
      pageShownAt: Date.now(),
      active: true,
      settings: defaultsFor(kind),
      lastImage: null
    };
  }
  applySettings(context, jsn.param);
});

$UD.onParamFromApp(jsn => applySettings(jsn.context, jsn.param));
$UD.onParamFromPlugin(jsn => applySettings(jsn.context, jsn.param));

// Pressing the key flips to the next page of that monitor.
$UD.onRun(jsn => {
  const key = keys[jsn.context];
  if (!key) {
    $UD.emit('add', jsn);
    return;
  }
  showPage(key, key.page + 1);
  draw(jsn.context, collector.poll());
});

// UlanziStudio sends active=false when the key's page is not on screen.
$UD.onSetActive(jsn => {
  const key = keys[jsn.context];
  if (!key) return;
  key.active = jsn.active;
  if (key.active) {
    key.lastImage = null;
    draw(jsn.context, collector.poll());
  }
});

$UD.onClear(jsn => {
  for (const item of jsn.param || []) delete keys[item.context];
  reschedule();
});

$UD.onClose(() => {
  console.warn('[sysmon] UlanziStudio connection closed, exiting');
  clearInterval(timer);
  collector.close();
  process.exit(0);
});
