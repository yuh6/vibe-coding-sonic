/**
 * S3 兼容存储实现 — 支持 Cloudflare R2 / 阿里 OSS / AWS S3 / MinIO
 *
 * 环境变量：
 *   S3_ENDPOINT    — https://xxx.r2.cloudflarestorage.com
 *   S3_REGION      — auto (R2) / cn-hangzhou (OSS) / us-east-1 (AWS)
 *   S3_BUCKET      — vibe-audio
 *   S3_ACCESS_KEY  — access key
 *   S3_SECRET_KEY  — secret key
 *   S3_PUBLIC_URL  — https://audio.yourdomain.com (CDN 公开前缀)
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

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
      forcePathStyle: true, // MinIO/R2 兼容
    });
  }
  return client;
}

const BUCKET = process.env.S3_BUCKET || 'vibe-audio';
const PUBLIC_URL = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');

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

    await getClient().send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
  },

  getUrl(key) {
    return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `${process.env.S3_ENDPOINT}/${BUCKET}/${key}`;
  },

  async delete(key) {
    try {
      await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    } catch {}
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
