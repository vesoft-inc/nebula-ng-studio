import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { binaryExtension, expectedBinaryFormat, readBinaryArchitecture } from '../scripts/binary-arch.mjs';

function tempFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-binary-arch-'));
  const file = path.join(dir, 'binary');
  fs.writeFileSync(file, contents);
  return file;
}

function macho(arch) {
  const buffer = Buffer.alloc(32);
  buffer.writeUInt32LE(0xfeedfacf, 0);
  buffer.writeUInt32LE(arch === 'arm64' ? 0x0100000c : 0x01000007, 4);
  return buffer;
}

function elf(arch) {
  const buffer = Buffer.alloc(64);
  buffer[0] = 0x7f;
  buffer.write('ELF', 1, 'latin1');
  buffer[4] = 2;
  buffer[5] = 1;
  buffer.writeUInt16LE(arch === 'arm64' ? 0xb7 : 0x3e, 18);
  return buffer;
}

function pe(arch) {
  const buffer = Buffer.alloc(256);
  buffer[0] = 0x4d;
  buffer[1] = 0x5a;
  buffer.writeUInt32LE(0x80, 0x3c);
  buffer.write('PE\0\0', 0x80, 'latin1');
  buffer.writeUInt16LE(arch === 'arm64' ? 0xaa64 : 0x8664, 0x84);
  return buffer;
}

test('readBinaryArchitecture identifies thin Mach-O binaries', () => {
  assert.deepEqual(readBinaryArchitecture(tempFile(macho('arm64'))), { format: 'mach-o', arch: 'arm64' });
  assert.deepEqual(readBinaryArchitecture(tempFile(macho('x64'))), { format: 'mach-o', arch: 'x64' });
});

test('readBinaryArchitecture identifies ELF binaries', () => {
  assert.deepEqual(readBinaryArchitecture(tempFile(elf('x64'))), { format: 'elf', arch: 'x64' });
  assert.deepEqual(readBinaryArchitecture(tempFile(elf('arm64'))), { format: 'elf', arch: 'arm64' });
});

test('readBinaryArchitecture identifies PE binaries', () => {
  assert.deepEqual(readBinaryArchitecture(tempFile(pe('x64'))), { format: 'pe', arch: 'x64' });
  assert.deepEqual(readBinaryArchitecture(tempFile(pe('arm64'))), { format: 'pe', arch: 'arm64' });
});

test('readBinaryArchitecture rejects unknown input', () => {
  assert.deepEqual(readBinaryArchitecture(tempFile(Buffer.from('hello'))), {
    format: 'unknown',
    arch: 'unknown',
  });
});

test('platform helpers map extensions and formats', () => {
  assert.equal(binaryExtension('win32'), '.exe');
  assert.equal(binaryExtension('darwin'), '');
  assert.equal(expectedBinaryFormat('darwin'), 'mach-o');
  assert.equal(expectedBinaryFormat('win32'), 'pe');
  assert.equal(expectedBinaryFormat('linux'), 'elf');
});
