import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { BRAND, loadAppSettings } from '../services/appData';

const ABOUT_CONTENT = {
  tagline: "India's Complete Business Builder App for Insurance Professionals.",
  headline: 'Learn Faster. Sell Smarter. Recruit Bigger',
  founder: {
    name: 'Yogendra Verma',
    role: 'Founder & CEO - Policy Bhandar',
    paragraphs: [
      'With more than 28 years of experience in the Insurance and Financial Services industry, Yogendra Verma has dedicated his career to helping Insurance Advisors, Mutual Fund Advisors, and Business Leaders build sustainable, profitable, and long-term businesses.',
      'Throughout his professional journey, he has trained, mentored, and guided thousands of insurance professionals across India in the areas of sales, recruitment, leadership development, digital marketing, branding, customer acquisition, and business growth strategies.',
      'Through Policy Bhandar, he is transforming traditional insurance selling into a digital-first business model, enabling advisors and leaders to market, recruit, sell, and grow smarter than ever before.',
    ],
    vision:
      'Empower advisors with knowledge, technology, and digital marketing so they can build a bigger business while serving their clients professionally.',
  },
  about:
    'Policy Bhandar is a complete business growth ecosystem designed for insurance advisors, mutual fund advisors, insurance leaders, agency managers, trainers, and business builders.',
  audience: [
    'Insurance Advisors',
    'Mutual Fund Advisors',
    'Insurance Leaders',
    'Agency Managers',
    'Trainers',
    'Business Builders',
  ],
  purpose:
    'The purpose of Policy Bhandar is to bridge the gap between traditional selling and modern digital business building. It gives professionals structured, mobile-first resources that save time, improve productivity, and accelerate business growth.',
  resources: [
    'Professional marketing materials',
    'AI-powered reels',
    'Ready-to-use presentations',
    'Sales scripts',
    'WhatsApp marketing resources',
    'Recruitment tools',
    'Digital branding techniques',
    'Closing strategies',
    'Business automation resources',
    'Continuous learning',
    'Updated product knowledge',
    'Professional business guidance',
  ],
  advisorMission:
    'We are committed to helping every Insurance and Mutual Fund Advisor build a stronger, more profitable, and more professional business through reliable digital tools, practical training, and continuous learning.',
  advisorMissionPoints: [
    'Build their business faster.',
    'Upgrade marketing and selling skills.',
    'Strengthen customer relationships.',
    'Deliver better financial guidance.',
    'Improve productivity using technology.',
    'Save time through ready-to-use marketing resources.',
    'Build a recognizable personal brand.',
    'Generate more quality leads.',
    'Increase policy conversions.',
    'Create long-term customer loyalty.',
    'Stay updated with the latest products and industry trends.',
    'Grow with confidence in the digital era.',
  ],
  advisorGoal:
    'To empower 5,00,000+ Insurance and Mutual Fund Advisors through the Policy Bhandar platform and help them maximize their income while delivering greater value to their clients.',
  leaderMission:
    'Our mission is to transform Insurance Leaders into powerful Business Builders by providing proven recruitment systems, digital marketing tools, leadership training, and scalable business processes.',
  leaderMissionPoints: [
    'Recruit advisors completely through digital methods.',
    'Build a consistent recruitment pipeline.',
    'Conduct bulk hiring campaigns.',
    'Create a strong personal brand.',
    'Improve leadership skills.',
    'Build high-performing advisor teams.',
    'Train advisors effectively.',
    'Improve team productivity.',
    'Automate recruitment and follow-up activities.',
    'Scale operations with digital systems.',
    'Build 100+ active advisors every year, depending on aspirations and efforts.',
    'Develop long-term, sustainable leadership businesses.',
  ],
  leaderGoal:
    'To empower 10,000+ Insurance Leaders to exponentially increase their recruitment, business growth, and annual earnings through digital-first leadership strategies.',
  vision:
    'Our vision is to make Insurance Advisory, Mutual Fund Advisory, Leadership Development, Recruitment, and Business Building more transparent, searchable, organized, and mobile-first for every professional.',
  visionPoints: [
    'Every advisor has access to world-class business resources.',
    'Every leader can recruit and train digitally.',
    'Knowledge is available anytime, anywhere.',
    'Technology simplifies business growth.',
    'AI becomes a practical tool for everyday marketing.',
    'Continuous learning becomes a habit.',
    'Advisors become trusted financial professionals.',
    'Leaders build scalable, ethical, and sustainable organizations.',
    'Insurance and Mutual Fund advisory become more professional, respected, and customer-centric.',
  ],
  commitment:
    'At Policy Bhandar, knowledge, technology, consistency, and execution are the four pillars of long-term success. Every update, banner, AI reel, presentation, training session, and app feature is created to help advisors and leaders learn faster, recruit smarter, market better, sell more professionally, and build lasting value.',
};

const Paragraph = ({ children }) => <Text style={styles.cardText}>{children}</Text>;

const BulletList = ({ items = [] }) => (
  <View style={styles.bulletList}>
    {items.map((item) => (
      <View key={item} style={styles.bulletRow}>
        <View style={styles.bulletDot} />
        <Text style={styles.bulletText}>{item}</Text>
      </View>
    ))}
  </View>
);

const SectionCard = ({ icon, title, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <MaterialIcons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const AboutUsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadAppSettings().then(setSettings);
  }, []);

  const brandName = settings?.brandName || BRAND.name;
  const team = settings?.team || [];

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.brandSection}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="shield-check" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.brandName}>{brandName}</Text>
          <Text style={styles.brandTagline}>{ABOUT_CONTENT.tagline}</Text>
          <Text style={styles.brandHeadline}>{ABOUT_CONTENT.headline}</Text>
          <Text style={styles.brandDesc}>
            {ABOUT_CONTENT.about}
          </Text>
        </View>

        {!settings ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading latest company details...</Text>
          </View>
        ) : null}

        <SectionCard icon="person" title="Founder & CEO">
          <Text style={styles.founderName}>{ABOUT_CONTENT.founder.name}</Text>
          <Text style={styles.founderRole}>{ABOUT_CONTENT.founder.role}</Text>
          {ABOUT_CONTENT.founder.paragraphs.map((paragraph) => (
            <Paragraph key={paragraph}>{paragraph}</Paragraph>
          ))}
          <View style={styles.quoteBox}>
            <Text style={styles.quoteText}>{ABOUT_CONTENT.founder.vision}</Text>
          </View>
        </SectionCard>

        <SectionCard icon="verified" title="Why Policy Bhandar?">
          <Paragraph>
            Policy Bhandar is not just another content library. Whether the goal is to generate more business,
            recruit more advisors, improve digital presence, or become a recognized industry expert, Policy
            Bhandar provides the right knowledge, tools, and resources in one place.
          </Paragraph>
          <BulletList items={ABOUT_CONTENT.audience} />
        </SectionCard>

        <SectionCard icon="track-changes" title="Purpose of Policy Bhandar">
          <Paragraph>{ABOUT_CONTENT.purpose}</Paragraph>
          <BulletList items={ABOUT_CONTENT.resources} />
        </SectionCard>

        <SectionCard icon="flag" title="Mission for Advisors">
          <Paragraph>{ABOUT_CONTENT.advisorMission}</Paragraph>
          <BulletList items={ABOUT_CONTENT.advisorMissionPoints} />
          <View style={styles.goalBox}>
            <Text style={styles.goalLabel}>Long-term goal</Text>
            <Text style={styles.goalText}>{ABOUT_CONTENT.advisorGoal}</Text>
          </View>
        </SectionCard>

        <SectionCard icon="groups" title="Mission for Leaders">
          <Paragraph>{ABOUT_CONTENT.leaderMission}</Paragraph>
          <BulletList items={ABOUT_CONTENT.leaderMissionPoints} />
          <View style={styles.goalBox}>
            <Text style={styles.goalLabel}>Long-term goal</Text>
            <Text style={styles.goalText}>{ABOUT_CONTENT.leaderGoal}</Text>
          </View>
        </SectionCard>

        <SectionCard icon="visibility" title="Our Vision">
          <Paragraph>{ABOUT_CONTENT.vision}</Paragraph>
          <Paragraph>
            We aspire to create India's most trusted digital platform where every advisor and leader can learn,
            grow, recruit, market, and manage their business from a single application.
          </Paragraph>
          <BulletList items={ABOUT_CONTENT.visionPoints} />
        </SectionCard>

        <SectionCard icon="workspace-premium" title="Our Commitment">
          <Paragraph>{ABOUT_CONTENT.commitment}</Paragraph>
        </SectionCard>

        <Text style={styles.sectionHeading}>Our Team</Text>
        {team.length ? (
          team.map((member, index) => (
            <View key={member._id || member.id || index} style={styles.teamCard}>
              <View style={styles.teamAvatar}>
                <MaterialIcons name="person" size={28} color={Colors.primary} />
              </View>
              <View style={styles.teamInfo}>
                <Text style={styles.teamName}>{member.name || member.fullName || 'Team Member'}</Text>
                <Text style={styles.teamRole}>{member.role || member.designation || 'POLICYBHANDAR Team'}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <MaterialIcons name="groups" size={28} color={Colors.textLight} />
            <Text style={styles.emptyText}>Team details will appear here when added from backend.</Text>
          </View>
        )}
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
  brandSection: { backgroundColor: Colors.primary, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 12, elevation: 4 },
  brandName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  brandTagline: { color: 'rgba(255,255,255,0.88)', fontSize: 13, marginTop: 4, textAlign: 'center' },
  brandHeadline: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 12, marginTop: 8, textAlign: 'center' },
  brandDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 14, borderRadius: 12, padding: 14 },
  loadingText: { color: Colors.textGray, fontSize: 13 },
  card: { backgroundColor: '#fff', margin: 14, marginBottom: 0, borderRadius: 12, padding: 16, elevation: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textDark },
  cardText: { fontSize: 13, color: Colors.textGray, lineHeight: 20, marginTop: 6 },
  founderName: { color: Colors.textDark, fontSize: 16, fontWeight: '900', marginTop: 4 },
  founderRole: { color: Colors.primary, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 2 },
  quoteBox: { backgroundColor: '#FFF4F2', borderLeftColor: Colors.primary, borderLeftWidth: 4, borderRadius: 10, marginTop: 12, padding: 12 },
  quoteText: { color: Colors.textDark, fontSize: 13, fontStyle: 'italic', fontWeight: '700', lineHeight: 20 },
  bulletList: { marginTop: 10 },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 7 },
  bulletDot: { backgroundColor: Colors.primary, borderRadius: 4, height: 7, marginTop: 7, width: 7 },
  bulletText: { color: Colors.textGray, flex: 1, fontSize: 13, lineHeight: 19 },
  goalBox: { backgroundColor: '#F8FAFC', borderColor: Colors.border, borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 12 },
  goalLabel: { color: Colors.primary, fontSize: 12, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase' },
  goalText: { color: Colors.textDark, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: Colors.textDark, paddingHorizontal: 14, paddingTop: 18, paddingBottom: 10 },
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', marginHorizontal: 14, marginBottom: 8, borderRadius: 12, padding: 14, elevation: 1 },
  teamAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF0F0' },
  teamName: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  teamRole: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', marginHorizontal: 14, borderRadius: 12, padding: 16 },
  emptyText: { flex: 1, color: Colors.textGray, fontSize: 13, lineHeight: 19 },
});

export default AboutUsScreen;
