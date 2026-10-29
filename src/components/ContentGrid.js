import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Alert, FlatList,
} from 'react-native';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import RecipientSheet from './RecipientSheet';
import { downloadTemplateToDevice } from '../services/downloads';
import ProfileFooterPreview from './ProfileFooterPreview';
import { isDocumentItem, isMediaItem } from '../utils/material';
import MediaCardPreview from './MediaCardPreview';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.38;

const ContentCard = React.memo(({ item, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => onPress(item)}>
      <View style={[styles.cardImageArea, { backgroundColor: item.color || Colors.primary }]}>
        <MediaCardPreview
          item={item}
          imageStyle={styles.cardImage}
          placeholderStyle={styles.cardPlaceholder}
          initialsStyle={styles.cardInitials}
          subtitleStyle={styles.cardSubInner}
        />
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.footerTitleWrap}>
          <ProfileFooterPreview compact />
        </View>
        <Ionicons name="share-social-outline" size={12} color={Colors.textLight} />
      </View>
    </TouchableOpacity>
  );
});

const ContentGrid = React.memo(({ title, data, onViewAll, onItemPress }) => {
  const [modalItem, setModalItem] = useState(null);
  const sectionTitleText = title || 'Templates';

  const handleCardPress = useCallback((item) => {
    if ((isMediaItem(item, sectionTitleText) || isDocumentItem(item, sectionTitleText)) && onItemPress) {
      onItemPress(item);
      return;
    }
    setModalItem(item);
  }, [onItemPress, sectionTitleText]);
  const handleTemplateDownload = useCallback(async (details) => {
    try {
      const result = await downloadTemplateToDevice(modalItem, details);
      Alert.alert('Download started', `${result?.filename || modalItem?.title || 'File'} is saving to Downloads.`);
    } catch (error) {
      Alert.alert('Download failed', error?.message || 'Unable to download this template.');
      throw error;
    }
  }, [modalItem]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.redBar} />
          <Text style={styles.sectionTitle}>{sectionTitleText}</Text>
        </View>
        <TouchableOpacity onPress={onViewAll} style={styles.viewAllBtn}>
          <Text style={styles.viewAll}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        renderItem={({ item }) => <ContentCard item={item} onPress={handleCardPress} />}
        keyExtractor={(item, index) => String(item.id || item._id || index)}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
        getItemLayout={(_, index) => ({ length: CARD_WIDTH + 10, offset: (CARD_WIDTH + 10) * index, index })}
        ListEmptyComponent={<View style={styles.emptyRow}><MaterialIcons name="folder-open" size={20} color={Colors.textLight} /><Text style={styles.emptyText}>No content added in this folder yet.</Text></View>}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.horizontalList}
      />

      <RecipientSheet
        visible={!!modalItem}
        item={modalItem}
        onClose={() => setModalItem(null)}
        onDownload={handleTemplateDownload}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.white, marginBottom: 8 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redBar: { width: 4, height: 18, backgroundColor: Colors.primary, borderRadius: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.textDark },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAll: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  horizontalList: { maxWidth: '100%', width: '100%' },
  emptyRow: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 14,
    width: width - 28,
  },
  emptyText: { color: Colors.textGray, fontSize: 12, fontWeight: '600' },
  card: {
    width: CARD_WIDTH, borderRadius: 10, overflow: 'hidden',
    backgroundColor: Colors.white, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  cardImageArea: {
    width: '100%', height: CARD_WIDTH * 1.2,
    justifyContent: 'center', alignItems: 'center',
  },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 6 },
  cardInitials: { color: 'rgba(255,255,255,0.95)', fontSize: 22, fontWeight: '800', marginBottom: 3 },
  cardSubInner: { color: 'rgba(255,255,255,0.82)', fontSize: 8, textAlign: 'center', lineHeight: 11 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 0, paddingVertical: 0,
    backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  footerTitleWrap: { flex: 1, paddingRight: 4 },
});

export default ContentGrid;
