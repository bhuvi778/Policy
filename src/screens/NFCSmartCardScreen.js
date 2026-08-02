import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NFCSmartCardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NFC Smart Card</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>

        {/* Smart NFC Visiting Card */}
        <TouchableOpacity
          style={[styles.card, styles.cardBlue]}
          onPress={() => navigation.navigate('SmartCardStyle')}
          activeOpacity={0.85}
        >
          <View style={styles.cardIcon}>
            <MaterialIcons name="nfc" size={64} color="#3B82F6" />
            <View style={styles.cardChip}>
              <MaterialIcons name="credit-card" size={32} color="#6C3FC9" />
            </View>
          </View>
          <Text style={styles.cardTitle}>Smart NFC{'\n'}Visiting Card</Text>
        </TouchableOpacity>

        {/* Google NFC Review Card */}
        <TouchableOpacity
          style={[styles.card, styles.cardGreen]}
          onPress={() => navigation.navigate('GoogleNFCReview')}
          activeOpacity={0.85}
        >
          <View style={styles.googleLogo}>
            <Text style={styles.googleG}>
              <Text style={{ color: '#4285F4' }}>G</Text>
              <Text style={{ color: '#EA4335' }}>o</Text>
              <Text style={{ color: '#FBBC05' }}>o</Text>
              <Text style={{ color: '#4285F4' }}>g</Text>
              <Text style={{ color: '#34A853' }}>l</Text>
              <Text style={{ color: '#EA4335' }}>e</Text>
            </Text>
          </View>
          <Text style={styles.cardTitle}>Google NFC{'\n'}Review Card</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F0F0' },
  header: {
    backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 10, elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  scroll: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    padding: 30, alignItems: 'center', gap: 16,
    elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6,
  },
  cardBlue: { borderWidth: 2, borderColor: '#3B82F6' },
  cardGreen: { borderWidth: 2, borderColor: '#34A853' },
  cardIcon: { alignItems: 'center', justifyContent: 'center' },
  cardChip: {
    marginTop: -8, backgroundColor: '#F5F0FF',
    borderRadius: 8, padding: 6,
  },
  cardTitle: {
    fontSize: 18, fontWeight: '700', color: '#222',
    textAlign: 'center', lineHeight: 26,
  },
  googleLogo: { height: 64, justifyContent: 'center' },
  googleG: { fontSize: 48, fontWeight: '700' },
});

export default NFCSmartCardScreen;
