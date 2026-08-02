import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Image,
  Dimensions, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { BRAND, getAdvisorDisplayName, isDisplayName } from '../services/appData';
import { getProfileImageUrl } from './ProfileFooterPreview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

const NAV_ITEMS = [
  { id: 'home', icon: 'home', label: 'Home' },
  { id: 'profile', icon: 'account-box', label: 'My Profile' },
  { id: 'subscription', icon: 'card-membership', label: 'Membership Plan' },
  { id: 'training', icon: 'school', label: 'Training' },
  { id: 'about', icon: 'person', label: 'About US' },
  { id: 'contact', icon: 'phone', label: 'Contact Us' },
  { id: 'rate', icon: 'star-border', label: 'Rate Us' },
  { id: 'terms', icon: 'description', label: 'Terms Of Use' },
  { id: 'privacy', icon: 'info-outline', label: 'Privacy & Policy' },
  { id: 'exit', icon: 'logout', label: 'Logout' },
];

const DrawerSidebar = ({ visible, onClose, activeItem = 'home', onNavigate, onLogout, userData }) => {
  const insets = useSafeAreaInsets();
  const { user: authUser, logout } = useAuth();
  const displayName = getAdvisorDisplayName(authUser, userData);
  const roleFromUser = authUser?.designation || userData?.designation || '';
  const profileImageUrl = getProfileImageUrl(authUser || userData || {});
  const rawRole = roleFromUser || (authUser?.memberType === 'Member' ? 'Member' : 'Insurance Advisor');
  const hasRealName = isDisplayName(displayName) && displayName.toLowerCase() !== 'insurance advisor';
  const roleLabel = isDisplayName(rawRole) ? rawRole : 'Insurance Advisor';
  const displayRole = hasRealName
    ? (roleLabel.toLowerCase() === 'insurance advisor' ? 'Insurance Advisor' : roleLabel)
    : '';
  const resolvedName = (hasRealName ? displayName : roleLabel).toUpperCase();

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateX, backdropOpacity]);

  const handleNavItem = (item) => {
    if (item.id === 'exit') {
      onClose && onClose();
      setTimeout(() => {
        if (onLogout) {
          onLogout();
        } else {
          logout();
        }
      }, 120);
      return;
    }
    onNavigate && onNavigate(item.id);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <View style={[styles.profileSection, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            style={[styles.closeButton, { top: insets.top + 18 }]}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="close" size={22} color={Colors.textGray} />
          </TouchableOpacity>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {profileImageUrl ? (
                <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <MaterialIcons name="person" size={54} color={Colors.primary} />
              )}
            </View>
          </View>
          <Text style={styles.userName}>{resolvedName}</Text>
          <Text style={styles.userRole}>
            {hasRealName ? displayRole : ''}
          </Text>
        </View>

        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeItem;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => handleNavItem(item)}
                activeOpacity={0.75}
              >
                <MaterialIcons
                  name={item.icon}
                  size={22}
                  color={isActive ? Colors.primary : '#888'}
                />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.footerCompany}>
            {userData?.company?.name || BRAND.name}
          </Text>
          <Text style={styles.footerVersion}>v10.6.9</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlay: {
    elevation: 1000,
    zIndex: 1000,
  },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: DRAWER_WIDTH, backgroundColor: '#fff',
    elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 12,
  },
  profileSection: {
    backgroundColor: '#fff',
    paddingBottom: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  avatarRing: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 10, backgroundColor: '#FFF5F5',
    elevation: 3,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  avatarInner: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: { height: '100%', width: '100%' },
  userName: {
    color: Colors.primary, fontSize: 16,
    fontWeight: '800', letterSpacing: 0.2,
  },
  userRole: {
    color: Colors.textGray, fontSize: 12, marginTop: 3,
  },
  navList: { flex: 1 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 14, paddingHorizontal: 22,
    borderBottomWidth: 0.5, borderBottomColor: '#F5F5F5',
  },
  navItemActive: {
    backgroundColor: '#FFF0F0',
  },
  navLabel: {
    fontSize: 14, color: '#444', fontWeight: '500',
  },
  navLabelActive: {
    color: Colors.primary, fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingTop: 14, paddingHorizontal: 20, alignItems: 'center', gap: 2,
  },
  footerCompany: {
    color: Colors.primary, fontWeight: '800', fontSize: 14,
  },
  footerVersion: {
    color: Colors.textLight, fontSize: 11,
  },
});

export default DrawerSidebar;
