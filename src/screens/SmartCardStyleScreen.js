import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  FlatList, Dimensions, Share, Alert, Modal, ScrollView, Linking,
  Image, ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getMaterials } from '../services/api';
import { normalizeMaterials } from '../services/contentMapper';

const { width } = Dimensions.get('window');
const CARD_W = (width - 40) / 2;

const STYLES = [
  { id: '1', label: 'Style 1', bg: '#1A237E', accent: '#C0392B', textColor: '#fff' },
  { id: '2', label: 'Style 2', bg: '#1a1a1a', accent: '#fff', textColor: '#fff' },
  { id: '3', label: 'Style 3', bg: '#fff', accent: '#F39C12', textColor: '#1a1a1a' },
  { id: '4', label: 'Style 4', bg: '#C0392B', accent: '#fff', textColor: '#fff' },
  { id: '5', label: 'Style 5', bg: '#6C3FC9', accent: '#F39C12', textColor: '#fff' },
  { id: '6', label: 'Style 6', bg: '#2980B9', accent: '#E74C3C', textColor: '#fff' },
  { id: '7', label: 'Style 7', bg: '#1B5E20', accent: '#FFD700', textColor: '#fff' },
  { id: '8', label: 'Style 8', bg: '#880E4F', accent: '#F39C12', textColor: '#fff' },
];

const CardPreview = ({ style, user, size = 'small' }) => {
  const h = size === 'small' ? CARD_W * 0.6 : (width - 32) * 0.55;
  const w2 = size === 'small' ? CARD_W : width - 32;
  const imageSource = typeof style.image === 'string' ? { uri: style.image } : style.image;
  return (
    <View style={[styles.cardPreview, { backgroundColor: style.bg, width: w2, height: h }]}>
      {imageSource ? (
        <Image source={imageSource} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : null}
      {imageSource ? <View style={styles.imageScrim} /> : null}
      <View style={[styles.cardAccentBar, { backgroundColor: style.accent }]} />
      <View style={styles.cardNfc}>
        <Text style={{ color: style.textColor, fontSize: size === 'small' ? 8 : 12, fontWeight: '700' }}>N))</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={[styles.cardAvatar, { backgroundColor: style.accent + '40', borderColor: style.accent }]}>
          <MaterialIcons name="person" size={size === 'small' ? 18 : 28} color={style.textColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: style.textColor, fontSize: size === 'small' ? 9 : 14 }]} numberOfLines={1}>
            {user?.name || 'Your Name'}
          </Text>
          <Text style={[styles.cardRole, { color: style.accent, fontSize: size === 'small' ? 7 : 11 }]}>
            Insurance Advisor
          </Text>
        </View>
      </View>
      <View style={[styles.cardFooterBar, { backgroundColor: style.accent + '30' }]}>
        <Text style={{ color: style.textColor, fontSize: size === 'small' ? 6 : 10 }}>
          {user?.mobile || '9999999999'} • POLICYBHANDAR
        </Text>
      </View>
    </View>
  );
};

const SmartCardStyleScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [cardStyles, setCardStyles] = useState(STYLES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadTemplates = async () => {
      try {
        const response = await getMaterials({ type: 'NFC', page: 1, limit: 20 });
        let templates = normalizeMaterials(response.data, 'NFC Smart Card');
        if (!templates.length) {
          const fallback = await getMaterials({ page: 1, limit: 80 });
          templates = normalizeMaterials(fallback.data, 'NFC Smart Card').filter((item) => {
            const text = `${item.title || ''} ${item.subtitle || ''} ${item.type || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
            return text.includes('nfc') || text.includes('smart card') || text.includes('visiting card');
          });
        }

        if (active && templates.length) {
          setCardStyles(templates.map((item, index) => ({
            id: item.id,
            label: item.title || `Template ${index + 1}`,
            bg: item.color || STYLES[index % STYLES.length].bg,
            accent: item.raw?.accentColor || STYLES[index % STYLES.length].accent,
            textColor: item.raw?.textColor || '#fff',
            image: item.image,
            raw: item.raw,
          })));
        }
      } catch (_) {
      } finally {
        if (active) setLoading(false);
      }
    };
    loadTemplates();
    return () => {
      active = false;
    };
  }, []);

  const handleStyleSelect = (style) => {
    setSelectedStyle(style);
    setPreviewVisible(true);
  };

  const handleShareWhatsApp = async () => {
    try {
      const msg = `*NFC Visiting Card - ${selectedStyle?.label}*\n\nName: ${user?.name || 'Your Name'}\nMobile: ${user?.mobile || ''}\nCompany: POLICYBHANDAR\n\nGenerated via POLICYBHANDAR App`;
      const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message: msg });
      }
    } catch (_) {
      Alert.alert('Error', 'Could not open WhatsApp');
    }
  };

  const handleBook = () => {
    Alert.alert('Book NFC Card', 'Your NFC Visiting Card order has been placed!\nOur team will contact you shortly.', [{ text: 'OK' }]);
  };

  const renderStyle = ({ item }) => (
    <TouchableOpacity
      style={[styles.styleItem, selectedStyle?.id === item.id && styles.styleItemSelected]}
      onPress={() => handleStyleSelect(item)}
      activeOpacity={0.85}
    >
      <CardPreview style={item} user={user} size="small" />
      <Text style={styles.styleLabel}>{item.label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Style</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="info-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="link" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={cardStyles}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={renderStyle}
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 80 }]}
        columnWrapperStyle={styles.row}
      />
      {loading ? (
        <View style={styles.loadingPill}>
          <ActivityIndicator color={Colors.primary} size="small" />
          <Text style={styles.loadingText}>Loading card templates...</Text>
        </View>
      ) : null}

      {/* Book Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBook} activeOpacity={0.85}>
          <Text style={styles.bookBtnTxt}>Book Your NFC Visiting Card</Text>
        </TouchableOpacity>
      </View>

      {/* Preview Modal */}
      <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewRoot}>
          <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
          <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
            <TouchableOpacity onPress={() => setPreviewVisible(false)} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>NFC Visiting Card - {selectedStyle?.label}</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn}>
                <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <MaterialIcons name="edit" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={[styles.previewScroll, { paddingBottom: insets.bottom + 100 }]}>
            <Text style={styles.sampleLabel}>Sample Output:</Text>

            {/* Front / Back row */}
            <View style={styles.frontBackRow}>
              <View style={styles.sideCard}>
                {selectedStyle && <CardPreview style={selectedStyle} user={user} size="small" />}
                <Text style={styles.sideLabel}>Front</Text>
              </View>
              <View style={styles.sideCard}>
                <View style={[styles.backCard, { backgroundColor: selectedStyle?.bg }]}>
                  <MaterialIcons name="qr-code-2" size={60} color={selectedStyle?.textColor || '#fff'} />
                  <Text style={{ color: selectedStyle?.textColor || '#fff', fontSize: 9, marginTop: 4 }}>
                    {user?.mobile || '9999999999'}
                  </Text>
                </View>
                <Text style={styles.sideLabel}>Back</Text>
              </View>
            </View>

            {/* Full preview */}
            {selectedStyle && (
              <>
                <CardPreview style={selectedStyle} user={user} size="large" />
                <View style={[styles.backFull, { backgroundColor: selectedStyle.bg }]}>
                  <MaterialIcons name="qr-code-2" size={100} color={selectedStyle.textColor || '#fff'} />
                  <Text style={{ color: selectedStyle.textColor, fontSize: 13, marginTop: 8 }}>
                    📞 {user?.mobile || '9999999999'}
                  </Text>
                  <Text style={{ color: selectedStyle.accent, fontSize: 11, marginTop: 4 }}>
                    POLICYBHANDAR
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Share WhatsApp Button */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
            <TouchableOpacity style={styles.whatsappBtn} onPress={handleShareWhatsApp} activeOpacity={0.85}>
              <Ionicons name="logo-whatsapp" size={22} color="#fff" />
              <Text style={styles.bookBtnTxt}>Share PDF on WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F0F0' },
  previewRoot: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  headerRight: { flexDirection: 'row' },
  iconBtn: { padding: 6 },
  grid: { padding: 12 },
  row: { gap: 8, marginBottom: 8 },
  styleItem: {
    width: CARD_W, alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 10, padding: 8,
    elevation: 2,
  },
  styleItemSelected: { borderWidth: 2, borderColor: Colors.primary },
  styleLabel: { fontSize: 12, fontWeight: '600', color: Colors.textDark },
  // Card preview
  cardPreview: { borderRadius: 8, overflow: 'hidden', position: 'relative' },
  imageScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  cardAccentBar: { height: 3, width: '100%' },
  cardNfc: { position: 'absolute', top: 4, left: 6 },
  cardContent: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 6, flex: 1 },
  cardAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontWeight: '800' },
  cardRole: { fontWeight: '600', marginTop: 1 },
  cardFooterBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 4, alignItems: 'center' },
  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  whatsappBtn: { backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bookBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // Preview screen
  previewScroll: { padding: 16, gap: 14 },
  sampleLabel: { fontSize: 15, fontWeight: '700', color: Colors.textDark, marginBottom: 4 },
  frontBackRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  sideCard: { flex: 1, alignItems: 'center', gap: 6 },
  sideLabel: { fontSize: 12, color: Colors.textGray, fontWeight: '500' },
  backCard: { width: CARD_W - 12, height: (CARD_W - 12) * 0.6, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  backFull: { width: width - 32, height: (width - 32) * 0.5, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 4 },
  loadingPill: {
    position: 'absolute', top: 74, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8,
    elevation: 3,
  },
  loadingText: { fontSize: 12, color: Colors.textGray },
});

export default SmartCardStyleScreen;
