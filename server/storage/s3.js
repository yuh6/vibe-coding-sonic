/**
 * S3 兼容存储实现 — 首选 Cloudflare R2，兼容阿里 OSS / AWS S3 / MinIO
 *
 * 环境变量：
 *   S3_ENDPOINT    — https://<account_id>.r2.cloudflarestorage.com
 *   S3_REGION      — auto (R2 必须为 auto)
 *   S3_BUCKET      — vibe-audio
 *   S3_ACCESS_KEY  — R2 API Token 的 Access Key ID
 *   S3_SECRET_KEY  — R2 API Token 的 Secret Access Key
 *   S3_PUBLIC_URL  — https://audio.yourdomain.com (R2 自定义域名或公共访问 URL)
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const UPLOAD_TIMEOUT_MS = 60_000; // 上传超时 60 秒

let client = null;

function getClient() {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'auto',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
      forcePathStyle: true, // R2/MinIO 兼容
    });
  }
  return client;
}

const BUCKET = process.env.S3_BUCKET || 'vibe-audio';
const PUBLIC_URL = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');

/** 带重试的 S3 命令执行 */
async function sendWithRetry(command, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await getClient().send(command, {
        requestTimeout: UPLOAD_TIMEOUT_MS,
      });
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = RETRY_DELAY_MS * attempt;
      console.warn(`[storage/r2] attempt ${attempt}/${retries} failed: ${err.message}, retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export const s3 = {
  async upload(key, streamOrBuffer, contentType = 'audio/mpeg') {
    let body;
    if (Buffer.isBuffer(streamOrBuffer) || ArrayBuffer.isView(streamOrBuffer)) {
      body = streamOrBuffer;
    } else if (streamOrBuffer[Symbol.asyncIterator]) {
      // 将 async iterable 转为 Buffer
      const chunks = [];
      for await (const chunk of streamOrBuffer) chunks.push(chunk);
      body = Buffer.concat(chunks);
    } else if (typeof streamOrBuffer.read === 'function') {
      // Readable stream → Buffer
      const { Readable } = await import('stream');
      const chunks = [];
      for await (const chunk of Readable.from(streamOrBuffer)) chunks.push(chunk);
      body = Buffer.concat(chunks);
    } else {
      body = streamOrBuffer;
    }

    await sendWithRetry(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // R2 建议设置 Content-Disposition 便于浏览器下载
      ContentDisposition: contentType.startsWith('audio/') ? 'inline' : undefined,
      // R2 缓存控制
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
  },

  getUrl(key) {
    return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
  },

  async delete(key) {
    try {
      await sendWithRetry(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }), 2);
    } catch {
      // 删除失败不抛出——幂等操作
    }
  },

  async exists(key) {
    try {
      await getClient().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return true;
    } catch {
      return false;
    }
  },
};
