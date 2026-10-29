import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getProfileImageUrl } from '../utils/profileAssets';
import { normalizeProfileFields } from '../utils/profileFields';
import { restoreProfileSupplement, persistProfileSupplement } from '../services/profileSupplement';
import { queueProfileUpdate, syncQueuedProfile } from '../services/profileSync';
import { AppState } from 'react-native';
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

export const extractUserData = (payload) => {
  if (!isObject(payload)) return null;

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

  for (const nested of [payload.user, payload.profile, payload.advisor, payload.employee,
    payload.customer, payload.member, payload.account, payload.success, payload.data]) {
    const extracted = extractUserData(nested);
    if (extracted) return extracted;
  }

  return null;
};

export const mergeUserData = (previous, next) => {
  if (!previous) return next;
  if (!next) return previous;

  const merged = { ...previous, ...next, ...(previous._pendingProfilePatch || {}) };
  const freshImage = getProfileImageUrl(next);
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
  if (freshImage && !previous._pendingProfilePatch?.profileImage) merged.profileImage = freshImage;

  if (!isDisplayName(merged.name) && isDisplayName(previous.name)) {
    merged.name = previous.name;
  }

  return normalizeProfileFields(merged);
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
  const userRef = useRef(user);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  userRef.current = user;
  const profileRequestRef = useRef(null);
  const lastProfileRefreshRef = useRef(0);

  useEffect(() => {
    loadSession();
  }, []);

  const refreshProfileInBackground = useCallback(async (previousUser = null, epoch = authEpochRef.current, options = {}) => {
    try {
      const queued = previousUser ? await syncQueuedProfile(previousUser, {
        token: tokenRef.current, extractUser: extractUserData, isCurrent: () => epoch === authEpochRef.current, force: !!options.force,
      }) : null;
      if (epoch !== authEpochRef.current) return;
      if (queued?.user) {
        setUser(queued.user);
        userRef.current = queued.user;
        await Storage.setItem(USER_KEY, JSON.stringify(queued.user));
        return queued.user;
      }
      const profileRes = await getProfile({ timeout: 6000 });
      if (epoch !== authEpochRef.current) return;
      const userData = extractUserData(profileRes.data);
      if (userData) {
        const mergedUser = mergeUserData(previousUser, userData);
        if (epoch !== authEpochRef.current) return;
        setUser((current) => JSON.stringify(current) === JSON.stringify(mergedUser) ? current : mergedUser);
        lastProfileRefreshRef.current = Date.now();
        await Storage.setItem(USER_KEY, JSON.stringify(mergedUser));
        return mergedUser;
      }
    } catch (err) {
      console.log('Failed to fetch fresh user profile from backend:', err.message);
    }
    return null;
  }, []);

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
      const parsedStoredUser = storedUser ? await restoreProfileSupplement(JSON.parse(storedUser)) : null;
      if (parsedStoredUser) setUser(parsedStoredUser);
      if (storedToken) {
        tokenRef.current = storedToken;
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
      tokenRef.current = authToken;
      setAuthToken(authToken);
      const normalizedUser = userData ? await restoreProfileSupplement(extractUserData(userData) || userData) : null;
      if (normalizedUser) {
        await Storage.setItem(USER_KEY, JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      }

      refreshProfileInBackground(normalizedUser, epoch, { force: true });
    } catch (_) {}
  };

  // Called after registration
  const login = async (userData, authToken) => {
    try {
      const epoch = authEpochRef.current + 1;
      authEpochRef.current = epoch;
      const normalizedUser = await restoreProfileSupplement(extractUserData(userData) || userData);
      await persistProfileSupplement(normalizedUser);
      await Storage.removeItem(FORCE_LOGOUT_KEY);
      await Storage.setItem(USER_KEY,  JSON.stringify(normalizedUser));
      await Storage.setItem(TOKEN_KEY, authToken || '');
      setUser(normalizedUser);
      setToken(authToken);
      tokenRef.current = authToken;
      setAuthToken(authToken);
      refreshProfileInBackground(normalizedUser, epoch, { force: true });
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
    tokenRef.current = null;
    setLogoutVersion((value) => value + 1);
    try {
      await Storage.setItem(FORCE_LOGOUT_KEY, 'true');
      await clearAuthStorage();
    } catch (err) {
      console.log('Logout cleanup failed:', err.message);
    }
  };

  const refreshProfile = useCallback(async (options = {}) => {
    if (!token) return;
    const epoch = authEpochRef.current;
    if (profileRequestRef.current?.epoch === epoch) return profileRequestRef.current.promise;
    if (!options.force && Date.now() - lastProfileRefreshRef.current < 30000) return userRef.current;
    const promise = refreshProfileInBackground(userRef.current, epoch, options);
    profileRequestRef.current = { epoch, promise };
    try { return await promise; }
    finally { if (profileRequestRef.current?.promise === promise) profileRequestRef.current = null; }
  }, [token, refreshProfileInBackground]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshProfile();
    });
    return () => listener.remove();
  }, [refreshProfile]);

  const saveProfileChanges = async (changes) => {
    const local = await queueProfileUpdate(userRef.current, changes);
    await login(local, tokenRef.current);
    return local;
  };

  const markOnboardingDone = async () => {
    await Storage.setItem(ONBOARD_KEY, 'true');
    setOnboardingDone(true);
  };

  return (
    <AuthContext.Provider value={{
      user, token, authLoading, onboardingDone,
      logoutVersion,
      login, loginWithToken, register, checkMobile, logout, markOnboardingDone, refreshProfile, saveProfileChanges,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
