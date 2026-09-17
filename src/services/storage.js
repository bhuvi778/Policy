/**
 * Safe storage wrapper — uses @react-native-async-storage if available,
 * falls back to a Map-based in-memory store so the app never crashes.
 */

let _AsyncStorage = null;
let _nativeOk = false;

try {
  const mod = require('@react-native-async-storage/async-storage');
  _AsyncStorage = mod.default || mod;
  // Quick check — if the native module is null it throws on first use
  _nativeOk = !!_AsyncStorage;
} catch (_) {
  _nativeOk = false;
}

// In-memory fallback (survives the session but not app restarts)
const _mem = new Map();

const Storage = {
  async getItem(key) {
    if (_nativeOk) {
      try { return await _AsyncStorage.getItem(key); } catch (_) {}
    }
    return _mem.get(key) ?? null;
  },

  async setItem(key, value) {
    _mem.set(key, value);
    if (_nativeOk) {
      try { await _AsyncStorage.setItem(key, value); return; } catch (_) {}
    }
  },

  async removeItem(key) {
    _mem.delete(key);
    if (_nativeOk) {
      try { await _AsyncStorage.removeItem(key); return; } catch (_) {}
    }
  },

  async multiRemove(keys) {
    keys.forEach(k => _mem.delete(k));
    if (_nativeOk) {
      try { await _AsyncStorage.multiRemove(keys); return; } catch (_) {}
    }
  },

  async getAllKeys() {
    const memKeys = Array.from(_mem.keys());
    if (_nativeOk) {
      try {
        const nativeKeys = await _AsyncStorage.getAllKeys();
        return Array.from(new Set([...memKeys, ...(nativeKeys || [])]));
      } catch (_) {}
    }
    return memKeys;
  },
};

export default Storage;
