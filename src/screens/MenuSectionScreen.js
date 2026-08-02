import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RecipientSheet from '../components/RecipientSheet';
import { loadMenuSection } from '../services/contentMapper';
import { downloadTemplateToDevice } from '../services/downloads';
import { isDocumentItem, isMediaCollection, isMediaItem } from '../utils/material';
import { useAuth } from '../context/AuthContext';
import ProfileFooterPreview from '../components/ProfileFooterPreview';
import MediaCardPreview from '../components/MediaCardPreview';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 28 - 8) / 3;

const SECTION_DATA = {
  motivation:  { title: 'Daily Motivation',  data: [] },
  greetings:   { title: 'Greetings',         data: [] },
  concepts:    { title: 'Concepts',          data: [] },
  knowledge:   { title: 'Knowledge Centre',  data: [] },
  news:        { title: 'News & Articles',   data: [] },
  licplans:    { title: 'LIC Plans',         data: [] },
  audiovideo:  { title: 'Audio / Video',     data: [] },
  leaders:     { title: "Leaders' Corner",   data: [] },
  mixplan:     { title: 'Mix Plan',          data: [] },
  mycontent:   { title: 'My Content',        data: [] },
  marketing:   { title: 'Marketing SMS',     data: [] },
  digitalcard: { title: 'Digital Card',      data: [] },
  prospect:    { title: 'Prospect Management', data: [] },
};

const MenuSectionScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { user = {} } = useAuth() || {};
  const {
    sectionId,
    title: routeTitle,
    profileRole = '',
    rolePreviewOnly = false,
    categoryId = '',
    subcategoryId = '',
    serviceCategoryName = '',
    serviceSubcategoryName = '',
  } = route.params || {};
  const roleLabel = profileRole === 'leader' ? 'Leader' : profileRole === 'agent' ? 'Agent' : '';
  const fallbackInfo = useMemo(
    () => SECTION_DATA[sectionId] || { title: routeTitle || sectionId, data: [] },
    [routeTitle, sectionId],
  );
  const [sectionInfo, setSectionInfo] = useState(fallbackInfo);
  const [loading, setLoading] = useState(sectionId !== 'prospect');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (sectionId === 'prospect') {
      navigation.replace('ProspectManagement');
      return undefined;
    }

    let active = true;
    setLoading(true);
    loadMenuSection(sectionId, fallbackInfo.title, {}, {
      user,
      profileRole,
      categoryId,
      subcategoryId,
      serviceCategoryName,
      serviceSubcategoryName,
      })
      .then((nextInfo) => {
        if (active) {
          setSectionInfo(nextInfo || { ...fallbackInfo, data: [] });
        }
      })
      .catch(() => {
        if (active) setSectionInfo(fallbackInfo);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [categoryId, fallbackInfo, navigation, profileRole, sectionId, serviceCategoryName, serviceSubcategoryName, subcategoryId, user]);

  if (sectionId === 'prospect') return null;

  const { title, data } = sectionInfo;
  const mediaMode = isMediaCollection(title, data);

  const handleCardPress = (item) => {
    if (mediaMode || isDocumentItem(item, title)) {
      navigation.navigate('MediaViewer', { item, title });
      return;
    }
    setSelectedItem(item);
    setSheetVisible(true);
  };

  const handleTemplateDownload = async (details) => {
    try {
      const result = await downloadTemplateToDevice(selectedItem, details);
      Alert.alert('Download started', `${result?.filename || selectedItem?.title || 'File'} is saving to Downloads.`);
    } catch (error) {
      Alert.alert('Download failed', error?.message || 'Unable to download this template.');
      throw error;
    }
  };

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.82}
      onPress={() => handleCardPress(item)}
    >
      <View style={[styles.cardImage, { backgroundColor: item.color || Colors.primary }]}>
        <MediaCardPreview
          item={item}
          sectionTitle={title}
          imageStyle={styles.itemImage}
          initialsStyle={styles.cardInitials}
          subtitleStyle={styles.cardSub}
        />
        {isMediaItem(item, title) ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={16} color={Colors.white} />
          </View>
        ) : null}
      </View>
      <View style={styles.cardFooter}>
        <ProfileFooterPreview compact />
        <TouchableOpacity onPress={() => handleCardPress(item)}>
          <Ionicons name="share-social-outline" size={14} color={Colors.textLight} />
        </TouchableOpacity>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {roleLabel ? (
            <Text style={styles.headerSubTitle}>
              {roleLabel}{rolePreviewOnly ? ' preview' : ''}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity style={styles.backBtn}>
          <Ionicons name="search" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item, i) => `${item.id}-${i}`}
        renderItem={renderCard}
        numColumns={3}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
        removeClippedSubviews={false}
        initialNumToRender={9}
        maxToRenderPerBatch={9}
        windowSize={7}
        ListHeaderComponent={loading ? (
          <View style={styles.loadingBar}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading latest content...</Text>
          </View>
        ) : null}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyListWrap}>
            <Text style={styles.emptyListText}>No templates available in this section yet.</Text>
          </View>
        ) : null}
      />

      <RecipientSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        item={selectedItem}
        onDownload={handleTemplateDownload}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sectionBg },
  header: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitleWrap: { flex: 1, marginLeft: 8 },
  headerTitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  headerSubTitle: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 1, textTransform: 'capitalize' },
  listContent: { padding: 14, paddingBottom: 30 },
  row: { gap: 4, marginBottom: 4 },
  emptyListWrap: {
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  emptyListText: {
    color: Colors.textGray,
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    width: CARD_WIDTH, borderRadius: 8, overflow: 'hidden',
    backgroundColor: Colors.white, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  cardImage: {
    width: '100%', height: CARD_WIDTH * 1.1,
    justifyContent: 'center', alignItems: 'center', padding: 6,
  },
  itemImage: { width: '100%', height: '100%' },
  playBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderColor: Colors.white,
    borderRadius: 15,
    borderWidth: 2,
    bottom: 6,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    width: 30,
  },
  cardInitials: { color: 'rgba(255,255,255,0.95)', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  cardSub: { color: 'rgba(255,255,255,0.85)', fontSize: 8, textAlign: 'center', lineHeight: 11 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 0, paddingRight: 6, paddingVertical: 0,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  cardTitle: {
    fontSize: 10, color: Colors.textDark, fontWeight: '500',
    paddingHorizontal: 6, paddingVertical: 4, lineHeight: 13,
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  loadingText: { fontSize: 12, color: Colors.textGray },
});

export default MenuSectionScreen;
