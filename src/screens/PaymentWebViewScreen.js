import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getSubscriptionInfo } from '../services/appData';
import { verifyPaymentOrder, verifyPaymentSubscription } from '../services/api';

const isSuccessUrl = (url = '') => {
  const value = String(url || '').toLowerCase();
  return (
    value.includes('razorpay_payment_id') ||
    value.includes('payment_id=') ||
    value.includes('paymentid=') ||
    value.includes('status=success') ||
    value.includes('payment=success') ||
    value.includes('/success')
  );
};

const isFailureUrl = (url = '') => {
  const value = String(url || '').toLowerCase();
  return (
    value.includes('status=failed') ||
    value.includes('status=cancel') ||
    value.includes('payment=failed') ||
    value.includes('payment=cancel') ||
    value.includes('/failed') ||
    value.includes('/cancel')
  );
};

const safeJson = (value) => JSON.stringify(value || {}).replace(/<\/script/gi, '<\\/script');

const buildRazorpayHtml = (checkout = {}) => {
  const mode = checkout.mode === 'trial' ? 'trial' : 'direct';
  const data = checkout.data || {};
  const user = checkout.user || {};
  const options = {
    key: checkout.key,
    amount: mode === 'direct' ? data.amount : undefined,
    currency: data.currency || 'INR',
    name: 'Policybhandar',
    description: mode === 'trial'
      ? `${checkout.planName || 'Membership'} - 15 Days Free Trial`
      : `${checkout.planName || 'Membership'} - Buy Now`,
    order_id: mode === 'direct' ? data.id : undefined,
    subscription_id: mode === 'trial' ? data.id : undefined,
    prefill: {
      name: user.name || '',
      email: user.email || '',
      contact: user.mobile || '9999999999',
    },
    theme: { color: '#C7332D' },
  };

  return `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; height: 100%; font-family: Arial, sans-serif; background: #fff7f5; }
      .wrap { height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; color: #222; }
      .box { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 12px 32px rgba(0,0,0,.12); max-width: 360px; width: 100%; }
      .spin { width: 34px; height: 34px; border: 4px solid #f0c8c4; border-top-color: #C7332D; border-radius: 50%; margin: 0 auto 16px; animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { color: #666; font-size: 13px; line-height: 18px; margin: 0; }
      button { margin-top: 18px; border: 0; background: #C7332D; color: #fff; border-radius: 10px; padding: 12px 16px; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="box">
        <div class="spin"></div>
        <h1>Opening secure Razorpay checkout</h1>
        <p>Please wait. Do not press back while payment is loading.</p>
        <button id="retry" style="display:none">Retry Payment</button>
      </div>
    </div>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <script>
      const checkoutOptions = ${safeJson(options)};
      function post(payload) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      function openCheckout() {
        if (!window.Razorpay) {
          document.getElementById('retry').style.display = 'inline-block';
          post({ type: 'error', message: 'Razorpay checkout failed to load.' });
          return;
        }
        const options = {
          ...checkoutOptions,
          handler: function(response) { post({ type: 'success', response }); },
          modal: {
            ondismiss: function() { post({ type: 'closed' }); }
          }
        };
        const instance = new window.Razorpay(options);
        instance.on('payment.failed', function(response) {
          post({ type: 'failed', response });
        });
        instance.open();
      }
      document.getElementById('retry').onclick = openCheckout;
      setTimeout(openCheckout, 400);
    </script>
  </body>
</html>`;
};

const PaymentWebViewScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const webRef = useRef(null);
  const { refreshProfile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [handled, setHandled] = useState(false);
  const url = route?.params?.url || '';
  const title = route?.params?.title || 'Payment';
  const checkout = route?.params?.checkout || null;

  const finishPayment = useCallback(async () => {
    if (handled) return;
    setHandled(true);
    const freshProfile = await refreshProfile?.().catch(() => null);
    const active = getSubscriptionInfo(freshProfile || user || {}).active;
    Alert.alert(
      active ? 'Payment completed' : 'Payment submitted',
      active
        ? 'Your membership is active now.'
        : 'Payment is submitted. Your access will update after backend confirmation.',
      [
        {
          text: 'OK',
          onPress: () => navigation.reset({
            index: 0,
            routes: [{ name: active ? 'Home' : 'Subscription' }],
          }),
        },
      ],
    );
  }, [handled, navigation, refreshProfile, user]);

  const verifyRazorpayPayment = useCallback(async (response = {}) => {
    if (!checkout || handled) return;
    setHandled(true);
    setLoading(true);
    try {
      const common = {
        planId: checkout.planId,
        selectedCategories: checkout.selectedCategories || [],
        selectedAddons: checkout.selectedAddons || [],
        couponCode: checkout.couponCode || undefined,
      };
      if (checkout.mode === 'trial') {
        await verifyPaymentSubscription({
          ...common,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_subscription_id: response.razorpay_subscription_id,
          razorpay_signature: response.razorpay_signature,
        });
      } else {
        await verifyPaymentOrder({
          ...common,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        });
      }
      const freshProfile = await refreshProfile?.().catch(() => null);
      const active = getSubscriptionInfo(freshProfile || user || {}).active;
      Alert.alert(
        checkout.mode === 'trial' ? 'Free trial started' : 'Payment successful',
        checkout.mode === 'trial'
          ? 'Autopay is active and your 15 days free trial has started.'
          : 'Your plan has been activated.',
        [{
          text: 'OK',
          onPress: () => navigation.reset({
            index: 0,
            routes: [{ name: active ? 'Home' : 'Subscription' }],
          }),
        }],
      );
    } catch (err) {
      setHandled(false);
      Alert.alert('Payment verification failed', err?.data?.error || err?.data?.message || err?.message || 'Please contact support if amount was deducted.');
    } finally {
      setLoading(false);
    }
  }, [checkout, handled, navigation, refreshProfile, user]);

  const handleMessage = useCallback((event) => {
    let payload = null;
    try {
      payload = JSON.parse(event?.nativeEvent?.data || '{}');
    } catch (_) {
      payload = {};
    }
    if (payload?.type === 'success') {
      verifyRazorpayPayment(payload.response || {});
      return;
    }
    if (payload?.type === 'failed') {
      const description = payload?.response?.error?.description || 'Please retry the payment.';
      Alert.alert('Payment failed', description);
      return;
    }
    if (payload?.type === 'error') {
      Alert.alert('Payment error', payload.message || 'Unable to open Razorpay checkout.');
    }
  }, [verifyRazorpayPayment]);

  const handleNavChange = useCallback((navState) => {
    const nextUrl = navState?.url || '';
    if (!nextUrl) return;
    if (isSuccessUrl(nextUrl)) {
      finishPayment();
      return;
    }
    if (isFailureUrl(nextUrl)) {
      Alert.alert('Payment not completed', 'You can retry the payment or choose another plan.');
    }
  }, [finishPayment]);

  const closePayment = useCallback(() => {
    Alert.alert('Close payment?', 'Your payment may not be complete yet.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }, [navigation]);

  if (!url && !checkout) {
    return (
      <View style={styles.emptyRoot}>
        <Text style={styles.emptyTitle}>Payment link unavailable</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.emptyBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={closePayment}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => webRef.current?.reload?.()}>
          <MaterialIcons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loaderText}>Opening secure payment...</Text>
        </View>
      ) : null}

      <WebView
        ref={webRef}
        source={checkout ? { html: buildRazorpayHtml(checkout), baseUrl: 'https://policy-bhandar.vercel.app' } : { uri: url }}
        style={styles.webview}
        originWhitelist={['*']}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={checkout ? undefined : handleNavChange}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onError={() => {
          setLoading(false);
          Alert.alert('Payment page error', 'Unable to load the payment page. Please retry.');
        }}
      />
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
