import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  ScrollView as RNScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import ContentTypeTiles from '../components/ContentTypeTiles';
import RecipientSheet from '../components/RecipientSheet';
import ProfileFooterPreview from '../components/ProfileFooterPreview';
import MediaCardPreview from '../components/MediaCardPreview';
import { downloadTemplateToDevice } from '../services/downloads';
import { isDocumentItem, isMediaCollection, isMediaItem } from '../utils/material';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 28 - 8) / 2;
const LANGUAGES = ['All', 'Hindi', 'English'];

const normalizeText = (value = '') =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const cleanLabel = (value = '') => String(value || '').trim();

const normalizeKey = (value = '') => normalizeText(value).replace(/\s+/g, '-');

const readObjectId = (value) => {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return cleanLabel(value);
  if (typeof value !== 'object') return '';
  return cleanLabel(value._id || value.id || value.value || value.key || '');
};

const readObjectLabel = (value) => {
  if (!value || typeof value !== 'object') return '';
  return cleanLabel(value.name || value.title || value.label || value.displayName || '');
};

const pickLabel = (...values) => values.map(cleanLabel).find(Boolean) || '';
const GENERIC_CATEGORY_LABELS = new Set([
  'banner',
  'banners',
  'banners-images',
  'content',
  'general',
  'image',
  'images',
  'template',
  'templates',
]);

const getCategoryMeta = (item = {}, pageTitle = '', options = {}) => {
  const raw = item.raw && item.raw !== item ? item.raw : {};
  const subcategoryObject = item.subcategoryId || item.subcategory || raw.subcategoryId || raw.subcategory;
  const categoryObject = item.categoryId || item.category || raw.categoryId || raw.category;
  const pageKey = normalizeText(pageTitle);
  const useRootBucket = options.groupByRoot !== false;
  const labelCandidates = [
    ...(useRootBucket
      ? [
        item.rootSubcategoryName,
        raw.rootSubcategoryName,
        item.serviceCategoryName,
        raw.serviceCategoryName,
      ]
      : [
        item.serviceSubcategoryName,
        raw.serviceSubcategoryName,
        readObjectLabel(subcategoryObject),
        item.subcategoryName,
        raw.subcategoryName,
        item.subcategory,
        raw.subcategory,
        item.bannerGroupTitle,
        raw.bannerGroupTitle,
      ]),
    ...(useRootBucket
      ? [
        item.parentSubcategoryName,
        raw.parentSubcategoryName,
        item.serviceSubcategoryName,
        raw.serviceSubcategoryName,
        readObjectLabel(subcategoryObject),
        item.subcategoryName,
        raw.subcategoryName,
        item.subcategory,
        raw.subcategory,
        item.bannerGroupTitle,
        raw.bannerGroupTitle,
      ]
      : []),
    readObjectLabel(subcategoryObject),
    item.subcategoryName,
    raw.subcategoryName,
    item.subcategory,
    raw.subcategory,
    readObjectLabel(categoryObject),
    item.categoryName,
    raw.categoryName,
    item.category,
    raw.category,
    item.section,
    raw.section,
    item.type,
    raw.type,
  ]
    .map(cleanLabel)
    .filter((label) => label && normalizeText(label) !== pageKey);
  const specificLabels = labelCandidates.filter((label) => !GENERIC_CATEGORY_LABELS.has(normalizeKey(label)));
  const labels = specificLabels.length ? specificLabels : labelCandidates;

  const label = labels[0] || 'Other';
  const id = pickLabel(
    useRootBucket ? item.rootSubcategoryId : '',
    useRootBucket ? raw.rootSubcategoryId : '',
    useRootBucket ? item.parentSubcategoryId : '',
    useRootBucket ? raw.parentSubcategoryId : '',
    !useRootBucket ? item.bannerGroupId : '',
    !useRootBucket ? raw.bannerGroupId : '',
    item.serviceSubcategoryId,
    raw.serviceSubcategoryId,
    readObjectId(subcategoryObject),
    item.subcategoryId,
    raw.subcategoryId,
    readObjectId(categoryObject),
    item.categoryId,
    raw.categoryId,
    normalizeKey(label),
  );

  return { id: id || normalizeKey(label) || 'other', label };
};

const getLanguageValue = (item = {}) =>
  normalizeText(item.language || item.raw?.language || '');

const ViewAllScreen = ({ route, navigation }) => {
  const {
    title,
    data = [],
    contentTypeTiles = [],
    activeContentTypeId = '',
  } = route.params || {};
  const insets = useSafeAreaInsets();
  const typeTiles = useMemo(
    () => (Array.isArray(contentTypeTiles) ? contentTypeTiles.filter((tile) => tile?.id) : []),
    [contentTypeTiles],
  );
  const initialTypeId = activeContentTypeId || typeTiles.find((tile) => tile?.title === title)?.id || '';
  const [selectedContentTypeId, setSelectedContentTypeId] = useState(initialTypeId);
  const selectedTypeTile = useMemo(
    () => typeTiles.find((tile) => tile.id === selectedContentTypeId),
    [selectedContentTypeId, typeTiles],
  );
  const pageTitle = selectedTypeTile?.title || title;
  const pageData = selectedTypeTile?.data || data;
  const [activeLanguage, setActiveLanguage] = useState('All');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [categoryStripActive, setCategoryStripActive] = useState(false);
  const categoryListRef = useRef(null);
  const categoryOffsetRef = useRef(0);
  const mediaMode = isMediaCollection(pageTitle, []);
  const visibleTypeTiles = useMemo(
    () => typeTiles.map((tile) => ({ ...tile, active: tile.id === selectedContentTypeId })),
    [selectedContentTypeId, typeTiles],
  );

  useEffect(() => {
    setActiveCategory('all');
    setSearchText('');
    setActiveLanguage('All');
    categoryOffsetRef.current = 0;
    categoryListRef.current?.scrollTo?.({ x: 0, animated: false });
  }, [pageData, pageTitle]);

  const baseFilteredData = useMemo(() => {
    const query = normalizeText(searchText);
    const language = normalizeText(activeLanguage);

    return (Array.isArray(pageData) ? pageData : []).filter((item) => {
      const itemLanguage = getLanguageValue(item);
      const languageMatches = language === 'all' || !itemLanguage || itemLanguage.includes(language);
      const text = normalizeText([
        item.title,
        item.subtitle,
        item.quote,
        item.bannerGroupTitle,
        item.section,
        item.categoryName,
        item.subcategoryName,
        item.type,
        item.raw?.bannerGroupTitle,
        item.raw?.section,
        item.raw?.title,
        item.raw?.description,
      ].filter(Boolean).join(' '));
      return languageMatches && (!query || text.includes(query));
    });
  }, [activeLanguage, pageData, searchText]);

  const groupCategoriesByRoot = useMemo(() => {
    const roots = new Set(
      (Array.isArray(pageData) ? pageData : [])
        .map((item) => cleanLabel(item.rootSubcategoryId || item.raw?.rootSubcategoryId))
        .filter(Boolean),
    );
    return roots.size > 1;
  }, [pageData]);

  const categoryOptions = useMemo(() => {
    const optionsById = new Map();
    baseFilteredData.forEach((item) => {
      const meta = getCategoryMeta(item, pageTitle, { groupByRoot: groupCategoriesByRoot });
      const current = optionsById.get(meta.id);
      if (current) {
        current.count += 1;
      } else {
        optionsById.set(meta.id, { id: meta.id, label: meta.label, count: 1 });
      }
    });
    return [
      { id: 'all', label: 'All', count: baseFilteredData.length },
      ...Array.from(optionsById.values()),
    ];
  }, [baseFilteredData, groupCategoriesByRoot, pageTitle]);

  const filteredData = useMemo(() => {
    if (activeCategory === 'all') return baseFilteredData;
    return baseFilteredData.filter((item) => getCategoryMeta(item, pageTitle, { groupByRoot: groupCategoriesByRoot }).id === activeCategory);
  }, [activeCategory, baseFilteredData, groupCategoriesByRoot, pageTitle]);

  const handleCardPress = (item) => {
    if (isMediaItem(item, pageTitle) || isDocumentItem(item, pageTitle)) {
      navigation.navigate('MediaViewer', { item, title: pageTitle });
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
          sectionTitle={pageTitle}
          imageStyle={styles.itemImage}
          initialsStyle={styles.cardInitials}
          subtitleStyle={styles.cardSub}
        />
        {isMediaItem(item, pageTitle) ? (
          <View style={styles.playBadge}>
            <Ionicons name="play" size={18} color={Colors.white} />
          </View>
        ) : null}
      </View>
      <View style={styles.cardFooter}>
        <ProfileFooterPreview compact />
        <TouchableOpacity onPress={() => handleCardPress(item)}>
          <Ionicons name="share-social-outline" size={14} color={Colors.textLight} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryTile = ({ item: option }) => {
    const active = activeCategory === option.id;
    return (
      <TouchableOpacity
        style={[styles.categoryTile, active && styles.categoryTileActive]}
        onPress={() => setActiveCategory(option.id)}
        activeOpacity={0.82}
      >
        <View style={[styles.categoryIcon, active && styles.categoryIconActive]}>
          <MaterialIcons
            name={option.id === 'all' ? 'dashboard' : 'filter-list'}
            size={17}
            color={active ? Colors.primary : Colors.white}
          />
        </View>
        <View style={styles.categoryCopy}>
          <Text style={[styles.categoryTileText, active && styles.categoryTileTextActive]} numberOfLines={1}>
            {option.id === 'all' ? `All ${pageTitle}` : option.label}
          </Text>
          <Text style={[styles.categoryTileCount, active && styles.categoryTileCountActive]} numberOfLines={1}>
            {option.count} items
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const scrollCategoryStrip = (direction = 1) => {
    const nextX = Math.max(0, categoryOffsetRef.current + direction * Math.min(width * 0.72, 280));
    categoryListRef.current?.scrollTo?.({ x: nextX, animated: true });
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
        <View style={styles.backBtn}>
          <Ionicons name="search" size={22} color={Colors.white} />
        </View>
      </View>

      <View style={styles.langTabBar}>
        <RNScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langScroll}>
          {LANGUAGES.map((language) => (
            <TouchableOpacity
              key={language}
              style={[styles.langTab, activeLanguage === language && styles.langTabActive]}
              onPress={() => setActiveLanguage(language)}
              activeOpacity={0.82}
            >
              <Text style={[styles.langTabText, activeLanguage === language && styles.langTabTextActive]}>
                {language}
              </Text>
            </TouchableOpacity>
          ))}
        </RNScrollView>
      </View>

      {visibleTypeTiles.length > 1 ? (
        <ContentTypeTiles
          tiles={visibleTypeTiles}
          onPress={(tile) => {
            if (!tile?.data?.length) {
              Alert.alert(tile?.title || 'Content', 'No content is available for this type right now.');
              return;
            }
            setSelectedContentTypeId(tile.id);
          }}
        />
      ) : null}

      <View style={styles.filterPanel}>
        <View style={styles.filterTitleRow}>
          <Text style={styles.filterTitle}>Filter {pageTitle}</Text>
          <Text style={styles.filterMeta}>{filteredData.length}/{baseFilteredData.length}</Text>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.textGray} />
          <TextInput
            style={styles.searchInput}
            placeholder={mediaMode ? 'Search reels' : 'Search content'}
            placeholderTextColor={Colors.textLight}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')} activeOpacity={0.75}>
              <MaterialIcons name="close" size={18} color={Colors.textGray} />
            </TouchableOpacity>
          ) : null}
        </View>
          <View style={styles.categoryRowWrap}>
            <TouchableOpacity
              style={styles.categoryArrow}
              onPress={() => scrollCategoryStrip(-1)}
              activeOpacity={0.76}
            >
              <MaterialIcons name="chevron-left" size={20} color={Colors.primary} />
            </TouchableOpacity>
            <GestureScrollView
              ref={categoryListRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              directionalLockEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.categoryScroll}
              style={styles.categoryList}
              onScroll={(event) => {
                categoryOffsetRef.current = event.nativeEvent.contentOffset.x;
              }}
              scrollEventThrottle={16}
              onTouchStart={() => setCategoryStripActive(true)}
              onTouchEnd={() => setCategoryStripActive(false)}
              onTouchCancel={() => setCategoryStripActive(false)}
              onScrollEndDrag={() => setCategoryStripActive(false)}
              onMomentumScrollEnd={() => setCategoryStripActive(false)}
            >
              {categoryOptions.map((option) => (
                <View key={String(option.id)}>
                  {renderCategoryTile({ item: option })}
                </View>
              ))}
            </GestureScrollView>
            <TouchableOpacity
              style={styles.categoryArrow}
              onPress={() => scrollCategoryStrip(1)}
              activeOpacity={0.76}
            >
              <MaterialIcons name="chevron-right" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item, index) => `${item.id || item._id || item.title || 'item'}-${index}`}
        renderItem={renderCard}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!categoryStripActive}
        columnWrapperStyle={styles.row}
        removeClippedSubviews={false}
        maxToRenderPerBatch={6}
        initialNumToRender={6}
        windowSize={7}
        ListEmptyComponent={(
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No content found for selected filters.</Text>
          </View>
        )}
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
    alignItems: 'center',
    backgroundColor: Colors.primary,
    elevation: 4,
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  backBtn: { padding: 6 },
  headerTitle: {
    color: Colors.white,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 8,
  },
  langTabBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  langScroll: { paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  langTab: {
    backgroundColor: '#fff',
    borderColor: Colors.border,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  langTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langTabText: { fontSize: 13, color: Colors.textDark, fontWeight: '500' },
  langTabTextActive: { color: '#fff', fontWeight: '700' },
  filterPanel: {
    backgroundColor: '#fff',
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    paddingBottom: 10,
    paddingHorizontal: 10,
    paddingTop: 9,
  },
  filterTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  filterTitle: {
    color: Colors.textDark,
    fontSize: 13,
    fontWeight: '900',
  },
  filterMeta: {
    color: Colors.textGray,
    fontSize: 11,
    fontWeight: '800',
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: Colors.sectionBg,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: Colors.textDark,
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  categoryScroll: {
    gap: 10,
    paddingHorizontal: 2,
    paddingTop: 10,
  },
  categoryList: {
    flex: 1,
    maxWidth: '100%',
    minWidth: 0,
  },
  categoryRowWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    maxWidth: '100%',
    width: '100%',
  },
  categoryArrow: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    marginTop: 10,
    width: 28,
  },
  categoryTile: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 54,
    paddingHorizontal: 10,
    width: 174,
  },
  categoryTileActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
  },
  categoryIcon: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  categoryIconActive: {
    backgroundColor: Colors.white,
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryTileText: {
    color: Colors.textDark,
    fontSize: 12.5,
    fontWeight: '900',
  },
  categoryTileTextActive: {
    color: '#fff',
  },
  categoryTileCount: {
    color: Colors.textGray,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  categoryTileCountActive: {
    color: 'rgba(255,255,255,0.86)',
  },
  listContent: { padding: 10, paddingBottom: 30 },
  row: { gap: 8, marginBottom: 8 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    width: CARD_WIDTH,
  },
  cardImage: {
    alignItems: 'center',
    height: CARD_WIDTH * 1.2,
    justifyContent: 'center',
    padding: 8,
    width: '100%',
  },
  itemImage: { width: '100%', height: '100%' },
  playBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderColor: Colors.white,
    borderRadius: 17,
    borderWidth: 2,
    bottom: 8,
    height: 34,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 34,
  },
  cardInitials: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
  },
  cardFooter: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 0,
    paddingRight: 8,
    paddingVertical: 0,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 44,
  },
  emptyText: {
    color: Colors.textGray,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default ViewAllScreen;
