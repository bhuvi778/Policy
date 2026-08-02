import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const LOGO  = require('../assets/images/policybhandar_logo.png');
const BADGE = require('../assets/images/anniversary_badge.png');

const DOTS = [
  { x: 0.12, y: 0.18, size: 30, color: Colors.dotPink   },
  { x: 0.44, y: 0.14, size: 14, color: Colors.dotBlue   },
  { x: 0.82, y: 0.19, size: 28, color: Colors.dotCoral  },
  { x: 0.26, y: 0.68, size: 18, color: Colors.dotPurple },
  { x: 0.72, y: 0.71, size: 22, color: '#FFCF9C'        },
];

const MIN_SPLASH_MS = 450;

const SplashScreen = ({ navigation }) => {
  const { user, authLoading } = useAuth();
  const [splashDone, setSplashDone]   = useState(false);
  const navigatedRef                  = useRef(false);

  // Animated values
  const logoScale      = useRef(new Animated.Value(0.5)).current;
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const badgeTranslate = useRef(new Animated.Value(60)).current;
  const badgeOpacity   = useRef(new Animated.Value(0)).current;
  const dot0 = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const dot4 = useRef(new Animated.Value(0)).current;
  const dotAnims = [dot0, dot1, dot2, dot3, dot4];

  // Run animations + mark splash done after MIN_SPLASH_MS
  useEffect(() => {
    const dotAnimations = dotAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1, duration: 400, delay: i * 120, useNativeDriver: true,
      })
    );

    Animated.parallel([
      ...dotAnimations,
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
          Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(badgeOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(badgeTranslate, { toValue: 0, useNativeDriver: true, tension: 60, friction: 8 }),
        ]),
      ]),
    ]).start();

    const timer = setTimeout(() => setSplashDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  // Navigate as soon as BOTH splash timer is done AND auth check is done
  useEffect(() => {
    if (!splashDone || authLoading || navigatedRef.current) return;
    navigatedRef.current = true;
    if (user) {
      navigation.replace('Home');
    } else {
      navigation.replace('Login');
    }
  }, [splashDone, authLoading, user]);

  // Safety fallback — if still stuck after 6 s, force navigate
  useEffect(() => {
    const fallback = setTimeout(() => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      navigation.replace('Login');
    }, 6000);
    return () => clearTimeout(fallback);
  }, []);

  return (
    <View style={styles.container}>
      {DOTS.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              left: dot.x * width,
              top:  dot.y * height,
              width:        dot.size,
              height:       dot.size,
              borderRadius: dot.size / 2,
              backgroundColor: dot.color,
              opacity: dotAnims[i],
              transform: [{
                scale: dotAnims[i].interpolate({
                  inputRange: [0, 1], outputRange: [0, 1],
                }),
              }],
            },
          ]}
        />
      ))}

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoClip}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.logoTitle}>POLICYBHANDAR</Text>
        <Text style={styles.logoSubtitle}>INSURANCE ADVISOR PLATFORM</Text>
      </Animated.View>

      {/* Anniversary badge — center row below logo */}
      <Animated.View style={[styles.badgeContainer, { opacity: badgeOpacity, transform: [{ translateY: badgeTranslate }] }]}>
        <Image source={BADGE} style={styles.badge} resizeMode="contain" />
      </Animated.View>

      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} size="small" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: { position: 'absolute' },
  logoContainer: { alignItems: 'center', justifyContent: 'center' },
  logoClip: {
    alignItems: 'center',
    height: width * 0.43,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    width: width * 0.66,
  },
  logo:  { width: width * 0.66, height: width * 0.66 },
  logoTitle: {
    color: '#2C2C2C',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 8,
  },
  logoSubtitle: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 2,
  },
  badgeContainer: { alignItems: 'center', marginTop: 28 },
  badge: { width: width * 0.48, height: width * 0.36 },
  loadingWrap: {
    alignItems: 'center',
    bottom: 42,
    gap: 8,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  loadingText: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SplashScreen;
