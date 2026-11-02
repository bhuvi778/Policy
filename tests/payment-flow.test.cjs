const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    const filename = path.resolve(file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
      configFile: false, babelrc: false,
      plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
    });
    const req = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id + (path.extname(id) ? '' : '.js')));
      return require(id);
    };
    new Function('require', 'module', 'exports', code)(req, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader();
const checkout = load('src/services/paymentCheckout.js');
const { getSubscriptionInfo } = load('src/utils/subscriptionInfo.js');
const { extractUserData } = load('src/utils/extractUserData.js');

test('Razorpay order takes priority over a generic hosted or store URL', () => {
  const detail = checkout.getCheckoutDetails({ key: 'rzp_test_fixture', data: { order: { id: 'order_fixture', amount: 12300 } }, url: 'https://play.google.com/store/apps' });
  assert.equal(detail.nativeReady, true);
  assert.equal(detail.url, '');
  assert.equal(detail.data.id, 'order_fixture');
  assert.equal(checkout.getCheckoutDetails({ key: 'fixture', data: { id: 'unrelated_database_id' } }).nativeReady, false);
  assert.equal(checkout.getCheckoutDetails({ data: { paymentUrl: 'https://rzp.io/i/fixture' } }).url, 'https://rzp.io/i/fixture');
});

test('trial subscriptions use subscription_id and do not invent a customer phone number', () => {
  const detail = checkout.getCheckoutDetails({ data: { key: 'rzp_test_fixture', subscription_id: 'sub_fixture' } }, 'trial');
  const options = checkout.buildRazorpayOptions({ ...detail, mode: 'trial' });
  assert.equal(options.subscription_id, 'sub_fixture');
  assert.equal(options.order_id, undefined);
  assert.equal(options.prefill.contact, '');
});

test('current backend data/order envelope opens native checkout with the server amount in paise', () => {
  const detail = checkout.getCheckoutDetails({ success: true, data: { id: 'order_backend', amount: 118000, currency: 'INR' }, key: 'rzp_test_fixture' });
  assert.equal(detail.nativeReady, true);
  const options = checkout.buildRazorpayOptions(detail);
  assert.equal(options.order_id, 'order_backend');
  assert.equal(options.amount, 118000);
});

test('only a complete receipt matching the server-created order is submitted for verification', () => {
  const order = { key: 'fixture', planId: 'plan-fixture', data: { id: 'order_fixture' }, selectedCategories: ['motor'] };
  const receipt = { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture-signature' };
  assert.equal(checkout.buildPaymentVerification(order, receipt).selectedCategories[0], 'motor');
  assert.throws(() => checkout.buildPaymentVerification(order, { ...receipt, razorpay_order_id: 'order_other' }));
  assert.throws(() => checkout.buildPaymentVerification(order, { ...receipt, razorpay_signature: '' }));
});

test('store redirects are rejected and success URLs are only refresh signals', () => {
  for (const url of ['market://details?id=app', ' https://play.google.com/store/apps/details?id=app ', 'itms-apps://apps.apple.com/app/id1']) {
    assert.equal(checkout.isStoreUrl(url), true);
    assert.equal(checkout.isHttpsPaymentUrl(url), false);
  }
  assert.equal(checkout.paymentReturnState('https://merchant.test/success?status=failed'), 'failed');
  assert.equal(checkout.paymentReturnState('https://merchant.test/page?next=/success'), '');
  assert.equal(checkout.paymentReturnState('https://merchant.test/success'), 'returned');
});

test('membership polling bypasses cache and waits for a fresh active backend profile', async () => {
  const calls = [];
  const profile = await checkout.waitForMembership(async options => {
    calls.push(options);
    return { subscription: { status: calls.length < 3 ? 'pending' : 'active' } };
  }, value => getSubscriptionInfo(value).active, { delayMs: 0 });
  assert.equal(calls.length, 3);
  assert.ok(calls.every(options => options.force && options.membershipOnly));
  assert.equal(getSubscriptionInfo(profile).active, true);
  let count = 0;
  await checkout.waitForMembership(async () => { count++; }, () => true, { isCurrent: () => false });
  assert.equal(count, 0);
});

test('admin subscription envelopes preserve user identity and authoritative membership', () => {
  const user = extractUserData({ success: true, data: { user: { _id: 'fixture-user', name: 'Fixture' }, subscription: { status: 'active', plan: { name: 'Admin Plan' } } } });
  assert.equal(user.name, 'Fixture');
  assert.equal(getSubscriptionInfo(user).name, 'Admin Plan');
  assert.equal(getSubscriptionInfo(user).active, true);
  assert.equal(getSubscriptionInfo({ activePlan: { _id: 'assigned', name: 'Admin Plan' } }).active, true);
  assert.equal(getSubscriptionInfo({ planId: 'selected-but-unpaid' }).active, false);
  assert.equal(getSubscriptionInfo({ isSubscribed: 'false', subscriptionId: 'sub_unpaid' }).active, false);
  assert.equal(getSubscriptionInfo({ planId: 'assigned', paymentStatus: 'paid' }).active, true);
  assert.equal(getSubscriptionInfo({ paymentStatus: 'paid' }).active, false);
});

test('expired and pending subscriptions cannot unlock access through stale flags or dates', () => {
  assert.equal(getSubscriptionInfo({ hasActivePlan: true, subscription: { status: 'expired' } }).active, false);
  assert.equal(getSubscriptionInfo({ activePlan: 'old', expiryDate: '2000-01-01', hasActivePlan: true }).active, false);
  assert.equal(getSubscriptionInfo({ subscription: { id: 'sub_pending', status: 'pending', endDate: '2099-01-01' } }).active, false);
  assert.equal(getSubscriptionInfo({ subscription: {}, activePlan: { id: 'admin', name: 'Admin Plan' } }).active, true);
  assert.equal(getSubscriptionInfo({ subscription: { status: 'active', planId: { name: 'Gold' } } }).name, 'Gold');
});

function authHarness({ initialUser = { name: 'Fixture', hasActivePlan: false }, profile, syncQueued = async () => null } = {}) {
  let index = 0;
  const hooks = [];
  const storage = new Map();
  let reads = 0;
  const React = {
    createContext: () => ({ Provider: 'Provider' }), createElement: (type, props) => ({ type, props }),
    useState(value) { const key = index++; if (!(key in hooks)) hooks[key] = key === 0 ? initialUser : key === 1 ? 'fixture-token' : value; return [hooks[key], next => { hooks[key] = typeof next === 'function' ? next(hooks[key]) : next; }]; },
    useRef(value) { const key = index++; return hooks[key] ||= { current: value }; },
    useEffect() { index++; }, useCallback(fn) { index++; return fn; },
  };
  const api = { setAuthToken() {}, getProfile: async options => { reads++; assert.equal(options.token, 'fixture-token'); assert.equal(options.cache, false); return { data: await profile(reads) }; } };
  const context = loader({
    react: React, 'react-native': { AppState: {} }, '../services/api': api,
    '../services/storage': { __esModule: true, default: { setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key) } },
    '../services/profileSupplement': { restoreProfileSupplement: async x => x, persistProfileSupplement: async () => {} },
    '../services/profileSync': { syncQueuedProfile: syncQueued, queueProfileUpdate: async x => x },
  })('src/context/AuthContext.js');
  return { context, render() { index = 0; return context.AuthProvider({}).props.value; }, reads: () => reads };
}

test('pending profile edits no longer prevent admin membership reads', async () => {
  const h = authHarness({ profile: async () => ({ name: 'Fixture', activePlan: { id: 'admin', name: 'Assigned Plan' } }), syncQueued: async user => ({ user, synced: false }) });
  const fresh = await h.render().refreshProfile({ force: true });
  assert.equal(h.reads(), 1);
  assert.equal(getSubscriptionInfo(fresh).active, true);
  assert.equal(fresh.hasActivePlan, undefined);
});

test('forced refresh waits for an older read then requests a new post-payment profile', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const h = authHarness({ profile: async count => count === 1 ? pending : { name: 'Fixture', subscription: { status: 'active' } } });
  const auth = h.render();
  const old = auth.refreshProfile({ membershipOnly: true });
  const afterPayment = auth.refreshProfile({ force: true, membershipOnly: true });
  release({ name: 'Fixture', subscription: { status: 'pending' } });
  await old;
  assert.equal(getSubscriptionInfo(await afterPayment).active, true);
  assert.equal(h.reads(), 2);
});

test('a late login profile cannot overwrite a newer confirmed admin activation', async () => {
  let release;
  const oldProfile = new Promise(resolve => { release = resolve; });
  const h = authHarness({ profile: async count => count === 1 ? oldProfile : { name: 'Fixture', subscription: { status: 'active' } } });
  const auth = h.render();
  await auth.loginWithToken('fixture-token', { name: 'Fixture' });
  await settle();
  const fresh = await auth.refreshProfile({ force: true, membershipOnly: true });
  assert.equal(getSubscriptionInfo(fresh).active, true);
  release({ name: 'Fixture', subscription: { status: 'pending' } });
  await settle();
  assert.equal(getSubscriptionInfo(h.render().user).active, true);
});

test('fresh revoked membership removes stale active-plan fields while keeping pending personal edits', () => {
  const h = authHarness();
  const merged = h.context.mergeUserData({ name: 'Fixture', activePlan: 'old', hasActivePlan: true, _pendingProfilePatch: { name: 'Local edit' } }, { subscription: { status: 'inactive' } });
  assert.equal(merged.name, 'Local edit');
  assert.equal(merged.activePlan, undefined);
  assert.equal(getSubscriptionInfo(merged).active, false);
});

function paymentHarness({ response, sdkError, verificationError, active = true, hosted = false, pendingPayment, profile, mode = 'direct', storageError = false } = {}) {
  let index = 0;
  const hooks = [], effects = [], alerts = [], verifiedBodies = [], resets = [], openedUrls = [], refreshes = [];
  let opened = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) { const key = index++; if (!(key in hooks)) hooks[key] = value; return [hooks[key], value => { hooks[key] = value; }]; },
    useRef(value) { const key = index++; return hooks[key] ||= { current: value }; },
    useEffect(fn) { index++; effects.push(fn); }, useCallback(fn) { index++; return fn; },
  };
  const verify = async body => { verifiedBodies.push(body); if (verificationError) throw verificationError; };
  const api = { verifyPaymentOrder: verify, verifyPaymentSubscription: verify };
  const service = { ...checkout, waitForMembership: (refresh, isActive, options) => checkout.waitForMembership(refresh, isActive, { ...options, attempts: 1, delayMs: 0 }) };
  const screen = loader({
    react: React,
    'react-native': { View: 'View', Text: 'Text', TouchableOpacity: 'Button', StatusBar: 'StatusBar', ActivityIndicator: 'Spinner', StyleSheet: { create: x => x }, Alert: { alert: (...args) => alerts.push(args) }, AppState: { addEventListener: () => ({ remove() {} }) }, Linking: { canOpenURL: async () => false, openURL: async url => openedUrls.push(url) } },
    'react-native-webview': { WebView: 'WebView' }, 'react-native-vector-icons/MaterialIcons': () => null,
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0 }) },
    '../theme/colors': { Colors: {} }, '../context/AuthContext': { useAuth: () => ({ user: { _id: 'fixture-user' }, token: 'fixture-token', refreshProfile: async options => { refreshes.push(options); return profile || { activePlan: active ? { _id: 'plan_fixture' } : null, planExpiryDate: active ? '2099-01-01' : null }; } }) },
    '../services/paymentRecovery': { savePendingPayment: async () => { if (storageError) throw Error('Storage full'); }, clearPendingPayment: async () => {} },
    '../services/appData': { getSubscriptionInfo }, '../services/api': api, '../services/paymentCheckout': service,
    'react-native-razorpay': { __esModule: true, default: { open: async () => { opened++; if (sdkError) throw sdkError; return response; } } },
  })('src/screens/PaymentWebViewScreen.js').default;
  const props = { navigation: { reset: value => resets.push(value) }, route: { params: hosted ? { url: 'https://rzp.io/i/fixture' } : { fromRegistration: true, pendingPayment, checkout: { mode, key: 'rzp_test_fixture', data: { id: mode === 'trial' ? 'sub_fixture' : 'order_fixture' }, selectedCategories: ['motor'], planId: 'plan_fixture' } } } };
  function render() {
    index = 0;
    let tree = screen(props);
    while (tree && typeof tree.type === 'function') tree = tree.type(tree.props);
    return tree;
  }
  const tree = render();
  function find(node, type) { if (!node || typeof node !== 'object') return; if (node.type === type) return node; for (const child of (node.props?.children || []).flat(Infinity)) { const found = find(child, type); if (found) return found; } }
  const buttons = (node, result = []) => { if (!node || typeof node !== 'object') return result; if (node.type === 'Button') result.push(node); (node.props?.children || []).flat(Infinity).forEach(child => buttons(child, result)); return result; };
  return { tree, render, effects, alerts, verifiedBodies, resets, openedUrls, refreshes, buttons: () => buttons(render()), opened: () => opened, web: () => find(tree, 'WebView') };
}
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };

test('native SDK success verifies on backend, refreshes membership, and returns registration to onboarding', async () => {
  const h = paymentHarness({ response: { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture-signature' } });
  h.effects.forEach(effect => effect());
  await settle();
  assert.equal(h.opened(), 1);
  assert.equal(h.verifiedBodies.length, 1);
  assert.deepEqual(h.verifiedBodies[0].selectedCategories, ['motor']);
  assert.ok(h.refreshes[0].force && h.refreshes[0].membershipOnly);
  assert.equal(h.alerts[0][0], 'Payment successful');
  h.alerts[0][2][0].onPress();
  assert.equal(h.resets[0].routes[0].name, 'Onboarding');
});

test('a verified payment awaiting activation never shows a false active-plan success', async () => {
  const h = paymentHarness({ active: false, response: { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture-signature' } });
  h.effects.forEach(effect => effect());
  await settle();
  assert.equal(h.verifiedBodies.length, 1);
  assert.equal(h.resets.length, 0);
  assert.equal(h.alerts.some(alert => alert[0] === 'Membership active'), false);
  assert.match(JSON.stringify(h.render()), /Payment verified.*Do not pay again/);
});

test('checkout cancellation does not submit verification or activate a plan', async () => {
  const h = paymentHarness({ sdkError: { code: 0, description: 'Cancelled' } });
  h.effects.forEach(effect => effect());
  await settle();
  assert.equal(h.verifiedBodies.length, 0);
  assert.equal(h.refreshes.length, 0);
  assert.equal(h.resets.length, 0);
});

test('status check recovers a committed activation without repeating a timed-out verification POST', async () => {
  const h = paymentHarness({ verificationError: Error('request timeout'), response: { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture-signature' } });
  h.effects.forEach(effect => effect());
  await settle();
  assert.equal(h.alerts[0][0], 'Confirmation pending');
  await h.buttons()[1].props.onPress();
  assert.equal(h.refreshes.length, 1);
  assert.equal(h.alerts.at(-1)[0], 'Membership active');
  assert.equal(h.verifiedBodies.length, 1);
  assert.equal(h.opened(), 1);
});

test('an unrelated active plan cannot confirm the purchased upgrade', async () => {
  const h = paymentHarness({ profile: { activePlan: { _id: 'old-plan' }, planExpiryDate: '2099-01-01' }, response: { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture' } });
  h.effects.forEach(effect => effect()); await settle();
  assert.equal(h.alerts.length, 0);
  assert.match(JSON.stringify(h.render()), /Waiting for the server/);
});

test('restarting with a pending receipt checks status without opening or charging checkout again', async () => {
  const h = paymentHarness({ pendingPayment: { receipt: { razorpay_order_id: 'order_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture' } } });
  h.effects.forEach(effect => effect()); await settle();
  assert.equal(h.opened(), 0);
  assert.equal(h.verifiedBodies.length, 0);
  assert.equal(h.alerts.at(-1)[0], 'Membership active');
});

test('subscription receipt follows the subscription verification endpoint contract', async () => {
  const h = paymentHarness({ mode: 'trial', storageError: true, response: { razorpay_subscription_id: 'sub_fixture', razorpay_payment_id: 'pay_fixture', razorpay_signature: 'fixture' } });
  h.effects.forEach(effect => effect()); await settle();
  assert.equal(h.verifiedBodies[0].razorpay_subscription_id, 'sub_fixture');
  assert.equal(h.verifiedBodies[0].razorpay_order_id, undefined);
  assert.equal(h.alerts.at(-1)[0], 'Payment successful');
});

test('a paid activePlan survives cancelled autopay, but explicit admin revocation wins over stale active flags', () => {
  assert.equal(getSubscriptionInfo({ activePlan: { _id: 'paid', name: 'Gold' }, planExpiryDate: '2099-01-01', subscriptionStatus: 'cancelled' }).active, true);
  assert.equal(getSubscriptionInfo({ activePlan: null, planExpiryDate: null, subscriptionStatus: 'active', hasActivePlan: true }).active, false);
});

test('unchanged existing membership does not prove that an unverified renewal succeeded', () => {
  const profile = { activePlan: { _id: 'gold' }, planExpiryDate: '2099-01-01' };
  const order = { planId: 'gold', previousPlanId: 'gold', previousValidTill: '2099-01-01' };
  assert.equal(checkout.membershipMatchesCheckout(profile, order, true), false);
  assert.equal(checkout.membershipMatchesCheckout({ ...profile, planExpiryDate: '2099-02-01' }, order, true), true);
  assert.equal(checkout.membershipMatchesCheckout(profile, order, false), true);
});

test('durable receipt recovery survives reload, isolates accounts, and retains a newer order', async () => {
  const store = new Map();
  const mocks = { './storage': { __esModule: true, default: { getItem: async key => store.get(key), setItemDurable: async (key, value) => store.set(key, value), removeItem: async key => store.delete(key) } } };
  const recovery = loader(mocks)('src/services/paymentRecovery.js');
  const user = { _id: 'one' }, order = { key: 'public-key', data: { id: 'order_one' }, planId: 'gold', user: { email: 'private-fixture' }, token: 'secret-fixture' };
  await recovery.savePendingPayment(user, order, { razorpay_payment_id: 'pay_one', razorpay_signature: 'signature', razorpay_order_id: 'order_one' });
  assert.equal((await loader(mocks)('src/services/paymentRecovery.js').readPendingPayment(user)).receipt.razorpay_payment_id, 'pay_one');
  assert.equal(await recovery.readPendingPayment({ _id: 'two' }), null);
  assert.doesNotMatch([...store.values()][0], /private-fixture|secret-fixture/);
  await recovery.savePendingPayment(user, { ...order, data: { id: 'order_two' } }, { razorpay_payment_id: 'pay_two' });
  await recovery.clearPendingPayment(user, order);
  assert.equal((await recovery.readPendingPayment(user)).receipt.razorpay_payment_id, 'pay_two');
  await recovery.clearPendingPayment(user, { data: { id: 'order_two' } });
  assert.equal(await recovery.readPendingPayment(user), null);
});

test('hosted checkout intercepts store and intent fallback URLs without opening a store', async () => {
  const h = paymentHarness({ hosted: true, active: false });
  const web = h.web();
  assert.equal(web.props.onShouldStartLoadWithRequest({ url: 'https://play.google.com/store/apps/details?id=upi' }), false);
  assert.equal(web.props.onShouldStartLoadWithRequest({ url: 'intent://pay?pa=fixture#Intent;scheme=upi;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore;end' }), false);
  await settle();
  assert.equal(h.openedUrls.length, 0);
  web.props.onNavigationStateChange({ url: 'https://merchant.test/success' });
  await settle();
  assert.equal(h.verifiedBodies.length, 0);
  assert.equal(h.resets.length, 0);
});
