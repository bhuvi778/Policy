import Storage from './storage';
import { getProfile } from './api';

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

const getPlan = (user = {}) =>
  user.subscription ||
  user.activeSubscription ||
  user.currentPlan ||
  (user.activePlan && typeof user.activePlan === 'object' ? user.activePlan : null) ||
  user.plan ||
  user.membership ||
  {};

const isAllFreePlan = (user = {}) => {
  const allFreePlanId = '6a6742abf3b8e2a894a538af';
  const plan = getPlan(user);
  const text = [
    plan._id,
    plan.id,
    plan.name,
    plan.planName,
    plan.type,
    plan.segment,
    plan.code,
    plan.slug,
    typeof user.activePlan === 'string' ? user.activePlan : '',
    user.subscriptionType,
    user.planName,
    user.role,
    user.accessRole,
  ]
    .filter((value) => typeof value !== 'object')
    .join(' ')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  const listText = [
    user.roles,
    user.permissions,
    user.allowedPlans,
    user.assignedPlans,
  ]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .map((value) => typeof value === 'string' ? value : pickFirst(value?.name, value?.planName, value?.role, value?.code))
    .join(' ')
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  return text.includes('allfree') || listText.includes('allfree') || text.includes(allFreePlanId.toLowerCase());
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const extractUserData = (payload) => {
  if (!isObject(payload)) return null;
  const direct = [
    payload.user,
    payload.profile,
    payload.advisor,
    payload.employee,
    payload.customer,
    payload.member,
    payload.account,
  ].find(isObject);
  if (direct) return extractUserData(direct) || direct;
  if (isObject(payload.success)) return extractUserData(payload.success) || payload.success;
  if (isObject(payload.data)) return extractUserData(payload.data) || payload.data;
  if (
    payload.name ||
    payload.fullName ||
    payload.full_name ||
    payload.mobile ||
    payload.email ||
    payload.designation ||
    payload.activePlan ||
    payload.subscription ||
    payload.currentPlan
  ) {
    return payload;
  }
  return null;
};

const mergeUserData = (previous = {}, next = {}) => ({ ...previous, ...next });

const hasAssignedPlan = (user = {}) => Boolean(
  (typeof user.activePlan === 'string' && user.activePlan.trim()) ||
    (user.activePlan && typeof user.activePlan === 'object' && (user.activePlan._id || user.activePlan.id || user.activePlan.name)) ||
    (typeof user.planId === 'string' && user.planId.trim()) ||
    (typeof user.subscriptionId === 'string' && user.subscriptionId.trim())
);

export const hasActivePlan = (user = {}) => {
  const plan = getPlan(user);
  const status = cleanText(
    pickFirst(plan.status, user.subscriptionStatus, user.planStatus, user.paymentStatus),
  ).toLowerCase();
  const validTill = pickFirst(plan.validTill, plan.expiryDate, user.expiryDate, user.subscriptionEndDate);
  const expiresAt = validTill ? Date.parse(validTill) : 0;
  const dateStillValid = Number.isFinite(expiresAt) && expiresAt >= Date.now();
  const statusBlocksAccess = ['expired', 'inactive', 'cancelled', 'canceled', 'failed'].includes(status);
  const expiryBlocksAccess = Boolean(validTill && !dateStillValid);

  return Boolean(
    isAllFreePlan(user) ||
      user.hasActivePlan ||
      user.isSubscribed ||
      plan.active ||
      plan.isActiveSubscription ||
      status === 'active' ||
      status === 'paid' ||
      dateStillValid ||
      (hasAssignedPlan(user) && !statusBlocksAccess && !expiryBlocksAccess)
  );
};

export const getDownloadAllowance = (user = {}) => {
  const plan = getPlan(user);
  if (isAllFreePlan(user)) {
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
    label: 'Activate a plan to download',
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
    throw new Error('Please activate a membership plan to download or share this content.');
  }
  if (allowance.mode === 'unlimited') {
    return { allowance, usage: await getDownloadUsage(quotaUser), remaining: Infinity, user: quotaUser };
  }
  const usage = await getDownloadUsage(quotaUser);
  const used = allowance.mode === 'daily' ? usage.daily : usage.total;
  const remaining = allowance.limit - used;

  if (remaining <= 0) {
    const message = `Your plan allows ${allowance.limit} downloads per day. Please try again tomorrow or upgrade your plan.`;
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
