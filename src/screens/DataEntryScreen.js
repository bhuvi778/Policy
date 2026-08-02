import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Platform, ScrollView, Alert, KeyboardAvoidingView, Share,
  ActivityIndicator, Image,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { pickFirst, saveClient } from '../services/appData';

const cleanPhone = (value = '') => String(value || '').replace(/\D/g, '').slice(-10);

const getPrefillClient = (params = {}) => params.prefillClient || params.client || null;

const DataEntryScreen = ({ route, navigation }) => {
  const initialPrefill = getPrefillClient(route?.params);
  const [cardImage, setCardImage] = useState(initialPrefill?.cardImage || initialPrefill?.image || '');
  const [memberType, setMemberType] = useState(initialPrefill ? 'Member' : 'Head');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [personalOpen, setPersonalOpen] = useState(true);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyNo, setPolicyNo] = useState('');
  const [company, setCompany] = useState('');
  const [plan, setPlan] = useState('');
  const [premium, setPremium] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prefill = getPrefillClient(route?.params);
    if (!prefill) return;

    const nextMobile = cleanPhone(pickFirst(prefill.mobile, prefill.phone, prefill.contactNumber, ''));
    const nextName = pickFirst(prefill.name, prefill.fullName, prefill.clientName, '');
    const nextCompany = pickFirst(prefill.company, prefill.companyName, prefill.organization, '');
    const nextImage = pickFirst(prefill.cardImage, prefill.image, '');

    setMemberType(pickFirst(prefill.memberType, prefill.type, 'Member'));
    setMobile(nextMobile);
    setName(nextName);
    setCompany(nextCompany);
    setCardImage(nextImage);
    setDob(pickFirst(prefill.dob, prefill.dateOfBirth, ''));
    setPersonalOpen(true);
    setPolicyOpen(false);
  }, [route?.params]);

  const buildEntry = () => ({
    name: name.trim(),
    mobile: mobile.trim(),
    dob: dob.trim(),
    memberType,
    policyNo: policyNo.trim(),
    company: company.trim(),
    plan: plan.trim(),
    premium: premium.trim(),
    dueDate: dueDate.trim(),
  });

  const validateClient = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter name.');
      return false;
    }
    if (!mobile || mobile.trim().length < 10) {
      Alert.alert('Required', 'Enter valid mobile number.');
      return false;
    }
    return true;
  };

  const saveEntry = async (successRemote, successLocal) => {
    if (!validateClient()) return null;
    setSaving(true);
    try {
      const result = await saveClient(buildEntry());
      Alert.alert('Saved', result.savedRemotely ? successRemote : successLocal);
      return result;
    } catch (error) {
      Alert.alert('Save failed', error?.message || 'Unable to save client details.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleProceed = async () => {
    const result = await saveEntry(
      'Client details synced with backend. Now fill policy details.',
      'Client details saved on this device. Backend sync will work when the client API is available for this user.',
    );
    if (result) {
      setPolicyOpen(true);
      setPersonalOpen(false);
    }
  };

  const handleSavePolicy = () => saveEntry(
    'Policy details synced with backend.',
    'Policy details saved on this device. Backend sync will work when the client API is available for this user.',
  );

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Client: ${name}\nMobile: ${mobile}\nDOB: ${dob}\nPolicy No: ${policyNo}\nCompany: ${company}\nPlan: ${plan}\nPremium: ${premium}\nDue Date: ${dueDate}`,
      });
    } catch (_) {}
  };

  const SectionHeader = ({ title, isOpen, onToggle }) => (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <MaterialIcons name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={Colors.primary} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>
        <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Data Entry</Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
            <MaterialIcons name="share" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.formTitle}>Digital Calendar</Text>
          {cardImage ? (
            <View style={styles.cardPreviewWrap}>
              <Image source={{ uri: cardImage }} style={styles.cardPreview} resizeMode="cover" />
              <Text style={styles.cardPreviewText}>Captured visiting card. Fill name and mobile, then proceed to save this contact.</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title="Personal Information" isOpen={personalOpen} onToggle={() => setPersonalOpen(!personalOpen)} />
            {personalOpen && (
              <View style={styles.body}>
                <View style={styles.radioRow}>
                  {['Head', 'Member'].map((t) => (
                    <TouchableOpacity key={t} style={styles.radioBtn} onPress={() => setMemberType(t)}>
                      <View style={[styles.radioOuter, memberType === t && styles.radioActive]}>
                        {memberType === t && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioLabel}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="Mobile No" placeholderTextColor={Colors.textLight} keyboardType="phone-pad" maxLength={10} value={mobile} onChangeText={setMobile} />
                <TextInput style={styles.input} placeholder="Name" placeholderTextColor={Colors.textLight} value={name} onChangeText={setName} />
                <View style={styles.dobRow}>
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Date Of Birth" placeholderTextColor={Colors.textLight} value={dob} onChangeText={setDob} />
                  <MaterialIcons name="calendar-today" size={20} color={Colors.textLight} style={{ marginRight: 10 }} />
                </View>
                <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.proceedTxt}>Proceed</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.section, { marginTop: 12 }]}>
            <SectionHeader title="Policy Details" isOpen={policyOpen} onToggle={() => setPolicyOpen(!policyOpen)} />
            {policyOpen && (
              <View style={styles.body}>
                <TextInput style={styles.input} placeholder="Policy No" placeholderTextColor={Colors.textLight} value={policyNo} onChangeText={setPolicyNo} />
                <TextInput style={styles.input} placeholder="Insurance Company" placeholderTextColor={Colors.textLight} value={company} onChangeText={setCompany} />
                <TextInput style={styles.input} placeholder="Plan Name" placeholderTextColor={Colors.textLight} value={plan} onChangeText={setPlan} />
                <TextInput style={styles.input} placeholder="Annual Premium" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={premium} onChangeText={setPremium} />
                <View style={styles.dobRow}>
                  <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} placeholder="Due Date" placeholderTextColor={Colors.textLight} value={dueDate} onChangeText={setDueDate} />
                  <MaterialIcons name="calendar-today" size={20} color={Colors.textLight} style={{ marginRight: 10 }} />
                </View>
                <TouchableOpacity style={[styles.proceedBtn, { backgroundColor: Colors.primary, marginTop: 8 }]} onPress={handleSavePolicy} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.proceedTxt}>Save Policy</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
  shareBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  scroll: { padding: 16, paddingBottom: 40 },
  formTitle: { fontSize: 22, fontWeight: '800', color: Colors.textDark, textAlign: 'center', marginBottom: 16 },
  cardPreviewWrap: {
    backgroundColor: '#fff',
    borderColor: Colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardPreview: {
    backgroundColor: '#EEE',
    height: 170,
    width: '100%',
  },
  cardPreviewText: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    padding: 10,
    textAlign: 'center',
  },
  section: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: '#F0F7EE' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  body: { padding: 12 },
  radioRow: { flexDirection: 'row', gap: 24, marginBottom: 10 },
  radioBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: Colors.textLight, justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  radioLabel: { fontSize: 14, color: Colors.textDark },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.textDark, marginBottom: 10 },
  dobRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 6, backgroundColor: '#F5F5F5', marginBottom: 10 },
  proceedBtn: { backgroundColor: '#27AE60', borderRadius: 6, paddingVertical: 12, alignItems: 'center', marginTop: 4, minHeight: 45 },
  proceedTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default DataEntryScreen;
