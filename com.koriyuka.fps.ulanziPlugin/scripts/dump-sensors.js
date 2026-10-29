// Prints every sensor MSI Afterburner is currently publishing.
// Usage: npm run sensors   (MSI Afterburner must be running)

import MAHMReader from '../plugin/mahm-reader.js';

const reader = new MAHMReader();
const snapshot = reader.read();

if (!snapshot) {
  console.error('Could not read MAHMSharedMemory.');
  console.error('Make sure MSI Afterburner is running, then try again.');
  process.exit(1);
}

console.log(`MAHM version 0x${snapshot.version.toString(16)}, header ${snapshot.headerSize} B, entry ${snapshot.entrySize} B, time ${snapshot.time}`);
console.log(`${snapshot.entries.length} sensors:\n`);

for (const e of snapshot.entries) {
  const value = Number.isFinite(e.value) ? e.value.toFixed(2) : String(e.value);
  console.log(`  [gpu ${e.gpu}] [src 0x${e.srcId.toString(16).padStart(8, '0')}] ${JSON.stringify(e.name)} = ${value} ${e.units}`);
}

reader.close();
