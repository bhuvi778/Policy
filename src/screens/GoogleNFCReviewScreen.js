import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  TextInput, ScrollView, Alert, Linking, Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const GoogleNFCReviewScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [location, setLocation] = useState('');
  const [placeDetails, setPlaceDetails] = useState('');
  const [reviewId, setReviewId] = useState('');
  const [qrTitle, setQrTitle] = useState('');
  const [customName, setCustomName] = useState(user?.name || '');
  const [reviewType, setReviewType] = useState('direct'); // 'direct' | 'limited'
  const [finding, setFinding] = useState(false);

  const findReviewId = async () => {
    if (!location.trim()) {
      Alert.alert('Required', 'Please enter a location to search');
      return;
    }
    setFinding(true);
    // Simulate finding place — in production use Google Places API
    setTimeout(() => {
      setPlaceDetails(`ChIJ... (Place ID for "${location}")\nOpen Google Maps to find the exact Review ID.`);
      setFinding(false);
    }, 1200);
  };

  const handleEnterReviewId = () => {
    if (!reviewId.trim()) {
      Alert.alert('Required', 'Please enter a Review ID');
      return;
    }
    Alert.alert('QR Generated', `Review ID: ${reviewId}\nTitle: ${qrTitle || 'Google Review'}\nThis QR will link directly to your Google Review page.`);
  };

  const handleBook = () => {
    Alert.alert(
      'Book NFC Google Review Card',
      'Your NFC Google Review Card order has been placed!\nOur team will contact you shortly.',
      [{ text: 'OK' }]
    );
  };

  const openGoogleMaps = () => {
    Linking.openURL('https://maps.google.com').catch(() =>
      Alert.alert('Error', 'Could not open Google Maps')
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Review</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="info-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="link" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Find Review ID section */}
        <Text style={styles.sectionTitle}>Find Review ID</Text>

        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            placeholder="Enter a location"
            placeholderTextColor={Colors.textLight}
            value={location}
            onChangeText={setLocation}
            onSubmitEditing={findReviewId}
          />
        </View>

        {placeDetails ? (
          <View style={styles.placeResult}>
            <Text style={styles.placeLabel}>Review ID:</Text>
            <TouchableOpacity onPress={openGoogleMaps}>
              <Text style={styles.placeDetails}>{placeDetails}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.placeResult}>
            <Text style={styles.placeLabel}>Review ID:</Text>
            <Text style={styles.placePlaceholder}>Place details will appear here.</Text>
          </View>
        )}

        {/* Enter Review ID */}
        <View style={styles.inputWithClear}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Enter Review ID"
            placeholderTextColor={Colors.textLight}
            value={reviewId}
            onChangeText={setReviewId}
          />
          <TouchableOpacity onPress={() => setReviewId('')} style={styles.clearIcon}>
            <MaterialIcons name="close" size={18} color={Colors.textGray} />
          </TouchableOpacity>
        </View>

        {/* Enter Review ID Button */}
        <TouchableOpacity style={styles.reviewIdBtn} onPress={handleEnterReviewId} activeOpacity={0.85}>
          <MaterialIcons name="qr-code" size={20} color="#fff" />
          <Text style={styles.reviewIdBtnTxt}>Enter Review ID</Text>
        </TouchableOpacity>

        {/* QR Title */}
        <View style={styles.inputWithClear}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Enter Title for QrCode"
            placeholderTextColor={Colors.textLight}
            value={qrTitle}
            onChangeText={setQrTitle}
          />
          <TouchableOpacity onPress={() => setQrTitle('')} style={styles.clearIcon}>
            <MaterialIcons name="close" size={18} color={Colors.textGray} />
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>Enter title for this QrCode to identify it later</Text>

        {/* Custom Name */}
        <View style={[styles.inputWithClear, styles.customNameBox]}>
          <View style={styles.customNameLabel}>
            <Text style={styles.customNameLabelTxt}>Enter Custom Name</Text>
          </View>
          <TextInput
            style={[styles.inputFlex, { paddingTop: 20 }]}
            placeholder="Your name"
            placeholderTextColor={Colors.textLight}
            value={customName}
            onChangeText={setCustomName}
          />
          <TouchableOpacity onPress={() => setCustomName('')} style={styles.clearIcon}>
            <MaterialIcons name="close" size={18} color={Colors.textGray} />
          </TouchableOpacity>
          <View style={styles.avatarThumb}>
            <MaterialIcons name="person" size={28} color={Colors.primary} />
          </View>
        </View>
        <Text style={styles.hint}>Custom name and Image here if you want some other name on the card, click to change image</Text>

        {/* Review Type Radio */}
        <View style={styles.radioRow}>
          <TouchableOpacity style={styles.radioItem} onPress={() => setReviewType('direct')}>
            <View style={[styles.radioOuter, reviewType === 'direct' && styles.radioOuterActive]}>
              {reviewType === 'direct' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioLabel}>Direct Reviews</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.radioItem} onPress={() => setReviewType('limited')}>
            <View style={[styles.radioOuter, reviewType === 'limited' && styles.radioOuterActive]}>
              {reviewType === 'limited' && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioLabel}>Limited Reviews</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Book Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBook} activeOpacity={0.85}>
          <Text style={styles.bookBtnTxt}>Book Your NFC Google Review Card</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  headerRight: { flexDirection: 'row' },
  iconBtn: { padding: 6 },
  scroll: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, textAlign: 'center', marginBottom: 14 },
  inputBox: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    marginBottom: 10,
  },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textDark },
  placeResult: { marginBottom: 14 },
  placeLabel: { fontSize: 13, color: Colors.textGray, marginBottom: 2 },
  placeDetails: { fontSize: 13, color: '#2980B9', lineHeight: 18 },
  placePlaceholder: { fontSize: 13, color: '#2980B9', fontStyle: 'italic' },
  inputWithClear: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
    marginBottom: 8, paddingRight: 10,
  },
  inputFlex: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textDark },
  clearIcon: { padding: 4 },
  reviewIdBtn: {
    backgroundColor: '#555', borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8, marginBottom: 14,
  },
  reviewIdBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 11, color: Colors.textGray, marginBottom: 12, lineHeight: 16 },
  customNameBox: { position: 'relative', paddingTop: 8 },
  customNameLabel: {
    position: 'absolute', top: -8, left: 10,
    backgroundColor: '#fff', paddingHorizontal: 4,
  },
  customNameLabelTxt: { fontSize: 11, color: Colors.textGray },
  avatarThumb: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center',
    marginLeft: 4,
  },
  radioRow: { flexDirection: 'row', gap: 24, marginTop: 4 },
  radioItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: Colors.textLight, justifyContent: 'center', alignItems: 'center',
  },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },
  radioLabel: { fontSize: 14, color: Colors.textDark },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  bookBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  bookBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default GoogleNFCReviewScreen;
