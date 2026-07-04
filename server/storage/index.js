/**
 * 对象存储抽象层入口
 *
 * STORAGE_DRIVER=local (默认) → 本地 audio-cache/
 * STORAGE_DRIVER=r2           → Cloudflare R2（推荐生产环境）
 * STORAGE_DRIVER=s3           → AWS S3 / MinIO
 * STORAGE_DRIVER=oss          → 阿里 OSS
 *
 * 统一接口：
 *   storage.upload(key, stream, contentType) → Promise<publicUrl>
 *   storage.getUrl(key)                     → string
 *   storage.delete(key)                     → Promise<void>
 *   storage.exists(key)                     → Promise<boolean>
 */

const STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

let storage;

if (STORAGE_DRIVER === 's3' || STORAGE_DRIVER === 'r2' || STORAGE_DRIVER === 'oss') {
  const { s3 } = await import('./s3.js');
  storage = s3;
  console.log(`[storage] Using ${STORAGE_DRIVER.toUpperCase()}-compatible:`, process.env.S3_ENDPOINT);
} else {
  const { local } = await import('./local.js');
  storage = local;
  console.log('[storage] Using local filesystem: server/data/audio-cache/');
}

export { storage };
