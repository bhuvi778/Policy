import React, { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { Colors } from '../theme/colors';

const ContentTypeTiles = ({ tiles = [], onPress }) => {
  const visibleTiles = tiles.filter((tile) => tile?.count > 0);
  const scrollRef = useRef(null);
  const offsetRef = useRef(0);

  const scrollBy = (direction = 1) => {
    const nextX = Math.max(0, offsetRef.current + direction * 240);
    scrollRef.current?.scrollTo?.({ x: nextX, animated: true });
  };

  if (!visibleTiles.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.gestureWrap}>
        <TouchableOpacity style={styles.arrowBtn} activeOpacity={0.75} onPress={() => scrollBy(-1)}>
          <MaterialIcons name="chevron-left" size={22} color={Colors.primary} />
        </TouchableOpacity>
        <GestureScrollView
          ref={scrollRef}
          horizontal
          style={styles.scrollView}
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          onScroll={(event) => {
            offsetRef.current = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
        >
          {visibleTiles.map((tile) => (
            <TouchableOpacity
              key={tile.id}
              style={[styles.tile, tile.active && styles.tileActive]}
              activeOpacity={0.82}
              onPress={() => onPress?.(tile)}
            >
              <Text style={[styles.title, tile.active && styles.titleActive]} numberOfLines={1}>
                {tile.title}
              </Text>
            </TouchableOpacity>
          ))}
        </GestureScrollView>
        <TouchableOpacity style={styles.arrowBtn} activeOpacity={0.75} onPress={() => scrollBy(1)}>
          <MaterialIcons name="chevron-right" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#F6F8FA',
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingTop: 12,
  },
  row: {
    gap: 14,
    paddingHorizontal: 2,
  },
  gestureWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    maxWidth: '100%',
    width: '100%',
  },
  arrowBtn: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 30,
  },
  scrollView: {
    flex: 1,
    maxWidth: '100%',
  },
  tile: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: '#E2E6EA',
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 112,
    paddingHorizontal: 24,
  },
  tileActive: {
    backgroundColor: '#FF5B14',
    borderColor: '#FF5B14',
    elevation: 5,
    shadowColor: '#FF5B14',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  title: {
    color: '#263B55',
    fontSize: 16,
    fontWeight: '800',
  },
  titleActive: {
    color: '#fff',
  },
});

export default ContentTypeTiles;
