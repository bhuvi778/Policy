export const MEMBERSHIP_KEYS = [
  'subscription', 'activeSubscription', 'currentPlan', 'activePlan', 'plan', 'membership',
  'planId', 'subscriptionId', 'subscriptionType', 'planName', 'subscriptionStatus', 'planStatus',
  'hasActivePlan', 'isSubscribed', 'paymentStatus', 'expiryDate', 'planExpiryDate', 'subscriptionEndDate',
  'subscriptionExpiresAt', 'validTill', 'validUntil', 'expiresAt', 'endDate', 'planEndDate',
  'assignedPlans', 'allowedPlans',
];

const object = value => value && typeof value === 'object' && !Array.isArray(value);
const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const yes = value => value === true || value === 1 || value === 'true';
const expires = value => first(value?.validTill, value?.validUntil, value?.expiryDate, value?.expiresAt, value?.endDate, value?.planExpiryDate, value?.planEndDate, value?.subscriptionEndDate, value?.subscriptionExpiresAt);
const statusOf = value => String(value || '').trim().toLowerCase();
const allowedStatus = status => ['active', 'paid', 'trialing', 'trial', 'authenticated'].includes(status);
const blockedStatus = status => ['expired', 'inactive', 'cancelled', 'canceled', 'failed', 'pending', 'created', 'unpaid', 'halted', 'paused', 'revoked'].includes(status);

export const getSubscriptionInfo = (user = {}) => {
  user = user || {};
  const assignment = (Array.isArray(user.assignedPlans) ? user.assignedPlans : []).find(value =>
    object(value) && (allowedStatus(statusOf(value.status)) || yes(value.active) || yes(value.isActiveSubscription)),
  );
  const record = [user.subscription, user.activeSubscription, user.currentPlan, user.activePlan, user.membership, assignment, user.plan]
    .find(value => object(value) && Object.keys(value).length) || {};
  const metadata = [record.plan, record.planId, user.planId].find(object) || {};
  const plan = { ...metadata, ...record };
  const name = first(plan.name, plan.planName, user.subscriptionType, user.planName, plan.type) || '';
  const validTill = expires(record) || expires(user) || '';
  const status = statusOf(first(record.status, user.subscriptionStatus, user.planStatus));
  const ids = [plan._id, plan.id, name, plan.code, plan.slug, user.activePlan, user.planId,
    user.subscriptionId, user.role, user.accessRole].filter(value => typeof value === 'string');
  const labels = [user.roles, user.permissions, user.allowedPlans, user.assignedPlans].flatMap(value => Array.isArray(value) ? value : [])
    .map(value => typeof value === 'string' ? value : first(value?.name, value?.planName, value?.role, value?.code) || '');
  const allFreeText = [...ids, ...labels].join(' ').toLowerCase().replace(/[\s_-]+/g, '');
  const isAllFree = allFreeText.includes('allfree') || ids.includes('6a6742abf3b8e2a894a538af');
  const expiryTime = validTill ? Date.parse(validTill) : 0;
  const expiryBlocked = !!validTill && (!Number.isFinite(expiryTime) || expiryTime < Date.now());
  const hasAssignment = Boolean(user.activePlan || user.planId || user.subscriptionId || assignment || record._id || record.id);
  const assignedActivePlan = typeof user.activePlan === 'string' ? !!user.activePlan.trim()
    : object(user.activePlan) && !!(user.activePlan._id || user.activePlan.id || user.activePlan.name);
  const confirmedPaidAssignment = !status && hasAssignment && statusOf(user.paymentStatus) === 'paid';
  const confirmed = isAllFree || assignedActivePlan || confirmedPaidAssignment || yes(user.hasActivePlan) || yes(user.isSubscribed) || yes(record.active) || yes(record.isActiveSubscription) || allowedStatus(status);
  // A plan selected during registration or an unpaid Razorpay subscription must not unlock access.
  const active = !blockedStatus(status) && !expiryBlocked && Boolean(confirmed || (hasAssignment && !!validTill && expiryTime >= Date.now()));
  return { active, name: active ? (isAllFree ? 'All Free' : name || 'Active Plan') : 'No active plan', validTill: active ? validTill : '', isAllFree };
};
