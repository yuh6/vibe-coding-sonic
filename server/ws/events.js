/**
 * /ws/events 事件推送 — docs/ai-music-engine-design.md §11
 * 订阅 arrangerEvents 全局总线，按 sessionId 过滤后推给对应的 WebSocket 连接。
 */
import { createWsServer } from './wsServer.js';
import { arrangerEvents } from '../services/arranger/index.js';

// sessionId -> Set<WsConnection>
const subscribers = new Map();

function addSubscriber(sessionId, conn) {
  if (!subscribers.has(sessionId)) subscribers.set(sessionId, new Set());
  subscribers.get(sessionId).add(conn);
}

function removeSubscriber(sessionId, conn) {
  subscribers.get(sessionId)?.delete(conn);
  if (subscribers.get(sessionId)?.size === 0) subscribers.delete(sessionId);
}

arrangerEvents.on('event', ({ sessionId, type, payload, at }) => {
  const conns = subscribers.get(sessionId);
  if (!conns || conns.size === 0) return;
  const message = { type, payload, at };
  for (const conn of conns) {
    conn.send(message);
  }
});

/**
 * 客户端连接时通过 query string 指定订阅的会话：/ws/events?sessionId=xxx
 * 未带 sessionId 的连接只接收心跳，不接收业务事件（避免误订阅全量广播）。
 */
export function attachWsEvents(httpServer) {
  createWsServer(httpServer, {
    path: '/ws/events',
    onConnection(conn, req) {
      const url = new URL(req.url, 'http://localhost');
      const sessionId = url.searchParams.get('sessionId');

      if (sessionId) {
        addSubscriber(sessionId, conn);
        conn.onClose(() => removeSubscriber(sessionId, conn));
      }

      conn.send({ type: 'connected', payload: { sessionId: sessionId || null } });

      // 心跳：每 25 秒 ping 一次，检测死连接（客户端 30 秒内无 pong 响应即视为断开由 TCP 层处理）
      const heartbeat = setInterval(() => conn.ping(), 25_000);
      conn.onClose(() => clearInterval(heartbeat));
    },
  });
}
