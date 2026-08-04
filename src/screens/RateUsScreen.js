import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Platform, Alert, Animated, Linking,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const EMOJIS = ['😞', '😐', '🙂', '😊', '🤩'];
const LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];

const RateUsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating === 0) {
      Alert.alert('Please Rate', 'Select a star rating before submitting.');
      return;
    }
    if (rating >= 4) {
      Alert.alert(
        'Thank You! 🎉',
        'We\'re glad you love the app! Would you like to rate us on the Play Store?',
        [
          { text: 'Not Now', style: 'cancel', onPress: () => setSubmitted(true) },
          {
            text: 'Rate on Play Store',
            onPress: () => {
              Linking.openURL('https://play.google.com/store/apps');
              setSubmitted(true);
            },
          },
        ]
      );
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <View style={styles.root}>
        <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rate Us</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.thankYouWrap}>
          <Text style={styles.thankYouEmoji}>🎉</Text>
          <Text style={styles.thankYouTitle}>Thank You!</Text>
          <Text style={styles.thankYouSub}>Your feedback helps us improve POLICYBHANDAR for everyone.</Text>
          <TouchableOpacity style={styles.goHomeBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.goHomeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Us</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        {/* App Icon */}
        <View style={styles.appIconWrap}>
          <View style={styles.appIcon}>
            <MaterialIcons name="shield" size={52} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>POLICYBHANDAR</Text>
          <Text style={styles.appVersion}>Version 10.6.9</Text>
        </View>

        <Text style={styles.rateTitle}>How are you enjoying the app?</Text>

        {/* Emoji Row */}
        <View style={styles.emojiRow}>
          {EMOJIS.map((emoji, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.emojiBtn, rating === i + 1 && styles.emojiSelected]}
              onPress={() => setRating(i + 1)}
              activeOpacity={0.8}
            >
              <Text style={[styles.emoji, rating === i + 1 && styles.emojiActive]}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {rating > 0 && (
          <Text style={styles.ratingLabel}>{LABELS[rating - 1]}</Text>
        )}

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map(star => (
            <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.8}>
              <MaterialIcons
                name={star <= rating ? 'star' : 'star-border'}
                size={40}
                color={star <= rating ? '#F39C12' : Colors.border}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Feedback */}
        <Text style={styles.feedbackLabel}>Tell us more (optional)</Text>
        <TextInput
          style={styles.feedbackInput}
          placeholder="What did you like or dislike?"
          placeholderTextColor={Colors.textLight}
          value={feedback}
          onChangeText={setFeedback}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Submit */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <MaterialIcons name="send" size={20} color="#fff" />
          <Text style={styles.submitText}>Submit Feedback</Text>
        </TouchableOpacity>

        {/* Play Store */}
        <TouchableOpacity
          style={styles.storeBtn}
          onPress={() => Linking.openURL('https://play.google.com/store/apps')}
        >
          <Ionicons name="logo-google-playstore" size={18} color={Colors.primary} />
          <Text style={styles.storeText}>Rate on Play Store</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10,
    elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  content: { flex: 1, padding: 20, alignItems: 'center' },
  appIconWrap: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  appIcon: {
    width: 90, height: 90, borderRadius: 22,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    elevation: 4, marginBottom: 10,
  },
  appName: { fontSize: 18, fontWeight: '800', color: Colors.textDark },
  appVersion: { fontSize: 12, color: Colors.textGray, marginTop: 2 },
  rateTitle: { fontSize: 16, fontWeight: '600', color: Colors.textDark, marginBottom: 20, textAlign: 'center' },
  emojiRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  emojiBtn: { padding: 6, borderRadius: 12 },
  emojiSelected: { backgroundColor: '#FFF0F0', transform: [{ scale: 1.2 }] },
  emoji: { fontSize: 28 },
  emojiActive: { fontSize: 34 },
  ratingLabel: {
    fontSize: 14, fontWeight: '700', color: Colors.primary,
    marginBottom: 10, letterSpacing: 0.5,
  },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 20 },
  feedbackLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600', color: Colors.textGray, marginBottom: 8 },
  feedbackInput: {
    width: '100%', borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, padding: 12, fontSize: 14,
    color: Colors.textDark, backgroundColor: '#fff',
    minHeight: 100, marginBottom: 16,
  },
  submitBtn: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 14, gap: 8, marginBottom: 12,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  storeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.primary,
    borderRadius: 10,
  },
  storeText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  thankYouWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 12 },
  thankYouEmoji: { fontSize: 64 },
  thankYouTitle: { fontSize: 24, fontWeight: '800', color: Colors.textDark },
  thankYouSub: { fontSize: 14, color: Colors.textGray, textAlign: 'center', lineHeight: 22 },
  goHomeBtn: {
    marginTop: 12, backgroundColor: Colors.primary,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
  },
  goHomeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default RateUsScreen;