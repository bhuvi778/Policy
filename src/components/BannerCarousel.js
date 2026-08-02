import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { Colors } from '../theme/colors';
import FastImage from './FastImage';

const { width } = Dimensions.get('window');
const FALLBACK_ASPECT = 16 / 9;
const MIN_BANNER_HEIGHT = Math.round(width * 0.54);
const MAX_BANNER_HEIGHT = Math.round(width * 1.25);
const AUTO_SCROLL_INTERVAL = 3500;

const resolveAspect = (image) => {
  if (!image) return FALLBACK_ASPECT;
  if (typeof image !== 'string') {
    const source = Image.resolveAssetSource(image);
    if (source?.width && source?.height) return source.width / source.height;
  }
  return null;
};

const heightForAspect = (aspect = FALLBACK_ASPECT) => {
  const nextHeight = Math.round(width / Math.max(aspect, 0.4));
  return Math.max(MIN_BANNER_HEIGHT, Math.min(MAX_BANNER_HEIGHT, nextHeight));
};

const BannerItem = React.memo(({ item, height }) => {
  if (item.image) {
    const imageSource = typeof item.image === 'string' ? { uri: item.image } : item.image;
    return (
      <View style={[styles.bannerItem, { height }]}>
        <FastImage source={imageSource} style={styles.bannerImage} resizeMode="contain" priority="high" />
        {/* Subtle title overlay for image banners */}
        {item.title ? (
          <View style={styles.imageOverlay}>
            <Text style={styles.overlayTitle} numberOfLines={1}>{item.title}</Text>
          </View>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[styles.bannerItem, { height, backgroundColor: item.color || Colors.primary }]}>
      <View style={styles.fallbackBanner}>
        <Text style={styles.bannerTitle}>{item.title}</Text>
        {item.subtitle ? (
          <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
});

const BannerCarousel = ({ banners }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [aspects, setAspects] = useState({});
  const flatListRef = useRef(null);
  const timerRef = useRef(null);
  const count = banners?.length ?? 0;
  const currentAspect = aspects[banners?.[currentIndex]?.id] || FALLBACK_ASPECT;
  const currentHeight = heightForAspect(currentAspect);

  useEffect(() => {
    (banners || []).forEach((item) => {
      if (!item?.image || aspects[item.id]) return;
      const localAspect = resolveAspect(item.image);
      if (localAspect) {
        setAspects((prev) => ({ ...prev, [item.id]: localAspect }));
        return;
      }
      if (typeof item.image === 'string') {
        Image.getSize(
          item.image,
          (imageWidth, imageHeight) => {
            if (imageWidth && imageHeight) {
              setAspects((prev) => ({ ...prev, [item.id]: imageWidth / imageHeight }));
            }
          },
          () => setAspects((prev) => ({ ...prev, [item.id]: FALLBACK_ASPECT })),
        );
      }
    });
  }, [aspects, banners]);

  const startTimer = useCallback(() => {
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % count;
        try {
          flatListRef.current?.scrollToIndex({ index: next, animated: true });
        } catch (_) {}
        return next;
      });
    }, AUTO_SCROLL_INTERVAL);
  }, [count]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  const onScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
    // Reset auto-scroll timer on manual swipe
    clearInterval(timerRef.current);
    startTimer();
  }, [startTimer]);

  const renderBanner = useCallback(({ item }) => <BannerItem item={item} height={currentHeight} />, [currentHeight]);
  const getItemLayout = useCallback((_, index) => ({ length: width, offset: width * index, index }), []);
  const keyExtractor = useCallback((item) => item.id, []);

  if (!count) return null;

  return (
    <View style={[styles.container, { height: currentHeight }]}>
      <FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBanner}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={getItemLayout}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        decelerationRate="fast"
        scrollEventThrottle={16}
      />

      {/* Dot indicators */}
      {count > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 2,
  },
  bannerItem: {
    width,
    backgroundColor: Colors.white,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  overlayTitle: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  fallbackBanner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bannerTitle: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.3,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.white,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
});

export default BannerCarousel;
