// Reads RivaTuner Statistics Server's shared memory ("RTSSSharedMemoryV2").
// RTSS measures framerate itself and updates it every frame, so this is much
// fresher than the copy MSI Afterburner republishes once per polling period.
//
// Layout (confirmed against a live dump, RTSS shared memory v2.21):
//   Header : dwSignature 'RTSS', dwVersion, dwAppEntrySize, dwAppArrOffset, dwAppArrSize, ...
//   AppEntry (one per hooked process):
//     +0   dwProcessID
//     +4   szName[260]          full path of the executable
//     +264 dwFlags
//     +268 dwTime0, dwTime1     framerate period, GetTickCount() ms
//     +276 dwFrames             frames presented in that period
//     +280 dwFrameTime          last frame time, microseconds

import koffi from 'koffi';
import SharedMemory from './shared-memory.js';

const RTSS_SIGNATURE = 0x52545353; // 'RTSS'
const OFF_PID = 0;
const OFF_TIME0 = 268;
const OFF_TIME1 = 272;
const OFF_FRAMES = 276;
const OFF_FRAMETIME = 280;

// An entry whose framerate period ended longer ago than this is not rendering any more
// (game minimized, paused on a loading screen, or closed).
const STALE_MS = 2000;

const kernel32 = koffi.load('kernel32.dll');
const user32 = koffi.load('user32.dll');
const GetTickCount = kernel32.func('uint32_t __stdcall GetTickCount()');
const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()');
const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)');

function foregroundPid() {
  const hwnd = GetForegroundWindow();
  if (!hwnd) return 0;
  const pid = [0];
  GetWindowThreadProcessId(hwnd, pid);
  return pid[0];
}

export default class RTSSReader {
  constructor() {
    this.memory = new SharedMemory('RTSSSharedMemoryV2');
  }

  close() {
    this.memory.close();
  }

  // Returns { fps, frametime, pid } for the game being rendered right now,
  // or null when RTSS isn't running or nothing is drawing frames.
  read() {
    if (!this.memory.open()) return null;

    const head = this.memory.bytes(20);
    if (head.readUInt32LE(0) !== RTSS_SIGNATURE) {
      // RTSS exited or restarted; drop the stale mapping and retry next poll.
      this.close();
      return null;
    }
    const entrySize = head.readUInt32LE(8);
    const arrOffset = head.readUInt32LE(12);
    const arrSize = head.readUInt32LE(16);
    const buffer = this.memory.bytes(arrOffset + arrSize * entrySize);

    const now = GetTickCount();
    const front = foregroundPid();
    let best = null;

    for (let i = 0; i < arrSize; i++) {
      const base = arrOffset + i * entrySize;
      const pid = buffer.readUInt32LE(base + OFF_PID);
      if (!pid) continue;

      const time0 = buffer.readUInt32LE(base + OFF_TIME0);
      const time1 = buffer.readUInt32LE(base + OFF_TIME1);
      const frames = buffer.readUInt32LE(base + OFF_FRAMES);
      const frameTimeUs = buffer.readUInt32LE(base + OFF_FRAMETIME);
      if (!time1 || time1 <= time0 || !frames) continue;

      // Unsigned subtraction so this survives GetTickCount wrapping after 49.7 days.
      const age = (now - time1) >>> 0;
      if (age > STALE_MS) continue;

      const entry = {
        pid,
        fps: (1000 * frames) / (time1 - time0),
        frametime: frameTimeUs ? frameTimeUs / 1000 : null,
        age
      };
      if (pid === front) return entry;
      if (!best || entry.age < best.age) best = entry;
    }

    return best;
  }
}
