import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Animated,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';

const WHATSAPP_URL = 'https://chat.whatsapp.com/';

const FloatingBar = ({ onMenuPress }) => {
  const menuScale = useRef(new Animated.Value(1)).current;
  const joinScale = useRef(new Animated.Value(1)).current;

  const handlePress = (scaleRef, callback) => {
    Animated.sequence([
      Animated.timing(scaleRef, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleRef, { toValue: 1, useNativeDriver: true, tension: 100, friction: 6 }),
    ]).start(callback);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Menu button */}
      <Animated.View style={{ transform: [{ scale: menuScale }] }}>
        <TouchableOpacity
          style={[styles.fab, styles.menuFab]}
          onPress={() => handlePress(menuScale, onMenuPress)}
          activeOpacity={0.9}
        >
          <MaterialIcons name="menu" size={24} color={Colors.white} />
          <Text style={styles.fabLabel}>Menu</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Join/WhatsApp button */}
      <Animated.View style={{ transform: [{ scale: joinScale }] }}>
        <TouchableOpacity
          style={[styles.fab, styles.joinFab]}
          onPress={() => handlePress(joinScale, () => Linking.openURL(WHATSAPP_URL))}
          activeOpacity={0.9}
        >
          <Ionicons name="logo-whatsapp" size={22} color={Colors.white} />
          <Text style={styles.fabLabel}>Join</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 30,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  menuFab: {
    backgroundColor: Colors.primary,
  },
  joinFab: {
    backgroundColor: Colors.green,
  },
  fabLabel: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
});

export default FloatingBar;
