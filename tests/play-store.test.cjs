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

test('Android defaults to store access-only; only an explicit native direct channel enables purchases', () => {
  for (const [os, channel, expected] of [['android', undefined, true], ['android', 'play', true], ['android', 'direct', false], ['ios', undefined, false]]) {
    const dist = load('src/utils/distribution.js', { 'react-native': { Platform: { OS: os }, NativeModules: { PolicyBhandarDistribution: { channel, versionName: '1.0.47' } } } });
    assert.equal(dist.IS_PLAY_STORE_BUILD, expected);
  }
});

test('Play navigator has membership status and no payment or custom rating route', () => {
  const React = { createElement: element, Component: class {} };
  const status = () => null;
  const fallback = () => null;
  const mocks = {
    react: React, 'react-native': { Platform: { OS: 'android' }, StyleSheet: { create: value => value } },
    '@react-navigation/native': { NavigationContainer: fallback }, '@react-navigation/stack': { createStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) },
    'react-native-gesture-handler': { GestureHandlerRootView: fallback }, 'react-native-safe-area-context': { SafeAreaProvider: fallback },
    './src/context/AuthContext': { useAuth: () => ({ user: { name: 'Fixture' }, authLoading: false }) },
    './src/services/appData': { getSubscriptionInfo: () => ({ active: true }) }, './src/utils/distribution': { IS_PLAY_STORE_BUILD: true },
    './src/screens/MembershipStatusScreen': { __esModule: true, default: status },
  };
  for (const match of fs.readFileSync('App.js','utf8').matchAll(/import \w+ from '(\.\/src\/screens\/[^']+)'/g)) mocks[match[1]] ||= { __esModule: true, default: fallback };
  const app = load('App.js', mocks, '\nexport { RootNavigator, SubscriptionRoute };');
  const routes = flatten(app.RootNavigator()).filter(node => node.type === 'Screen').map(node => node.props.name);
  for (const name of ['Home', 'Subscription', 'MyProfile']) assert.ok(routes.includes(name));
  for (const name of ['PaymentWebView', 'RateUs', 'SmartCardReview']) assert.equal(routes.includes(name), false);
  assert.equal(app.SubscriptionRoute({}).type, status);
});

test('even directly mounting the payment screen in a Play build renders only membership status', () => {
  let sdkCalls = 0;
  const status = () => null;
  const mocks = {
    react: { createElement: element }, 'react-native': { StyleSheet: { create: value => value } },
    'react-native-webview': {}, 'react-native-vector-icons/MaterialIcons': () => null, 'react-native-safe-area-context': {},
    '../theme/colors': { Colors: {} }, '../context/AuthContext': {}, '../services/appData': {}, '../services/api': {},
    '../services/paymentCheckout': {}, '../utils/distribution': { IS_PLAY_STORE_BUILD: true },
    './MembershipStatusScreen': { __esModule: true, default: status },
    'react-native-razorpay': { open: () => sdkCalls++ },
  };
  const payment = load('src/screens/PaymentWebViewScreen.js', mocks).default;
  assert.equal(payment({ route: { params: { checkout: { key: 'fixture' } } } }).type, status);
  assert.equal(sdkCalls, 0);
});

test('membership status has no purchase CTA and refreshes an admin activation into the app', async () => {
  let index = 0, active = false;
  const hooks = [], effects = [], timers = [], resets = [], reads = [];
  const React = {
    createElement: element,
    useRef(value) { const key = index++; return hooks[key] ||= { current: value }; },
    useState(value) { const key = index++; if (!(key in hooks)) hooks[key] = value; return [hooks[key], value => { hooks[key] = value; }]; },
    useCallback: fn => fn, useEffect: fn => effects.push(fn),
  };
  const mocks = {
    react: React,
    'react-native': { View: 'View', SafeAreaView: 'SafeAreaView', Text: 'Text', TouchableOpacity: 'Button', StyleSheet: { create: value => value }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    '../theme/colors': { Colors: {} },
    '../context/AuthContext': { useAuth: () => ({ user: { name: 'Fixture' }, logout: async () => {}, refreshProfile: async options => { reads.push(options); return active ? { activePlan: { id: 'assigned', name: 'Admin Plan' } } : { hasActivePlan: false }; } }) },
  };
  const screen = load('src/screens/MembershipStatusScreen.js', mocks, '', timers).default;
  const props = { navigation: { isFocused: () => true, addListener: () => () => {}, reset: value => resets.push(value), navigate: () => {} } };
  const tree = screen(props);
  assert.doesNotMatch(JSON.stringify(tree), /razorpay|purchase|buy now|whatsapp|https:\/\//i);
  const cleanups = effects.map(fn => fn()).filter(fn => typeof fn === 'function');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(timers[0].ms, 15000);
  assert.equal(resets.length, 0);
  active = true;
  await timers[0].fn();
  assert.ok(reads.every(options => options.force && options.membershipOnly));
  assert.equal(resets[0].routes[0].name, 'Home');
  cleanups.forEach(fn => fn());
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

test('NFC templates remain accessible but store builds have no card booking buttons', () => {
  for (const file of ['src/screens/SmartCardStyleScreen.js','src/screens/GoogleNFCReviewScreen.js']) {
    const store = load(file, cardMocks(true)).default({ navigation: {} });
    const direct = load(file, cardMocks(false)).default({ navigation: {} });
    assert.doesNotMatch(JSON.stringify(store), /Book Your NFC/);
    assert.match(JSON.stringify(direct), /Book Your NFC/);
  }
});

test('legacy upgrade prompt cannot render in the Play distribution', () => {
  const prompt = load('src/components/SubscriptionModal.js', cardMocks(true)).default;
  assert.equal(prompt({ visible: true }), null);
});
