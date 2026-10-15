import { BASE_URL } from '../services/api';

export const normalizeProfileAsset = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    return normalizeProfileAsset(value.url || value.uri || value.path || value.src || value.secure_url || value.location || value.fileUrl || value.imageUrl);
  }
  if (typeof value !== 'string') return '';
  const uri = value.trim();
  if (!uri) return '';
  if (/^(https?:|file:|content:|data:|policybhandar:)/i.test(uri)) return uri;
  if (uri.startsWith('//')) return `https:${uri}`;
  return `${BASE_URL.replace(/\/$/, '')}/${uri.replace(/^\/+/, '')}`;
};

const firstAsset = (objects, fields) => {
  for (const object of objects) {
    if (!object || typeof object !== 'object') continue;
    for (const field of fields) {
      const uri = normalizeProfileAsset(object[field]);
      if (uri) return uri;
    }
  }
  return '';
};

const profiles = (user = {}) => [user, user.profile, user.user, user.data, user.company];

export const getProfileImageUrl = (user = {}) => {
  const uri = firstAsset(profiles(user), [
  'profileImage', 'profileImageUrl', 'profilePhoto', 'profilePhotoUrl',
  'profile_picture', 'profilePicture', 'profilePictureUrl', 'profilePic', 'profile_pic',
  'avatar', 'avatarUrl', 'photo', 'photoUrl', 'image', 'imageUrl',
  ]);
  // The backend can replace a profile image at the same URL. Bust only our own public asset cache.
  if (user._profileImageRevision && uri.startsWith(`${BASE_URL}/`)) {
    const url = new URL(uri);
    url.searchParams.set('_pbv', String(user._profileImageRevision));
    return url.toString();
  }
  return uri;
};

export const getLogoImageUrl = (user = {}) => firstAsset(profiles(user), [
  'logoUrl', 'logo', 'companyLogo', 'companyLogoUrl', 'businessLogo', 'profileLogo',
  'logoImage', 'logoImageUrl', 'brandLogo', 'brandLogoUrl',
]);

export const getBrandImageUrl = (user = {}) => getLogoImageUrl(user) || getProfileImageUrl(user);

export const getQrCodeImageUrl = (user = {}) => firstAsset(profiles(user), [
  'qrCodeUrl', 'qrUrl', 'qrImage', 'whatsappScannerImage', 'whatsappScannerPhoto', 'whatsappScannerUrl',
]);
