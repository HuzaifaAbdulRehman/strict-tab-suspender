import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconDirectory = path.join(root, 'src', 'icons');

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type, 'ascii');
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function png(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const put = (x, y, red, green, blue, alpha = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const index = y * (size * 4 + 1) + 1 + x * 4;
    pixels.set([red, green, blue, alpha], index);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - (size - 1) / 2;
      const dy = y - (size - 1) / 2;
      if (dx * dx + dy * dy <= (size * 0.45) ** 2) put(x, y, 7, 89, 133);
      const moonX = x - size * 0.57;
      const moonY = y - size * 0.43;
      if (moonX * moonX + moonY * moonY <= (size * 0.2) ** 2) put(x, y, 248, 250, 252);
      const cutX = x - size * 0.64;
      const cutY = y - size * 0.35;
      if (cutX * cutX + cutY * cutY <= (size * 0.2) ** 2) put(x, y, 7, 89, 133);
      if (x >= size * 0.25 && x <= size * 0.7 && y >= size * 0.61 && y <= size * 0.76)
        put(x, y, 245, 158, 11);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(iconDirectory, { recursive: true });
await Promise.all(
  [16, 32, 48, 128].map((size) =>
    writeFile(path.join(iconDirectory, `icon-${size}.png`), png(size)),
  ),
);
