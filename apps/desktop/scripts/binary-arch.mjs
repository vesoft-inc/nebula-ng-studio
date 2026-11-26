import fs from 'node:fs';

const MACHO_MAGIC_64 = 0xfeedfacf;
const CPU_TYPE_X86_64 = 0x01000007;
const CPU_TYPE_ARM64 = 0x0100000c;

const ELF_MACHINE_X86_64 = 0x3e;
const ELF_MACHINE_AARCH64 = 0xb7;

const PE_MACHINE_X64 = 0x8664;
const PE_MACHINE_ARM64 = 0xaa64;

function readHeader(file, length = 64 * 1024) {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytes = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytes);
  } finally {
    fs.closeSync(fd);
  }
}

function machoArch(buffer) {
  const littleEndian = buffer.readUInt32LE(0) === MACHO_MAGIC_64;
  const bigEndian = buffer.readUInt32BE(0) === MACHO_MAGIC_64;
  if (!littleEndian && !bigEndian) return null;

  const cpuType = littleEndian ? buffer.readUInt32LE(4) : buffer.readUInt32BE(4);
  if (cpuType === CPU_TYPE_ARM64) return 'arm64';
  if (cpuType === CPU_TYPE_X86_64) return 'x64';
  return 'unknown';
}

function elfArch(buffer) {
  if (buffer.length < 20 || buffer[0] !== 0x7f || buffer.toString('latin1', 1, 4) !== 'ELF') {
    return null;
  }
  const littleEndian = buffer[5] === 1;
  const byteOrder = littleEndian ? 'readUInt16LE' : 'readUInt16BE';
  const machine = buffer[byteOrder](18);
  if (machine === ELF_MACHINE_X86_64) return 'x64';
  if (machine === ELF_MACHINE_AARCH64) return 'arm64';
  return 'unknown';
}

function peArch(buffer) {
  if (buffer.length < 64 || buffer[0] !== 0x4d || buffer[1] !== 0x5a) return null;
  const peOffset = buffer.readUInt32LE(0x3c);
  if (peOffset + 6 > buffer.length) return 'unknown';
  if (buffer.toString('latin1', peOffset, peOffset + 4) !== 'PE\0\0') return null;

  const machine = buffer.readUInt16LE(peOffset + 4);
  if (machine === PE_MACHINE_X64) return 'x64';
  if (machine === PE_MACHINE_ARM64) return 'arm64';
  return 'unknown';
}

/**
 * Read a native executable's architecture without relying on platform tools
 * (`file`, `lipo`, PowerShell). Supports thin Mach-O, ELF, and PE binaries.
 */
export function readBinaryArchitecture(file) {
  const buffer = readHeader(file);
  if (buffer.length === 0) return { format: 'unknown', arch: 'unknown' };

  const macho = machoArch(buffer);
  if (macho) return { format: 'mach-o', arch: macho };

  const elf = elfArch(buffer);
  if (elf) return { format: 'elf', arch: elf };

  const pe = peArch(buffer);
  if (pe) return { format: 'pe', arch: pe };

  return { format: 'unknown', arch: 'unknown' };
}

export const binaryExtension = (platform = process.platform) => (platform === 'win32' ? '.exe' : '');

export const expectedBinaryFormat = (platform = process.platform) => {
  if (platform === 'darwin') return 'mach-o';
  if (platform === 'win32') return 'pe';
  if (platform === 'linux') return 'elf';
  return 'unknown';
};
