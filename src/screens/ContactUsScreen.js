import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { submitContact } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BRAND,
  getAssignedFranchise,
  getAssignedRep,
  loadAppSettings,
} from '../services/appData';

const ContactCard = ({ icon, iconColor, title, value, onPress, subtitle }) => {
  if (!value) return null;
  return (
    <TouchableOpacity style={styles.contactCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.contactIcon, { backgroundColor: iconColor + '20' }]}>
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactTitle}>{title}</Text>
        <Text style={styles.contactValue}>{value}</Text>
        {subtitle ? <Text style={styles.contactSubtitle}>{subtitle}</Text> : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
    </TouchableOpacity>
  );
};

const ContactUsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user = {} } = useAuth();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [settings, setSettings] = useState({
    brandName: BRAND.name,
    supportPhone: BRAND.phone,
    supportEmail: BRAND.email,
    address: BRAND.address,
  });

  const rep = getAssignedRep(user);
  const franchise = getAssignedFranchise(user);

  useEffect(() => {
    loadAppSettings().then(setSettings);
  }, []);

  const call = (phone) => phone && Linking.openURL(`tel:${phone}`);
  const whatsapp = (phone) => phone && Linking.openURL(`https://wa.me/91${phone}`);
  const email = (mail) => mail && Linking.openURL(`mailto:${mail}`);
  const maps = () => {
    const q = encodeURIComponent(settings.address || settings.brandName || BRAND.name);
    Linking.openURL(`https://maps.google.com/?q=${q}`);
  };

  const sendMessage = async () => {
    if (!name.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in your name and message.');
      return;
    }
    setSending(true);
    try {
      await submitContact({
        name: name.trim(),
        message: message.trim(),
        source: 'POLICYBHANDAR App',
      });
      setName('');
      setMessage('');
      Alert.alert('Sent', 'Your message has been sent to POLICYBHANDAR.');
    } catch (_) {
      const phone = settings.supportPhone || BRAND.phone;
      Linking.openURL(
        `https://wa.me/91${phone}?text=Name: ${encodeURIComponent(name)}%0AMessage: ${encodeURIComponent(message)}`
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="support-agent" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>We're here to help</Text>
          <Text style={styles.heroSub}>Reach out to {settings.brandName || BRAND.name}</Text>
        </View>

        <Text style={styles.sectionLabel}>{settings.brandName || BRAND.name}</Text>
        <ContactCard icon="phone" iconColor={Colors.primary} title="Call Us" value={settings.supportPhone} subtitle="Tap to call directly" onPress={() => call(settings.supportPhone)} />
        <ContactCard icon="email" iconColor="#2980B9" title="Email Us" value={settings.supportEmail} subtitle="We reply as soon as possible" onPress={() => email(settings.supportEmail)} />
        <ContactCard icon="chat" iconColor="#25D366" title="WhatsApp" value={settings.supportPhone} subtitle="Chat with support team" onPress={() => whatsapp(settings.supportPhone)} />
        <ContactCard icon="location-on" iconColor="#E67E22" title="Our Location" value="View on Maps" subtitle={settings.address} onPress={maps} />

        {(rep.name || rep.phone) ? (
          <>
            <Text style={styles.sectionLabel}>Your Company Rep</Text>
            <ContactCard icon="person-pin" iconColor="#8E44AD" title={rep.name || 'Company Rep'} value={rep.phone} subtitle="Your dedicated rep" onPress={() => call(rep.phone)} />
            <ContactCard icon="chat" iconColor="#25D366" title="WhatsApp Rep" value={rep.phone} onPress={() => whatsapp(rep.phone)} />
          </>
        ) : null}

        {(franchise.name || franchise.phone) ? (
          <>
            <Text style={styles.sectionLabel}>Your Franchise</Text>
            <ContactCard icon="store" iconColor="#E67E22" title={franchise.name || 'Franchise'} value={franchise.phone} subtitle="Your franchise partner" onPress={() => call(franchise.phone)} />
            <ContactCard icon="chat" iconColor="#25D366" title="WhatsApp Franchise" value={franchise.phone} onPress={() => whatsapp(franchise.phone)} />
          </>
        ) : null}

        <Text style={styles.sectionLabel}>Send a Message</Text>
        <View style={styles.formCard}>
          <TextInput style={styles.input} placeholder="Your Name" placeholderTextColor={Colors.textLight} value={name} onChangeText={setName} />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Your Message"
            placeholderTextColor={Colors.textLight}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity style={[styles.sendBtn, sending && styles.sendBtnDisabled]} onPress={sendMessage} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
            <Text style={styles.sendText}>{sending ? 'Sending...' : 'Send Message'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10, elevation: 4 },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  content: { paddingBottom: 30 },
  hero: { backgroundColor: Colors.primary, alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4, textAlign: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textGray, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', marginHorizontal: 14, marginBottom: 6, borderRadius: 12, padding: 14, elevation: 1 },
  contactIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  contactInfo: { flex: 1 },
  contactTitle: { fontSize: 14, fontWeight: '600', color: Colors.textDark },
  contactValue: { fontSize: 13, color: Colors.primary, marginTop: 1, fontWeight: '500' },
  contactSubtitle: { fontSize: 11, color: Colors.textGray, marginTop: 1 },
  formCard: { backgroundColor: '#fff', marginHorizontal: 14, borderRadius: 12, padding: 16, elevation: 1, gap: 10 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textDark },
  textArea: { height: 100 },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 8 },
  sendBtnDisabled: { opacity: 0.75 },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default ContactUsScreen;
