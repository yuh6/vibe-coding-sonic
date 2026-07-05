import { useEffect, useState } from 'react';
import {
  addFavorite, removeFavorite, getFavoriteStatus,
  rateTrack, getMyRating, getTrackRatings,
} from '../lib/api';

/**
 * 可复用的「❤️ 收藏 + ⭐ 评分」按钮组。
 * - 始终展示全局平均分/评分人数
 * - 登录后可收藏、可打分
 * - 未登录点击 → onRequireAuth 提示
 */
export default function TrackActions({ trackId, user, onRequireAuth, compact = false }) {
  const [favorited, setFavorited] = useState(false);
  const [myScore, setMyScore] = useState(null);
  const [hover, setHover] = useState(0);
  const [ratings, setRatings] = useState({ average: null, count: 0 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!trackId) return undefined;

    getTrackRatings(trackId)
      .then((r) => { if (!cancelled) setRatings(r || { average: null, count: 0 }); })
      .catch(() => {});

    if (user) {
      getFavoriteStatus(trackId)
        .then((r) => { if (!cancelled) setFavorited(Boolean(r?.favorited)); })
        .catch(() => {});
      getMyRating(trackId)
        .then((r) => { if (!cancelled) setMyScore(r?.score || null); })
        .catch(() => {});
    } else {
      setFavorited(false);
      setMyScore(null);
    }

    return () => { cancelled = true; };
  }, [trackId, user]);

  const toggleFavorite = async () => {
    if (!user) { onRequireAuth?.('登录后可以收藏歌曲'); return; }
    if (busy || !trackId) return;
    const next = !favorited;
    setFavorited(next); // 乐观更新
    setBusy(true);
    try {
      if (next) await addFavorite(trackId);
      else await removeFavorite(trackId);
    } catch (err) {
      setFavorited(!next); // 回滚
      if (err.status === 401) onRequireAuth?.('登录后可以收藏歌曲');
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async (score) => {
    if (!user) { onRequireAuth?.('登录后可以评分'); return; }
    if (busy || !trackId) return;
    const prev = myScore;
    setMyScore(score); // 乐观更新
    setBusy(true);
    try {
      await rateTrack(trackId, score);
      const fresh = await getTrackRatings(trackId).catch(() => null);
      if (fresh) setRatings(fresh);
    } catch (err) {
      setMyScore(prev); // 回滚
      if (err.status === 401) onRequireAuth?.('登录后可以评分');
    } finally {
      setBusy(false);
    }
  };

  const starSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleFavorite}
        title={favorited ? '取消收藏' : '收藏'}
        className={`shrink-0 leading-none transition-transform hover:scale-110 ${starSize} ${
          favorited ? 'text-pink-400' : 'text-white/30 hover:text-pink-300'
        }`}
      >
        {favorited ? '❤️' : '🤍'}
      </button>

      <div className="flex items-center" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hover || myScore || 0) >= n;
          return (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHover(n)}
              onClick={() => submitRating(n)}
              title={`评 ${n} 分`}
              className={`leading-none transition-colors ${starSize} ${
                active ? 'text-amber-400' : 'text-white/20 hover:text-amber-300'
              }`}
            >
              ★
            </button>
          );
        })}
      </div>

      {ratings.count > 0 && (
        <span className="shrink-0 text-[10px] text-white/40">
          {ratings.average} ({ratings.count})
        </span>
      )}
    </div>
  );
}
