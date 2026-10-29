import { readContentCache, writeContentCache } from './contentCacheStorage';

// Only public, display-only metadata belongs here. Account data and payment
// operations must continue to use their authenticated service paths.
const entries = new Map();
const reads = new Map();
const pending = new Map();
const failures = new Map();
const PREFIX = '@policybhandar_public_display_v1:';
const TTL = 2 * 60 * 1000;

const readSaved = (key) => {
  if (entries.has(key)) return Promise.resolve(entries.get(key));
  if (reads.has(key)) return reads.get(key);
  const read = readContentCache(PREFIX + key).then((saved) => {
    if (saved && saved.value !== undefined && Number.isFinite(saved.savedAt)) {
      entries.set(key, saved);
      return saved;
    }
    return null;
  }).catch(() => null).finally(() => reads.delete(key));
  reads.set(key, read);
  return read;
};

export const loadPublicDisplayData = async (key, fetchValue, options = {}) => {
  const saved = await readSaved(key);
  if (saved) options.onUpdate?.(saved.value);
  if (!options.refresh && saved && Date.now() - saved.savedAt < TTL) return saved.value;
  if (!options.refresh && failures.has(key) && Date.now() - failures.get(key).at < 15000) {
    if (saved) return saved.value;
    throw failures.get(key).error;
  }
  let request = pending.get(key);
  if (!request) {
    request = Promise.resolve().then(fetchValue).then(async (value) => {
      if (value === undefined || value === null) throw Error('Invalid display data response');
      const entry = { value, savedAt: Date.now() };
      entries.set(key, entry);
      failures.delete(key);
      await writeContentCache(PREFIX + key, entry).catch(() => {});
      return value;
    }).catch((error) => {
      failures.set(key, { at: Date.now(), error });
      throw error;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
  }
  const update = request.then((value) => {
    options.onUpdate?.(value);
    return value;
  });
  if (saved && !options.refresh) {
    update.catch(() => {});
    return saved.value;
  }
  try { return await update; } catch (error) {
    if (saved) return saved.value;
    throw error;
  }
};
