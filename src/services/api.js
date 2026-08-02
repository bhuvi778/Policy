export const BASE_URL = 'https://api2.primeimpact.in';

let currentToken = null;
const PUBLIC_GET_CACHE_TTL_MS = 45 * 1000;
const publicGetCache = new Map();
const publicGetInflight = new Map();

export class ApiError extends Error {
  constructor(message, response, data) {
    super(message);
    this.name = 'ApiError';
    this.response = response;
    this.data = data;
  }
}

export const setAuthToken = (token) => {
  currentToken = token || null;
};

const buildUrl = (path, params = {}) => {
  const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const isFormData = (body) =>
  typeof FormData !== 'undefined' && body instanceof FormData;

const toJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
};

export const apiRequest = async (path, options = {}) => {
  const {
    method = 'GET',
    params,
    body,
    headers = {},
    token = currentToken,
    timeout = 15000,
    cache = true,
  } = options;

  const hasFormBody = isFormData(body);
  const url = buildUrl(path, params);
  const methodName = String(method || 'GET').toUpperCase();
  const canUsePublicGetCache = cache !== false && methodName === 'GET' && !body && token === null;
  const cacheKey = canUsePublicGetCache ? url : '';

  if (canUsePublicGetCache) {
    const cached = publicGetCache.get(cacheKey);
    if (cached && Date.now() - cached.savedAt <= PUBLIC_GET_CACHE_TTL_MS) {
      return { data: cached.data, status: cached.status, headers: cached.headers };
    }
    const inflight = publicGetInflight.get(cacheKey);
    if (inflight) return inflight;
  }

  const runRequest = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body && !hasFormBody ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body ? (hasFormBody ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
      });

      const data = await toJson(response);
      if (!response.ok || data?.success === false) {
        const message =
          data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`;
        throw new ApiError(message, response, data);
      }

      const result = { data, status: response.status, headers: response.headers };
      if (canUsePublicGetCache) {
        publicGetCache.set(cacheKey, { ...result, savedAt: Date.now() });
      }
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timed out. Please try again.', null, null);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (canUsePublicGetCache) publicGetInflight.delete(cacheKey);
    }
  };

  const requestPromise = runRequest();
  if (canUsePublicGetCache) {
    publicGetInflight.set(cacheKey, requestPromise);
  }
  return requestPromise;
};

const isMissingEndpointError = (error) => {
  const status = error?.response?.status;
  const message = String(
    error?.data?.error ||
    error?.data?.message ||
    error?.message ||
    ''
  ).toLowerCase();

  return (
    status === 404 ||
    message.includes('cannot post') ||
    message.includes('cannot put') ||
    message.includes('not found')
  );
};

const formDataFrom = (payload = {}) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      formData.append(key, value);
    }
  });
  return formData;
};

const compactPayload = (payload = {}) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      value !== undefined && value !== null && value !== ''
    ),
  );

const PROFILE_IMAGE_FIELDS = [
  'profileImage',
  'profilePhoto',
  'photo',
  'avatar',
  'image',
  'file',
];

const isUploadFile = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.uri === 'string' &&
  value.uri.trim();

const getProfileImageFile = (payload = {}) => {
  for (const field of PROFILE_IMAGE_FIELDS) {
    if (isUploadFile(payload[field])) return payload[field];
  }
  return null;
};

const withoutProfileImageFields = (payload = {}) =>
  Object.fromEntries(
    Object.entries(payload).filter(([key]) => !PROFILE_IMAGE_FIELDS.includes(key)),
  );

const isUnexpectedUploadFieldError = (error) => {
  const message = String(
    error?.data?.error ||
    error?.data?.message ||
    error?.message ||
    ''
  ).toLowerCase();
  return message.includes('unexpected field') || message.includes('unexpected file field');
};

export const sendOTP = (mobile, email, name = '', password = '') =>
  apiRequest('/api/auth/register-init', {
    method: 'POST',
    body: { mobile, email, name, password },
  });

export const checkMobileRegistration = async (mobile) => {
  try {
    const res = await apiRequest('/api/auth/register-init', {
      method: 'POST',
      body: { mobile },
      timeout: 10000,
    });

    const payload = res.data || {};
    const exists =
      payload.exists ??
      payload.registered ??
      payload.isRegistered ??
      payload.userExists ??
      payload?.user?.exists;

    if (typeof exists === 'boolean') {
      return { exists };
    }

    return { exists: false };
  } catch (error) {
    const message = String(
      error?.data?.error ||
      error?.data?.message ||
      error?.message ||
      ''
    ).toLowerCase();

    if (
      message.includes('already registered') ||
      message.includes('already exist') ||
      message.includes('duplicate')
    ) {
      return { exists: true };
    }

    if (
      message.includes('email: please add an email') ||
      message.includes('email: please add a valid email') ||
      message.includes('please add an email') ||
      message.includes('please add a valid email')
    ) {
      return { exists: false };
    }

    if (message.includes('password') && !message.includes('email')) {
      return { exists: true };
    }

    throw error;
  }
};

export const loginUser = (identifier, password) => {
  const normalizedIdentifier = String(identifier || '').trim();
  const digits = normalizedIdentifier.replace(/\D/g, '');
  const isEmail = normalizedIdentifier.includes('@');
  const mobile = !isEmail && digits.length >= 10 ? digits.slice(-10) : '';
  const email = isEmail ? normalizedIdentifier : '';

  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: {
      identifier: normalizedIdentifier,
      ...(mobile ? { mobile } : {}),
      ...(email ? { email } : {}),
      password,
    },
  });
};

export const setRegistrationPassword = async ({
  mobile = '',
  email = '',
  currentPassword = '',
  newPassword = '',
} = {}) => {
  const nextPass = String(newPassword || '').trim();
  const oldPass = String(currentPassword || '').trim();
  if (!nextPass || !oldPass || nextPass === oldPass) return null;

  const endpoints = [
    '/api/auth/change-password',
    '/api/auth/password',
    '/api/auth/set-password',
    '/api/auth/update-password',
    '/api/user/change-password',
    '/api/users/change-password',
  ];

  const baseIdentity = {
    ...(mobile ? { mobile } : {}),
    ...(email ? { email } : {}),
  };
  const payloads = [
    {
      ...baseIdentity,
      currentPassword: oldPass,
      oldPassword: oldPass,
      password: oldPass,
      newPassword: nextPass,
      confirmPassword: nextPass,
      password_confirmation: nextPass,
    },
    {
      ...baseIdentity,
      currentPassword: oldPass,
      newPassword: nextPass,
      confirmPassword: nextPass,
    },
    {
      ...baseIdentity,
      oldPassword: oldPass,
      newPassword: nextPass,
      confirmPassword: nextPass,
    },
    {
      ...baseIdentity,
      password: oldPass,
      newPassword: nextPass,
      password_confirmation: nextPass,
    },
  ];

  let lastError = null;
  for (const path of endpoints) {
    for (const body of payloads) {
      for (const method of ['POST', 'PUT']) {
        try {
          return await apiRequest(path, {
            method,
            body,
            timeout: 10000,
          });
        } catch (error) {
          lastError = error;
          const status = error?.response?.status;
          if (status === 401 || status === 403) throw error;
          if (isMissingEndpointError(error)) continue;
        }
      }
    }
  }

  if (lastError && isMissingEndpointError(lastError)) {
    throw new ApiError(
      'Password update is not available on the backend. Please start signup again so your password is saved before OTP.',
      null,
      null,
    );
  }

  throw lastError || new ApiError('Unable to set registration password.', null, null);
};

export const verifyOTP = (userId, otp) =>
  apiRequest('/api/auth/verify-otp', {
    method: 'POST',
    body: { userId, otp },
  });

const extractUserId = (payload = {}) =>
  payload?.userId ||
  payload?.id ||
  payload?._id ||
  payload?.data?.userId ||
  payload?.data?.id ||
  payload?.data?._id ||
  payload?.user?._id ||
  payload?.user?.id ||
  payload?.data?.user?._id ||
  payload?.data?.user?.id ||
  '';

const extractResetToken = (payload = {}) =>
  payload?.resetToken ||
  payload?.passwordResetToken ||
  payload?.token ||
  payload?.data?.resetToken ||
  payload?.data?.passwordResetToken ||
  payload?.data?.token ||
  '';

const throwIfActionableResetError = (error) => {
  if (isMissingEndpointError(error)) return false;

  const status = error?.response?.status;
  const message = String(
    error?.data?.error ||
    error?.data?.message ||
    error?.message ||
    ''
  ).toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    message.includes('invalid otp') ||
    message.includes('wrong otp') ||
    message.includes('incorrect otp') ||
    message.includes('expired otp') ||
    message.includes('otp expired') ||
    message.includes('user not found') ||
    message.includes('not registered') ||
    message.includes('does not exist') ||
    message.includes('no account')
  ) {
    throw error;
  }

  return false;
};

export const requestPasswordResetOtp = async (mobile = '') => {
  const phone = String(mobile || '').replace(/\D/g, '').slice(-10);
  const endpoints = [
    '/api/auth/forgot-password',
    '/api/auth/forgot-password/send-otp',
    '/api/auth/password/forgot',
    '/api/auth/reset-password/request',
    '/api/auth/send-reset-otp',
    '/api/auth/send-otp',
  ];
  const payloads = [
    { mobile: phone },
    { phone },
    { identifier: phone },
    { mobile: phone, type: 'forgot-password' },
    { phone, type: 'forgot-password' },
  ].map(compactPayload);

  let lastError = null;
  for (const path of endpoints) {
    for (const body of payloads) {
      try {
        const res = await apiRequest(path, {
          method: 'POST',
          body,
          timeout: 10000,
        });
        return {
          ...res,
          userId: extractUserId(res.data),
          resetToken: extractResetToken(res.data),
        };
      } catch (error) {
        lastError = error;
        throwIfActionableResetError(error);
      }
    }
  }

  throw lastError || new ApiError('Forgot password endpoint is not available.', null, null);
};

export const verifyPasswordResetOtp = async ({
  mobile = '',
  userId = '',
  otp = '',
} = {}) => {
  const phone = String(mobile || '').replace(/\D/g, '').slice(-10);
  const endpoints = [
    '/api/auth/forgot-password/verify-otp',
    '/api/auth/reset-password/verify-otp',
    '/api/auth/verify-reset-otp',
    '/api/auth/verify-otp',
  ];
  const payloads = [
    { mobile: phone, userId, otp, type: 'forgot-password' },
    { phone, userId, otp, type: 'forgot-password' },
    { mobile: phone, otp, type: 'forgot-password' },
    { phone, otp, type: 'forgot-password' },
    { userId, otp },
    { mobile: phone, otp },
    { phone, otp },
  ].map(compactPayload);

  let lastError = null;
  for (const path of endpoints) {
    for (const body of payloads) {
      try {
        const res = await apiRequest(path, {
          method: 'POST',
          body,
          timeout: 10000,
        });
        return {
          ...res,
          userId: extractUserId(res.data) || userId,
          resetToken: extractResetToken(res.data),
        };
      } catch (error) {
        lastError = error;
        throwIfActionableResetError(error);
      }
    }
  }

  return {
    data: { success: true, deferred: true },
    status: 200,
    headers: null,
    userId,
    resetToken: '',
  };
};

export const resetForgotPassword = async ({
  mobile = '',
  userId = '',
  otp = '',
  resetToken = '',
  password = '',
} = {}) => {
  const phone = String(mobile || '').replace(/\D/g, '').slice(-10);
  const nextPassword = String(password || '').trim();
  const endpoints = [
    '/api/auth/reset-password',
    '/api/auth/forgot-password/reset',
    '/api/auth/password/reset',
    '/api/auth/update-password',
    '/api/auth/set-password',
  ];
  const basePayload = {
    mobile: phone,
    phone,
    identifier: phone,
    userId,
    otp,
    resetToken,
    token: resetToken,
    password: nextPassword,
    newPassword: nextPassword,
    confirmPassword: nextPassword,
    password_confirmation: nextPassword,
    type: 'forgot-password',
  };
  const payloads = [
    basePayload,
    { mobile: phone, userId, otp, password: nextPassword, confirmPassword: nextPassword },
    { mobile: phone, userId, otp, newPassword: nextPassword, confirmPassword: nextPassword },
    { phone, otp, newPassword: nextPassword, confirmPassword: nextPassword },
    { identifier: phone, otp, password: nextPassword },
    { token: resetToken, password: nextPassword, confirmPassword: nextPassword },
    { resetToken, newPassword: nextPassword, confirmPassword: nextPassword },
  ].map(compactPayload);

  let lastError = null;
  for (const path of endpoints) {
    for (const body of payloads) {
      for (const method of ['POST', 'PUT']) {
        try {
          return await apiRequest(path, {
            method,
            body,
            timeout: 10000,
          });
        } catch (error) {
          lastError = error;
          throwIfActionableResetError(error);
        }
      }
    }
  }

  throw lastError || new ApiError('Password reset endpoint is not available.', null, null);
};

export const completeProfile = (data) =>
  apiRequest('/api/auth/complete-profile', {
    method: 'POST',
    body: formDataFrom(data),
  });

export const getProfile = (options = {}) => apiRequest('/api/auth/me', options);

export const updateProfile = async (data = {}) => {
  const imageFile = getProfileImageFile(data);
  const textPayload = withoutProfileImageFields(data);

  if (!imageFile) {
    return apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: formDataFrom(textPayload),
    });
  }

  let lastUnexpectedFieldError = null;
  for (const field of PROFILE_IMAGE_FIELDS) {
    try {
      return await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: formDataFrom({
          ...textPayload,
          [field]: imageFile,
        }),
      });
    } catch (error) {
      if (!isUnexpectedUploadFieldError(error)) throw error;
      lastUnexpectedFieldError = error;
    }
  }

  throw lastUnexpectedFieldError || new ApiError('Profile image upload field is not accepted by the backend.', null, null);
};

export const changePassword = async (data) => {
  const endpoints = [
    '/api/auth/change-password',
    '/api/auth/password',
    '/api/user/change-password',
    '/api/users/change-password',
  ];

  let lastError = null;
  for (const path of endpoints) {
    try {
      return await apiRequest(path, {
        method: 'POST',
        body: data,
        timeout: 10000,
      });
    } catch (error) {
      lastError = error;
      const status = error?.response?.status;
      const message = String(error?.message || '').toLowerCase();
      if (status && status !== 404) throw error;
      if (!status && !message.includes('404') && !message.includes('cannot post')) throw error;
    }
  }

  throw lastError || new ApiError('Password change endpoint is not available.', null, null);
};

export const getMaterialCategories = (options = {}) =>
  apiRequest('/api/materials/categories', options);

export const getMaterialSubcategories = (categoryId, options = {}) =>
  apiRequest(`/api/materials/categories/${categoryId}/subcategories`, options);

export const getAllMaterialSubcategories = (options = {}) =>
  apiRequest('/api/materials/subcategories', options);

export const getMaterials = (params = {}, options = {}) =>
  apiRequest('/api/materials', { ...options, params });

export const createMaterial = (body, options = {}) =>
  apiRequest('/api/admin/materials', {
    ...options,
    method: 'POST',
    body,
  });

export const getMaterialTags = () => apiRequest('/api/materials/tags');

export const downloadMaterial = (id, body = {}) =>
  apiRequest(`/api/materials/${id}/download`, { method: 'POST', body });

export const getDirectDownload = (params = {}) =>
  apiRequest('/api/materials/download-direct', { params });

export const getDownloadJob = (jobId) =>
  apiRequest(`/api/materials/download-job/${jobId}`);

export const getPlans = () => apiRequest('/api/plans');

export const createPaymentOrder = (body) =>
  apiRequest('/api/payments/create-order', {
    method: 'POST',
    body,
  });

export const createPaymentSubscription = (body) =>
  apiRequest('/api/payments/create-subscription', {
    method: 'POST',
    body,
  });

export const validatePaymentCoupon = (code) =>
  apiRequest('/api/payments/validate-coupon', {
    method: 'POST',
    body: { code },
  });

export const verifyPaymentOrder = (body) =>
  apiRequest('/api/payments/verify', {
    method: 'POST',
    body,
  });

export const verifyPaymentSubscription = (body) =>
  apiRequest('/api/payments/verify-subscription', {
    method: 'POST',
    body,
  });

export const getTrainingCategories = () =>
  apiRequest('/api/trainings/categories');

export const getTrainings = (params = {}) =>
  apiRequest('/api/trainings', { params });

export const getTestimonials = () => apiRequest('/api/testimonials');

export const submitTestimonial = (body) =>
  apiRequest('/api/testimonials', { method: 'POST', body });

export const getBlogs = (params = {}) =>
  apiRequest('/api/blogs', { params });

export const getBlogBySlug = (slug) => apiRequest(`/api/blogs/${slug}`);

export const getSettings = () => apiRequest('/api/settings');

export const submitContact = (body) =>
  apiRequest('/api/contacts', { method: 'POST', body });

export default {
  get: (path, config = {}) => apiRequest(path, { ...config, method: 'GET' }),
  post: (path, body, config = {}) => apiRequest(path, { ...config, method: 'POST', body }),
  put: (path, body, config = {}) => apiRequest(path, { ...config, method: 'PUT', body }),
  delete: (path, config = {}) => apiRequest(path, { ...config, method: 'DELETE' }),
};
