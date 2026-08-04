import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Platform, TextInput, Alert, Linking, ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const GOOGLE_REVIEW_URL = 'https://g.page/r/review'; // Replace with actual Google review link

const SmartCardReviewScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('google'); // 'google' | 'normal'
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleGoogleReview = () => {
    Linking.openURL(GOOGLE_REVIEW_URL).catch(() =>
      Alert.alert('Error', 'Could not open Google Review. Please try again.')
    );
  };

  const handleNormalSubmit = () => {
    if (rating === 0) { Alert.alert('Required', 'Please select a star rating.'); return; }
    if (!reviewText.trim()) { Alert.alert('Required', 'Please write a short review.'); return; }
    setSubmitted(true);
  };

  const STARS = [1, 2, 3, 4, 5];

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Card Review</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[{ key: 'google', label: 'Google Review', icon: 'logo-google' }, { key: 'normal', label: 'App Review', icon: 'star' }].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => { setActiveTab(t.key); setSubmitted(false); }}
          >
            <Ionicons name={t.icon} size={18} color={activeTab === t.key ? Colors.primary : Colors.textGray} />
            <Text style={[styles.tabTxt, activeTab === t.key && { color: Colors.primary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {activeTab === 'google' ? (
          <View style={styles.googleCard}>
            <View style={styles.googleIconWrap}>
              <Ionicons name="logo-google" size={52} color="#4285F4" />
            </View>
            <Text style={styles.googleTitle}>Share your experience on Google</Text>
            <Text style={styles.googleSub}>Your review helps others discover POLICYBHANDAR and supports our team. It takes less than a minute!</Text>
            <View style={styles.googleStars}>
              {STARS.map(s => <MaterialIcons key={s} name="star" size={32} color="#F4B400" />)}
            </View>
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleReview} activeOpacity={0.85}>
              <Ionicons name="logo-google" size={20} color="#fff" />
              <Text style={styles.googleBtnTxt}>Review on Google</Text>
            </TouchableOpacity>
            <Text style={styles.googleNote}>Opens in browser • Google account required</Text>
          </View>
        ) : submitted ? (
          <View style={styles.thankCard}>
            <Text style={styles.thankEmoji}>🎉</Text>
            <Text style={styles.thankTitle}>Thank You!</Text>
            <Text style={styles.thankSub}>Your review has been submitted successfully.</Text>
            <TouchableOpacity style={styles.backToHome} onPress={() => { setSubmitted(false); setRating(0); setReviewText(''); }}>
              <Text style={styles.backToHomeTxt}>Write Another Review</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.normalCard}>
            <Text style={styles.normalTitle}>Share Your Feedback</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Your Name (optional)"
              placeholderTextColor={Colors.textLight}
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.rateLabel}>Rate Your Experience</Text>
            <View style={styles.starsRow}>
              {STARS.map(s => (
                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                  <MaterialIcons name={s <= rating ? 'star' : 'star-border'} size={38} color={s <= rating ? '#F39C12' : Colors.border} />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text style={styles.ratingLabel}>
                {['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent 🤩'][rating]}
              </Text>
            )}
            <TextInput
              style={styles.reviewInput}
              placeholder="Write your review here..."
              placeholderTextColor={Colors.textLight}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.submitBtn} onPress={handleNormalSubmit} activeOpacity={0.85}>
              <MaterialIcons name="send" size={20} color="#fff" />
              <Text style={styles.submitTxt}>Submit Review</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10, elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabTxt: { fontSize: 13, fontWeight: '600', color: Colors.textGray },
  scroll: { padding: 16, paddingBottom: 40 },
  googleCard: { backgroundColor: '#fff', borderRadius: 14, padding: 24, alignItems: 'center', elevation: 2 },
  googleIconWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#F0F4FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  googleTitle: { fontSize: 18, fontWeight: '800', color: Colors.textDark, textAlign: 'center', marginBottom: 10 },
  googleSub: { fontSize: 13, color: Colors.textGray, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  googleStars: { flexDirection: 'row', gap: 4, marginBottom: 20 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4285F4', borderRadius: 10, paddingVertical: 13, paddingHorizontal: 24, marginBottom: 10 },
  googleBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  googleNote: { fontSize: 11, color: Colors.textLight, textAlign: 'center' },
  thankCard: { backgroundColor: '#fff', borderRadius: 14, padding: 40, alignItems: 'center', elevation: 2 },
  thankEmoji: { fontSize: 56, marginBottom: 12 },
  thankTitle: { fontSize: 22, fontWeight: '800', color: Colors.textDark, marginBottom: 8 },
  thankSub: { fontSize: 14, color: Colors.textGray, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  backToHome: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  backToHomeTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  normalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 20, elevation: 2 },
  normalTitle: { fontSize: 17, fontWeight: '700', color: Colors.textDark, marginBottom: 14, textAlign: 'center' },
  nameInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textDark, marginBottom: 14 },
  rateLabel: { fontSize: 13, fontWeight: '600', color: Colors.textGray, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  ratingLabel: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 14 },
  reviewInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textDark, minHeight: 100, marginBottom: 16 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 8 },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default SmartCardReviewScreen;
