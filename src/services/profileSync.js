import Storage from './storage';
import { updateProfile, getProfile } from './api';
import { applySavedProfileFields } from '../utils/profileFields';
import { getProfileImageUrl } from '../utils/profileAssets';

const editable = ['name', 'designation', 'email', 'dob', 'pinCode', 'licBranch', 'profileImage'];
const inflight = new Map();
const keyFor = (user) => {
  const id = user?._id || user?.id || user?.userId || user?.mobile || user?.phone || user?.email;
  if (!id) throw new Error('Please sign in again before updating your profile.');
  return `@policybhandar_profile_pending_v1:${encodeURIComponent(String(id))}`;
};
const read = async (key) => {
  const value = await Storage.getItem(key);
  return value ? JSON.parse(value) : null;
};
const write = (key, value) => Storage.setItemDurable(key, JSON.stringify(value));

export const applyPendingProfile = (user, pending) => {
  if (!pending?.patch) return user;
  const next = applySavedProfileFields(user, pending.patch);
  next._pendingProfilePatch = pending.patch;
  next._profileSyncStatus = pending.errorKind === 'auth' || pending.errorKind === 'validation' ? 'blocked' : 'pending';
  next._profileSyncError = pending.message || '';
  if (pending.patch.profileImage?.uri) next._profileImageRevision = pending.revision;
  return next;
};

export const restorePendingProfile = async (user) => {
  if (!user) return user;
  try {
    const pending = await read(keyFor(user));
    if (!pending && user._pendingProfilePatch) {
      const next = { ...user, _profileSyncStatus: 'synced', _profileSyncError: '' };
      delete next._pendingProfilePatch;
      return next;
    }
    return applyPendingProfile(user, pending);
  }
  catch (_) { return user; }
};

export const queueProfileUpdate = async (user, values) => {
  const patch = Object.fromEntries(editable.filter((key) => values[key] !== undefined)
    .map((key) => [key, key === 'profileImage' ? values[key] : String(values[key] ?? '').trim()]));
  const pending = { revision: `${Date.now()}-${Math.random().toString(36).slice(2)}`, patch, lastAttempt: 0 };
  // Persist before changing the visible profile; a storage failure must leave the edit form intact.
  await write(keyFor(user), pending);
  return applyPendingProfile(user, pending);
};

const coreMatches = (returned, patch) => returned && ['name', 'designation', 'email'].every((key) =>
  patch[key] === undefined || String(returned[key] ?? '').trim().toLowerCase() === patch[key].toLowerCase(),
);

export const syncQueuedProfile = async (user, { token, extractUser, isCurrent = () => true, force = false } = {}) => {
  const key = keyFor(user);
  if (inflight.has(key)) {
    await inflight.get(key);
    if (!isCurrent()) return null;
    return syncQueuedProfile(user, { token, extractUser, isCurrent, force });
  }
  const run = async () => {
    const pending = await read(key);
    if (!pending || !token || !isCurrent()) return null;
    if (!force && (Date.now() - pending.lastAttempt < 30000 || ['auth', 'validation'].includes(pending.errorKind))) {
      return { user: applyPendingProfile(user, pending), synced: false };
    }
    const attempt = { ...pending, lastAttempt: Date.now() };
    await write(key, attempt);
    try {
      let response;
      try { response = await updateProfile(pending.patch, { token }); }
      catch (error) {
        if (error?.response?.status !== 415) throw error;
        response = await updateProfile(pending.patch, { token, multipart: true });
      }
      let returned = extractUser?.(response.data);
      if (!returned) returned = extractUser?.((await getProfile({ token, timeout: 10000 })).data);
      // A 200 response containing old values is not a confirmed profile update.
      if (!coreMatches(returned, pending.patch) && !pending.patch.profileImage) {
        response = await updateProfile(pending.patch, { token, multipart: true });
        returned = extractUser?.(response.data);
        if (!returned) returned = extractUser?.((await getProfile({ token, timeout: 10000 })).data);
      }
      if (!coreMatches(returned, pending.patch) || (pending.patch.profileImage && !getProfileImageUrl(returned))) {
        const error = new Error('The server has not confirmed your changes yet. Your edits are saved on this phone.');
        error.code = 'PROFILE_UNCONFIRMED';
        throw error;
      }
      const latest = await read(key);
      if (!isCurrent() || latest?.revision !== pending.revision) return null;
      const next = applySavedProfileFields(user, { ...pending.patch, profileImage: undefined }, returned);
      if (pending.patch.profileImage) next.profileImage = getProfileImageUrl(returned);
      delete next._pendingProfilePatch;
      next._profileSyncStatus = 'synced';
      next._profileSyncError = '';
      await Storage.removeItem(key);
      return { user: next, synced: true };
    } catch (error) {
      const latest = await read(key);
      if (!isCurrent() || latest?.revision !== pending.revision) return null;
      const status = error?.response?.status;
      const errorKind = [401, 403].includes(status) ? 'auth'
        : (status >= 400 && status < 500 && ![408, 429].includes(status)) || (error?.data?.success === false && status && status < 500) ? 'validation' : 'network';
      const message = errorKind === 'auth' ? 'Sign in again to sync your saved changes.'
        : errorKind === 'validation' ? String(error?.data?.message || error.message || 'Please review your profile details.')
        : 'Saved on this phone. Waiting for the server to sync your changes.';
      const failed = { ...attempt, errorKind, message };
      await write(key, failed);
      return { user: applyPendingProfile(user, failed), synced: false };
    }
  };
  const promise = run().finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });
  inflight.set(key, promise);
  return promise;
};
