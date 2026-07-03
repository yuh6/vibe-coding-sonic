/**
 * 极简 WebSocket 服务端（RFC 6455），无第三方依赖。
 *
 * 背景：沙箱环境无法访问 npm registry（`npm install ws` 返回 403），设计文档 §11 要求的
 * `/ws/events` 又只需要「服务端单向推送事件」这一种能力 —— 不需要客户端消息路由、子协议
 * 协商、分片重组等 `ws` 库的完整能力。因此这里只实现推送场景必需的最小子集：
 *   - HTTP Upgrade 握手（Sec-WebSocket-Accept 计算）
 *   - 服务端→客户端文本帧发送（不分片，单帧 FIN=1）
 *   - 客户端 ping/pong 心跳应答、close 帧处理
 * 不实现：客户端→服务端消息分片重组、掩码之外的其它 opcode、扩展协商。
 * 若未来需要接收客户端消息（目前设计中 /ws/events 只推送，不接收），需要补上分片重组逻辑。
 */
import { createHash, randomBytes } from 'crypto';

const WEBSOCKET_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const OPCODE = { CONTINUATION: 0x0, TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa };

function acceptKey(clientKey) {
  return createHash('sha1').update(clientKey + WEBSOCKET_MAGIC).digest('base64');
}

function encodeFrame(payload, opcode = OPCODE.TEXT) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len = data.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode; // FIN=1 + opcode，服务端下发不加掩码

  return Buffer.concat([header, data]);
}

/** 解析客户端发来的帧（客户端必须掩码）；仅支持单帧（无分片），够用于 ping/pong/close */
function decodeFrame(buffer) {
  if (buffer.length < 2) return null;
  const fin = (buffer[0] & 0x80) !== 0;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let len = buffer[1] & 0x7f;
  let offset = 2;

  if (len === 126) {
    if (buffer.length < 4) return null;
    len = buffer.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    if (buffer.length < 10) return null;
    len = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    maskKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + len) return null;
  const payload = Buffer.from(buffer.subarray(offset, offset + len));
  if (masked) {
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return { fin, opcode, payload, frameLength: offset + len };
}

class WsConnection {
  constructor(socket) {
    this.socket = socket;
    this.alive = true;
    this._buffer = Buffer.alloc(0);
    this._onMessage = null;
    this._onClose = [];

    socket.on('data', (chunk) => this._handleData(chunk));
    socket.on('close', () => this._handleClose());
    socket.on('error', () => this._handleClose());
  }

  _handleData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk]);
    for (;;) {
      const frame = decodeFrame(this._buffer);
      if (!frame) return;
      this._buffer = this._buffer.subarray(frame.frameLength);

      if (frame.opcode === OPCODE.CLOSE) {
        this.close();
        return;
      }
      if (frame.opcode === OPCODE.PING) {
        this._send(frame.payload, OPCODE.PONG);
      } else if (frame.opcode === OPCODE.PONG) {
        this.alive = true;
      } else if (frame.opcode === OPCODE.TEXT && this._onMessage) {
        this._onMessage(frame.payload.toString('utf8'));
      }
    }
  }

  _handleClose() {
    if (!this.alive) return;
    this.alive = false;
    for (const cb of this._onClose) cb();
  }

  onMessage(cb) {
    this._onMessage = cb;
  }

  onClose(cb) {
    this._onClose.push(cb);
  }

  _send(payload, opcode) {
    if (!this.alive) return;
    try {
      this.socket.write(encodeFrame(payload, opcode));
    } catch {
      this._handleClose();
    }
  }

  send(obj) {
    const text = typeof obj === 'string' ? obj : JSON.stringify(obj);
    this._send(text, OPCODE.TEXT);
  }

  ping() {
    this._send(Buffer.alloc(0), OPCODE.PING);
  }

  close() {
    if (!this.alive) return;
    try {
      this.socket.write(encodeFrame(Buffer.alloc(0), OPCODE.CLOSE));
      this.socket.end();
    } catch {
      // socket 可能已断开，忽略
    }
    this._handleClose();
  }
}

/**
 * 挂载到 http.Server 的 upgrade 事件上，只接受路径匹配的连接。
 * onConnection(conn: WsConnection, req) 由调用方注册业务逻辑。
 */
export function createWsServer(httpServer, { path = '/ws/events', onConnection } = {}) {
  httpServer.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }
    if (url.pathname !== path) {
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      '',
      '',
    ].join('\r\n');

    socket.write(responseHeaders);
    if (head && head.length) socket._readableState && socket.unshift(head);

    const conn = new WsConnection(socket);
    onConnection?.(conn, req);
  });
}

export function randomWsKeyForTesting() {
  return randomBytes(16).toString('base64');
}
