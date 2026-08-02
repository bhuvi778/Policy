import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';

const Header = ({
  onMenuPress, onSearchPress, onRefreshPress,
  onNotificationPress, notificationCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" translucent={false} />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={onMenuPress} style={styles.iconBtn}>
          <MaterialIcons name="menu" size={26} color={Colors.white} />
        </TouchableOpacity>

        <Text style={styles.title}>POLICYBHANDAR</Text>

        <View style={styles.rightIcons}>
          <TouchableOpacity onPress={onSearchPress} style={styles.iconBtn}>
            <Ionicons name="search" size={22} color={Colors.white} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onRefreshPress} style={styles.iconBtn}>
            <Ionicons name="refresh" size={22} color={Colors.white} />
          </TouchableOpacity>

          {/* Notification with badge */}
          <TouchableOpacity onPress={onNotificationPress} style={styles.iconBtn}>
            <View>
              <Ionicons name="notifications-outline" size={22} color={Colors.white} />
              {notificationCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
  title: {
    flex: 1,
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 0.4,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    padding: 7,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: '#FFD700',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  badgeText: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
});

export default Header;
