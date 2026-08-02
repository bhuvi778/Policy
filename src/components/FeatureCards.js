import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/colors';

const FEATURE_CARDS = [
  {
    id: '1',
    label: 'Scan & Save\nCard',
    icon: 'credit-card-scan',
    iconLib: 'MaterialCommunityIcons',
    iconColor: '#2980B9',
    bg: '#EBF5FB',
    badge: 'NEW',
    route: 'Scan',
  },
  {
    id: '2',
    label: 'Premium\nCalendar',
    icon: 'calendar-month',
    iconLib: 'MaterialIcons',
    iconColor: '#27AE60',
    bg: '#EAFAF1',
    route: 'PremiumCalendar',
  },
  {
    id: '3',
    label: 'NFC Smart\nCard',
    icon: 'nfc',
    iconLib: 'MaterialIcons',
    iconColor: '#8E44AD',
    bg: '#F5EEFF',
    route: 'NFCSmartCard',
  },
];

const FeatureCard = React.memo(({ card, onCardPress }) => {
  const Icon = card.iconLib === 'MaterialCommunityIcons'
    ? <MaterialCommunityIcons name={card.icon} size={32} color={card.iconColor} />
    : <MaterialIcons name={card.icon} size={32} color={card.iconColor} />;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onCardPress && onCardPress(card)}
      activeOpacity={0.72}
    >
      <View style={[styles.iconWrap, { backgroundColor: card.bg }]}>
        {Icon}
        {card.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{card.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.label}>{card.label}</Text>
    </TouchableOpacity>
  );
});

const FeatureCards = ({ onCardPress }) => (
  <View style={styles.container}>
    {FEATURE_CARDS.map((card) => (
      <FeatureCard key={card.id} card={card} onCardPress={onCardPress} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.offWhite,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '800',
  },
  label: {
    fontSize: 11.5,
    color: Colors.textDark,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 15,
    paddingHorizontal: 4,
  },
});

export default FeatureCards;
