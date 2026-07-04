/**
 * /ws/radio — 电台实时推送
 * 收听者连接 /ws/radio?stationId=xxx，当电台切歌时收到 track_change 事件。
 *
 * 电台连接不要求强认证（公开电台可匿名收听），但验证 stationId 有效性。
 */
import { createWsServer } from './wsServer.js';
import { arrangerEvents } from '../services/arranger/index.js';
import { getStation, getStationBySession, updateNowPlaying } from '../services/radioService.js';

// stationId -> Set<WsConnection>
const listeners = new Map();

function addListener(stationId, conn) {
  if (!listeners.has(stationId)) listeners.set(stationId, new Set());
  listeners.get(stationId).add(conn);
}

function removeListener(stationId, conn) {
  listeners.get(stationId)?.delete(conn);
  if (listeners.get(stationId)?.size === 0) listeners.delete(stationId);
}

function broadcastToStation(stationId, message) {
  const conns = listeners.get(stationId);
  if (!conns || conns.size === 0) return;
  for (const conn of conns) {
    conn.send(message);
  }
}

async function handleRadioEvent({ sessionId, type, payload }) {
  if (type !== 'track_started' && type !== 'phase_changed') return;

  const stationId = await getStationBySession(sessionId);
  if (!stationId) return;

  if (type === 'track_started' && payload?.trackId) {
    await updateNowPlaying(stationId, payload.trackId);
    broadcastToStation(stationId, {
      type: 'track_change',
      payload: {
        trackId: payload.trackId,
        audioUrl: payload.audioUrl,
        title: payload.title,
        bpm: payload.bpm,
        genre: payload.genre,
      },
    });
  }

  if (type === 'phase_changed') {
    broadcastToStation(stationId, {
      type: 'phase_change',
      payload: { phase: payload?.phase },
    });
  }
}

// 当 arranger session 切歌时，推送给对应电台的收听者
arrangerEvents.on('event', (event) => {
  handleRadioEvent(event).catch((err) => {
    console.error('[ws/radio] event handling failed:', err.message);
  });
});

export function attachWsRadio(httpServer) {
  createWsServer(httpServer, {
    path: '/ws/radio',
    async onConnection(conn, req) {
      const url = new URL(req.url, 'http://localhost');
      const stationId = url.searchParams.get('stationId');

      // 验证电台存在
      if (stationId) {
        const station = await getStation(stationId);
        if (!station) {
          conn.send({ type: 'error', payload: { code: 'STATION_NOT_FOUND', message: '电台不存在' } });
          conn.close();
          return;
        }
        addListener(stationId, conn);
        conn.onClose(() => removeListener(stationId, conn));
      }

      conn.send({ type: 'connected', payload: { stationId: stationId || null } });

      const heartbeat = setInterval(() => conn.ping(), 25_000);
      conn.onClose(() => clearInterval(heartbeat));
    },
  });
}

// 外部调用：电台主动推送切歌（非 arranger 场景，如播放列表模式）
export function pushTrackChange(stationId, track) {
  broadcastToStation(stationId, { type: 'track_change', payload: track });
}
