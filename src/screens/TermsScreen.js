import React from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By downloading, installing, or using the POLICYBHANDAR application, you agree to be bound by these Terms of Use. If you do not agree, please do not use the App.',
  },
  {
    title: '2. Use of the Application',
    body: 'The App is intended for licensed agents and authorized insurance advisors registered with POLICYBHANDAR. Unauthorized use, redistribution, or modification of the App or its content is strictly prohibited.',
  },
  {
    title: '3. User Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for notifying POLICYBHANDAR immediately about unauthorized account access.',
  },
  {
    title: '4. Content & Intellectual Property',
    body: 'All content within the App, including text, graphics, logos, images, videos, templates, and digital cards, is owned by POLICYBHANDAR or its licensors.',
  },
  {
    title: '5. Subscription & Payments',
    body: 'Premium features require an active subscription. Plan availability, pricing, and validity are shown dynamically from the backend when available.',
  },
  {
    title: '6. Prohibited Activities',
    body: 'Users must not use the App for unlawful purposes, transmit spam, reverse engineer the App, share login credentials, or upload malicious content.',
  },
  {
    title: '7. Disclaimer of Warranties',
    body: 'The App is provided as is. POLICYBHANDAR does not guarantee the accuracy, completeness, or timeliness of insurance information shown in the App.',
  },
  {
    title: '8. Limitation of Liability',
    body: 'POLICYBHANDAR shall not be liable for indirect, incidental, special, or consequential damages arising from use of the App.',
  },
  {
    title: '9. Modifications',
    body: 'POLICYBHANDAR may update these Terms from time to time. Continued use of the App after changes means you accept the updated Terms.',
  },
  {
    title: '10. Contact',
    body: 'For questions regarding these Terms, contact POLICYBHANDAR at info@POLICYBHANDAR.in or call 8424055399.',
  },
];

const TermsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  return (
  <View style={styles.root}>
    <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Terms Of Use</Text>
      <View style={{ width: 36 }} />
    </View>

    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <MaterialIcons name="description" size={36} color={Colors.primary} />
        <Text style={styles.bannerTitle}>Terms & Conditions</Text>
        <Text style={styles.bannerDate}>Last updated: 1 July 2026</Text>
        <Text style={styles.bannerDesc}>Please read these terms carefully before using POLICYBHANDAR.</Text>
      </View>

      {SECTIONS.map((section, index) => (
        <View key={index} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
        </View>
      ))}

      <View style={styles.agreeBox}>
        <MaterialIcons name="check-circle" size={22} color="#27AE60" />
        <Text style={styles.agreeText}>
          By using POLICYBHANDAR, you acknowledge that you have read and agree to these Terms of Use.
        </Text>
      </View>
    </ScrollView>
  </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10, elevation: 4 },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  content: { paddingBottom: 30 },
  banner: { backgroundColor: '#fff', margin: 14, borderRadius: 12, padding: 20, alignItems: 'center', gap: 4, borderTopWidth: 4, borderTopColor: Colors.primary, elevation: 1 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, marginTop: 6 },
  bannerDate: { fontSize: 12, color: Colors.textGray },
  bannerDesc: { fontSize: 13, color: Colors.textGray, textAlign: 'center', marginTop: 4 },
  section: { backgroundColor: '#fff', marginHorizontal: 14, marginBottom: 8, borderRadius: 10, padding: 16, elevation: 1 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  sectionBody: { fontSize: 13, color: Colors.textDark, lineHeight: 21 },
  agreeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#E8F8EE', marginHorizontal: 14, marginTop: 6, borderRadius: 10, padding: 14 },
  agreeText: { flex: 1, fontSize: 13, color: '#1B5E20', lineHeight: 20 },
});

export default TermsScreen;
