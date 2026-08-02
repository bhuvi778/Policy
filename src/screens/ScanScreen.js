import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Linking,
  NativeModules,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const { PolicyBhandarVisitingCardScanner } = NativeModules;
const CARD_FRAME_WIDTH = width * 0.84;
const CARD_FRAME_HEIGHT = CARD_FRAME_WIDTH * 0.58;
const CARD_FRAME_RATIO = CARD_FRAME_WIDTH / CARD_FRAME_HEIGHT;

let Camera = null;
let useCameraDevice = null;
let useCameraPermission = null;
let visionCameraAvailable = false;

try {
  const mod = require('react-native-vision-camera');
  if (mod.Camera && mod.useCameraDevice && mod.useCameraPermission) {
    Camera = mod.Camera;
    useCameraDevice = mod.useCameraDevice;
    useCameraPermission = mod.useCameraPermission;
    visionCameraAvailable = true;
  }
} catch (_) {
  visionCameraAvailable = false;
}

const makePhotoUri = (photo = {}) => {
  const path = String(photo?.path || '');
  if (!path) return '';
  return path.startsWith('file://') ? path : `file://${path}`;
};

const getCapturedPhotoPath = (photo = {}) => String(photo?.path || '').replace(/^file:\/\//, '');

const extractPhoneFromText = (text = '') => {
  const matches = String(text || '').match(/(?:\+?91[-\s]?)?[6-9][0-9][\s-]?[0-9]{3}[\s-]?[0-9]{5}|[6-9][0-9]{9}/g) || [];
  return matches.map((item) => item.replace(/\D/g, '').slice(-10)).find((item) => item.length === 10) || '';
};

const extractNameFromText = (text = '') => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const badWords = /(phone|mobile|email|www|http|\.com|@|regards|consultant|advisor|agent|manager|director|pvt|ltd|company|insurance|policy|address)/i;
  const candidates = lines.filter((line) => (
    line.length >= 3 &&
    line.length <= 42 &&
    !/\d{4,}/.test(line) &&
    !badWords.test(line)
  ));
  return (candidates[0] || '').replace(/[^a-zA-Z .'-]/g, '').replace(/\s+/g, ' ').trim();
};

const buildCapturedClient = (photo = null, processed = null) => {
  const ocrText = processed?.text || '';
  const image = processed?.uri || makePhotoUri(photo);
  return {
    id: String(Date.now()),
    name: extractNameFromText(ocrText),
    mobile: extractPhoneFromText(ocrText),
    email: String(ocrText).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '',
    company: '',
    designation: '',
    memberType: 'Member',
    image,
    cardImage: image,
    source: processed?.text ? 'Captured visiting card' : 'Captured card',
    rawValue: ocrText,
  };
};

const Header = ({ insets, onBack, torch, onTorch }) => (
  <View style={[styles.header, { paddingTop: (insets?.top || 0) + 6 }]}>
    <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
      <MaterialIcons name="arrow-back" size={24} color="#fff" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Scan Visiting Card</Text>
    {onTorch ? (
      <TouchableOpacity onPress={onTorch} style={styles.iconBtn}>
        <MaterialIcons name={torch ? 'flash-on' : 'flash-off'} size={22} color="#fff" />
      </TouchableOpacity>
    ) : (
      <View style={{ width: 36 }} />
    )}
  </View>
);

const CaptureOverlay = ({ insets, loading, onCapture }) => (
  <View style={styles.overlay} pointerEvents="box-none">
    <View style={styles.centerLayer} pointerEvents="none">
      <View style={styles.cardFrame}>
        <View style={[styles.corner, styles.cTL]} />
        <View style={[styles.corner, styles.cTR]} />
        <View style={[styles.corner, styles.cBL]} />
        <View style={[styles.corner, styles.cBR]} />
        <MaterialCommunityIcons name="card-account-details-outline" size={46} color="rgba(255,255,255,0.22)" />
      </View>
    </View>
    <View style={[styles.bottomControls, { paddingBottom: (insets?.bottom || 0) + 22 }]}>
      <Text style={styles.hint}>Place the visiting card inside the frame</Text>
      <TouchableOpacity
        style={[styles.captureBtn, loading && styles.captureBtnDisabled]}
        onPress={onCapture}
        activeOpacity={0.84}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <MaterialCommunityIcons name="camera" size={32} color="#fff" />
        )}
      </TouchableOpacity>
      <Text style={styles.subHint}>Capture will open Data Entry for saving contact details.</Text>
    </View>
  </View>
);

const CameraCardCapture = ({ navigation, insets }) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const cameraRef = useRef(null);
  const [torch, setTorch] = useState(false);
  const [active, setActive] = useState(true);
  const [capturing, setCapturing] = useState(false);

  const openDataEntry = useCallback((client) => {
    navigation.navigate('DataEntry', {
      prefillClient: client,
      source: 'card_capture',
    });
  }, [navigation]);

  const handleCapture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const photo = cameraRef.current?.takePhoto
        ? await cameraRef.current.takePhoto({ flash: torch ? 'on' : 'off' })
        : null;
      const path = getCapturedPhotoPath(photo);
      const processed = path && PolicyBhandarVisitingCardScanner?.processCardImage
        ? await PolicyBhandarVisitingCardScanner.processCardImage(path, CARD_FRAME_RATIO)
        : null;
      openDataEntry(buildCapturedClient(photo, processed));
    } catch (error) {
      Alert.alert('Capture failed', error?.message || 'Unable to capture visiting card. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, openDataEntry, torch]);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="camera-alt" size={80} color="rgba(255,255,255,0.2)" />
        <Text style={styles.permTitle}>Camera Permission Required</Text>
        <Text style={styles.permSub}>POLICYBHANDAR needs camera access to capture visiting cards.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <MaterialIcons name="camera" size={18} color="#fff" />
          <Text style={styles.permBtnTxt}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.outlineBtn} onPress={() => Linking.openSettings()}>
          <Text style={styles.outlineTxt}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="no-photography" size={80} color="rgba(255,255,255,0.2)" />
        <Text style={styles.permTitle}>Camera Not Found</Text>
      </View>
    );
  }

  return (
    <>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={active}
        photo
        torch={torch ? 'on' : 'off'}
      />
      <CaptureOverlay insets={insets} loading={capturing} onCapture={handleCapture} />
      <Header
        insets={insets}
        onBack={() => navigation.goBack()}
        torch={torch}
        onTorch={() => setTorch((value) => !value)}
      />
    </>
  );
};

const FallbackView = ({ navigation, insets }) => (
  <>
    <CaptureOverlay
      insets={insets}
      loading={false}
      onCapture={() => navigation.navigate('DataEntry', {
        prefillClient: buildCapturedClient(null),
        source: 'card_capture',
      })}
    />
    <View style={styles.fallbackCenter}>
      <MaterialCommunityIcons name="card-account-details-outline" size={66} color="rgba(255,255,255,0.3)" />
      <Text style={styles.permTitle}>Card Capture</Text>
      <Text style={styles.permSub}>Camera module is not active in this build. You can still open Data Entry manually.</Text>
    </View>
    <Header insets={insets} onBack={() => navigation.goBack()} />
  </>
);

const ScanScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
      {visionCameraAvailable ? (
        <CameraCardCapture navigation={navigation} insets={insets} />
      ) : (
        <FallbackView navigation={navigation} insets={insets} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fallbackCenter: {
    alignItems: 'center',
    gap: 10,
    left: 26,
    position: 'absolute',
    right: 26,
    top: '35%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    left: 0,
    paddingBottom: 10,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  iconBtn: { minWidth: 36, padding: 6 },
  headerTitle: { color: '#fff', flex: 1, fontSize: 17, fontWeight: '700', marginLeft: 8 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 96,
  },
  cardFrame: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
    height: CARD_FRAME_HEIGHT,
    justifyContent: 'center',
    width: CARD_FRAME_WIDTH,
  },
  bottomControls: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    bottom: 0,
    gap: 12,
    left: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    position: 'absolute',
    right: 0,
  },
  corner: {
    borderColor: Colors.primary,
    height: 30,
    position: 'absolute',
    width: 30,
  },
  cTL: { borderLeftWidth: 3, borderTopWidth: 3, left: 0, top: 0 },
  cTR: { borderRightWidth: 3, borderTopWidth: 3, right: 0, top: 0 },
  cBL: { borderBottomWidth: 3, borderLeftWidth: 3, bottom: 0, left: 0 },
  cBR: { borderBottomWidth: 3, borderRightWidth: 3, bottom: 0, right: 0 },
  hint: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  subHint: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 28,
    textAlign: 'center',
  },
  captureBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderColor: '#fff',
    borderRadius: 36,
    borderWidth: 4,
    elevation: 8,
    height: 72,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    width: 72,
  },
  captureBtnDisabled: { opacity: 0.72 },
  permTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  permSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  permBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 26,
    paddingVertical: 13,
  },
  permBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  outlineBtn: {
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 26,
    paddingVertical: 11,
  },
  outlineTxt: { color: 'rgba(255,255,255,0.72)', fontSize: 14 },
});

export default ScanScreen;
