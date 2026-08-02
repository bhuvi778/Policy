import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Big icon cards exactly like screenshot
const MENU_ITEMS = [
  {
    id: 'dataEntry',
    label: 'Data Entry',
    icon: 'person-add',
    iconBg: '#E3F2FD',
    iconColor: '#2196F3',
    plusColor: '#2196F3',
    route: 'DataEntry',
  },
  {
    id: 'clientList',
    label: 'Client List',
    icon: 'event-available',
    iconBg: '#FFF3E0',
    iconColor: '#FF5722',
    route: 'ClientList',
  },
  {
    id: 'dueList',
    label: 'Due List',
    icon: 'event-busy',
    iconBg: '#FFF8E1',
    iconColor: '#FFC107',
    route: 'DueList',
  },
];

const BigIconCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.iconWrap, { backgroundColor: item.iconBg }]}>
      <MaterialIcons name={item.icon} size={80} color={item.iconColor} />
    </View>
    <Text style={styles.cardLabel}>{item.label}</Text>
  </TouchableOpacity>
);

const PremiumCalendarScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium Calendar</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
        {MENU_ITEMS.map((item) => (
          <BigIconCard
            key={item.id}
            item={item}
            onPress={() => navigation.navigate(item.route)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  scroll: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 16,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 4,
  },
  iconWrap: {
    width: 140, height: 120, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  cardLabel: {
    fontSize: 16, fontWeight: '600', color: '#444',
  },
});

export default PremiumCalendarScreen;
