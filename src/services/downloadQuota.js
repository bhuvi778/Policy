import Storage from './storage';
import { getProfile } from './api';
import { getSubscriptionInfo, MEMBERSHIP_KEYS } from '../utils/subscriptionInfo';
import { extractUserData } from '../utils/extractUserData';
import { IS_PLAY_STORE_BUILD } from '../utils/distribution';

const USAGE_KEY = '@policybhandar_download_usage_v1';
const USER_KEY = '@policybhandar_user';
const ACTIVE_PLAN_FALLBACK_LIMIT = 98;

const todayKey = () => new Date().toISOString().slice(0, 10);

const cleanText = (value = '') => String(value || '').trim();

const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && cleanText(value) !== '');

const toNumber = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
};

const toLimit = (...values) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const getUserKey = (user = {}) =>
  cleanText(user._id || user.id || user.userId || user.mobile || user.phone || user.email || 'guest');

const getPlan = (user = {}) => {
  const record = [user.subscription, user.activeSubscription, user.currentPlan, user.activePlan, user.plan, user.membership]
    .find(value => value && typeof value === 'object' && Object.keys(value).length) || {};
  const metadata = [record.plan, record.planId, user.planId].find(value => value && typeof value === 'object') || {};
  return { ...metadata, ...record };
};
const isAllFreePlan = (user = {}) => getSubscriptionInfo(user).isAllFree;

const mergeUserData = (previous = {}, next = {}) => {
  const merged = { ...previous, ...next };
  if (MEMBERSHIP_KEYS.some(key => Object.prototype.hasOwnProperty.call(next, key))) {
    MEMBERSHIP_KEYS.forEach(key => { delete merged[key]; });
    MEMBERSHIP_KEYS.forEach(key => { if (Object.prototype.hasOwnProperty.call(next, key)) merged[key] = next[key]; });
  }
  return merged;
};

export const hasActivePlan = (user = {}) => getSubscriptionInfo(user).active;

export const getDownloadAllowance = (user = {}) => {
  const plan = getPlan(user);
  if (hasActivePlan(user) && isAllFreePlan(user)) {
    return {
      mode: 'unlimited',
      limit: Infinity,
      label: 'Unlimited downloads',
    };
  }
  if (hasActivePlan(user)) {
    const rawLimit = toLimit(
      plan.dailyDownloadLimit,
      plan.downloadLimit,
      plan.downloadsPerDay,
      plan.downloads,
      user.dailyDownloadLimit,
      user.downloadLimit,
    );
    const limit = rawLimit < 0 ? Infinity : (toNumber(rawLimit) || ACTIVE_PLAN_FALLBACK_LIMIT);

    return {
      mode: Number.isFinite(limit) ? 'daily' : 'unlimited',
      limit,
      label: Number.isFinite(limit) ? `${limit} downloads per day` : 'Unlimited downloads',
    };
  }

  return {
    mode: 'locked',
    limit: 0,
    label: IS_PLAY_STORE_BUILD ? 'Not included in your membership' : 'Activate a plan to download',
  };
};

const readUsageStore = async () => {
  try {
    const raw = await Storage.getItem(USAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
};

const writeUsageStore = async (store) => {
  try {
    await Storage.setItem(USAGE_KEY, JSON.stringify(store || {}));
  } catch (_) {}
};

const normalizeUsage = (usage = {}) => {
  const currentDate = todayKey();
  const normalized = {
    date: usage.date === currentDate ? usage.date : currentDate,
    daily: usage.date === currentDate ? Number(usage.daily || 0) : 0,
    total: Number(usage.total || 0),
  };

  if (!Number.isFinite(normalized.daily) || normalized.daily < 0) normalized.daily = 0;
  if (!Number.isFinite(normalized.total) || normalized.total < 0) normalized.total = 0;
  return normalized;
};

export const getDownloadUsage = async (user = {}) => {
  const store = await readUsageStore();
  return normalizeUsage(store[getUserKey(user)] || {});
};

export const assertCanDownload = async (user = {}) => {
  let quotaUser = user || {};
  let allowance = getDownloadAllowance(quotaUser);

  if (allowance.mode === 'locked') {
    try {
      const profileRes = await getProfile({ timeout: 8000, cache: false });
      const freshUser = extractUserData(profileRes.data);
      if (freshUser) {
        quotaUser = mergeUserData(quotaUser, freshUser);
        await Storage.setItem(USER_KEY, JSON.stringify(quotaUser));
        allowance = getDownloadAllowance(quotaUser);
      }
    } catch (err) {
      console.log('Failed to refresh profile before download:', err?.message);
    }
  }

  if (allowance.mode === 'locked') {
    throw new Error(IS_PLAY_STORE_BUILD ? 'Your account does not have access to this content. Refresh your membership status and try again.' : 'Please activate a membership plan to download or share this content.');
  }
  if (allowance.mode === 'unlimited') {
    return { allowance, usage: await getDownloadUsage(quotaUser), remaining: Infinity, user: quotaUser };
  }
  const usage = await getDownloadUsage(quotaUser);
  const used = allowance.mode === 'daily' ? usage.daily : usage.total;
  const remaining = allowance.limit - used;

  if (remaining <= 0) {
    const message = IS_PLAY_STORE_BUILD ? `Your membership allows ${allowance.limit} downloads per day. Please try again tomorrow.` : `Your plan allows ${allowance.limit} downloads per day. Please try again tomorrow or upgrade your plan.`;
    throw new Error(message);
  }

  return { allowance, usage, remaining, user: quotaUser };
};

export const recordDownload = async (user = {}) => {
  const key = getUserKey(user);
  const store = await readUsageStore();
  const usage = normalizeUsage(store[key] || {});
  usage.daily += 1;
  usage.total += 1;
  store[key] = usage;
  await writeUsageStore(store);
  return usage;
};
