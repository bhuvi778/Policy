import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, StatusBar, Platform, ActivityIndicator, Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { getMaterials } from '../services/api';
import { normalizeMaterialsForUser } from '../services/contentMapper';
import { isDocumentItem, isMediaItem } from '../utils/material';
import RecipientSheet from '../components/RecipientSheet';
import { downloadTemplateToDevice } from '../services/downloads';
import { useAuth } from '../context/AuthContext';

const POPULAR_SEARCHES = [
  'Life Insurance', 'Birthday Card', 'Daily Motivation',
  'Festival', 'Term Plan', 'Data Entry', 'Due List',
];

const APP_RESULTS = [
  { id: 'profile', title: 'My Profile', section: 'Account', route: 'MyProfile', icon: 'person' },
  { id: 'subscription', title: 'Subscription Plans', section: 'Account', route: 'Subscription', icon: 'workspace-premium' },
  { id: 'calendar', title: 'Premium Calendar', section: 'Calendar', route: 'PremiumCalendar', icon: 'event-note' },
  { id: 'data-entry', title: 'Data Entry', section: 'Calendar', route: 'DataEntry', icon: 'edit-note' },
  { id: 'client-list', title: 'Client View', section: 'Reports', route: 'ClientList', icon: 'people-outline' },
  { id: 'due-list', title: 'Due List', section: 'Reports', route: 'DueList', icon: 'event-available' },
  { id: 'nfc-card', title: 'NFC Smart Card', section: 'Cards', route: 'NFCSmartCard', icon: 'nfc' },
  { id: 'google-nfc', title: 'Google NFC Review', section: 'Cards', route: 'GoogleNFCReview', icon: 'reviews' },
  { id: 'prospects', title: 'Prospect Management', section: 'Business', route: 'ProspectManagement', icon: 'business-center' },
  { id: 'utility', title: 'Utilities', section: 'Tools', route: 'Utility', icon: 'calculate' },
  { id: 'notifications', title: 'Notifications', section: 'Updates', route: 'Notifications', icon: 'notifications' },
  { id: 'about', title: 'About Us', section: 'Company', route: 'AboutUs', icon: 'info-outline' },
  { id: 'contact', title: 'Contact Us', section: 'Company', route: 'ContactUs', icon: 'support-agent' },
  { id: 'terms', title: 'Term of Use', section: 'Company', route: 'Terms', icon: 'description' },
  { id: 'privacy', title: 'Privacy Policy', section: 'Company', route: 'Privacy', icon: 'privacy-tip' },
];

const matches = (item, query) => {
  const q = query.toLowerCase();
  return [item.title, item.section, item.subtitle, item.type, ...(item.tags || [])]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
};

const SearchScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user = {} } = useAuth() || {};
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      const appMatches = APP_RESULTS.filter((item) => matches(item, trimmed))
        .map((item) => ({ ...item, kind: 'app' }));

      try {
        const response = await getMaterials({ tag: trimmed, page: 1, limit: 20 });
        let materials = await normalizeMaterialsForUser(response.data, 'Materials', user);

        if (!materials.length) {
          const fallback = await getMaterials({ page: 1, limit: 60 });
          materials = (await normalizeMaterialsForUser(fallback.data, 'Materials', user))
            .filter((item) => matches(item, trimmed));
        }

        const materialMatches = materials.map((item) => ({ ...item, kind: 'material' }));
        if (active) setResults([...appMatches, ...materialMatches]);
      } catch (err) {
        if (active) {
          setResults(appMatches);
          setError(appMatches.length ? '' : (err.message || 'Search failed. Please try again.'));
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, user]);

  const handleSearch = (text) => {
    setQuery(text);
  };

  const handleResultPress = (item) => {
    if (item.kind === 'app' && item.route) {
      navigation.navigate(item.route);
      return;
    }
    if (isMediaItem(item, item.section) || isDocumentItem(item, item.section)) {
      navigation.navigate('MediaViewer', { item, title: item.section || 'Media' });
      return;
    }
    setSelectedTemplate(item);
  };

  const handleTemplateDownload = async (details) => {
    try {
      const result = await downloadTemplateToDevice(selectedTemplate, details);
      Alert.alert('Download started', `${result?.filename || selectedTemplate?.title || 'File'} is saving to Downloads.`);
    } catch (downloadError) {
      Alert.alert('Download failed', downloadError?.message || 'Unable to download this template.');
      throw downloadError;
    }
  };

  const renderResult = ({ item }) => (
    <TouchableOpacity
      style={styles.resultItem}
      activeOpacity={0.75}
      onPress={() => handleResultPress(item)}
    >
      <View style={[styles.resultIcon, { backgroundColor: item.color || Colors.primary }]}>
        {item.kind === 'app' ? (
          <MaterialIcons name={item.icon || 'apps'} size={22} color="#fff" />
        ) : (
          <Text style={styles.resultInitial}>
            {item.title?.[0]?.toUpperCase() || '?'}
          </Text>
        )}
      </View>
      <View style={styles.resultText}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.resultSection}>{item.section || item.type || 'Content'}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      {loading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : (
        <Ionicons name="search-outline" size={48} color={Colors.border} />
      )}
      <Text style={styles.emptyText}>
        {loading ? 'Searching...' : error || `No results for "${query}"`}
      </Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textGray} style={{ marginLeft: 8 }} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search app, clients tools, templates..."
            placeholderTextColor={Colors.textLight}
            value={query}
            onChangeText={handleSearch}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')} style={{ padding: 6 }}>
              <MaterialIcons name="close" size={18} color={Colors.textGray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {query.length < 2 ? (
        <View style={styles.suggestWrap}>
          <Text style={styles.suggestTitle}>Popular Searches</Text>
          <View style={styles.chipsWrap}>
            {POPULAR_SEARCHES.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.chip}
                onPress={() => handleSearch(s)}
              >
                <Ionicons name="search" size={12} color={Colors.primary} />
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => `${item.kind}-${item.id}-${index}`}
          renderItem={renderResult}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={results.length === 0 ? styles.emptyContainer : styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          removeClippedSubviews={false}
          maxToRenderPerBatch={10}
          initialNumToRender={12}
          windowSize={5}
        />
      )}

      <RecipientSheet
        visible={!!selectedTemplate}
        item={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onDownload={handleTemplateDownload}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8F8' },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10,
    gap: 8,
    elevation: 4,
  },
  backBtn: { padding: 4 },
  searchBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 14,
    color: Colors.textDark,
  },
  suggestWrap: { padding: 16 },
  suggestTitle: {
    fontSize: 13, fontWeight: '600', color: Colors.textGray,
    marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 13, color: Colors.textDark },
  listContent: { padding: 0 },
  resultItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    gap: 12,
  },
  resultIcon: {
    width: 42, height: 42, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  resultInitial: { color: '#fff', fontSize: 18, fontWeight: '800' },
  resultText: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: '600', color: Colors.textDark },
  resultSection: { fontSize: 12, color: Colors.textGray, marginTop: 1 },
  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 70 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: Colors.textGray, textAlign: 'center', paddingHorizontal: 24 },
});

export default SearchScreen;
