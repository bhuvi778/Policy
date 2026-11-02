const text = (value) => typeof value === 'string' ? value.trim() : '';

export const isStoreUrl = (value = '') => {
  const url = String(value).trim().toLowerCase();
  return /^(market|itms-apps|itms):/.test(url) ||
    /^https?:\/\/(play\.google\.com|apps\.apple\.com|itunes\.apple\.com)([/:?#]|$)/.test(url);
};

export const isHttpsPaymentUrl = (value) => /^https:\/\//i.test(text(value)) && !isStoreUrl(value);

export const getCheckoutDetails = (payload = {}, mode = 'direct') => {
  payload = payload || {};
  const data = payload.data || {};
  const record = mode === 'trial'
    ? (data.subscription || payload.subscription || data)
    : (data.order || payload.order || data);
  const key = text(payload.key || data.key || payload.razorpayKey || data.razorpayKey || payload.key_id || data.key_id);
  const id = text(mode === 'trial'
    ? record.subscription_id || record.id
    : record.order_id || record.id);
  const expectedPrefix = mode === 'trial' ? 'sub_' : 'order_';
  const nativeReady = Boolean(key && id.startsWith(expectedPrefix));
  const values = [payload.paymentUrl, payload.paymentLink, payload.short_url, payload.url,
    data.paymentUrl, data.paymentLink, data.short_url, data.url, record.short_url];
  return { key, data: { ...record, id }, nativeReady, url: values.find(isHttpsPaymentUrl) || '' };
};

export const buildRazorpayOptions = (checkout = {}) => {
  const trial = checkout.mode === 'trial';
  const data = checkout.data || {};
  const id = text(trial ? data.subscription_id || data.id : data.order_id || data.id);
  if (!checkout.key || !id.startsWith(trial ? 'sub_' : 'order_')) {
    throw new Error('The server did not provide a valid Razorpay checkout. Please retry.');
  }
  return {
    key: checkout.key,
    ...(trial ? { subscription_id: id } : { order_id: id, amount: data.amount }),
    currency: data.currency || 'INR',
    name: 'Policybhandar',
    description: `${checkout.planName || 'Membership'} - ${trial ? 'Free Trial' : 'Buy Now'}`,
    prefill: {
      name: checkout.user?.name || '', email: checkout.user?.email || '', contact: checkout.user?.mobile || '',
    },
    theme: { color: '#C7332D' },
  };
};

export const buildPaymentVerification = (checkout, response = {}) => {
  const trial = checkout.mode === 'trial';
  const expected = buildRazorpayOptions(checkout);
  const referenceKey = trial ? 'razorpay_subscription_id' : 'razorpay_order_id';
  const expectedId = trial ? expected.subscription_id : expected.order_id;
  if (!text(response.razorpay_payment_id) || !text(response.razorpay_signature) || response[referenceKey] !== expectedId) {
    throw new Error('Payment confirmation is incomplete or belongs to another order. Check payment status before trying again.');
  }
  return {
    planId: checkout.planId,
    selectedCategories: checkout.selectedCategories || [],
    selectedAddons: checkout.selectedAddons || [],
    couponCode: checkout.couponCode || undefined,
    razorpay_payment_id: response.razorpay_payment_id,
    [referenceKey]: expectedId,
    razorpay_signature: response.razorpay_signature,
  };
};

// A URL is only a signal to refresh the authenticated profile, never proof of payment.
export const paymentReturnState = (value = '') => {
  try {
    const url = new URL(value);
    const status = (url.searchParams.get('status') || url.searchParams.get('payment') || '').toLowerCase();
    if (['failed', 'cancel', 'cancelled', 'canceled'].includes(status) || /\/(failed|cancel(?:led)?)(\/|$)/i.test(url.pathname)) return 'failed';
    if (['success', 'paid', 'completed'].includes(status) || /\/success(\/|$)/i.test(url.pathname) || url.searchParams.has('razorpay_payment_id')) return 'returned';
  } catch (_) {}
  return '';
};

export const waitForMembership = async (refreshProfile, isActive, { attempts = 4, delayMs = 1500, isCurrent = () => true } = {}) => {
  let profile = null;
  for (let attempt = 0; attempt < attempts && isCurrent(); attempt += 1) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, delayMs));
    if (!isCurrent()) return null;
    profile = await refreshProfile({ force: true, membershipOnly: true }).catch(() => null);
    if (!isCurrent()) return null;
    if (profile && isActive(profile)) return profile;
  }
  return profile;
};
