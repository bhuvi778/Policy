const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

function load(file, mocks = {}, suffix = '', timers = []) {
  const module = { exports: {} };
  const { code } = babel.transformSync(fs.readFileSync(file, 'utf8') + suffix, { configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'] });
  const req = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.')) {
      const next = path.resolve(path.dirname(file), id + (path.extname(id) ? '' : '.js'));
      if (fs.existsSync(next) && next.endsWith('.js')) return load(next, mocks, '', timers);
    }
    throw Error('Unexpected module: ' + id);
  };
  new Function('require','module','exports','setInterval','clearInterval',code)(req,module,module.exports,
    (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, () => {});
  return module.exports;
}
const element = (type, props, ...children) => ({ type, props: { ...props, children } });
const flatten = (node, result = []) => { if (!node || typeof node !== 'object') return result; result.push(node); (node.props?.children || []).flat(Infinity).forEach(child => flatten(child, result)); return result; };

test('Native distribution metadata identifies the channel without changing checkout availability', () => {
  for (const [os, channel, expected] of [['android', undefined, true], ['android', 'play', true], ['android', 'direct', false], ['ios', undefined, false]]) {
    const dist = load('src/utils/distribution.js', { 'react-native': { Platform: { OS: os }, NativeModules: { PolicyBhandarDistribution: { channel, versionName: '1.0.47' } } } });
    assert.equal(dist.IS_PLAY_STORE_BUILD, expected);
  }
});

test('Play navigator retains plans and Razorpay payment routes', () => {
  const React = { createElement: element, Component: class {} };
  const plans = () => null;
  const fallback = () => null;
  const mocks = {
    react: React, 'react-native': { Platform: { OS: 'android' }, StyleSheet: { create: value => value } },
    '@react-navigation/native': { NavigationContainer: fallback }, '@react-navigation/stack': { createStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) },
    'react-native-gesture-handler': { GestureHandlerRootView: fallback }, 'react-native-safe-area-context': { SafeAreaProvider: fallback },
    './src/context/AuthContext': { useAuth: () => ({ user: { name: 'Fixture' }, authLoading: false }) },
    './src/services/appData': { getSubscriptionInfo: () => ({ active: true }) }, './src/utils/distribution': { IS_PLAY_STORE_BUILD: true },
    './src/screens/SubscriptionPlansScreen': { __esModule: true, default: plans },
  };
  for (const match of fs.readFileSync('App.js','utf8').matchAll(/import \w+ from '(\.\/src\/screens\/[^']+)'/g)) mocks[match[1]] ||= { __esModule: true, default: fallback };
  const app = load('App.js', mocks, '\nexport { RootNavigator, SubscriptionRoute };');
  const routes = flatten(app.RootNavigator()).filter(node => node.type === 'Screen').map(node => node.props.name);
  for (const name of ['Home', 'Subscription', 'MyProfile', 'PaymentWebView']) assert.ok(routes.includes(name));
  for (const name of ['RateUs', 'SmartCardReview']) assert.equal(routes.includes(name), false);
  assert.equal(app.SubscriptionRoute({}).type, plans);
});

test('download access agrees with membership and respects nested admin plan limits', async () => {
  const store = new Map();
  const quota = load('src/services/downloadQuota.js', {
    './storage': { __esModule: true, default: { getItem: async key => store.get(key), setItem: async (key, value) => store.set(key, value) } },
    './api': { getProfile: async () => ({ data: { user: { name: 'Fixture', subscription: { status: 'inactive' } } } }) },
    '../utils/distribution': { IS_PLAY_STORE_BUILD: true },
  });
  assert.equal(quota.hasActivePlan({ planId: 'selected-unpaid' }), false);
  assert.equal(quota.hasActivePlan({ hasActivePlan: true, subscription: { status: 'expired' } }), false);
  assert.equal(quota.getDownloadAllowance({ subscription: { status: 'active', plan: { dailyDownloadLimit: 5 } } }).limit, 5);
  await assert.rejects(quota.assertCanDownload({ hasActivePlan: false }), error => !/upgrade|activate|purchase/i.test(error.message));
});

function cardMocks(store) {
  const native = new Proxy({ Dimensions: { get: () => ({ width: 400 }) }, StyleSheet: { create: value => value }, Platform: { OS: 'android' } }, { get: (value, key) => value[key] || key });
  return {
    react: { createElement: element, useState: value => [typeof value === 'function' ? value() : value, () => {}], useEffect: () => {} },
    'react-native': native, 'react-native-vector-icons/MaterialIcons': () => null, 'react-native-vector-icons/Ionicons': () => null,
    '../theme/colors': { Colors: {} }, '../utils/distribution': { IS_PLAY_STORE_BUILD: store },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../context/AuthContext': { useAuth: () => ({ user: {} }) }, '../services/contentMapper': {}, '../services/appData': {},
    '../assets/images/policybhandar_logo.png': 'fixture-image',
  };
}

test('NFC booking buttons remain available in both Play and direct builds', () => {
  for (const file of ['src/screens/SmartCardStyleScreen.js','src/screens/GoogleNFCReviewScreen.js']) {
    const store = load(file, cardMocks(true)).default({ navigation: {} });
    const direct = load(file, cardMocks(false)).default({ navigation: {} });
    assert.match(JSON.stringify(store), /Book Your NFC/);
    assert.match(JSON.stringify(direct), /Book Your NFC/);
  }
});

test('upgrade prompt remains visible with an actionable Upgrade button in a Play build', () => {
  const mocks = cardMocks(true);
  mocks.react.useRef = value => ({ current: value });
  mocks['react-native'].Animated = { Value: class {} , View: 'AnimatedView' };
  mocks['../services/appData'] = { getSubscriptionInfo: () => ({ active: false }), getAssignedFranchise: () => ({}), getAssignedRep: () => ({}), BRAND: {} };
  const prompt = load('src/components/SubscriptionModal.js', mocks).default;
  const upgrade = () => {};
  const tree = prompt({ visible: true, userData: {}, onUpgrade: upgrade });
  assert.ok(tree);
  assert.ok(flatten(tree).some(node => node.props?.onPress === upgrade));
});

test('Buy Now creates one backend order and passes native Razorpay checkout rather than any store link', async () => {
  let index = 0, states = [], pending = null, orders = 0;
  const navigations = [], alerts = [];
  const mocks = cardMocks(true);
  mocks.react = { ...mocks.react, useRef: value => ({ current: value }), useMemo: fn => fn(), useCallback: fn => fn,
    useState(value) { const key = index++; if (!(key in states)) states[key] = key === 0 ? [{ _id: 'plan_fixture', name: 'Gold', price: 100, validityDays: 30 }] : key === 2 ? false : value;
      return [states[key], next => { states[key] = typeof next === 'function' ? next(states[key]) : next; }]; } };
  mocks['react-native'].Alert = { alert: (...args) => alerts.push(args) };
  mocks['../services/appData'] = { BRAND: {}, getSubscriptionInfo: () => ({ active: false }) };
  mocks['../context/AuthContext'] = { useAuth: () => ({ user: { _id: 'fixture-user' } }) };
  mocks['../services/contentMapper'] = { getUserProfileRole: () => '', normalizeProfileRole: () => '' };
  mocks['../services/paymentRecovery'] = { paymentOwner: user => user._id, readPendingPayment: async () => pending };
  mocks['../services/api'] = { createPaymentOrder: async () => { orders++; return { data: { success: true, key: 'fixture', data: { id: 'order_fixture', amount: 11800, currency: 'INR' }, url: 'https://play.google.com/store/apps' } }; } };
  const screen = load('src/screens/SubscriptionPlansScreen.js', mocks).default;
  const navigation = { navigate: (...args) => navigations.push(args), isFocused: () => true };
  const render = () => { index = 0; return screen({ navigation }); };
  const buy = () => flatten(render()).find(node => node.props?.onPress && JSON.stringify(node.props.children).includes('Buy Now'));
  await buy().props.onPress();
  assert.equal(orders, 1);
  assert.equal(navigations[0][0], 'PaymentWebView');
  assert.equal(navigations[0][1].checkout.data.id, 'order_fixture');
  assert.equal(navigations[0][1].url, undefined);
  assert.equal(alerts.length, 0);
  pending = { checkout: { data: { id: 'order_pending' } }, receipt: { razorpay_payment_id: 'pay_pending' } };
  await buy().props.onPress();
  assert.equal(orders, 1);
  assert.equal(navigations.at(-1)[1].pendingPayment, pending);
});
