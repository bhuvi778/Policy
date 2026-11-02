import { MEMBERSHIP_KEYS } from './subscriptionInfo';

const object = value => value && typeof value === 'object' && !Array.isArray(value);

export const extractUserData = (payload) => {
  if (!object(payload)) return null;
  // Some actual user records contain a nested profile holding only the photo.
  if (['name', 'fullName', 'full_name', 'mobile', 'email', 'designation'].some(key => payload[key])) return payload;
  // Prefer the actual user over an envelope containing a subscription and user together.
  for (const key of ['user', 'profile', 'advisor', 'employee', 'customer', 'member', 'account', 'success', 'data']) {
    const nested = extractUserData(payload[key]);
    if (nested) {
      const membership = Object.fromEntries(MEMBERSHIP_KEYS.filter(key => payload[key] !== undefined).map(key => [key, payload[key]]));
      return Object.keys(membership).length ? { ...membership, ...nested } : nested;
    }
  }
  const identityKeys = ['name', 'fullName', 'full_name', 'mobile', 'email', 'designation', 'profileImage', 'profileImageUrl', 'profilePhoto', 'profilePhotoUrl', 'profilePicture', 'profilePictureUrl', 'profilePic', 'profile_pic', 'avatar', 'avatarUrl', 'photo', 'photoUrl', 'image', 'imageUrl'];
  return identityKeys.some(key => payload[key]) || MEMBERSHIP_KEYS.some(key => payload[key] !== undefined) ? payload : null;
};
