import Storage from './storage';

// Large catalogs can exceed Android's per-row storage read limit. Split them
// into small rows, and commit the manifest only after all parts are stored.
const CHUNK_SIZE = 128 * 1024;
const queues = new Map();
let sequence = 0;
const serial = (key, action) => {
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  queues.set(key, next);
  next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
  return next;
};
const manifestParts = (value) => value?.contentCacheChunks === 1 && Array.isArray(value.parts)
  ? value.parts : [];

export const readContentCache = (key) => serial(key, async () => {
  const raw = await Storage.getItem(key);
  if (!raw) return null;
  const value = JSON.parse(raw);
  const parts = manifestParts(value);
  if (!parts.length) return value;
  const chunks = [];
  for (let i = 0; i < parts.length; i += 4) {
    chunks.push(...await Promise.all(parts.slice(i, i + 4).map((part) => Storage.getItem(part))));
  }
  if (chunks.some((part) => typeof part !== 'string')) throw Error('Incomplete saved content cache');
  return JSON.parse(chunks.join(''));
});

export const writeContentCache = (key, value) => serial(key, async () => {
  let oldParts = [];
  try { oldParts = manifestParts(JSON.parse(await Storage.getItem(key))); } catch (_) {}
  const text = JSON.stringify(value);
  if (text.length <= CHUNK_SIZE) {
    await Storage.setItem(key, text);
  } else {
    const generation = `${Date.now()}-${sequence++}`;
    const parts = [];
    for (let offset = 0; offset < text.length;) {
      let end = Math.min(offset + CHUNK_SIZE, text.length);
      // Keep UTF-16 surrogate pairs together when native storage encodes UTF-8.
      if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end -= 1;
      const part = `${key}:chunk:${generation}:${parts.length}`;
      await Storage.setItem(part, text.slice(offset, end));
      parts.push(part);
      offset = end;
    }
    await Storage.setItem(key, JSON.stringify({ contentCacheChunks: 1, parts }));
  }
  if (oldParts.length) await Storage.multiRemove(oldParts).catch(() => {});
});
