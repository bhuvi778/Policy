import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { isMediaItem } from '../utils/material';
import MediaCardPreview from './MediaCardPreview';

const AVATAR_SIZE = 70;

// Static styles moved out of render to avoid new objects every render
const CircleAvatar = React.memo(({ item, sectionTitle }) => {
  return (
    <View style={[styles.avatar, { backgroundColor: item.color || Colors.primary }]}>
      <MediaCardPreview
        item={item}
        sectionTitle={sectionTitle}
        imageStyle={styles.avatarImage}
        initialsStyle={styles.avatarText}
      />
    </View>
  );
});

const SectionRowItem = React.memo(({ item, onPress, sectionTitle }) => (
  <TouchableOpacity style={styles.item} activeOpacity={0.8} onPress={() => onPress?.(item)}>
    <CircleAvatar item={item} sectionTitle={sectionTitle} />
    {isMediaItem(item, sectionTitle) ? (
      <View style={styles.playBadge}>
        <Ionicons name="play" size={12} color={Colors.white} />
      </View>
    ) : null}
    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
  </TouchableOpacity>
));

const SectionRow = React.memo(({ title, data, onViewAll, onItemPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.redBar} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <TouchableOpacity onPress={onViewAll} style={styles.viewAllBtn}>
          <Text style={styles.viewAll}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      <GestureScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        style={styles.horizontalList}
      >
        {data.map((item, index) => (
          <SectionRowItem key={item.id || item._id || `${item.title || 'item'}-${index}`} item={item} onPress={onItemPress} sectionTitle={title} />
        ))}
      </GestureScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redBar: {
    width: 4,
    height: 18,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textDark,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAll: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 10,
    paddingBottom: 14,
    gap: 14,
  },
  horizontalList: {
    maxWidth: '100%',
    width: '100%',
  },
  item: {
    alignItems: 'center',
    width: AVATAR_SIZE + 10,
    gap: 6,
    position: 'relative',
  },
  // Static avatar styles — backgroundColor applied dynamically only
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: AVATAR_SIZE * 0.28,
  },
  playBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderColor: Colors.white,
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    top: 46,
    width: 24,
  },
  itemTitle: {
    fontSize: 11,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
  },
});

export default SectionRow;
