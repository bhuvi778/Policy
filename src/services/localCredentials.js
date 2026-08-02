import Storage from './storage';

const PASSWORDS_KEY = '@policybhandar_registration_passwords_v1';

const normalizeMobile = (value = '') => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

const readPasswordMap = async () => {
  try {
    const raw = await Storage.getItem(PASSWORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
};

export const saveRegistrationPassword = async (mobile, password) => {
  const key = normalizeMobile(mobile);
  const value = String(password || '').trim();
  if (!key || !value) return;

  const map = await readPasswordMap();
  map[key] = value;
  await Storage.setItem(PASSWORDS_KEY, JSON.stringify(map));
};

export const getRegistrationPassword = async (mobile) => {
  const key = normalizeMobile(mobile);
  if (!key) return '';

  const map = await readPasswordMap();
  return String(map[key] || '').trim();
};
