import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, KeyboardAvoidingView,
  Platform, Modal, ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
  completeProfile,
  getMaterialCategories,
  loginUser,
  setAuthToken,
  setRegistrationPassword,
} from '../services/api';
import { buildRegistrationTempPassword } from '../services/authPassword';
import { saveRegistrationPassword } from '../services/localCredentials';

const PROFILE_FALLBACKS = [
  { id: 'agent', name: 'Agent' },
  { id: 'leader', name: 'Leader' },
];

const PROFILE_PRIORITY = ['agent', 'leader'];
const SIGNUP_PROFILE_NAMES = new Set(PROFILE_PRIORITY);

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.categories)) return payload.categories;
  return [];
};

const normalizeProfileName = (value = '') =>
  String(value || '').trim().replace(/\s+/g, ' ');

const buildProfileOptions = (payload) => {
  const mapped = unwrapList(payload)
    .map((item) => ({
      id: String(item?._id || item?.id || item?.name || '').trim(),
      name: normalizeProfileName(item?.name || item?.title || item?.label),
    }))
    .filter((item) => SIGNUP_PROFILE_NAMES.has(item.name.toLowerCase()));

  if (!mapped.length) return PROFILE_FALLBACKS;

  const byName = new Map(mapped.map((item) => [item.name.toLowerCase(), item]));
  const ordered = [
    ...PROFILE_PRIORITY.map((name) => byName.get(name)).filter(Boolean),
    ...mapped.filter((item) => !PROFILE_PRIORITY.includes(item.name.toLowerCase())),
  ];

  return ordered.slice(0, 3);
};

const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.data?.error ||
  err?.data?.message ||
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  fallback;

const ensurePasswordLoginWorks = async ({ mobile, email, tempPassword, password }) => {
  const identifiers = Array.from(new Set([mobile, email].filter(Boolean)));
  if (!identifiers.length || !password || password === tempPassword) return;

  let lastLoginError = null;
  for (const identifier of identifiers) {
    try {
      await loginUser(identifier, password);
      return;
    } catch (error) {
      lastLoginError = error;
    }
  }

  await setRegistrationPassword({
    mobile,
    email,
    currentPassword: tempPassword,
    newPassword: password,
  });

  for (const identifier of identifiers) {
    try {
      await loginUser(identifier, password);
      return;
    } catch (error) {
      lastLoginError = error;
    }
  }

  throw lastLoginError || new Error('Password setup verification failed.');
};

// Floating label input field
const FormField = ({
  label,
  value,
  onChangeText,
  icon,
  keyboardType,
  placeholder,
  maxLength,
  editable = true,
  secureTextEntry = false,
  rightIcon,
  onRightPress,
}) => (
  <View style={[styles.fieldWrap, !editable && styles.fieldDisabled]}>
    {value || placeholder ? (
      <Text style={styles.floatLabel}>{label}</Text>
    ) : null}
    <TextInput
      style={styles.fieldInput}
      placeholder={label}
      placeholderTextColor={Colors.primary}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      maxLength={maxLength}
      editable={editable}
      secureTextEntry={secureTextEntry}
    />
    {rightIcon ? (
      <TouchableOpacity onPress={onRightPress} disabled={!editable}>
        <MaterialIcons name={rightIcon} size={22} color={Colors.primary} />
      </TouchableOpacity>
    ) : (
      icon && <MaterialIcons name={icon} size={22} color={Colors.primary} />
    )}
  </View>
);

const RegisterScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const prefillMobile = route?.params?.mobile || '';
  const prefillEmail  = route?.params?.email  || '';
  const authToken     = route?.params?.token  || '';
  const signupPassword = route?.params?.signupPassword || '';
  const passwordLocked = Boolean(signupPassword);

  const [name,        setName]        = useState('');
  const [designation, setDesignation] = useState('');
  const [dob,         setDob]         = useState('');
  const [pinCode,     setPinCode]     = useState('');
  const [licBranch,   setLicBranch]   = useState('');
  const [password,    setPassword]    = useState(signupPassword);
  const [confirmPassword, setConfirmPassword] = useState(signupPassword);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [dropOpen,    setDropOpen]    = useState(false);
  const [profileOptions, setProfileOptions] = useState(PROFILE_FALLBACKS);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setProfileLoading(true);
    getMaterialCategories({ timeout: 10000 })
      .then((res) => {
        if (mounted) setProfileOptions(buildProfileOptions(res.data));
      })
      .catch(() => {
        if (mounted) setProfileOptions(PROFILE_FALLBACKS);
      })
      .finally(() => {
        if (mounted) setProfileLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!signupPassword) return;
    setPassword(signupPassword);
    setConfirmPassword(signupPassword);
  }, [signupPassword]);

  const handleSubmit = async () => {
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!name.trim())        { Alert.alert('Required', 'Please enter your Full Name.'); return; }
    if (!designation)        { Alert.alert('Required', 'Please select a Profile Type.'); return; }
    if (!dob.trim())         { Alert.alert('Required', 'Please enter your Date of Birth.'); return; }
    if (!pinCode.trim())     { Alert.alert('Required', 'Please enter your Area Pin Code.'); return; }
    if (pinCode.length < 6)  { Alert.alert('Invalid', 'Pin Code must be 6 digits.'); return; }
    if (!licBranch.trim())   { Alert.alert('Required', 'Please enter your LIC Branch No.'); return; }
    if (!trimmedPassword)    { Alert.alert('Required', 'Please enter a password.'); return; }
    if (trimmedPassword.length < 6) { Alert.alert('Invalid', 'Password must be at least 6 characters.'); return; }
    if (trimmedPassword !== trimmedConfirmPassword) {
      Alert.alert('Mismatch', 'Password and confirm password should match.');
      return;
    }

    setLoading(true);
    try {
      // Set token for this request
      if (authToken) setAuthToken(authToken);
      const selectedProfile = profileOptions.find((item) => item.name === designation);
      const profileName = selectedProfile?.name || designation;
      const tempPassword = signupPassword || buildRegistrationTempPassword(prefillMobile);

      const res = await completeProfile({
        name:        name.trim(),
        designation: profileName,
        role: profileName,
        profileType: profileName,
        accountType: profileName,
        profileCategoryId: selectedProfile?.id || '',
        dob,
        email:       prefillEmail,
        pinCode,
        licBranch,
        password: trimmedPassword,
        newPassword: trimmedPassword,
        confirmPassword: trimmedPassword,
        password_confirmation: trimmedPassword,
      });

      await ensurePasswordLoginWorks({
        mobile: prefillMobile,
        email: prefillEmail,
        tempPassword,
        password: trimmedPassword,
      });

      const backendUser = res.data?.user || {};
      const userData = {
        ...backendUser,
        name: name.trim(),
        mobile: prefillMobile || backendUser.mobile,
        email: prefillEmail || backendUser.email,
        designation: profileName,
        role: profileName,
        profileType: profileName,
        profileCategoryId: selectedProfile?.id || '',
        dob,
        pinCode,
        licBranch,
        password: trimmedPassword,
      };
      await saveRegistrationPassword(prefillMobile, trimmedPassword);
      await login(userData, authToken);
      navigation.replace('Subscription', { fromRegistration: true });
    } catch (err) {
      Alert.alert(
        'Registration failed',
        getErrorMessage(err, 'Could not complete registration or set your login password. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>
        <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <Text style={styles.headerTitle}>Registration</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Full Name */}
          <FormField label="Full Name *" value={name} onChangeText={setName} icon="person" />

          {/* Profile type dropdown */}
          <TouchableOpacity style={styles.dropBtn} onPress={() => setDropOpen(true)}>
            <View style={styles.dropInner}>
              <Text style={styles.dropFloatLabel}>Profile Type *</Text>
              <Text style={[styles.dropValue, !designation && { color: Colors.textLight }]}>
                {designation || '-- Select --'}
              </Text>
            </View>
            {profileLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <MaterialIcons name="keyboard-arrow-down" size={22} color={Colors.textGray} />
            )}
          </TouchableOpacity>

          {/* DOB */}
          <FormField label="DOB * (DD-MM-YYYY)" value={dob} onChangeText={setDob} icon="cake" placeholder="DD-MM-YYYY" />

          {/* Mobile — prefilled */}
          <FormField label="Mobile" value={prefillMobile} icon="phone-iphone" editable={false} />

          {/* Email — prefilled */}
          <FormField label="E-mail" value={prefillEmail} icon="alternate-email" editable={false} />

          {/* Password */}
          <FormField
            label="Password *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            editable={!passwordLocked}
            rightIcon={passwordVisible ? 'visibility-off' : 'visibility'}
            onRightPress={() => setPasswordVisible((value) => !value)}
          />

          {/* Confirm Password */}
          <FormField
            label="Confirm Password *"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!confirmPasswordVisible}
            editable={!passwordLocked}
            rightIcon={confirmPasswordVisible ? 'visibility-off' : 'visibility'}
            onRightPress={() => setConfirmPasswordVisible((value) => !value)}
          />

          {/* Area Pin Code */}
          <FormField label="Area Pin Code *" value={pinCode} onChangeText={setPinCode} icon="location-on" keyboardType="number-pad" maxLength={6} />

          {/* LIC Branch No */}
          <FormField label="LIC Branch No *" value={licBranch} onChangeText={setLicBranch} icon="person-outline" keyboardType="number-pad" />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitText}>Submit</Text>
            }
          </TouchableOpacity>

        </ScrollView>

        {/* Profile type modal */}
        <Modal visible={dropOpen} transparent animationType="slide" onRequestClose={() => setDropOpen(false)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setDropOpen(false)} />
          <View style={styles.designationSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Profile Type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {profileOptions.map((profile) => (
                <TouchableOpacity
                  key={profile.id || profile.name}
                  style={[styles.designItem, designation === profile.name && styles.designItemActive]}
                  onPress={() => { setDesignation(profile.name); setDropOpen(false); }}
                >
                  <Text style={[styles.designText, designation === profile.name && styles.designTextActive]}>{profile.name}</Text>
                  {designation === profile.name && <MaterialIcons name="check" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: Colors.primary, paddingHorizontal: 16,
    paddingBottom: 14, elevation: 4,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },

  // Form field
  fieldWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 6,
    paddingHorizontal: 14, marginBottom: 14, position: 'relative',
    backgroundColor: '#fff',
  },
  fieldDisabled: { backgroundColor: '#FAFAFA', borderColor: '#DDD' },
  floatLabel: {
    position: 'absolute', top: -9, left: 10,
    backgroundColor: '#fff', paddingHorizontal: 4,
    fontSize: 11, color: Colors.primary, fontWeight: '600',
  },
  fieldInput: { flex: 1, fontSize: 15, color: Colors.textDark, paddingVertical: 12 },

  // Designation dropdown
  dropBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#CCC', borderRadius: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 14, backgroundColor: '#fff',
  },
  dropInner: { flex: 1 },
  dropFloatLabel: { fontSize: 10, color: Colors.textGray, marginBottom: 2 },
  dropValue: { fontSize: 15, color: Colors.textDark, fontWeight: '500' },

  submitBtn: {
    backgroundColor: '#27AE60', borderRadius: 6,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  designationSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 40, maxHeight: '75%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textDark, paddingHorizontal: 16, marginBottom: 8 },
  designItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  designItemActive: { backgroundColor: '#FFF0F0' },
  designText: { fontSize: 14, color: Colors.textDark, flex: 1 },
  designTextActive: { color: Colors.primary, fontWeight: '600' },
});

export default RegisterScreen;
