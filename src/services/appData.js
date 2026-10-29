import Storage from './storage';
import { isDisplayName, getAdvisorDisplayName } from '../utils/profileIdentity';
export { isDisplayName, getAdvisorDisplayName } from '../utils/profileIdentity';
import {
  apiRequest,
  getSettings,
  getAuthSessionVersion,
} from './api';
import { loadCachedMaterialMatches } from './contentMapper';
import { loadPublicDisplayData } from './publicDataCache';

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

export const loadAppSettings = async (options = {}) => {
  try {
    return await loadPublicDisplayData('settings', async () => {
      const response = await getSettings({ token: null, timeout: 9000 });
      const data = unwrapData(response.data);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid settings response');
      return {
        raw: {},
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
    }, options);
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
  try {
    const stored = await Storage.getItem(CLIENTS_KEY);
    const clients = stored ? JSON.parse(stored) : [];
    return Array.isArray(clients) ? clients : [];
  } catch (_) { return []; }
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
      return list;
    } catch (error) {
      // Alternative routes only help when a route is absent. Retrying a network
      // outage or an authorization error against every route stalls the screen.
      if (![404, 405].includes(error?.response?.status)) throw error;
    }
  }
  return [];
};

let clientsRequest = null;
let clientsRequestSession = -1;
let clientsSnapshot = null;
export const loadClients = async (options = {}) => {
  const session = getAuthSessionVersion();
  // The legacy disk list has no owner. Only publish a previously resolved
  // current-session list early; never flash another account's legacy cache.
  if (clientsSnapshot?.session === session && clientsSnapshot.items.length) {
    options.onCached?.(clientsSnapshot.items);
  }
  const local = await loadLocalClients();
  if (session !== getAuthSessionVersion()) return [];
  if (!clientsRequest || clientsRequestSession !== session) {
    clientsRequestSession = session;
    const request = tryApiList([
      '/api/user/clients', '/api/users/clients', '/api/admin/clients',
      '/api/admin/customers', '/api/admin/prospects',
    ]).then(async (apiClients) => {
      if (session !== getAuthSessionVersion()) return [];
      if (apiClients.length) {
        await saveLocalClients(apiClients);
        return apiClients;
      }
      // Keep records entered locally when the server has no copy yet.
      return loadLocalClients();
    }).finally(() => { if (clientsRequest === request) clientsRequest = null; });
    clientsRequest = request;
  }
  try {
    const clients = await clientsRequest;
    if (session !== getAuthSessionVersion()) return [];
    clientsSnapshot = { session, items: clients };
    return clients;
  } catch (_) {
    if (session !== getAuthSessionVersion()) return [];
    clientsSnapshot = { session, items: local };
    return local;
  }
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

export const loadDueClients = async (options = {}) => {
  const clients = await loadClients({ ...options, onCached: (items) => options.onCached?.(items.filter((client) => !!client.dueDate)) });
  return clients.filter((client) => !!client.dueDate);
};

let notificationsState = null;
let notificationsRequest = null;
export const loadDynamicNotifications = async (options = {}) => {
  const session = getAuthSessionVersion();
  if (notificationsState?.session === session) {
    options.onCached?.(notificationsState.items);
    if (Date.now() - notificationsState.at < 60000) return notificationsState.items;
  }
  if (notificationsRequest?.session === session) return notificationsRequest.promise;
  const promise = fetchDynamicNotifications().then((items) => {
    if (session !== getAuthSessionVersion()) return [];
    notificationsState = { session, items, at: Date.now() };
    return items;
  }).catch(() => notificationsState?.session === session ? notificationsState.items : [])
    .finally(() => { if (notificationsRequest?.promise === promise) notificationsRequest = null; });
  notificationsRequest = { session, promise };
  return promise;
};

const fetchDynamicNotifications = async () => {
  for (const path of ['/api/notifications', '/api/user/notifications', '/api/admin/notifications']) {
    try {
      const response = await apiRequest(path, { timeout: 10000 });
      const items = listFromPayload(response.data);
      return items.map((item, index) => ({
          id: String(item._id || item.id || index),
          title: pickFirst(item.title, item.heading, 'Notification'),
          body: pickFirst(item.body, item.message, item.description, ''),
          date: pickFirst(item.date, item.createdAt, 'Latest'),
          time: pickFirst(item.time, item.createdAt, ''),
          unread: item.unread ?? !item.read,
          type: item.type || 'update',
      }));
    } catch (error) {
      if (![404, 405].includes(error?.response?.status)) throw error;
    }
  }

  try {
    const items = await loadCachedMaterialMatches('', { section: 'Latest Content', limit: 8 });
    return items.map((item) => ({
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
