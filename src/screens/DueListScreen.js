import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, FlatList, Share, Alert, ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadDueClients } from '../services/appData';

const parseDateValue = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.replace(/\//g, '-');
  const direct = new Date(normalized);
  if (!Number.isNaN(direct.getTime())) return direct;
  const parts = normalized.split('-').map((part) => part.trim());
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const DueListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [clients, setClients] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAndSearch = async () => {
    setLoading(true);
    try {
      let filtered = await loadDueClients();
      const from = parseDateValue(fromDate);
      const to = parseDateValue(toDate);
      if (from || to) {
        filtered = filtered.filter((c) => {
          const due = parseDateValue(c.dueDate);
          if (!due) return false;
          if (from && due < from) return false;
          if (to && due > to) return false;
          return true;
        });
      }
      if (searchText) {
        filtered = filtered.filter(c =>
          c.name?.toLowerCase().includes(searchText.toLowerCase()) ||
          c.mobile?.includes(searchText)
        );
      }
      setClients(filtered);
      setSearched(true);
    } catch (_) {
      setClients([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const shareReport = async () => {
    const text = clients.map(c =>
      `Name: ${c.name} | Mobile: ${c.mobile} | Policy: ${c.policyNo || '-'} | Due: ${c.dueDate}`
    ).join('\n');
    await Share.share({ message: `Policy Due Date Report\n\n${text || 'No records found.'}` });
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report</Text>
        <TouchableOpacity style={styles.backBtn} onPress={shareReport}>
          <MaterialIcons name="share" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Green title bar with PDF/XLS icons */}
      <View style={styles.greenBar}>
        <Text style={styles.greenBarText}>Policy Due Date Report</Text>
        <View style={styles.exportIcons}>
          <TouchableOpacity onPress={() => Alert.alert('PDF', 'PDF export coming soon')}>
            <MaterialIcons name="picture-as-pdf" size={28} color="#E74C3C" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('XLS', 'Excel export coming soon')}>
            <MaterialIcons name="table-chart" size={28} color="#27AE60" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date filter row */}
      <View style={styles.filterRow}>
        <TextInput
          style={styles.dateInput}
          placeholder="From Date"
          placeholderTextColor={Colors.textLight}
          value={fromDate}
          onChangeText={setFromDate}
        />
        <TextInput
          style={styles.dateInput}
          placeholder="To Date"
          placeholderTextColor={Colors.textLight}
          value={toDate}
          onChangeText={setToDate}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={loadAndSearch}>
          <Text style={styles.searchBtnTxt}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Name/Mobile search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search By Name Or Mobile No"
          placeholderTextColor={Colors.textLight}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={loadAndSearch}
        />
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.emptyText}>Loading due records...</Text>
        </View>
      ) : !searched ? (
        <View style={styles.empty}>
          <MaterialIcons name="event-note" size={64} color={Colors.border} />
          <Text style={styles.emptyText}>Search to see due list</Text>
          <Text style={styles.emptySub}>Enter date range or name to filter</Text>
        </View>
      ) : clients.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="check-circle-outline" size={64} color="#27AE60" />
          <Text style={styles.emptyText}>No due records found</Text>
          <Text style={styles.emptySub}>No policies match your search criteria</Text>
        </View>
      ) : (
        <FlatList
          data={clients}
          keyExtractor={(item, i) => `${item.mobile}-${i}`}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={styles.dueCard}>
              <View style={styles.srNo}>
                <Text style={styles.srText}>{index + 1}</Text>
              </View>
              <View style={styles.dueInfo}>
                <Text style={styles.dueName}>{item.name}</Text>
                <Text style={styles.dueMobile}>{item.mobile}</Text>
                {item.policyNo ? <Text style={styles.duePolicy}>Policy: {item.policyNo}</Text> : null}
              </View>
              <View style={styles.dueDateBox}>
                <Text style={styles.dueDateLabel}>Due</Text>
                <Text style={styles.dueDate}>{item.dueDate}</Text>
              </View>
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
  greenBar: {
    backgroundColor: '#27AE60', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  greenBarText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  exportIcons: { flexDirection: 'row', gap: 10 },
  filterRow: { flexDirection: 'row', padding: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dateInput: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, color: Colors.textDark,
  },
  searchBtn: { backgroundColor: '#27AE60', borderRadius: 6, paddingHorizontal: 14, justifyContent: 'center' },
  searchBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchRow: { paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: Colors.textDark,
  },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontWeight: '700', color: Colors.textGray },
  emptySub: { fontSize: 12, color: Colors.textLight, textAlign: 'center' },
  list: { padding: 10, gap: 8 },
  dueCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, gap: 10,
  },
  srNo: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  srText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dueInfo: { flex: 1 },
  dueName: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  dueMobile: { fontSize: 12, color: Colors.textGray, marginTop: 1 },
  duePolicy: { fontSize: 11, color: Colors.textLight, marginTop: 1 },
  dueDateBox: { alignItems: 'center' },
  dueDateLabel: { fontSize: 10, color: Colors.textGray },
  dueDate: { fontSize: 12, fontWeight: '700', color: '#E67E22' },
});

export default DueListScreen;
