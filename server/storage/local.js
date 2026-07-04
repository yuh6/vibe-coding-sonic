/**
 * 本地文件存储实现 — 开发模式
 * 文件存储到 server/data/audio-cache/，通过 Express static 提供访问
 */
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../data/audio-cache');
if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

export const local = {
  async upload(key, streamOrBuffer, _contentType) {
    const filePath = join(CACHE_DIR, key);
    if (Buffer.isBuffer(streamOrBuffer) || ArrayBuffer.isView(streamOrBuffer)) {
      const { writeFileSync } = await import('fs');
      writeFileSync(filePath, streamOrBuffer);
    } else {
      const file = createWriteStream(filePath);
      if (streamOrBuffer.pipe) {
        await finished(streamOrBuffer.pipe(file));
      } else if (streamOrBuffer[Symbol.asyncIterator]) {
        await finished(Readable.from(streamOrBuffer).pipe(file));
      }
    }
    return `/audio-cache/${key}`;
  },

  getUrl(key) {
    return `/audio-cache/${key}`;
  },

  async delete(key) {
    const filePath = join(CACHE_DIR, key);
    try { unlinkSync(filePath); } catch {}
  },

  async exists(key) {
    return existsSync(join(CACHE_DIR, key));
  },
};
