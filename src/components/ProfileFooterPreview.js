import React from 'react';
import { getProfileImageUrl, getLogoImageUrl, getQrCodeImageUrl } from '../utils/profileAssets';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';
import { BASE_URL } from '../services/api';
import { getAdvisorDisplayName, pickFirst } from '../services/appData';
import { Colors } from '../theme/colors';
import FastImage from './FastImage';

const normalizeAssetUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|file:|content:|data:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${BASE_URL.replace(/\/$/, '')}${raw}`;
  if (/^[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(raw)) {
    return `${BASE_URL.replace(/\/$/, '')}/${raw.replace(/^\/+/, '')}`;
  }
  return raw;
};

const firstAssetUrl = (...values) => {
  for (const value of values) {
    if (!value) continue;
    if (typeof value === 'string' && value.trim()) return normalizeAssetUrl(value);
    if (typeof value === 'object') {
      const url =
        value.url ||
        value.uri ||
        value.path ||
        value.src ||
        value.secure_url ||
        value.location ||
        value.fileUrl ||
        value.imageUrl;
      if (url) return normalizeAssetUrl(url);
    }
  }
  return '';
};

export { getProfileImageUrl, getLogoImageUrl, getQrCodeImageUrl } from '../utils/profileAssets';
const buildQrImageUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(raw)}`;
};

const initialsFor = (name = '') =>
  String(name || 'P')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'P';

const ProfileFooterPreview = ({
  compact = false,
  dark = false,
  user: suppliedUser,
  showLogo = true,
  showQrCode = true,
  showSocialCaption = true,
  logoUrl: suppliedLogoUrl = '',
  qrCodeUrl: suppliedQrCodeUrl = '',
  name: suppliedName = '',
  fontColor,
  qrPosition = 'right',
}) => {
  const { user: authUser = {} } = useAuth() || {};
  const user = suppliedUser || authUser || {};
  const name = suppliedName || getAdvisorDisplayName(user);
  const designation = pickFirst(user.designation, user.role, user.memberType, 'Insurance Advisor');
  const mobile = pickFirst(user.mobile, user.phone, user.contactNumber, '');
  const email = pickFirst(user.email, user.profile?.email, '');
  const logoImageUrl = suppliedLogoUrl || getLogoImageUrl(user);
  const imageUrl = logoImageUrl || getProfileImageUrl(user);
  const qrData = pickFirst(
    user.customLink,
    user.website,
    user.websiteUrl,
    user.profile?.customLink,
    user.company?.website,
    email ? `mailto:${email}` : '',
    mobile ? `tel:${mobile}` : '',
  );
  const qrImageUrl = suppliedQrCodeUrl || getQrCodeImageUrl(user) || buildQrImageUrl(qrData);
  const qrOnLeft = qrPosition === 'left';

  return (
    <View style={[styles.footer, compact && styles.footerCompact, dark && styles.footerDark]}>
      {showQrCode && qrOnLeft && !compact ? (
        <View style={styles.qrBox}>
          {qrImageUrl ? (
            <FastImage source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <MaterialIcons name="qr-code-2" size={34} color="#111827" />
          )}
        </View>
      ) : null}
      {showLogo ? (
        <View style={[styles.avatar, compact && styles.avatarCompact]}>
          {imageUrl ? (
            <FastImage source={{ uri: imageUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Text style={[styles.avatarText, compact && styles.avatarTextCompact]}>{initialsFor(name)}</Text>
          )}
        </View>
      ) : null}
      <View style={styles.copy}>
        {!compact ? <Text style={[styles.regards, dark && styles.darkText]}>With Best Regards,</Text> : null}
        <Text
          style={[
            styles.name,
            compact && styles.nameCompact,
            dark && styles.darkText,
            fontColor ? { color: fontColor } : null,
          ]}
          numberOfLines={1}
        >
          {name.toUpperCase()}
        </Text>
        {!compact ? (
          <>
            <Text style={[styles.meta, dark && styles.darkText]} numberOfLines={1}>{designation}</Text>
            {mobile ? <Text style={[styles.meta, dark && styles.darkText]} numberOfLines={1}>{mobile}</Text> : null}
            {email ? <Text style={[styles.meta, dark && styles.darkText]} numberOfLines={1}>{email}</Text> : null}
            {showSocialCaption ? <Text style={[styles.meta, dark && styles.darkText]} numberOfLines={1}>All  f  ig  x  in</Text> : null}
          </>
        ) : null}
      </View>
      {showQrCode && !qrOnLeft && !compact ? (
        <View style={styles.qrBox}>
          {qrImageUrl ? (
            <FastImage source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" />
          ) : (
            <MaterialIcons name="qr-code-2" size={34} color="#111827" />
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopColor: '#111827',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 84,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  footerCompact: {
    borderTopColor: Colors.border,
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  footerDark: {
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#A855F7',
    borderRadius: 12,
    borderWidth: 2,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58,
  },
  avatarCompact: {
    borderRadius: 10,
    height: 28,
    width: 28,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarText: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '900',
  },
  avatarTextCompact: {
    fontSize: 11,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  regards: {
    color: '#374151',
    fontSize: 10,
  },
  name: {
    color: '#1A237E',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  nameCompact: {
    color: Colors.textDark,
    fontSize: 10,
    lineHeight: 12,
  },
  meta: {
    color: '#1F2937',
    fontSize: 10,
    lineHeight: 13,
  },
  darkText: {
    color: '#111827',
  },
  qrBox: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  qrImage: {
    height: '100%',
    width: '100%',
  },
});

export default React.memo(ProfileFooterPreview);
