import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import Storage from '../services/storage';
import { setAuthToken, getProfile } from '../services/api';

const AuthContext = createContext(null);

const USER_KEY       = '@policybhandar_user';
const TOKEN_KEY      = '@policybhandar_token';
const ONBOARD_KEY    = '@policybhandar_onboarding_done';
const FORCE_LOGOUT_KEY = '@policybhandar_force_logged_out';
const LEGACY_AUTH_KEYS = [
  '@bimagyan_user',
  '@bimagyan_token',
  '@bimgyan_user',
  '@bimgyan_token',
];
const LOGOUT_KEYS = [USER_KEY, TOKEN_KEY, ...LEGACY_AUTH_KEYS];

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const isDisplayName = (value = '') => {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  return (
    !!text &&
    !/^\+?\d[\d\s-]{7,}$/.test(text) &&
    !['user', 'advisor', 'agent', 'member', 'insurance advisor'].includes(lower)
  );
};

const extractUserData = (payload) => {
  if (!isObject(payload)) return null;

  const direct = [
    payload.user,
    payload.profile,
    payload.advisor,
    payload.employee,
    payload.customer,
    payload.member,
    payload.account,
  ].find(isObject);
  if (direct) return extractUserData(direct) || direct;

  if (isObject(payload.success)) return extractUserData(payload.success) || payload.success;
  if (isObject(payload.data)) return extractUserData(payload.data) || payload.data;

  if (
    payload.name ||
    payload.fullName ||
    payload.full_name ||
    payload.mobile ||
    payload.email ||
    payload.designation ||
    payload.activePlan ||
    payload.planId ||
    payload.subscription ||
    payload.currentPlan ||
    payload.profileImage ||
    payload.profileImageUrl ||
    payload.profilePhoto ||
    payload.profilePhotoUrl ||
    payload.profilePicture ||
    payload.profilePictureUrl ||
    payload.profilePic ||
    payload.profile_pic ||
    payload.avatar ||
    payload.avatarUrl ||
    payload.photo ||
    payload.photoUrl ||
    payload.image ||
    payload.imageUrl
  ) {
    return payload;
  }

  return null;
};

const mergeUserData = (previous, next) => {
  if (!previous) return next;
  if (!next) return previous;

  const merged = { ...previous, ...next };
  const keepPreviousWhenNextIsBlank = [
    'name',
    'fullName',
    'full_name',
    'mobile',
    'email',
    'designation',
    'dob',
    'pinCode',
    'licBranch',
    'profileImage',
    'profileImageUrl',
    'profilePhoto',
    'profilePhotoUrl',
    'profilePicture',
    'profilePictureUrl',
    'profilePic',
    'profile_pic',
    'avatar',
    'avatarUrl',
    'photo',
    'photoUrl',
    'image',
    'imageUrl',
  ];

  keepPreviousWhenNextIsBlank.forEach((key) => {
    if (!String(next[key] || '').trim() && previous[key]) {
      merged[key] = previous[key];
    }
  });

  if (!isDisplayName(merged.name) && isDisplayName(previous.name)) {
    merged.name = previous.name;
  }

  return merged;
};

const clearAuthStorage = async () => {
  await Storage.multiRemove(LOGOUT_KEYS);
  await Promise.all(LOGOUT_KEYS.map((key) => Storage.removeItem(key)));
};

export const AuthProvider = ({ children }) => {
  const [user,           setUser]           = useState(null);
  const [token,          setToken]          = useState(null);
  const [authLoading,    setAuthLoading]    = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [logoutVersion,  setLogoutVersion]  = useState(0);
  const authEpochRef = useRef(0);

  useEffect(() => {
    loadSession();
  }, []);

  const refreshProfileInBackground = async (previousUser = null, epoch = authEpochRef.current) => {
    try {
      const profileRes = await getProfile({ timeout: 6000 });
      if (epoch !== authEpochRef.current) return;
      const userData = extractUserData(profileRes.data);
      if (userData) {
        const mergedUser = mergeUserData(previousUser, userData);
        if (epoch !== authEpochRef.current) return;
        setUser(mergedUser);
        await Storage.setItem(USER_KEY, JSON.stringify(mergedUser));
        return mergedUser;
      }
    } catch (err) {
      console.log('Failed to fetch fresh user profile from backend:', err.message);
    }
    return null;
  };

  const loadSession = async () => {
    try {
      const [forceLoggedOut, storedUser, storedToken, storedOnboard] = await Promise.all([
        Storage.getItem(FORCE_LOGOUT_KEY),
        Storage.getItem(USER_KEY),
        Storage.getItem(TOKEN_KEY),
        Storage.getItem(ONBOARD_KEY),
      ]);
      if (forceLoggedOut === 'true') {
        await clearAuthStorage();
        setAuthToken(null);
        setToken(null);
        setUser(null);
        if (storedOnboard === 'true') setOnboardingDone(true);
        return;
      }
      const parsedStoredUser = storedUser ? JSON.parse(storedUser) : null;
      if (parsedStoredUser) setUser(parsedStoredUser);
      if (storedToken) {
        const epoch = authEpochRef.current;
        setToken(storedToken);
        setAuthToken(storedToken);
        refreshProfileInBackground(parsedStoredUser, epoch);
      }
      if (storedOnboard === 'true') setOnboardingDone(true);
    } catch (_) {}
    finally { setAuthLoading(false); }
  };

  // Called after OTP verify — save token immediately
  const loginWithToken = async (authToken, userData = null) => {
    try {
      const epoch = authEpochRef.current + 1;
      authEpochRef.current = epoch;
      await Storage.removeItem(FORCE_LOGOUT_KEY);
      await Storage.setItem(TOKEN_KEY, authToken);
      setToken(authToken);
      setAuthToken(authToken);
      const normalizedUser = extractUserData(userData) || userData;
      if (normalizedUser) {
        await Storage.setItem(USER_KEY, JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      }

      refreshProfileInBackground(normalizedUser, epoch);
    } catch (_) {}
  };

  // Called after registration
  const login = async (userData, authToken) => {
    try {
      const epoch = authEpochRef.current + 1;
      authEpochRef.current = epoch;
      const normalizedUser = extractUserData(userData) || userData;
      await Storage.removeItem(FORCE_LOGOUT_KEY);
      await Storage.setItem(USER_KEY,  JSON.stringify(normalizedUser));
      await Storage.setItem(TOKEN_KEY, authToken || '');
      setUser(normalizedUser);
      setToken(authToken);
      setAuthToken(authToken);
      refreshProfileInBackground(normalizedUser, epoch);
    } catch (_) {}
  };

  // Legacy register (local only) — kept for backward compat
  const register = async (
    name,
    mobile,
    dob = '',
    memberType = 'Head',
    designation = '',
    password = ''
  ) => {
    const userData = { name, mobile, dob, memberType, designation, password };
    await login(userData, token || '');
  };

  const checkMobile = async (mobile) => {
    try {
      const stored = await Storage.getItem(USER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.mobile === mobile) { setUser(parsed); return parsed; }
      }
    } catch (_) {}
    return null;
  };

  const logout = async () => {
    authEpochRef.current += 1;
    setAuthToken(null);
    setUser(null);
    setToken(null);
    setLogoutVersion((value) => value + 1);
    try {
      await Storage.setItem(FORCE_LOGOUT_KEY, 'true');
      await clearAuthStorage();
    } catch (err) {
      console.log('Logout cleanup failed:', err.message);
    }
  };

  const refreshProfile = async () => {
    if (!token) return;
    return refreshProfileInBackground(user, authEpochRef.current);
  };

  const markOnboardingDone = async () => {
    await Storage.setItem(ONBOARD_KEY, 'true');
    setOnboardingDone(true);
  };

  return (
    <AuthContext.Provider value={{
      user, token, authLoading, onboardingDone,
      logoutVersion,
      login, loginWithToken, register, checkMobile, logout, markOnboardingDone, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
