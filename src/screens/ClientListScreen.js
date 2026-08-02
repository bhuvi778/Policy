import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, FlatList, Share, ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadClients as fetchClients } from '../services/appData';

const ClientListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const items = await fetchClients();
      setClients(items);
    } catch (_) {
      setClients([]);
    } finally {
      setLoaded(true);
    }
  };

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search)
  );

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => Share.share({ message: 'Client List from POLICYBHANDAR' })}>
          <MaterialIcons name="share" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Green title bar */}
      <View style={styles.greenBar}>
        <Text style={styles.greenBarText}>Digital Calendar View</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {!loaded ? (
        <View style={styles.empty}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.emptyText}>Loading clients...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="people-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyText}>No clients found</Text>
          <Text style={styles.emptySub}>Add clients via Client Entry</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('DataEntry')}>
            <MaterialIcons name="person-add" size={18} color="#fff" />
            <Text style={styles.addBtnTxt}>Add Client</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.mobile}-${i}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.clientCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() || 'C'}</Text>
              </View>
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{item.name}</Text>
                <Text style={styles.clientMobile}>{item.mobile}</Text>
                {item.dob ? <Text style={styles.clientDob}>DOB: {item.dob}</Text> : null}
              </View>
              <MaterialIcons name="chevron-right" size={22} color={Colors.textLight} />
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  greenBar: { backgroundColor: '#27AE60', paddingVertical: 12, alignItems: 'center' },
  greenBarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  searchRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: Colors.textDark,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textGray },
  emptySub: { fontSize: 13, color: Colors.textLight, textAlign: 'center' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 20, marginTop: 8,
  },
  addBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 12, gap: 8 },
  clientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  clientMobile: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  clientDob: { fontSize: 11, color: Colors.textLight, marginTop: 1 },
});

export default ClientListScreen;
