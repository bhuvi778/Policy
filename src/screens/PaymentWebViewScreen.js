import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getSubscriptionInfo } from '../services/appData';
import { verifyPaymentOrder, verifyPaymentSubscription } from '../services/api';
import { buildPaymentVerification, buildRazorpayOptions, isHttpsPaymentUrl, isStoreUrl, paymentReturnState, waitForMembership } from '../services/paymentCheckout';

const PaymentWebViewScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { refreshProfile, token } = useAuth();
  const webRef = useRef(null);
  const alive = useRef(true);
  const session = useRef(token);
  const currentToken = useRef(token);
  currentToken.current = token;
  const busy = useRef(false);
  const started = useRef(false);
  const finished = useRef(false);
  const receipt = useRef(null);
  const verified = useRef(false);
  const externalPayment = useRef(false);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('opening');
  const [message, setMessage] = useState('Opening secure Razorpay checkout...');
  const checkout = route?.params?.checkout || null;
  const url = route?.params?.url || '';
  const title = route?.params?.title || 'Payment';
  const fromRegistration = !!route?.params?.fromRegistration;
  const isCurrent = useCallback(() => alive.current && session.current === currentToken.current, []);

  useEffect(() => () => { alive.current = false; }, []);

  const returnToApp = useCallback((active) => {
    if (!isCurrent()) return;
    navigation.reset({ index: 0, routes: [{ name: active ? (fromRegistration ? 'Onboarding' : 'Home') : 'Subscription' }] });
  }, [fromRegistration, isCurrent, navigation]);

  const checkMembership = useCallback(async () => {
    const fresh = await waitForMembership(refreshProfile, profile => getSubscriptionInfo(profile).active, { isCurrent });
    if (!isCurrent()) return;
    const active = !!fresh && getSubscriptionInfo(fresh).active;
    setLoading(false);
    if (active) {
      finished.current = true;
      setPhase('active');
      setMessage('Your membership is active.');
      Alert.alert('Membership active', 'Your plan is active. You can continue in the app.', [
        { text: 'Continue', onPress: () => returnToApp(true) },
      ]);
    } else {
      setPhase('pending');
      setMessage(verified.current
        ? 'Payment verified. Waiting for the server to activate your plan. Do not pay again; check status shortly.'
        : 'The server has not confirmed an active plan yet. If money was deducted, do not pay again; check status or contact support.');
    }
  }, [isCurrent, refreshProfile, returnToApp]);

  const verifyReceipt = useCallback(async (response) => {
    if (!checkout || busy.current || finished.current || !isCurrent()) return;
    busy.current = true;
    receipt.current = response;
    setLoading(true);
    setPhase('verifying');
    setMessage('Verifying payment with the server...');
    try {
      const body = buildPaymentVerification(checkout, response);
      if (checkout.mode === 'trial') await verifyPaymentSubscription(body);
      else await verifyPaymentOrder(body);
      verified.current = true;
      await checkMembership();
    } catch (error) {
      if (isCurrent()) {
        setPhase('pending');
        setLoading(false);
        setMessage('Payment confirmation is pending. Do not pay again if money was deducted. Check status to retry verification.');
        Alert.alert('Confirmation pending', error?.data?.error || error?.message || 'Unable to verify payment. Please check status or contact support.');
      }
    } finally { busy.current = false; }
  }, [checkMembership, checkout, isCurrent]);

  const openNativeCheckout = useCallback(async () => {
    if (busy.current || !checkout || !isCurrent() || receipt.current) return;
    setPhase('opening');
    setLoading(true);
    setMessage('Opening secure Razorpay checkout...');
    busy.current = true;
    try {
      // Load the official SDK only for an order/subscription created by our backend.
      const RazorpayCheckout = require('react-native-razorpay').default;
      const response = await RazorpayCheckout.open(buildRazorpayOptions(checkout));
      busy.current = false;
      if (isCurrent()) await verifyReceipt(response);
    } catch (error) {
      busy.current = false;
      if (!isCurrent()) return;
      setLoading(false);
      setPhase('cancelled');
      setMessage('Checkout did not complete. If money was deducted, check status before trying again.');
      if (Number(error?.code) !== 0) Alert.alert('Payment not completed', error?.description || error?.message || 'Please retry Razorpay checkout or check your membership status.');
    }
  }, [checkout, isCurrent, verifyReceipt]);

  useEffect(() => {
    if (!checkout || started.current) return;
    started.current = true;
    openNativeCheckout();
  }, [checkout, openNativeCheckout]);

  const refreshStatus = useCallback(async () => {
    if (busy.current || finished.current || !isCurrent()) return;
    if (receipt.current && !verified.current) {
      await verifyReceipt(receipt.current);
      if (verified.current || finished.current || !isCurrent()) return;
      // A webhook may already have activated the plan even if the verify response was lost.
    }
    busy.current = true;
    setLoading(true);
    setPhase('verifying');
    setMessage('Checking your membership status...');
    try { await checkMembership(); }
    finally { busy.current = false; }
  }, [checkMembership, isCurrent, verifyReceipt]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && externalPayment.current) {
        externalPayment.current = false;
        refreshStatus();
      }
    });
    return () => listener.remove();
  }, [refreshStatus]);

  const handleRequest = useCallback((request) => {
    const next = request?.url || '';
    if (!next || next === 'about:blank') return true;
    if (isStoreUrl(next)) {
      Alert.alert('Use Razorpay checkout', 'A store redirect was blocked. Return to checkout and choose an available payment method.');
      return false;
    }
    if (next.startsWith('policybhandar://payment')) { refreshStatus(); return false; }
    if (/^https?:\/\//i.test(next)) return true;
    // Never forward an Android intent or its browser_fallback_url to the store.
    let target = next;
    if (next.startsWith('intent://')) {
      const scheme = next.match(/;scheme=([a-z0-9.-]+);/i)?.[1];
      target = scheme ? `${scheme}://${next.slice(9).split('#Intent;')[0]}` : '';
    }
    if (!/^(upi|phonepe|tez|gpay|paytmmp):\/\//i.test(target)) {
      Alert.alert('Payment method unavailable', 'Please return to checkout and choose another payment method.');
      return false;
    }
    Linking.canOpenURL(target).then(async supported => {
      if (!isCurrent()) return;
      if (!supported) throw new Error('The selected payment app is not installed. Choose another method in Razorpay.');
      externalPayment.current = true;
      await Linking.openURL(target);
    }).catch(error => { if (isCurrent()) Alert.alert('Payment app unavailable', error?.message || 'Choose another payment method.'); });
    return false;
  }, [isCurrent, refreshStatus]);

  const handleNavChange = useCallback(state => {
    const result = paymentReturnState(state?.url);
    if (result === 'returned') refreshStatus();
    if (result === 'failed') {
      setLoading(false);
      setMessage('Payment did not complete. Check status if money was deducted.');
    }
  }, [refreshStatus]);

  const closePayment = () => {
    if (finished.current) return returnToApp(true);
    Alert.alert('Close payment?', 'If money was deducted, check status before paying again.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Close', onPress: () => returnToApp(false) },
    ]);
  };

  const hosted = !checkout && isHttpsPaymentUrl(url);
  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={closePayment}><MaterialIcons name="close" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={refreshStatus}><MaterialIcons name="refresh" size={22} color="#fff" /></TouchableOpacity>
      </View>
      {hosted ? <WebView
        ref={webRef} source={{ uri: url }} style={styles.webview} originWhitelist={['*']}
        onShouldStartLoadWithRequest={handleRequest}
        onOpenWindow={event => {
          const next = event.nativeEvent?.targetUrl;
          if (next && handleRequest({ url: next }) && /^https?:\/\//i.test(next)) webRef.current?.injectJavaScript(`window.location.href=${JSON.stringify(next)};true;`);
        }}
        onNavigationStateChange={handleNavChange} javaScriptEnabled domStorageEnabled
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setMessage('Payment page could not load. Check status if money was deducted.'); }}
      /> : null}
      {checkout || !hosted ? <View style={styles.emptyRoot}>
        {loading ? <ActivityIndicator color={Colors.primary} /> : null}
        <Text style={styles.emptyTitle}>{checkout ? message : 'Secure payment link unavailable. Return to plans and retry.'}</Text>
        <TouchableOpacity style={styles.emptyBtn} disabled={loading} onPress={refreshStatus}><Text style={styles.emptyBtnText}>Check payment status</Text></TouchableOpacity>
        {checkout && phase === 'cancelled' && !receipt.current ? <TouchableOpacity style={styles.emptyBtn} onPress={openNativeCheckout}><Text style={styles.emptyBtnText}>Retry Razorpay checkout</Text></TouchableOpacity> : null}
      </View> : <View style={styles.loader}>
        {loading ? <ActivityIndicator color={Colors.primary} /> : null}
        <Text style={[styles.loaderText, { flex: 1 }]}>{message}</Text>
        <TouchableOpacity disabled={loading} onPress={refreshStatus}><Text style={styles.loaderText}>Check status</Text></TouchableOpacity>
      </View>}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    elevation: 4,
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  iconBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    color: '#fff',
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  loader: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 42,
  },
  loaderText: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '700',
  },
  webview: {
    flex: 1,
  },
  emptyRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: Colors.textDark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default PaymentWebViewScreen;
