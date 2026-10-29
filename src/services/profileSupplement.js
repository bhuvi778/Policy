import Storage from './storage';
import { normalizeProfileFields } from '../utils/profileFields';
import { restorePendingProfile } from './profileSync';

const keyFor = (user) => {
  const identity = user?._id || user?.id || user?.userId || user?.mobile || user?.phone || user?.email;
  return identity ? `@policybhandar_profile_fields_v1:${encodeURIComponent(String(identity))}` : '';
};

export const restoreProfileSupplement = async (user) => {
  const key = keyFor(user);
  if (!key) return normalizeProfileFields(user || {});
  try {
    const stored = await Storage.getItem(key);
    const fields = user._localProfileFields || (stored ? JSON.parse(stored) : null);
    return restorePendingProfile(normalizeProfileFields({ ...user, ...(fields ? { _localProfileFields: fields } : {}) }));
  } catch (_) { return normalizeProfileFields(user); }
};

export const persistProfileSupplement = async (user) => {
  const key = keyFor(user);
  if (key && user?._localProfileFields) await Storage.setItem(key, JSON.stringify(user._localProfileFields));
};
