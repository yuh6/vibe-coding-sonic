/**
 * /ws/events 事件推送 — docs/ai-music-engine-design.md §11
 * 订阅 arrangerEvents 全局总线，按 sessionId 过滤后推给对应的 WebSocket 连接。
 *
 * 认证：连接时通过 query string token= 验证用户身份；无效 token 拒绝连接。
 */
import { createWsServer } from './wsServer.js';
import { arrangerEvents } from '../services/arranger/index.js';
import { getOrCreateGuestUser, getUserBySession, GUEST_COOKIE, SESSION_COOKIE } from '../services/authService.js';
import { parseCookies } from '../middleware/userAuth.js';

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
 * 客户端连接时通过 query string 指定订阅的会话：/ws/events?sessionId=xxx&token=yyy
 * token 可通过 query string 或 cookie 传递。未认证的连接会被拒绝。
 */
export function attachWsEvents(httpServer) {
  createWsServer(httpServer, {
    path: '/ws/events',
    async onConnection(conn, req) {
      const url = new URL(req.url, 'http://localhost');
      const sessionId = url.searchParams.get('sessionId');

      // 认证：优先 query token，其次 cookie
      const cookies = parseCookies(req);
      const token = url.searchParams.get('token') || cookies?.[SESSION_COOKIE] || null;
      let user = await getUserBySession(token);
      if (!user && cookies?.[GUEST_COOKIE]) {
        user = (await getOrCreateGuestUser(cookies[GUEST_COOKIE])).user;
      }
      if (!user) {
        conn.send({ type: 'error', payload: { code: 'UNAUTHORIZED', message: '未认证' } });
        conn.close();
        return;
      }

      if (sessionId) {
        addSubscriber(sessionId, conn);
        conn.onClose(() => removeSubscriber(sessionId, conn));
      }

      conn.send({ type: 'connected', payload: { sessionId: sessionId || null, userId: user.id } });

      // 心跳：每 25 秒 ping 一次，检测死连接
      const heartbeat = setInterval(() => conn.ping(), 25_000);
      conn.onClose(() => clearInterval(heartbeat));
    },
  });
}
