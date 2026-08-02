import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, Alert, Image, Modal, ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import Storage from '../services/storage';
import { getSubscriptionInfo } from '../services/appData';
import {
  checkMobileRegistration,
  loginUser,
  requestPasswordResetOtp,
  resetForgotPassword,
  sendOTP,
  verifyPasswordResetOtp,
  verifyOTP,
} from '../services/api';
import { buildRegistrationTempPassword } from '../services/authPassword';
import {
  getRegistrationPassword,
  saveRegistrationPassword,
} from '../services/localCredentials';

const { width } = Dimensions.get('window');
const LOGO = require('../assets/images/policybhandar_logo.png');

const STEP = {
  MOBILE: 'mobile',
  EMAIL: 'email',
  PASSWORD: 'password',
};

const AUTH_MODE = {
  LOGIN: 'login',
  SIGNUP: 'signup',
};

const RESET_PHASE = {
  OTP: 'otp',
  PASSWORD: 'password',
};

const USER_KEY = '@policybhandar_user';

const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.data?.error ||
  err?.data?.message ||
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  fallback;

const normalizeMobile = (value) => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const getLocalUserForMobile = async (mobile) => {
  try {
    const raw = await Storage.getItem(USER_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    const storedMobile = normalizeMobile(String(stored?.mobile || ''));
    return storedMobile === normalizeMobile(mobile) ? stored : null;
  } catch (_) {
    return null;
  }
};

const getPostLoginRoute = (user = {}) =>
  getSubscriptionInfo(user).active ? 'Home' : 'Subscription';

const isInvalidCredentialError = (err) => {
  const status = err?.response?.status;
  const message = getErrorMessage(err, '').toLowerCase();
  return status === 401 || message.includes('invalid credential');
};

const OTPSheet = ({
  visible, mobile, email, userId, signupPassword = '', onSuccess, onClose,
}) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSec, setResendSec] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    setOtp('');
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [visible]);

  const startTimer = () => {
    clearInterval(timerRef.current);
    setResendSec(30);
    setCanResend(false);
    timerRef.current = setInterval(() => {
      setResendSec((seconds) => {
        if (seconds <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  };

  const handleVerify = async () => {
    if (otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP received.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOTP(userId, otp);
      onSuccess(res.data);
    } catch (err) {
      Alert.alert('Wrong OTP', getErrorMessage(err, 'Invalid OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    try {
      await sendOTP(
        mobile,
        email,
        mobile,
        signupPassword || buildRegistrationTempPassword(mobile),
      );
      startTimer();
      Alert.alert('OTP Sent', 'A new OTP has been sent.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, 'Could not resend OTP.'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.otpBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.otpSheet}>
        <View style={styles.otpHandle} />
        <Text style={styles.otpInfo}>You will receive OTP on</Text>

        <View style={styles.otpIconRow}>
          <Ionicons name="logo-whatsapp" size={32} color="#25D366" />
          <Text style={styles.otpPlus}>+</Text>
          <MaterialIcons name="mail" size={32} color="#EA4335" />
          <Text style={styles.otpPlus}>+</Text>
          <MaterialIcons name="message" size={32} color={Colors.primary} />
        </View>

        <View style={styles.otpInputWrap}>
          <TextInput
            style={styles.otpInput}
            placeholder="OTP"
            placeholderTextColor={Colors.primary}
            keyboardType="number-pad"
            maxLength={6}
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, ''))}
          />
          <MaterialIcons name="dialpad" size={22} color={Colors.textGray} />
        </View>

        <TouchableOpacity onPress={handleResend} disabled={!canResend}>
          <Text style={[styles.resendText, canResend && styles.resendActive]}>
            {canResend ? 'Resend OTP' : `Resend OTP in ${resendSec}s`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.otpSubmitBtn, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.otpSubmitText}>Submit</Text>
          }
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const ForgotPasswordSheet = ({ visible, mobile, onSuccess, onClose }) => {
  const [phase, setPhase] = useState(RESET_PHASE.OTP);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendSec, setResendSec] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      clearInterval(timerRef.current);
      return undefined;
    }

    setPhase(RESET_PHASE.OTP);
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordVisible(false);
    setConfirmVisible(false);
    setResetUserId('');
    setResetToken('');
    handleRequestOtp(false);
    return () => clearInterval(timerRef.current);
  }, [visible, mobile]);

  const startTimer = () => {
    clearInterval(timerRef.current);
    setResendSec(30);
    setCanResend(false);
    timerRef.current = setInterval(() => {
      setResendSec((seconds) => {
        if (seconds <= 1) {
          clearInterval(timerRef.current);
          setCanResend(true);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async (showAlert = true) => {
    if (mobile.length !== 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit mobile number first.');
      onClose();
      return;
    }

    setLoading(true);
    try {
      const res = await requestPasswordResetOtp(mobile);
      setResetUserId(res.userId || '');
      setResetToken(res.resetToken || '');
      startTimer();
      if (showAlert) Alert.alert('OTP Sent', 'A new OTP has been sent to your mobile number.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, 'Could not send password reset OTP.'));
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (otp.length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP received on your mobile.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyPasswordResetOtp({
        mobile,
        userId: resetUserId,
        otp,
      });
      setResetUserId(res.userId || resetUserId);
      setResetToken(res.resetToken || resetToken);
      setPhase(RESET_PHASE.PASSWORD);
    } catch (err) {
      Alert.alert('Wrong OTP', getErrorMessage(err, 'Invalid OTP. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const nextPassword = newPassword.trim();
    const confirmPassword = confirmNewPassword.trim();
    if (nextPassword.length < 6) {
      Alert.alert('Invalid', 'New password must be at least 6 characters.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirm password should match.');
      return;
    }

    setLoading(true);
    try {
      await resetForgotPassword({
        mobile,
        userId: resetUserId,
        otp,
        resetToken,
        password: nextPassword,
      });
      await saveRegistrationPassword(mobile, nextPassword);
      Alert.alert('Password updated', 'Please login with your new password.');
      onSuccess(nextPassword);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, 'Could not update password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const title =
    phase === RESET_PHASE.PASSWORD ? 'Create New Password' : 'Forgot Password';
  const subtitle =
    phase === RESET_PHASE.PASSWORD
      ? 'Enter a new password for your POLICYBHANDAR account.'
      : `OTP will be sent to ${mobile || 'your mobile number'}.`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.otpBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.otpSheet}>
        <View style={styles.otpHandle} />
        <View style={styles.resetHeader}>
          <View>
            <Text style={styles.resetTitle}>{title}</Text>
            <Text style={styles.resetSubtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={loading}
          >
            <MaterialIcons name="close" size={24} color={Colors.textGray} />
          </TouchableOpacity>
        </View>

        {phase === RESET_PHASE.OTP ? (
          <>
            <View style={styles.otpInputWrap}>
              <TextInput
                style={styles.otpInput}
                placeholder="OTP"
                placeholderTextColor={Colors.primary}
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(value) => setOtp(value.replace(/\D/g, ''))}
                editable={!loading}
              />
              <MaterialIcons name="dialpad" size={22} color={Colors.textGray} />
            </View>

            <TouchableOpacity onPress={() => handleRequestOtp(true)} disabled={!canResend || loading}>
              <Text style={[styles.resendText, canResend && styles.resendActive]}>
                {canResend ? 'Resend OTP' : `Resend OTP in ${resendSec}s`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.otpSubmitBtn, loading && { opacity: 0.7 }]}
              onPress={handleVerifyResetOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.otpSubmitText}>Verify OTP</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.resetPasswordInput}>
              <TextInput
                style={styles.resetInput}
                placeholder="New password"
                placeholderTextColor={Colors.textGray}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible((value) => !value)}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons
                  name={passwordVisible ? 'visibility-off' : 'visibility'}
                  size={22}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.resetPasswordInput}>
              <TextInput
                style={styles.resetInput}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.textGray}
                secureTextEntry={!confirmVisible}
                autoCapitalize="none"
                autoCorrect={false}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setConfirmVisible((value) => !value)}
                disabled={loading}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons
                  name={confirmVisible ? 'visibility-off' : 'visibility'}
                  size={22}
                  color={Colors.primary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.otpSubmitBtn, loading && { opacity: 0.7 }]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.otpSubmitText}>Update Password</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
};

const LoginScreen = ({ navigation }) => {
  const [authMode, setAuthMode] = useState(AUTH_MODE.LOGIN);
  const [step, setStep] = useState(STEP.MOBILE);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const { loginWithToken } = useAuth();
  const isSignupMode = authMode === AUTH_MODE.SIGNUP;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslate = useRef(new Animated.Value(30)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const detailTranslate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      ]),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(formTranslate, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    if (step === STEP.MOBILE) {
      detailOpacity.setValue(0);
      detailTranslate.setValue(20);
      return;
    }

    Animated.parallel([
      Animated.timing(detailOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(detailTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [step]);

  const resetDetailStep = (nextMode = authMode) => {
    setStep(nextMode === AUTH_MODE.SIGNUP ? STEP.EMAIL : STEP.MOBILE);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUserId('');
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === authMode || loading) return;
    setAuthMode(nextMode);
    resetDetailStep(nextMode);
  };

  const handleMobileChange = (value) => {
    setMobile(normalizeMobile(value));
    if (!isSignupMode && step !== STEP.MOBILE) resetDetailStep();
  };

  const handleMobileSubmit = async () => {
    if (mobile.length !== 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const result = await checkMobileRegistration(mobile);
      if (result.exists) {
        setStep(STEP.PASSWORD);
      } else {
        setAuthMode(AUTH_MODE.SIGNUP);
        setStep(STEP.EMAIL);
      }
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err, 'Could not verify mobile number. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const getValidatedSignupPassword = () => {
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    if (!trimmedPassword) {
      Alert.alert('Required', 'Please create a password.');
      return '';
    }
    if (trimmedPassword.length < 6) {
      Alert.alert('Invalid', 'Password must be at least 6 characters.');
      return '';
    }
    if (trimmedPassword !== trimmedConfirmPassword) {
      Alert.alert('Mismatch', 'Password and confirm password should match.');
      return '';
    }
    return trimmedPassword;
  };

  const startSignupOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Invalid', 'Please enter a valid email address.');
      return;
    }

    const registrationPassword = getValidatedSignupPassword();
    if (!registrationPassword) return;

    setLoading(true);
    try {
      const res = await sendOTP(mobile, trimmedEmail, mobile, registrationPassword);
      const nextUserId = res.data?.userId || res.data?.user?._id || res.data?.id || '';

      if (!nextUserId) {
        Alert.alert('Error', 'Could not start OTP verification. Please try again.');
        return;
      }

      setEmail(trimmedEmail);
      await saveRegistrationPassword(mobile, registrationPassword);
      setUserId(nextUserId);
      setOtpVisible(true);
    } catch (err) {
      const message = getErrorMessage(err, 'Could not send OTP. Please try again.');
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('already registered') || lowerMessage.includes('already exist')) {
        setStep(STEP.PASSWORD);
        Alert.alert('Already registered', 'This mobile number already has an account. Please enter your password to login.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = () => startSignupOtp();

  const handleSignupSubmit = async () => {
    const trimmedEmail = email.trim();
    if (mobile.length !== 10) {
      Alert.alert('Invalid', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      Alert.alert('Invalid', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const result = await checkMobileRegistration(mobile);
      if (result.exists) {
        setAuthMode(AUTH_MODE.LOGIN);
        setStep(STEP.PASSWORD);
        Alert.alert('Already registered', 'This mobile number already has an account. Please enter your password to login.');
        return;
      }

      const registrationPassword = getValidatedSignupPassword();
      if (!registrationPassword) return;

      const res = await sendOTP(mobile, trimmedEmail, mobile, registrationPassword);
      const nextUserId = res.data?.userId || res.data?.user?._id || res.data?.id || '';

      if (!nextUserId) {
        Alert.alert('Error', 'Could not start OTP verification. Please try again.');
        return;
      }

      setEmail(trimmedEmail);
      await saveRegistrationPassword(mobile, registrationPassword);
      setUserId(nextUserId);
      setOtpVisible(true);
    } catch (err) {
      const message = getErrorMessage(err, 'Could not send OTP. Please try again.');
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('already registered') || lowerMessage.includes('already exist')) {
        setAuthMode(AUTH_MODE.LOGIN);
        setStep(STEP.PASSWORD);
        Alert.alert('Already registered', 'This mobile number already has an account. Please enter your password to login.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginUser(mobile, trimmedPassword);
      const token = res.data?.token;
      const user = res.data?.user || null;

      if (!token) {
        Alert.alert('Error', 'Login response did not include a session token.');
        return;
      }

      await loginWithToken(token, user);
      navigation.replace(getPostLoginRoute(user));
    } catch (err) {
      if (isInvalidCredentialError(err)) {
        const recovered = await tryLegacyLocalPasswordLogin(trimmedPassword);
        if (recovered) return;
      }

      Alert.alert('Login failed', getErrorMessage(err, 'Invalid mobile number or password.'));
    } finally {
      setLoading(false);
    }
  };

  const tryLegacyLocalPasswordLogin = async (enteredPassword) => {
    const localUser = await getLocalUserForMobile(mobile);
    const savedRegistrationPassword = await getRegistrationPassword(mobile);
    const localPassword = String(localUser?.password || savedRegistrationPassword || '').trim();
    if (!localPassword || localPassword !== enteredPassword) return false;

    try {
      const res = await loginUser(mobile, buildRegistrationTempPassword(mobile));
      const token = res.data?.token;
      const backendUser = res.data?.user || null;
      if (!token) return false;

      await loginWithToken(token, {
        ...backendUser,
        ...localUser,
        mobile,
        password: enteredPassword,
        backendPasswordPending: true,
      });
      navigation.replace(getPostLoginRoute({ ...backendUser, ...localUser }));
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleOTPSuccess = async (data) => {
    setOtpVisible(false);
    const token = data?.token;
    const user = data?.user || null;

    if (token) {
      await loginWithToken(token, user);
    }

    navigation.navigate('Register', { mobile, email, token, signupPassword: password.trim() });
  };

  const handleForgotPassword = () => {
    if (mobile.length !== 10) {
      Alert.alert('Invalid', 'Please enter your registered 10-digit mobile number first.');
      return;
    }
    setForgotVisible(true);
  };

  const handleForgotPasswordSuccess = (nextPassword) => {
    setForgotVisible(false);
    setAuthMode(AUTH_MODE.LOGIN);
    setStep(STEP.PASSWORD);
    setPassword(nextPassword);
    setPasswordVisible(false);
  };

  const handleSubmit = () => {
    if (isSignupMode) return handleSignupSubmit();
    if (step === STEP.PASSWORD) return handlePasswordSubmit();
    if (step === STEP.EMAIL) return handleEmailSubmit();
    return handleMobileSubmit();
  };

  const submitLabel =
    isSignupMode ? 'Send OTP' :
    step === STEP.PASSWORD ? 'Login' :
    step === STEP.EMAIL ? 'Send OTP' :
    'Submit';

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.topBar} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], alignItems: 'center', marginBottom: 40 }}>
            <View style={styles.logoClip}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.logoTitle}>POLICYBHANDAR</Text>
          </Animated.View>

          <Animated.View style={[styles.form, { opacity: formOpacity, transform: [{ translateY: formTranslate }] }]}>
            <View style={styles.modeSwitch}>
              <TouchableOpacity
                style={[styles.modeTab, authMode === AUTH_MODE.LOGIN && styles.modeTabActive]}
                onPress={() => handleModeChange(AUTH_MODE.LOGIN)}
                activeOpacity={0.85}
                disabled={loading}
              >
                <MaterialIcons
                  name="login"
                  size={17}
                  color={authMode === AUTH_MODE.LOGIN ? Colors.white : Colors.primary}
                />
                <Text style={[styles.modeText, authMode === AUTH_MODE.LOGIN && styles.modeTextActive]}>
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, authMode === AUTH_MODE.SIGNUP && styles.modeTabActive]}
                onPress={() => handleModeChange(AUTH_MODE.SIGNUP)}
                activeOpacity={0.85}
                disabled={loading}
              >
                <MaterialIcons
                  name="person-add-alt-1"
                  size={17}
                  color={authMode === AUTH_MODE.SIGNUP ? Colors.white : Colors.primary}
                />
                <Text style={[styles.modeText, authMode === AUTH_MODE.SIGNUP && styles.modeTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputWrap, step !== STEP.MOBILE && styles.inputFilled]}>
              <Text style={styles.floatLabel}>Mobile</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={handleMobileChange}
                editable={!loading}
              />
              <MaterialIcons name="phone-iphone" size={22} color={Colors.primary} />
            </View>

            {(step === STEP.EMAIL || isSignupMode) && (
              <Animated.View style={[
                styles.inputWrap,
                styles.inputWrapGray,
                { opacity: detailOpacity, transform: [{ translateY: detailTranslate }] },
              ]}>
                <Text style={styles.floatLabelGray}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  autoFocus
                  editable={!loading}
                />
                <Text style={styles.atIcon}>@</Text>
              </Animated.View>
            )}

            {isSignupMode && (
              <Animated.View style={[
                styles.inputWrap,
                styles.inputWrapGray,
                { opacity: detailOpacity, transform: [{ translateY: detailTranslate }] },
              ]}>
                <Text style={styles.floatLabelGray}>Create Password</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  disabled={loading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={passwordVisible ? 'visibility-off' : 'visibility'}
                    size={22}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}

            {isSignupMode && (
              <Animated.View style={[
                styles.inputWrap,
                styles.inputWrapGray,
                { opacity: detailOpacity, transform: [{ translateY: detailTranslate }] },
              ]}>
                <Text style={styles.floatLabelGray}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry={!confirmPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setConfirmPasswordVisible((visible) => !visible)}
                  disabled={loading}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={confirmPasswordVisible ? 'visibility-off' : 'visibility'}
                    size={22}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}

            {step === STEP.PASSWORD && (
              <Animated.View style={{ opacity: detailOpacity, transform: [{ translateY: detailTranslate }] }}>
                <View style={[
                  styles.inputWrap,
                  styles.inputWrapGray,
                  styles.passwordInputWrap,
                ]}>
                  <Text style={styles.floatLabelGray}>Password</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    autoFocus
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    disabled={loading}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons
                      name={passwordVisible ? 'visibility-off' : 'visibility'}
                      size={22}
                      color={Colors.primary}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.forgotBtn}
                  onPress={handleForgotPassword}
                  disabled={loading}
                  activeOpacity={0.75}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{submitLabel}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.privacyBtn} onPress={() => navigation.navigate('Privacy')}>
              <MaterialIcons name="info-outline" size={16} color={Colors.textGray} />
              <Text style={styles.privacyText}>Privacy & Policy</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar} />

      <OTPSheet
        visible={otpVisible}
        mobile={mobile}
        email={email}
        userId={userId}
        signupPassword={password.trim()}
        onSuccess={handleOTPSuccess}
        onClose={() => setOtpVisible(false)}
      />

      <ForgotPasswordSheet
        visible={forgotVisible}
        mobile={mobile}
        onSuccess={handleForgotPasswordSuccess}
        onClose={() => setForgotVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: { height: 8, backgroundColor: Colors.primary },
  bottomBar: { height: 8, backgroundColor: Colors.primary },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  logoClip: {
    alignItems: 'center',
    height: width * 0.36,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    width: width * 0.58,
  },
  logo: { width: width * 0.58, height: width * 0.58 },
  logoTitle: {
    color: '#2C2C2C',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 6,
  },
  form: { width: '100%' },

  modeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#FFF4F2',
    borderColor: '#F0C8C2',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 18,
    padding: 4,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 42,
  },
  modeTabActive: {
    backgroundColor: Colors.primary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  modeText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  modeTextActive: {
    color: Colors.white,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 14,
    marginBottom: 16,
    position: 'relative',
    backgroundColor: '#fff',
  },
  inputFilled: { borderColor: Colors.primary },
  inputWrapGray: { borderColor: '#CCC' },
  passwordInputWrap: { marginBottom: 8 },
  floatLabel: {
    position: 'absolute',
    top: -9,
    left: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  floatLabelGray: {
    position: 'absolute',
    top: -9,
    left: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    fontSize: 11,
    color: Colors.textGray,
    fontWeight: '600',
  },
  input: { flex: 1, fontSize: 15, color: Colors.textDark, paddingVertical: 13 },
  atIcon: { fontSize: 20, fontWeight: '700', color: Colors.primary },

  submitBtn: {
    backgroundColor: '#27AE60',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  privacyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  privacyText: { fontSize: 13, color: Colors.textGray },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },

  otpBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  otpSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
  },
  otpHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 18,
  },
  otpInfo: {
    fontSize: 15,
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 14,
    fontWeight: '500',
  },
  otpIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  otpPlus: { fontSize: 18, color: Colors.textGray, fontWeight: '700' },
  otpInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  otpInput: {
    flex: 1,
    fontSize: 20,
    color: Colors.primary,
    paddingVertical: 13,
    letterSpacing: 6,
    fontWeight: '700',
  },
  resendText: {
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'right',
    marginBottom: 16,
  },
  resendActive: { color: Colors.primary, fontWeight: '700' },
  otpSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
  },
  otpSubmitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  resetTitle: {
    color: Colors.textDark,
    fontSize: 20,
    fontWeight: '900',
  },
  resetSubtitle: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  resetPasswordInput: {
    alignItems: 'center',
    borderColor: '#DDD',
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  resetInput: {
    color: Colors.textDark,
    flex: 1,
    fontSize: 15,
    paddingVertical: 13,
  },
});

export default LoginScreen;
