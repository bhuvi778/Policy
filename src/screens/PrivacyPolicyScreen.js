import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { BRAND, loadAppSettings } from '../services/appData';

const DEFAULT_SECTIONS = [
  {
    icon: 'person',
    title: 'Information We Collect',
    body: 'We collect the information needed to run your account and insurance-advisor workflows, including name, phone number, email address, professional details, client records you enter, device details, and usage activity.',
  },
  {
    icon: 'settings',
    title: 'How We Use Your Information',
    body: 'We use this information to provide app features, manage reminders, show relevant content, process requests, improve service quality, send important updates, and comply with legal obligations.',
  },
  {
    icon: 'share',
    title: 'Information Sharing',
    body: 'We do not sell your personal information. Data may be shared with trusted service providers only when required to operate the app, process payments, deliver communication, or meet legal requirements.',
  },
  {
    icon: 'lock',
    title: 'Data Security',
    body: 'We use reasonable technical and organizational safeguards to protect information. No online system can be guaranteed completely secure, so users should also protect their login and device access.',
  },
  {
    icon: 'phone-android',
    title: 'Device Permissions',
    body: 'The app may request permissions such as camera, storage, contacts, and notifications when those features are used. You can manage these permissions from your device settings.',
  },
  {
    icon: 'update',
    title: 'Changes to This Policy',
    body: 'POLICYBHANDAR may update this policy when services, compliance needs, or product behavior changes. Important updates may be shared through the app or registered contact details.',
  },
];

const rights = [
  'Access your personal data',
  'Correct inaccurate data',
  'Request data deletion where applicable',
  'Withdraw consent where applicable',
  'Ask how your data is used',
];

const PrivacyPolicyScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadAppSettings()
      .then((data) => {
        if (active) setSettings(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const brandName = settings?.brandName || BRAND.name;
  const contactEmail = settings?.supportEmail || BRAND.email;
  const contactPhone = settings?.supportPhone || BRAND.phone;
  const sections = settings?.privacy?.length ? settings.privacy : DEFAULT_SECTIONS;

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialIcons name="privacy-tip" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.bannerTitle}>Privacy Policy</Text>
          <Text style={styles.bannerDate}>Last updated: 1 July 2026</Text>
          <Text style={styles.bannerDesc}>
            {brandName} is committed to protecting your privacy and handling advisor, client, and content data responsibly.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading latest policy...</Text>
          </View>
        ) : null}

        {sections.map((section, i) => (
          <View key={`${section.title}-${i}`} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <MaterialIcons name={section.icon || 'article'} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{section.body || section.description || section.content}</Text>
          </View>
        ))}

        <View style={styles.dataRightsBox}>
          <Text style={styles.dataRightsTitle}>Your Data Rights</Text>
          {rights.map((right) => (
            <View key={right} style={styles.rightRow}>
              <MaterialIcons name="check" size={16} color="#27AE60" />
              <Text style={styles.rightText}>{right}</Text>
            </View>
          ))}
          <Text style={styles.contactText}>
            Privacy requests: {contactEmail} | {contactPhone}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10,
    elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  content: { paddingBottom: 30 },
  banner: {
    backgroundColor: Colors.primary,
    padding: 24, alignItems: 'center', gap: 4,
  },
  bannerIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  bannerDate: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  bannerDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', marginHorizontal: 14, marginTop: 10,
    borderRadius: 10, padding: 12,
  },
  loadingText: { color: Colors.textGray, fontSize: 12 },
  section: {
    backgroundColor: '#fff', marginHorizontal: 14,
    marginTop: 8, borderRadius: 12, padding: 16, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textDark },
  sectionBody: { fontSize: 13, color: Colors.textGray, lineHeight: 21 },
  dataRightsBox: {
    backgroundColor: '#fff', margin: 14, borderRadius: 12,
    padding: 16, elevation: 1,
    borderLeftWidth: 4, borderLeftColor: Colors.primary,
  },
  dataRightsTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark, marginBottom: 10 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  rightText: { fontSize: 13, color: Colors.textDark },
  contactText: { fontSize: 12, color: Colors.textGray, lineHeight: 18, marginTop: 10 },
});

export default PrivacyPolicyScreen;
