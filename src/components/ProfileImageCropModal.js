import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, NativeModules, PanResponder, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export default function ProfileImageCropModal({ image, onCancel, onConfirm }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const frame = Math.min(width - 48, 360);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const position = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = frame / Math.min(image?.width || 1, image?.height || 1) * zoom;
  const imageWidth = (image?.width || 1) * scale;
  const imageHeight = (image?.height || 1) * scale;
  const maxX = (imageWidth - frame) / 2;
  const maxY = (imageHeight - frame) / 2;

  useEffect(() => {
    setZoom(1); setFit(false); setError('');
    position.current = { x: 0, y: 0 }; pan.setValue(position.current);
  }, [image, pan]);
  useEffect(() => {
    position.current = { x: clamp(position.current.x, maxX), y: clamp(position.current.y, maxY) };
    pan.setValue(position.current);
  }, [maxX, maxY, pan]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !fit && !busy,
    onMoveShouldSetPanResponder: () => !fit && !busy,
    onPanResponderGrant: () => { start.current = { ...position.current }; },
    onPanResponderMove: (_, gesture) => {
      position.current = { x: clamp(start.current.x + gesture.dx, maxX), y: clamp(start.current.y + gesture.dy, maxY) };
      pan.setValue(position.current);
    },
  }), [busy, fit, maxX, maxY, pan]);

  const save = async () => {
    if (busy || !image) return;
    setBusy(true); setError('');
    try {
      const cropped = await NativeModules.PolicyBhandarProfileImagePicker.cropImage(
        image.uri,
        (maxX - position.current.x) / imageWidth,
        (maxY - position.current.y) / imageHeight,
        frame / imageWidth, frame / imageHeight, fit,
      );
      onConfirm(cropped);
    } catch (failure) { setError(failure?.message || 'Unable to crop the image. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={!!image} animationType="slide" onRequestClose={busy ? undefined : onCancel}>
      <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} disabled={busy} accessibilityLabel="Cancel crop"><MaterialIcons name="close" size={26} color={Colors.textDark} /></TouchableOpacity>
          <Text style={styles.title}>Crop Photo / Logo</Text>
          <View style={{ width: 26 }} />
        </View>
        <Text style={styles.help}>{fit ? 'Keep your entire logo visible, with transparent padding.' : 'Drag the image to position it. Use + or − to zoom.'}</Text>
        <View style={[styles.frame, { width: frame, height: frame }]} {...responder.panHandlers}>
          {image ? <Animated.Image source={{ uri: image.uri }} resizeMode={fit ? 'contain' : 'stretch'} style={fit ? { width: frame, height: frame } : { width: imageWidth, height: imageHeight, position: 'absolute', left: -maxX, top: -maxY, transform: pan.getTranslateTransform() }} /> : null}
          <View pointerEvents="none" style={styles.border} />
        </View>
        <View style={styles.controls}>
          <TouchableOpacity accessibilityLabel="Zoom out" disabled={fit || busy || zoom <= 1} onPress={() => setZoom(Math.max(1, zoom - 0.25))} style={styles.zoom}><MaterialIcons name="remove" size={24} color={Colors.primary} /></TouchableOpacity>
          <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity accessibilityLabel="Zoom in" disabled={fit || busy || zoom >= 3} onPress={() => setZoom(Math.min(3, zoom + 0.25))} style={styles.zoom}><MaterialIcons name="add" size={24} color={Colors.primary} /></TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setFit(!fit)} disabled={busy} style={styles.fit}>
          <MaterialIcons name={fit ? 'check-box' : 'check-box-outline-blank'} size={22} color={Colors.primary} />
          <Text style={styles.fitText}>Fit whole image (best for logos)</Text>
        </TouchableOpacity>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity onPress={save} disabled={busy} style={styles.save}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Use This Image</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingHorizontal: 24 },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 19, fontWeight: '700', color: Colors.textDark },
  help: { color: Colors.textGray, textAlign: 'center', marginVertical: 24, lineHeight: 21 },
  frame: { backgroundColor: '#E5E7EB', overflow: 'hidden', borderRadius: 12 },
  border: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: Colors.primary, borderRadius: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 28, marginTop: 20 },
  zoom: { padding: 12, backgroundColor: '#F3F4F6', borderRadius: 24 },
  zoomText: { fontSize: 16, fontWeight: '600', color: Colors.textDark },
  fit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingVertical: 12 },
  fitText: { fontSize: 14, color: Colors.textDark },
  error: { color: Colors.primary, marginTop: 8 },
  save: { width: '100%', alignItems: 'center', marginTop: 20, padding: 16, backgroundColor: Colors.primary, borderRadius: 12 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
