import Storage from './storage';
import {
  apiRequest,
  getSettings,
  getMaterials,
} from './api';
import { normalizeMaterials } from './contentMapper';

export const BRAND = {
  name: 'POLICYBHANDAR',
  email: 'info@policybhandar.in',
  phone: '8424055399',
  address: 'POLICYBHANDAR HQ',
};

export const COMPANY_DETAILS = {
  about:
    "Policy Bhandar is India's complete business builder app for insurance professionals. It is a complete business growth ecosystem for insurance advisors, mutual fund advisors, insurance leaders, agency managers, trainers, and business builders.",
  mission:
    'We are committed to helping every Insurance and Mutual Fund Advisor build a stronger, more profitable, and more professional business through reliable digital tools, practical training, continuous learning, marketing resources, customer relationship support, and technology-led productivity.',
  vision:
    "Our vision is to make Insurance Advisory, Mutual Fund Advisory, Leadership Development, Recruitment, and Business Building more transparent, searchable, organized, and mobile-first for every professional. We aspire to create India's most trusted digital platform where every advisor and leader can learn, grow, recruit, market, and manage their business from a single application.",
};

const CLIENTS_KEY = '@policybhandar_clients';

export const unwrapData = (payload) => {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload;
  if (payload.data !== undefined) return unwrapData(payload.data);
  if (payload.success && typeof payload.success === 'object') return unwrapData(payload.success);
  return payload;
};

export const listFromPayload = (payload) => {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.clients)) return data.clients;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

export const isDisplayName = (value = '') => {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  return (
    !!text &&
    !/^\+?\d[\d\s-]{7,}$/.test(text) &&
    !['user', 'advisor', 'agent', 'member', 'insurance advisor'].includes(lower)
  );
};

export const getAdvisorDisplayName = (...sources) => {
  const candidates = sources.flatMap((user = {}) => [
    user?.name,
    user?.fullName,
    user?.full_name,
    user?.advisorName,
    user?.advisor_name,
    user?.employeeName,
    user?.employee_name,
    user?.customerName,
    user?.customer_name,
    user?.profile?.name,
    user?.profile?.fullName,
    user?.profile?.full_name,
    user?.user?.name,
    user?.user?.fullName,
    user?.data?.name,
    user?.data?.fullName,
    [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    [user?.first_name, user?.last_name].filter(Boolean).join(' '),
  ]);

  return candidates.find(isDisplayName) || 'Insurance Advisor';
};

export const loadAppSettings = async () => {
  try {
    const response = await getSettings();
    const data = unwrapData(response.data) || {};
    return {
      raw: data,
      brandName: pickFirst(data.brandName, data.appName, data.companyName, BRAND.name),
      supportPhone: pickFirst(data.supportPhone, data.phone, data.mobile, data.contactPhone, BRAND.phone),
      supportEmail: pickFirst(data.supportEmail, data.email, data.contactEmail, BRAND.email),
      address: pickFirst(data.address, data.officeAddress, data.location, BRAND.address),
      team: Array.isArray(data.team) ? data.team : [],
      about: data.about || data.aboutUs || COMPANY_DETAILS.about,
      mission: data.mission || COMPANY_DETAILS.mission,
      vision: data.vision || COMPANY_DETAILS.vision,
      terms: Array.isArray(data.terms) ? data.terms : null,
      privacy: Array.isArray(data.privacy) ? data.privacy : null,
    };
  } catch (_) {
    return {
      raw: {},
      brandName: BRAND.name,
      supportPhone: BRAND.phone,
      supportEmail: BRAND.email,
      address: BRAND.address,
      team: [],
      about: COMPANY_DETAILS.about,
      mission: COMPANY_DETAILS.mission,
      vision: COMPANY_DETAILS.vision,
      terms: null,
      privacy: null,
    };
  }
};

export const getAssignedFranchise = (user = {}) => {
  const franchise = user.franchise || user.franchiseId || user.assignedFranchise || {};
  return {
    name: pickFirst(franchise.name, user.franchiseName),
    phone: pickFirst(franchise.phone, franchise.mobile, user.franchisePhone),
  };
};

export const getAssignedRep = (user = {}) => {
  const rep = user.companyRep || user.rep || user.assignedRep || user.relationshipManager || {};
  return {
    name: pickFirst(rep.name, rep.fullName, user.repName, user.companyRepName),
    phone: pickFirst(rep.phone, rep.mobile, user.repPhone, user.companyRepPhone),
  };
};

export const getSubscriptionInfo = (user = {}) => {
  const allFreePlanId = '6a6742abf3b8e2a894a538af';
  const plan =
    user.subscription ||
    user.activeSubscription ||
    user.currentPlan ||
    (user.activePlan && typeof user.activePlan === 'object' ? user.activePlan : null) ||
    user.plan ||
    user.membership ||
    {};
  const name = pickFirst(plan.name, plan.planName, plan.type, user.subscriptionType, user.planName);
  const planText = String([
    plan._id,
    plan.id,
    name,
    plan.segment,
    plan.code,
    plan.slug,
    typeof user.activePlan === 'string' ? user.activePlan : '',
    user.activePlan,
    user.planId,
    user.subscriptionId,
    user.subscriptionType,
    user.planName,
    user.role,
    user.accessRole,
  ].filter((value) => typeof value !== 'object').join(' ')).toLowerCase().replace(/[\s_-]+/g, '');
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
  const isAllFreePlan =
    planText.includes('allfree') ||
    listText.includes('allfree') ||
    planText.includes(allFreePlanId.toLowerCase());
  const validTill = pickFirst(
    plan.validTill,
    plan.expiryDate,
    plan.expiresAt,
    user.expiryDate,
    user.planExpiryDate,
    user.subscriptionEndDate,
    user.subscriptionExpiresAt,
  );
  const status = String(pickFirst(plan.status, user.subscriptionStatus, user.planStatus, user.paymentStatus, '') || '').toLowerCase();
  const expiryTime = validTill ? Date.parse(validTill) : 0;
  const dateStillValid = Number.isFinite(expiryTime) && expiryTime >= Date.now();
  const hasAssignedPlan = Boolean(
    (typeof user.activePlan === 'string' && user.activePlan.trim()) ||
      (user.activePlan && typeof user.activePlan === 'object' && (user.activePlan._id || user.activePlan.id || user.activePlan.name)) ||
      (typeof user.planId === 'string' && user.planId.trim()) ||
      (typeof user.subscriptionId === 'string' && user.subscriptionId.trim())
  );
  const statusBlocksAccess = ['expired', 'inactive', 'cancelled', 'canceled', 'failed'].includes(status);
  const expiryBlocksAccess = Boolean(validTill && !dateStillValid);
  const active = Boolean(
    isAllFreePlan ||
      user.hasActivePlan ||
      user.isSubscribed ||
      plan.active ||
      plan.isActiveSubscription ||
      status === 'active' ||
      status === 'paid' ||
      dateStillValid ||
      (hasAssignedPlan && !statusBlocksAccess && !expiryBlocksAccess)
  );

  return {
    active,
    name: active ? (isAllFreePlan ? 'All Free' : (name || 'Active Plan')) : 'No active plan',
    validTill: active ? validTill : '',
    isAllFree: isAllFreePlan,
  };
};

export const loadLocalClients = async () => {
  const stored = await Storage.getItem(CLIENTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveLocalClients = async (clients) => {
  await Storage.setItem(CLIENTS_KEY, JSON.stringify(clients));
};

export const normalizeClient = (item = {}) => ({
  id: String(item._id || item.id || item.mobile || Date.now()),
  name: pickFirst(item.name, item.fullName, item.clientName, 'Unnamed Client'),
  mobile: pickFirst(item.mobile, item.phone, item.contactNumber, ''),
  email: pickFirst(item.email, item.mail, ''),
  designation: pickFirst(item.designation, item.role, item.profileType, ''),
  dob: pickFirst(item.dob, item.dateOfBirth, ''),
  memberType: pickFirst(item.memberType, item.type, 'Head'),
  policyNo: pickFirst(item.policyNo, item.policyNumber, ''),
  company: pickFirst(item.company, item.insuranceCompany, ''),
  plan: pickFirst(item.plan, item.planName, ''),
  premium: pickFirst(item.premium, item.annualPremium, ''),
  dueDate: pickFirst(item.dueDate, item.nextDueDate, item.renewalDate, ''),
  image: pickFirst(item.image, item.profileImage, item.profilePhoto, ''),
  url: pickFirst(item.url, item.website, item.profileUrl, ''),
  raw: item,
});

const tryApiList = async (paths) => {
  for (const path of paths) {
    try {
      const response = await apiRequest(path, { timeout: 10000 });
      const list = listFromPayload(response.data).map(normalizeClient);
      if (list.length) return list;
    } catch (_) {}
  }
  return [];
};

export const loadClients = async () => {
  const apiClients = await tryApiList([
    '/api/admin/clients',
    '/api/admin/customers',
    '/api/admin/prospects',
    '/api/user/clients',
    '/api/users/clients',
  ]);
  if (apiClients.length) {
    await saveLocalClients(apiClients);
    return apiClients;
  }
  return loadLocalClients();
};

export const saveClient = async (client) => {
  const normalized = normalizeClient(client);
  let savedRemotely = false;
  for (const path of ['/api/admin/clients', '/api/user/clients', '/api/admin/prospects']) {
    try {
      await apiRequest(path, { method: 'POST', body: normalized, timeout: 10000 });
      savedRemotely = true;
      break;
    } catch (_) {}
  }

  const clients = await loadLocalClients();
  const existing = clients.findIndex((item) => item.mobile === normalized.mobile);
  if (existing >= 0) clients[existing] = normalized;
  else clients.push(normalized);
  await saveLocalClients(clients);
  return { client: normalized, savedRemotely };
};

export const loadDueClients = async () => {
  const clients = await loadClients();
  return clients.filter((client) => !!client.dueDate);
};

export const loadDynamicNotifications = async () => {
  for (const path of ['/api/notifications', '/api/user/notifications', '/api/admin/notifications']) {
    try {
      const response = await apiRequest(path, { timeout: 10000 });
      const items = listFromPayload(response.data);
      if (items.length) {
        return items.map((item, index) => ({
          id: String(item._id || item.id || index),
          title: pickFirst(item.title, item.heading, 'Notification'),
          body: pickFirst(item.body, item.message, item.description, ''),
          date: pickFirst(item.date, item.createdAt, 'Latest'),
          time: pickFirst(item.time, item.createdAt, ''),
          unread: item.unread ?? !item.read,
          type: item.type || 'update',
        }));
      }
    } catch (_) {}
  }

  try {
    const response = await getMaterials({ page: 1, limit: 8 });
    return normalizeMaterials(response.data, 'Latest Content').map((item) => ({
      id: item.id,
      title: item.title,
      body: item.subtitle || `${item.type || 'Content'} added to POLICYBHANDAR.`,
      date: 'Latest',
      time: '',
      unread: false,
      type: 'content',
    }));
  } catch (_) {
    return [];
  }
};
