import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, requireNativeComponent, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';

const AndroidVideoView =
  Platform.OS === 'android' ? requireNativeComponent('PolicyBhandarVideoView') : null;

const NativeVideoPlayer = ({ source, style, thumbnailMode = false }) => {
  const [loading, setLoading] = useState(!!source && !thumbnailMode);
  const [error, setError] = useState(false);

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

  if (Platform.OS !== 'android' || !AndroidVideoView) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Video playback is available on Android.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      <AndroidVideoView
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
