import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getSubscriptionInfo } from '../utils/subscriptionInfo';
import { Colors } from '../theme/colors';

const MembershipStatusScreen = ({ navigation, route }) => {
  const { user, refreshProfile, logout } = useAuth();
  const membership = getSubscriptionInfo(user);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const busy = useRef(false);
  const fromRegistration = !!route?.params?.fromRegistration;
  const continueToApp = useCallback(() => navigation.reset({ index: 0, routes: [{ name: fromRegistration ? 'Onboarding' : 'Home' }] }), [fromRegistration, navigation]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const check = useCallback(async () => {
    if (busy.current || AppState.currentState !== 'active' || navigation.isFocused?.() === false) return;
    busy.current = true;
    setChecking(true);
    setError('');
    try {
      const fresh = await refreshProfile({ force: true, membershipOnly: true });
      if (!mounted.current || navigation.isFocused?.() === false) return;
      if (fresh && getSubscriptionInfo(fresh).active) continueToApp();
      else if (!fresh) setError('Unable to refresh your account. Your last saved status is shown. Please try again.');
    } catch (_) {
      if (mounted.current) setError('Unable to refresh your account. Please try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [continueToApp, navigation, refreshProfile]);

  useEffect(() => {
    if (membership.active) return;
    check();
    const timer = setInterval(check, 15000);
    const focus = navigation.addListener?.('focus', check);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') check(); });
    return () => { clearInterval(timer); focus?.(); listener.remove(); };
  }, [check, membership.active, navigation]);

  const signOut = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return <SafeAreaView style={styles.root}>
    <View style={styles.card}>
      <Text style={styles.brand}>POLICYBHANDAR</Text>
      <Text style={styles.title}>Membership status</Text>
      <Text style={styles.status}>{membership.active ? membership.name : 'No active membership'}</Text>
      <Text style={styles.body}>{membership.active
        ? 'Your account has access to the features included in your membership.'
        : 'This app provides access to your existing membership. No active membership is linked to this account yet. Account changes will appear here after they are confirmed.'}</Text>
      {membership.validTill ? <Text style={styles.body}>Valid until: {membership.validTill}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {membership.active ? <TouchableOpacity style={styles.primary} onPress={continueToApp}><Text style={styles.primaryText}>Continue</Text></TouchableOpacity>
        : <TouchableOpacity style={styles.primary} disabled={checking} onPress={check}>
          {checking ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Refresh status</Text>}
        </TouchableOpacity>}
      <TouchableOpacity style={styles.secondary} onPress={() => navigation.navigate('MyProfile')}><Text style={styles.secondaryText}>My account</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={signOut}><Text style={styles.secondaryText}>Sign out</Text></TouchableOpacity>
    </View>
  </SafeAreaView>;
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F7F7', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', padding: 24, borderRadius: 18 },
  brand: { color: Colors.primary, fontSize: 17, fontWeight: '800', marginBottom: 22 },
  title: { color: Colors.textDark, fontSize: 24, fontWeight: '700', marginBottom: 16 },
  status: { color: Colors.textDark, fontSize: 17, fontWeight: '600', marginBottom: 12 },
  body: { color: Colors.textGray, fontSize: 15, lineHeight: 23, marginBottom: 16 },
  error: { color: Colors.primary, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  primary: { backgroundColor: Colors.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: { padding: 14, alignItems: 'center' },
  secondaryText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
});

export default MembershipStatusScreen;
