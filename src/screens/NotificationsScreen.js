import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Platform, Alert, ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { loadDynamicNotifications } from '../services/appData';

const ICONS = {
  renewal: { icon: 'card-membership', iconLib: 'MaterialIcons', iconColor: '#C0392B', bg: '#FFF0F0' },
  update: { icon: 'system-update', iconLib: 'MaterialIcons', iconColor: '#2980B9', bg: '#EBF5FB' },
  content: { icon: 'image', iconLib: 'MaterialIcons', iconColor: '#8E44AD', bg: '#F5EEF8' },
  training: { icon: 'school', iconLib: 'MaterialIcons', iconColor: '#27AE60', bg: '#EAFAF1' },
  policy: { icon: 'security', iconLib: 'MaterialIcons', iconColor: '#C0392B', bg: '#FFF0F0' },
  event: { icon: 'event', iconLib: 'MaterialIcons', iconColor: '#E67E22', bg: '#FEF9E7' },
  default: { icon: 'notifications', iconLib: 'MaterialIcons', iconColor: Colors.primary, bg: '#FFF0F0' },
};

const friendlyDate = (value) => {
  if (!value) return 'Latest';
  if (value === 'Latest' || value === 'Today' || value === 'Yesterday') return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const today = new Date();
  const sameDay = parsed.toDateString() === today.toDateString();
  if (sameDay) return 'Today';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const friendlyTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const decorateNotification = (item) => {
  const meta = ICONS[item.type] || ICONS.default;
  return {
    ...meta,
    ...item,
    date: friendlyDate(item.date),
    time: friendlyTime(item.time || item.date),
  };
};

const NotifIcon = ({ iconLib, icon, color, size = 22 }) => {
  if (iconLib === 'MaterialCommunityIcons') return <MaterialCommunityIcons name={icon} size={size} color={color} />;
  if (iconLib === 'Ionicons') return <Ionicons name={icon} size={size} color={color} />;
  return <MaterialIcons name={icon} size={size} color={color} />;
};

const NotificationItem = ({ item, onPress, onDelete }) => (
  <TouchableOpacity
    style={[styles.card, item.unread && styles.cardUnread]}
    onPress={() => onPress(item)}
    activeOpacity={0.78}
  >
    <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
      <NotifIcon iconLib={item.iconLib} icon={item.icon} color={item.iconColor} size={24} />
    </View>

    <View style={styles.cardBody}>
      <View style={styles.topRow}>
        <Text style={[styles.title, item.unread && styles.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        {item.unread && <View style={styles.dot} />}
      </View>
      <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
      {item.time ? <Text style={styles.time}>{item.time}</Text> : null}
    </View>

    <TouchableOpacity onPress={() => onDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <MaterialIcons name="close" size={17} color="#BBBBBB" />
    </TouchableOpacity>
  </TouchableOpacity>
);

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const unread = notifs.filter((n) => n.unread).length;

  useEffect(() => {
    let active = true;
    loadDynamicNotifications()
      .then((items) => {
        if (active) setNotifs(items.map(decorateNotification));
      })
      .catch(() => {
        if (active) setNotifs([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const markAllRead = () => setNotifs((p) => p.map((n) => ({ ...n, unread: false })));
  const deleteOne = (id) => setNotifs((p) => p.filter((n) => n.id !== id));
  const handlePress = (item) => {
    setNotifs((p) => p.map((n) => (n.id === item.id ? { ...n, unread: false } : n)));
    Alert.alert(item.title, item.body || 'No additional details available.');
  };
  const clearAll = () => Alert.alert('Clear All', 'Remove all notifications from this device?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear All', style: 'destructive', onPress: () => setNotifs([]) },
  ]);

  const groups = notifs.reduce((acc, n) => {
    const key = n.date || 'Latest';
    (acc[key] = acc[key] || []).push(n);
    return acc;
  }, {});

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 && (
          <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>
        )}
        <View style={{ flex: 1 }} />
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.iconBtn}>
            <MaterialIcons name="done-all" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {notifs.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.iconBtn}>
            <MaterialIcons name="delete-sweep" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.emptySub}>Loading notifications...</Text>
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="notifications-off-outline" size={72} color="#DDD" />
          <Text style={styles.emptyTitle}>All caught up</Text>
          <Text style={styles.emptySub}>No notifications are available right now.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {unread > 0 && (
            <TouchableOpacity style={styles.markBanner} onPress={markAllRead}>
              <MaterialIcons name="notifications-active" size={16} color={Colors.primary} />
              <Text style={styles.markBannerText}>{unread} unread - Tap to mark all read</Text>
            </TouchableOpacity>
          )}

          {Object.entries(groups).map(([date, items]) => (
            <View key={date}>
              <View style={styles.dateSep}>
                <View style={styles.sepLine} />
                <Text style={styles.sepText}>{date}</Text>
                <View style={styles.sepLine} />
              </View>
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  item={n}
                  onPress={handlePress}
                  onDelete={deleteOne}
                />
              ))}
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F3F7' },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10,
    elevation: 4,
  },
  iconBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 4 },
  badge: {
    backgroundColor: '#FFD700', borderRadius: 10,
    minWidth: 20, height: 20, justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: 5,
    marginLeft: 6, borderWidth: 1.5, borderColor: Colors.primary,
  },
  badgeText: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  list: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20 },
  markBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#FFD5D5',
  },
  markBannerText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  dateSep: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 8, marginTop: 4,
  },
  sepLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  sepText: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 0.4, textTransform: 'uppercase' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 13, marginBottom: 8, gap: 11,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  cardUnread: {
    borderLeftWidth: 3, borderLeftColor: Colors.primary,
    backgroundColor: '#FFFCFC',
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  cardBody: { flex: 1, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  title: { flex: 1, fontSize: 13, fontWeight: '500', color: '#1A1A1A' },
  titleUnread: { fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, flexShrink: 0 },
  body: { fontSize: 12, color: '#777', lineHeight: 17 },
  time: { fontSize: 11, color: '#AAA', marginTop: 2 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 28 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#444' },
  emptySub: { fontSize: 14, color: '#AAA', textAlign: 'center' },
});

export default NotificationsScreen;
