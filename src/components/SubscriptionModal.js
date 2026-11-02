import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Linking,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { BRAND, getAssignedFranchise, getAssignedRep, getSubscriptionInfo } from '../services/appData';

const { width } = Dimensions.get('window');
const LOGO = require('../assets/images/policybhandar_logo.png');

const Divider = () => <View style={styles.divider} />;

const ContactBlock = ({ label, icon, name, phone, email }) => (
  <View style={styles.contactBlock}>
    <Text style={styles.contactLabel}>{label}</Text>
    {name ? (
      <View style={styles.contactRow}>
        <MaterialIcons name="person-outline" size={18} color={Colors.textGray} />
        <Text style={styles.contactText}>{name}</Text>
      </View>
    ) : null}
    {phone ? (
      <TouchableOpacity
        style={styles.contactRow}
        onPress={() => Linking.openURL(`tel:${phone}`)}
      >
        <MaterialIcons name="phone" size={18} color={Colors.textGray} />
        <Text style={styles.contactText}>{phone}</Text>
      </TouchableOpacity>
    ) : null}
    {email ? (
      <TouchableOpacity
        style={styles.contactRow}
        onPress={() => Linking.openURL(`mailto:${email}`)}
      >
        <MaterialIcons name="mail-outline" size={18} color={Colors.textGray} />
        <Text style={styles.contactText}>{email}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const SubscriptionModal = ({ visible, onUpgrade, onLater, userData }) => {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!userData) return null;

  const subscription = getSubscriptionInfo(userData);
  const franchise = getAssignedFranchise(userData);
  const rep = getAssignedRep(userData);
  const company = userData.company || {};

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modal,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Logo */}
            <View style={styles.logoRow}>
              <View style={styles.logoClip}>
                <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              </View>
              <Text style={styles.logoTitle}>POLICYBHANDAR</Text>
            </View>

            {/* Greeting */}
            <Text style={styles.greeting}>Dear {userData.name}</Text>
            <Text style={styles.congratsText}>
              {subscription.active ? 'Your plan is active' : 'No active plan linked'}
            </Text>
            <Text style={styles.bodyText}>
              {subscription.active
                ? `POLICYBHANDAR ${subscription.name} is active${subscription.validTill ? ` till ${subscription.validTill}` : ''}.`
                : 'Choose a POLICYBHANDAR subscription plan to unlock premium advisor tools.'}
            </Text>

            <Divider />

            {franchise.name || franchise.phone ? (
              <>
                <ContactBlock
                  label="Assigned Franchise"
                  name={franchise.name}
                  phone={franchise.phone}
                />
                <Divider />
              </>
            ) : null}

            {rep.name || rep.phone ? (
              <>
                <ContactBlock
                  label="Company Representative"
                  name={rep.name}
                  phone={rep.phone}
                />
                <Divider />
              </>
            ) : null}

            <ContactBlock
              label={company.name || BRAND.name}
              phone={company.phone || BRAND.phone}
              email={company.email || BRAND.email}
            />

            <Divider />
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={onUpgrade}>
              <Text style={styles.actionText}>Upgrade Now</Text>
            </TouchableOpacity>
            <View style={styles.actionSep} />
            <TouchableOpacity style={styles.actionBtn} onPress={onLater}>
              <Text style={styles.actionText}>Upgrade Later</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logoRow: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  logo: {
    width: 120,
    height: 120,
  },
  logoClip: {
    alignItems: 'center',
    height: 66,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    width: 120,
  },
  logoTitle: {
    color: '#2C2C2C',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 4,
  },
  greeting: {
    fontSize: 15,
    color: Colors.textDark,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  congratsText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13.5,
    color: Colors.textDark,
    paddingHorizontal: 20,
    lineHeight: 20,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
    color: Colors.textDark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 0,
    marginVertical: 4,
  },
  contactBlock: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  contactLabel: {
    fontSize: 13,
    color: Colors.textGray,
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textDark,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  actionSep: {
    width: 1,
    backgroundColor: Colors.border,
  },
});

export default SubscriptionModal;
