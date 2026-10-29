// Maps a named Windows shared-memory section read-only.
// MSI Afterburner ("MAHMSharedMemory") and RTSS ("RTSSSharedMemoryV2") both publish one.

import koffi from 'koffi';

const FILE_MAP_READ = 0x0004;

const kernel32 = koffi.load('kernel32.dll');
const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
const OpenFileMappingW = kernel32.func('HANDLE __stdcall OpenFileMappingW(uint32_t dwDesiredAccess, int bInheritHandle, const char16_t *lpName)');
const MapViewOfFile = kernel32.func('void * __stdcall MapViewOfFile(HANDLE hFileMappingObject, uint32_t dwDesiredAccess, uint32_t dwFileOffsetHigh, uint32_t dwFileOffsetLow, size_t dwNumberOfBytesToMap)');
const UnmapViewOfFile = kernel32.func('int __stdcall UnmapViewOfFile(void *lpBaseAddress)');
const CloseHandle = kernel32.func('int __stdcall CloseHandle(HANDLE hObject)');

export default class SharedMemory {
  constructor(name) {
    this.name = name;
    this.handle = null;
    this.view = null;
  }

  get isOpen() {
    return this.view !== null;
  }

  // Returns true when the section exists and is mapped.
  open() {
    if (this.isOpen) return true;

    const handle = OpenFileMappingW(FILE_MAP_READ, 0, this.name);
    if (!handle) return false;

    const view = MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0);
    if (!view) {
      CloseHandle(handle);
      return false;
    }

    this.handle = handle;
    this.view = view;
    return true;
  }

  close() {
    if (this.view) UnmapViewOfFile(this.view);
    if (this.handle) CloseHandle(this.handle);
    this.view = null;
    this.handle = null;
  }

  // Live, zero-copy view of the first `length` bytes. Do not keep it after close().
  bytes(length) {
    return Buffer.from(koffi.view(this.view, length));
  }
}
