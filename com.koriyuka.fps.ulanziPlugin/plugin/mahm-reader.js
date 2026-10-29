// Reads MSI Afterburner's hardware monitoring shared memory ("MAHMSharedMemory").
// Layout reference: MAHMSharedMemory.h shipped with the Afterburner SDK.
//
//   Header  : dwSignature, dwVersion, dwHeaderSize, dwNumEntries, dwEntrySize, time, ...
//   Entry[] : 5 x char[260] strings, then float data/min/max, DWORD flags/gpu/srcId
//
// Afterburner only publishes sensors that are ticked in
// Settings -> Monitoring -> "Active hardware monitoring graphs", and only refreshes
// them once per "Hardware polling period".

import SharedMemory from './shared-memory.js';

const MAHM_SIGNATURE = 0x4D41484D; // 'MAHM'
const MAX_PATH = 260;
const HEADER_PEEK = 32;

// Entry field offsets (bytes from the start of an entry)
const OFF_SRC_NAME = 0;
const OFF_SRC_UNITS = MAX_PATH;
const OFF_DATA = MAX_PATH * 5;
const OFF_MIN = OFF_DATA + 4;
const OFF_MAX = OFF_DATA + 8;
const OFF_FLAGS = OFF_DATA + 12;
const OFF_GPU = OFF_DATA + 16;
const OFF_SRC_ID = OFF_DATA + 20;

function readCString(buffer, offset, maxLength) {
  const end = buffer.indexOf(0, offset);
  const stop = end === -1 || end > offset + maxLength ? offset + maxLength : end;
  return buffer.toString('latin1', offset, stop).trim();
}

export default class MAHMReader {
  constructor() {
    this.memory = new SharedMemory('MAHMSharedMemory');
  }

  close() {
    this.memory.close();
  }

  // Returns { version, time, entries[] }, or null if Afterburner is not publishing.
  read() {
    if (!this.memory.open()) return null;

    const head = this.memory.bytes(HEADER_PEEK);
    if (head.readUInt32LE(0) !== MAHM_SIGNATURE) {
      // Afterburner exited (it writes 0xDEAD) or restarted; drop the stale mapping and retry next poll.
      this.close();
      return null;
    }

    const version = head.readUInt32LE(4);
    const headerSize = head.readUInt32LE(8);
    const numEntries = head.readUInt32LE(12);
    const entrySize = head.readUInt32LE(16);
    const time = head.readUInt32LE(20);

    const buffer = this.memory.bytes(headerSize + numEntries * entrySize);

    const entries = [];
    for (let i = 0; i < numEntries; i++) {
      const base = headerSize + i * entrySize;
      entries.push({
        name: readCString(buffer, base + OFF_SRC_NAME, MAX_PATH),
        units: readCString(buffer, base + OFF_SRC_UNITS, MAX_PATH),
        value: buffer.readFloatLE(base + OFF_DATA),
        min: buffer.readFloatLE(base + OFF_MIN),
        max: buffer.readFloatLE(base + OFF_MAX),
        flags: buffer.readUInt32LE(base + OFF_FLAGS),
        gpu: buffer.readUInt32LE(base + OFF_GPU),
        srcId: buffer.readUInt32LE(base + OFF_SRC_ID)
      });
    }

    return { version, headerSize, entrySize, time, entries };
  }
}
