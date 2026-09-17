import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  FlatList, Animated, StatusBar, PermissionsAndroid,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Marketing Concepts',
    subtitle: 'Get Marketing Concepts on your Finger',
    desc: 'Personalized Brochures & Greetings\nAdd your name & client name for more personal touch',
    icon: 'campaign',
    iconColor: '#6C63FF',
    bg: '#F0EEFF',
  },
  {
    id: '2',
    title: "Leader's Corner",
    subtitle: 'Motivate your Team',
    desc: 'Access exclusive leadership content\nand motivational resources for your team',
    icon: 'workspace-premium',
    iconColor: '#F39C12',
    bg: '#FEF9F0',
  },
  {
    id: '3',
    title: 'Motivate your Team',
    subtitle: 'Get Marketing Concepts on your Finger',
    desc: 'Personalized Brochures & Greetings\nAdd your name & client name for more personal touch',
    icon: 'groups',
    iconColor: '#2980B9',
    bg: '#EBF5FB',
  },
  {
    id: '4',
    title: 'Prospect Management System',
    subtitle: 'Track your prospects for better results',
    desc: 'Manage all your prospects, follow-ups\nand business targets in one place',
    icon: 'manage-accounts',
    iconColor: Colors.primary,
    bg: '#FFF0F0',
    isLast: true,
  },
];

const PERMISSION_SCREENS = [
  {
    id: 'storage',
    title: 'Storage Permission:',
    desc: 'Storage permissions is necessary to run this app to store data like your profile data and downloaded content by you.',
    icon: 'folder',
    permission: PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
  },
];

// ── Single onboarding slide ───────────────────────────────────────
const Slide = ({ item }) => (
  <View style={[styles.slide, { width }]}>
    {/* Illustration area */}
    <View style={[styles.illustrationWrap, { backgroundColor: item.bg }]}>
      <MaterialIcons name={item.icon} size={160} color={item.iconColor} style={{ opacity: 0.85 }} />
    </View>
    <View style={styles.slideText}>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      <Text style={styles.slideDesc}>{item.desc}</Text>
    </View>
  </View>
);

// ── Permission screen ─────────────────────────────────────────────
const PermissionScreen = ({ item, onAgree }) => (
  <View style={styles.permRoot}>
    <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
    <View style={styles.permTopBar} />
    <View style={styles.permContent}>
      <View style={styles.permIconWrap}>
        <MaterialIcons name={item.icon} size={80} color="#555" />
      </View>
      <Text style={styles.permTitle}>{item.title}</Text>
      <Text style={styles.permDesc}>{item.desc}</Text>
      <TouchableOpacity style={styles.agreeBtn} onPress={onAgree}>
        <Text style={styles.agreeBtnTxt}>I Agree</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.permBottomBar} />
  </View>
);

// ── Main Onboarding ───────────────────────────────────────────────
const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { markOnboardingDone } = useAuth() || {};
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState('slides'); // 'slides' | 'permissions'
  const [permIndex, setPermIndex] = useState(0);
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      // Done with slides → permissions
      setPhase('permissions');
    }
  };

  const skipAll = () => setPhase('permissions');

  const handlePermAgree = async (item) => {
    try {
      await PermissionsAndroid.request(item.permission);
    } catch (_) {}
    if (permIndex < PERMISSION_SCREENS.length - 1) {
      setPermIndex(permIndex + 1);
    } else {
      // All done → mark onboarding complete → Home
      await markOnboardingDone?.();
      navigation.replace('Home');
    }
  };

  // ── Permission screens ──
  if (phase === 'permissions') {
    const current = PERMISSION_SCREENS[permIndex];
    return <PermissionScreen item={current} onAgree={() => handlePermAgree(current)} />;
  }

  // ── Slides ──
  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="#fff" barStyle="dark-content" />

      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={({ item }) => <Slide item={item} />}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
      />

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity onPress={skipAll}>
          <Text style={styles.skipTxt}>Skip</Text>
        </TouchableOpacity>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity onPress={goNext}>
          {currentIndex === SLIDES.length - 1
            ? <Text style={[styles.nextTxt, { color: Colors.primary }]}>Start</Text>
            : <Text style={styles.nextTxt}>Next</Text>
          }
        </TouchableOpacity>
      </View>

      {/* GET STARTED button on last slide */}
      {currentIndex === SLIDES.length - 1 && (
        <View style={styles.getStartedWrap}>
          <TouchableOpacity style={styles.getStartedBtn} onPress={goNext}>
            <Text style={styles.getStartedTxt}>GET STARTED</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  slide: { flex: 1, alignItems: 'center' },
  illustrationWrap: {
    width: '100%', height: height * 0.55,
    justifyContent: 'center', alignItems: 'center',
  },
  slideText: { padding: 24, alignItems: 'flex-start', width: '100%' },
  slideTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 6 },
  slideSubtitle: { fontSize: 14, color: Colors.textGray, marginBottom: 8 },
  slideDesc: { fontSize: 13, color: Colors.textGray, lineHeight: 20 },

  bottomNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
  },
  skipTxt: { fontSize: 14, color: Colors.textGray, fontWeight: '500', minWidth: 40 },
  nextTxt: { fontSize: 14, color: Colors.primary, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DDD' },
  dotActive: { backgroundColor: Colors.primary, width: 20 },

  getStartedWrap: {
    position: 'absolute', bottom: 70, left: 24, right: 24,
  },
  getStartedBtn: {
    backgroundColor: Colors.primary, borderRadius: 30,
    paddingVertical: 16, alignItems: 'center',
  },
  getStartedTxt: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },

  // Permission screens
  permRoot: { flex: 1, backgroundColor: '#fff' },
  permTopBar: { height: 8, backgroundColor: Colors.primary },
  permBottomBar: { height: 8, backgroundColor: Colors.primary },
  permContent: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, gap: 16,
  },
  permIconWrap: {
    width: 120, height: 120, borderRadius: 16,
    backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center',
    marginBottom: 8,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center' },
  permDesc: { fontSize: 14, color: Colors.textGray, textAlign: 'center', lineHeight: 22 },
  agreeBtn: {
    backgroundColor: Colors.primary, borderRadius: 8, width: '100%',
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  agreeBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default OnboardingScreen;
