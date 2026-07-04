/**
 * 本地文件存储实现 — 开发模式
 * 文件存储到 server/data/audio-cache/，通过 Express static 提供访问
 */
import { createWriteStream, existsSync, mkdirSync, unlinkSync, readdirSync, statSync, rmdirSync, writeFileSync } from 'fs';
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
    mkdirSync(dirname(filePath), { recursive: true });
    if (Buffer.isBuffer(streamOrBuffer) || ArrayBuffer.isView(streamOrBuffer)) {
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

/**
 * 清理过期的本地缓存文件（超过 maxAgeMs 毫秒的文件）
 * 递归遍历 CACHE_DIR，删除超时文件并清理空目录。
 */
export async function cleanupLocalCache(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const now = Date.now();
  let removed = 0;

  function walkAndClean(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndClean(fullPath);
        // 尝试删除空目录
        try {
          const remaining = readdirSync(fullPath);
          if (remaining.length === 0) rmdirSync(fullPath);
        } catch {}
      } else if (entry.isFile() && entry.name !== '.gitkeep') {
        try {
          const stat = statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            unlinkSync(fullPath);
            removed++;
          }
        } catch {}
      }
    }
  }

  walkAndClean(CACHE_DIR);
  if (removed > 0) {
    console.log(`[cleanup] Removed ${removed} expired audio cache files`);
  }
}
