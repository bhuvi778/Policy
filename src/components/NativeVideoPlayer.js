import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, requireNativeComponent, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import FastImage from './FastImage';

const NativeVideoView =
  Platform.OS === 'android' || Platform.OS === 'ios'
    ? requireNativeComponent('PolicyBhandarVideoView')
    : null;

const NativeVideoPlayer = ({ source, style, thumbnailMode = false, poster = null, posterResizeMode = 'contain' }) => {
  const [loading, setLoading] = useState(!!source && !thumbnailMode);
  const [error, setError] = useState(false);
  const posterSource = typeof poster === 'string' ? { uri: poster } : poster;

  useEffect(() => {
    setError(false);
    setLoading(!!source && !thumbnailMode);
  }, [source, thumbnailMode]);

  if (!source) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Video URL is not available.</Text>
      </View>
    );
  }

  if (!NativeVideoView) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Video playback is not available in this build.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      {posterSource && loading ? (
        <FastImage
          source={posterSource}
          style={StyleSheet.absoluteFill}
          resizeMode={posterResizeMode}
          priority="high"
        />
      ) : null}
      <NativeVideoView
        thumbnailMode={thumbnailMode}
        source={source}
        style={StyleSheet.absoluteFill}
        onVideoLoadStart={() => {
          if (!thumbnailMode) setLoading(true);
        }}
        onVideoReady={() => setLoading(false)}
        onVideoError={() => {
          setError(true);
          setLoading(false);
        }}
      />
      {loading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={Colors.white} size="large" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <Text style={styles.fallbackText}>Unable to play this video.</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    backgroundColor: '#111',
    justifyContent: 'center',
  },
  fallbackText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
});

export default NativeVideoPlayer;
