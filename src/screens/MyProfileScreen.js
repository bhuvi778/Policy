import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  NativeModules,
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
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { changePassword, updateProfile } from '../services/api';
import {
  BRAND,
  getAdvisorDisplayName,
  getAssignedFranchise,
  getAssignedRep,
  getSubscriptionInfo,
  loadAppSettings,
  loadClients,
  pickFirst,
} from '../services/appData';
import { getProfileImageUrl } from '../components/ProfileFooterPreview';

const { PolicyBhandarProfileImagePicker } = NativeModules;

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <MaterialIcons name={icon} size={20} color={Colors.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Not available'}</Text>
    </View>
  </View>
);

const EditField = ({
  icon,
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  secureTextEntry = false,
  rightIcon,
  onRightPress,
}) => (
  <View style={styles.editFieldContainer}>
    <View style={styles.infoIcon}>
      <MaterialIcons name={icon} size={20} color={Colors.primary} />
    </View>
    <View style={styles.editFieldContent}>
      <Text style={styles.editFieldLabel}>{label}</Text>
      <TextInput
        style={styles.editFieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType || 'default'}
        placeholder={placeholder || `Enter ${label}`}
        placeholderTextColor="#999"
        secureTextEntry={secureTextEntry}
      />
      {rightIcon ? (
        <TouchableOpacity style={styles.inputIconBtn} onPress={onRightPress}>
          <MaterialIcons name={rightIcon} size={21} color={Colors.textGray} />
        </TouchableOpacity>
      ) : null}
    </View>
  </View>
);

const StatCard = ({ icon, label, value, color }) => (
  <View style={[styles.statCard, { borderTopColor: color }]}>
    <MaterialIcons name={icon} size={26} color={color} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const EmptyAssignment = ({ label }) => (
  <View style={styles.emptyAssignment}>
    <MaterialIcons name="info-outline" size={18} color={Colors.textLight} />
    <Text style={styles.emptyAssignmentText}>{label} will appear here after backend assignment.</Text>
  </View>
);

const MyProfileScreen = ({ navigation }) => {
  const { user: authUser = {}, token, login, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [licBranch, setLicBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [settings, setSettings] = useState({ brandName: BRAND.name, supportEmail: BRAND.email });
  const [clientStats, setClientStats] = useState({ clients: 0, policies: 0 });
  const logoutTimerRef = useRef(null);

  const displayName = getAdvisorDisplayName(authUser).toUpperCase();
  const designationText = pickFirst(authUser.designation, authUser.role, 'Insurance Advisor');
  const savedProfileImage = getProfileImageUrl(authUser);
  const profileImageUri = profileImage?.uri || savedProfileImage;
  const subscription = getSubscriptionInfo(authUser);
  const franchise = getAssignedFranchise(authUser);
  const rep = getAssignedRep(authUser);

  useEffect(() => {
    setName(authUser.name || '');
    setDesignation(authUser.designation || '');
    setEmail(authUser.email || '');
    setDob(authUser.dob || '');
    setPinCode(authUser.pinCode || '');
    setLicBranch(authUser.licBranch || '');
    if (!isEditing) setProfileImage(null);
  }, [authUser, isEditing]);

  useEffect(() => {
    let active = true;
    loadAppSettings().then((next) => active && setSettings(next));
    loadClients().then((clients) => {
      if (!active) return;
      setClientStats({
        clients: clients.length,
        policies: clients.filter((client) => client.policyNo).length,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
  }, []);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your Full Name.');
      return;
    }
    setLoading(true);
    try {
      const imagePayload = profileImage?.uri ? {
        profileImage,
      } : {};
      const res = await updateProfile({
        name: name.trim(),
        designation: designation.trim(),
        email: email.trim(),
        dob: dob.trim(),
        pinCode: pinCode.trim(),
        licBranch: licBranch.trim(),
        ...imagePayload,
      });
      const updatedUser =
        res.data?.user ||
        (res.data?.success && typeof res.data.success === 'object' ? res.data.success : null) ||
        (res.data?.name || res.data?.mobile ? res.data : null);
      const optimisticImage = profileImage?.uri || '';
      if (updatedUser) {
        const nextUser = { ...authUser, ...updatedUser };
        if (optimisticImage && !getProfileImageUrl(updatedUser)) {
          nextUser.profileImage = optimisticImage;
        }
        await login(nextUser, token);
        setIsEditing(false);
        setProfileImage(null);
        Alert.alert('Success', 'Profile updated successfully.');
      } else {
        await login({
          ...authUser,
          name: name.trim(),
          designation: designation.trim(),
          email: email.trim(),
          dob: dob.trim(),
          pinCode: pinCode.trim(),
          licBranch: licBranch.trim(),
          ...(optimisticImage ? { profileImage: optimisticImage } : {}),
        }, token);
        setIsEditing(false);
        setProfileImage(null);
        Alert.alert('Success', res.data?.message || 'Profile updated successfully.');
      }
    } catch (err) {
      const errMsg = err.data?.error || err.data?.message || err.message || 'Something went wrong.';
      Alert.alert('Error', errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handlePickProfileImage = async () => {
    if (!PolicyBhandarProfileImagePicker?.pickImage) {
      Alert.alert('Unavailable', 'Profile image picker is not available in this build.');
      return;
    }

    try {
      const image = await PolicyBhandarProfileImagePicker.pickImage();
      if (image?.uri) {
        setProfileImage({
          uri: image.uri,
          name: image.name || `profile-${Date.now()}.jpg`,
          type: image.type || 'image/jpeg',
        });
      }
    } catch (error) {
      Alert.alert('Image selection failed', error?.message || 'Unable to select profile image.');
    }
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    logoutTimerRef.current = setTimeout(() => {
      logoutTimerRef.current = null;
      logout().then(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }).finally(() => {
        setLogoutLoading(false);
      });
    }, 80);
  };

  const handleChangePassword = async () => {
    const oldPass = currentPassword.trim();
    const nextPass = newPassword.trim();
    const confirmPass = confirmPassword.trim();

    if (!oldPass) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    if (nextPass.length < 6) {
      Alert.alert('Invalid', 'New password must be at least 6 characters.');
      return;
    }
    if (nextPass !== confirmPass) {
      Alert.alert('Mismatch', 'New password and confirm password should match.');
      return;
    }
    if (oldPass === nextPass) {
      Alert.alert('Invalid', 'New password should be different from current password.');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword({
        currentPassword: oldPass,
        oldPassword: oldPass,
        password: oldPass,
        newPassword: nextPass,
        confirmPassword: confirmPass,
        password_confirmation: confirmPass,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully.');
    } catch (err) {
      const errMsg = err.data?.error || err.data?.message || err.message || 'Unable to change password right now.';
      Alert.alert('Password change failed', errMsg);
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (isEditing ? setIsEditing(false) : navigation.goBack())}
          style={styles.backBtn}
        >
          <MaterialIcons name={isEditing ? 'close' : 'arrow-back'} size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Profile' : 'My Profile'}</Text>
        {loading ? (
          <ActivityIndicator color="#fff" style={{ padding: 6 }} />
        ) : (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={isEditing ? handleSaveProfile : () => setIsEditing(true)}
          >
            <MaterialIcons name={isEditing ? 'check' : 'edit'} size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={isEditing ? handlePickProfileImage : undefined}
            activeOpacity={isEditing ? 0.82 : 1}
          >
            {profileImageUri ? (
              <Image source={{ uri: profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <MaterialIcons name="person" size={60} color={Colors.primary} />
            )}
            {isEditing ? (
              <View style={styles.avatarEditBadge}>
                <MaterialIcons name="photo-camera" size={15} color="#fff" />
              </View>
            ) : null}
          </TouchableOpacity>
          {isEditing ? (
            <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickProfileImage} activeOpacity={0.85}>
              <MaterialIcons name="image" size={15} color="#fff" />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.userName}>{isEditing ? (name || displayName).toUpperCase() : displayName}</Text>
          <Text style={styles.userRole}>{isEditing ? designation || designationText : designationText}</Text>
          <View style={styles.planPill}>
            <MaterialIcons name={subscription.active ? 'verified' : 'card-membership'} size={14} color="#fff" />
            <Text style={styles.planPillText}>{subscription.name}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon="people" label="Clients" value={String(clientStats.clients)} color={Colors.primary} />
          <StatCard icon="security" label="Policies" value={String(clientStats.policies)} color="#27AE60" />
          <StatCard icon="workspace-premium" label="Plan" value={subscription.active ? 'Active' : 'None'} color="#F39C12" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          {isEditing ? (
            <>
              <EditField icon="person" label="Full Name" value={name} onChangeText={setName} />
              <EditField icon="work" label="Designation" value={designation} onChangeText={setDesignation} />
              <EditField icon="email" label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
              <EditField icon="cake" label="Date of Birth" value={dob} onChangeText={setDob} placeholder="DD-MM-YYYY" />
              <EditField icon="pin-drop" label="Pin Code" value={pinCode} onChangeText={setPinCode} keyboardType="number-pad" />
              <EditField icon="home-work" label="LIC Branch" value={licBranch} onChangeText={setLicBranch} />
            </>
          ) : (
            <>
              <InfoRow icon="person" label="Full Name" value={displayName} />
              <InfoRow icon="work" label="Designation" value={designationText} />
              <InfoRow icon="business" label="Company" value={settings.brandName || BRAND.name} />
              <InfoRow icon="phone" label="Mobile" value={authUser.mobile} />
              <InfoRow icon="email" label="Email" value={authUser.email || settings.supportEmail} />
              {authUser.dob ? <InfoRow icon="cake" label="Date of Birth" value={authUser.dob} /> : null}
              {authUser.pinCode ? <InfoRow icon="pin-drop" label="Pin Code" value={authUser.pinCode} /> : null}
              {authUser.licBranch ? <InfoRow icon="home-work" label="LIC Branch" value={authUser.licBranch} /> : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Password</Text>
          <EditField
            icon="lock"
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrentPassword}
            rightIcon={showCurrentPassword ? 'visibility-off' : 'visibility'}
            onRightPress={() => setShowCurrentPassword((value) => !value)}
          />
          <EditField
            icon="vpn-key"
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            rightIcon={showNewPassword ? 'visibility-off' : 'visibility'}
            onRightPress={() => setShowNewPassword((value) => !value)}
          />
          <EditField
            icon="verified-user"
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            rightIcon={showConfirmPassword ? 'visibility-off' : 'visibility'}
            onRightPress={() => setShowConfirmPassword((value) => !value)}
          />
          <TouchableOpacity
            style={[styles.passwordBtn, passwordLoading && { opacity: 0.7 }]}
            onPress={handleChangePassword}
            disabled={passwordLoading}
            activeOpacity={0.85}
          >
            {passwordLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="lock-reset" size={19} color="#fff" />
                <Text style={styles.passwordBtnText}>Change Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Franchise Details</Text>
          {franchise.name || franchise.phone ? (
            <>
              <InfoRow icon="store" label="Franchise Name" value={franchise.name} />
              <InfoRow icon="phone" label="Franchise Phone" value={franchise.phone} />
            </>
          ) : (
            <EmptyAssignment label="Franchise details" />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Representative</Text>
          {rep.name || rep.phone ? (
            <>
              <InfoRow icon="person-pin" label="Rep Name" value={rep.name} />
              <InfoRow icon="phone" label="Rep Phone" value={rep.phone} />
            </>
          ) : (
            <EmptyAssignment label="Company representative details" />
          )}
        </View>

        <View style={[styles.section, styles.membershipCard]}>
          <View style={styles.membershipHeader}>
            <MaterialIcons name="card-membership" size={22} color="#F39C12" />
            <Text style={styles.membershipTitle}>Membership Status</Text>
          </View>
          <View style={styles.membershipRow}>
            <Text style={styles.membershipLabel}>Plan</Text>
            <Text style={styles.membershipValue}>{subscription.name}</Text>
          </View>
          {subscription.active && subscription.validTill ? (
            <View style={styles.membershipRow}>
              <Text style={styles.membershipLabel}>Valid Till</Text>
              <Text style={styles.membershipValue}>{subscription.validTill}</Text>
            </View>
          ) : null}
          {!subscription.active ? (
            <Text style={styles.membershipNote}>No active subscription is linked to this account yet.</Text>
          ) : null}
          <TouchableOpacity style={styles.renewBtn} onPress={() => navigation.navigate('Subscription')}>
            <Text style={styles.renewText}>{subscription.active ? 'Manage Plan' : 'Choose Plan'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, logoutLoading && { opacity: 0.75 }]}
          onPress={handleLogout}
          disabled={logoutLoading}
        >
          {logoutLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="logout" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 6 : 10,
    elevation: 4,
  },
  backBtn: { padding: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 },
  content: { paddingBottom: 30 },
  avatarSection: { backgroundColor: Colors.primary, alignItems: 'center', paddingBottom: 28, paddingTop: 8 },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    marginBottom: 10,
    overflow: 'hidden',
  },
  avatarImage: { height: '100%', width: '100%' },
  avatarEditBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderColor: '#fff',
    borderRadius: 14,
    borderWidth: 2,
    bottom: 4,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 28,
  },
  changePhotoBtn: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  changePhotoText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  userName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  userRole: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 8,
  },
  planPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4, borderTopWidth: 3, elevation: 2 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: Colors.textGray, textAlign: 'center' },
  section: { backgroundColor: '#fff', marginHorizontal: 14, marginBottom: 12, borderRadius: 12, elevation: 1, overflow: 'hidden' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textGray,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F8F8F8', gap: 12 },
  infoIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: Colors.textGray },
  infoValue: { fontSize: 14, color: Colors.textDark, fontWeight: '500', marginTop: 1 },
  editFieldContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8F8F8', gap: 12 },
  editFieldContent: { flex: 1 },
  editFieldLabel: { fontSize: 11, color: Colors.textGray },
  editFieldInput: { fontSize: 14, color: Colors.textDark, fontWeight: '500', marginTop: 2, paddingVertical: 4, paddingRight: 34, borderBottomWidth: 1, borderBottomColor: Colors.primary },
  inputIconBtn: { position: 'absolute', right: 0, bottom: 7, padding: 4 },
  passwordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 14, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12 },
  passwordBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyAssignment: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16 },
  emptyAssignmentText: { flex: 1, color: Colors.textGray, fontSize: 13, lineHeight: 18 },
  membershipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  membershipTitle: { fontSize: 14, fontWeight: '700', color: Colors.textDark },
  membershipRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F8F8F8' },
  membershipLabel: { fontSize: 13, color: Colors.textGray },
  membershipValue: { fontSize: 13, fontWeight: '600', color: Colors.textDark },
  membershipNote: { color: Colors.textGray, fontSize: 12, lineHeight: 18, paddingHorizontal: 16, paddingTop: 10 },
  renewBtn: { margin: 14, backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  renewText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 14, marginBottom: 30, marginTop: 4, backgroundColor: '#E74C3C', borderRadius: 10, paddingVertical: 13 },
  logoutText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default MyProfileScreen;
