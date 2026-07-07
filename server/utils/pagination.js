export function clampInt(value, { defaultValue = 0, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  const normalized = Math.trunc(parsed);
  return Math.min(max, Math.max(min, normalized));
}

export function paginationFromQuery(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  return {
    page: clampInt(query.page, { defaultValue: 1, min: 1 }),
    limit: clampInt(query.limit, { defaultValue: defaultLimit, min: 1, max: maxLimit }),
  };
}
