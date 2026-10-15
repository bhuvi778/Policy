import { Linking, NativeModules, Platform, Share, PermissionsAndroid } from 'react-native';
import { BASE_URL, downloadMaterial, getDirectDownload, getDownloadJob } from './api';
import { getAppOverlayLogoUrl } from '../utils/templateBranding';
import {
  getDownloadFilename,
  getDownloadSourceUrl,
  getMaterialId,
  getMediaUrl,
  getTemplateSettings,
  isVideoUrl,
} from '../utils/material';
import { assertCanDownload, recordDownload } from './downloadQuota';
import { getBrandImageUrl, getProfileImageUrl, normalizeProfileAsset } from '../utils/profileAssets';
import { getAdvisorDisplayName } from '../utils/profileIdentity';

const { PolicyBhandarDownloader } = NativeModules;

const unwrap = (payload) => {
  if (!payload) return null;
  if (payload.data && payload.data !== payload) return unwrap(payload.data);
  return payload;
};

const extractUrl = (payload) => {
  const data = unwrap(payload);
  if (!data) return '';
  if (typeof data === 'string') return data.trim();

  if (typeof data === 'object') {
    const direct = data.url || data.downloadUrl || data.fileUrl || data.renderedUrl || data.outputUrl || data.file?.url || data.file?.path || data.path || data.src;
    if (direct) return direct;

    if (typeof data.file === 'string') return data.file;
    if (typeof data.output === 'string') return data.output;
    if (typeof data.render === 'string') return data.render;

    const nested =
      extractUrl(data.data) ||
      extractUrl(data.result) ||
      extractUrl(data.payload) ||
      extractUrl(data?.file?.data) ||
      extractUrl(data?.urls) ||
      extractUrl(data?.download?.url);

    if (nested) return nested;
  }

  return (
    data.url ||
    data.downloadUrl ||
    data.download_url ||
    data.fileUrl ||
    data.file_url ||
    data.renderedUrl ||
    data.rendered_url ||
    data.outputUrl ||
    data.output_url ||
    data.sourceUrl ||
    data.source_url ||
    data.path ||
    data.file ||
    data.src ||
    data?.file?.url ||
    data?.file?.path ||
    ''
  );
};

const normalizeDownloadUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (/^(https?:|content:|file:|data:|policybhandar:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${BASE_URL.replace(/\/$/, '')}${raw}`;

  const looksLikeRelativeAsset =
    /^[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(raw) &&
    /\.(png|jpe?g|webp|gif|mp4|mov|m4v|webm|m3u8|mp3|m4a|wav|pdf|pptx?|docx?)(\?|#|$)/i.test(raw);

  return looksLikeRelativeAsset ? `${BASE_URL.replace(/\/$/, '')}/${raw.replace(/^\/+/, '')}` : '';
};

const cleanText = (value = '') => String(value || '').trim();

const formatDownloadDate = () => {
  const date = new Date();
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('-');
};

const readBoolean = (...values) => {
  const value = values.find((entry) => entry !== undefined && entry !== null);
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return !!value;
};

const wantsWatermark = (details = {}) =>
  readBoolean(details.waterMark, details.includeWatermark, details.watermark, details.showWatermark);

const readUrl = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return normalizeDownloadUrl(value);
  if (typeof value !== 'object') return '';
  return normalizeDownloadUrl(
    value.url ||
      value.uri ||
      value.path ||
      value.src ||
      value.secure_url ||
      value.fileUrl ||
      value.imageUrl ||
      '',
  );
};

const pickFirstText = (...values) =>
  cleanText(values.find((value) => cleanText(value)) || '');

const pickFirstUrl = (...values) => {
  for (const value of values) {
    const url = readUrl(value);
    if (url) return url;
  }
  return '';
};

const withLogoAliases = (logoUrl = '') => ({
  logoUrl,
  profileLogo: logoUrl,
  companyLogo: logoUrl,
  companyLogoUrl: logoUrl,
  businessLogo: logoUrl,
  logoImage: logoUrl,
  logoImageUrl: logoUrl,
  brandLogo: logoUrl,
  brandLogoUrl: logoUrl,

});

const withProfileAliases = (uri = '') => ({
  profileImage: uri, profileImageUrl: uri, profilePhoto: uri, profilePhotoUrl: uri,
  profilePicture: uri, profilePictureUrl: uri, profilePic: uri, avatar: uri, avatarUrl: uri,
  photo: uri, photoUrl: uri, image: uri, imageUrl: uri,
});

const buildQrImageUrl = (value = '') => {
  const raw = cleanText(value);
  if (!raw) return '';
  if (/^(https?:|file:|content:|data:)/i.test(raw) && /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(raw)) {
    return raw;
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(raw)}`;
};

const getUserDetails = (details = {}) => {
  const user = details.user || {};
  const profile = user.profile || {};
  const company = user.company || {};
  const qrData = pickFirstText(
    details.qrData,
    user.customLink,
    user.website,
    user.websiteUrl,
    profile.customLink,
    company.website,
    user.email ? `mailto:${user.email}` : '',
    user.mobile ? `tel:${user.mobile}` : '',
  );

  return {
    advisorName: getAdvisorDisplayName({ name: details.advisorName }, user),
    advisorDesignation: pickFirstText(
      details.advisorDesignation,
      user.designation,
      user.role,
      profile.designation,
      'Insurance Advisor',
    ),
    advisorMobile: pickFirstText(
      details.advisorMobile,
      user.mobile,
      user.phone,
      user.contactNumber,
      profile.mobile,
      profile.phone,
    ),
    advisorEmail: pickFirstText(
      details.advisorEmail,
      user.email,
      profile.email,
    ),
    profileImageUrl: normalizeProfileAsset(details.profileImageUrl || getProfileImageUrl(user)),
    logoUrl: pickFirstUrl(
      details.logoUrl,
      details.profileLogo,
      details.companyLogo,
      details.companyLogoUrl,
      details.businessLogo,
      details.logoImage,
      details.logoImageUrl,
      details.brandLogo,
      details.brandLogoUrl,
      details.profileImage,
      details.profileImageUrl,
      details.profilePhoto,
      details.profilePhotoUrl,
      details.profilePicture,
      details.profilePictureUrl,
      details.profilePic,
      details.avatar,
      details.avatarUrl,
      details.photo,
      details.photoUrl,
      details.image,
      details.imageUrl,
      getBrandImageUrl(user),
      user.logoUrl,
      user.logo,
      user.companyLogo,
      user.companyLogoUrl,
      user.businessLogo,
      user.profileLogo,
      user.logoImage,
      user.logoImageUrl,
      user.brandLogo,
      user.brandLogoUrl,
      user.profileImage,
      user.profileImageUrl,
      user.profilePhoto,
      user.profilePhotoUrl,
      user.profile_picture,
      user.profilePicture,
      user.profilePictureUrl,
      user.profilePic,
      user.profile_pic,
      user.avatar,
      user.avatarUrl,
      user.photo,
      user.photoUrl,
      user.image,
      user.imageUrl,
      profile.logoUrl,
      profile.logo,
      profile.profileLogo,
      profile.companyLogo,
      profile.companyLogoUrl,
      profile.businessLogo,
      profile.logoImage,
      profile.logoImageUrl,
      profile.brandLogo,
      profile.brandLogoUrl,
      profile.profileImage,
      profile.profileImageUrl,
      profile.profilePhoto,
      profile.profilePhotoUrl,
      profile.profile_picture,
      profile.profilePicture,
      profile.profilePictureUrl,
      profile.profilePic,
      profile.profile_pic,
      profile.avatar,
      profile.avatarUrl,
      profile.photo,
      profile.photoUrl,
      profile.image,
      profile.imageUrl,
      company.logoUrl,
      company.logo,
      company.companyLogo,
      company.companyLogoUrl,
      company.businessLogo,
      company.logoImage,
      company.logoImageUrl,
      company.brandLogo,
      company.brandLogoUrl,
      company.profileImage,
      company.profileImageUrl,
      company.profilePhoto,
      company.profilePhotoUrl,
      company.profilePicture,
      company.profilePictureUrl,
      company.profilePic,
      company.avatar,
      company.avatarUrl,
      company.photo,
      company.photoUrl,
      company.image,
      company.imageUrl,
    ),
    qrCodeUrl: pickFirstUrl(
      details.qrCodeUrl,
      user.qrCodeUrl,
      user.qrUrl,
      user.qrImage,
      user.whatsappScannerImage,
      user.whatsappScannerPhoto,
      user.whatsappScannerUrl,
      profile.qrCodeUrl,
      profile.qrUrl,
      profile.qrImage,
      profile.whatsappScannerImage,
      company.qrCodeUrl,
      company.qrUrl,
    ) || buildQrImageUrl(qrData),
    qrData,
  };
};

const toBackendPayload = (details = {}, item = {}) => {
  const userDetails = getUserDetails(details);
  const recipientName = cleanText(
    details.recipientName ||
      details.name ||
      details.customerName ||
      details.displayName ||
      userDetails.advisorName,
  );
  const recipientType = cleanText(details.recipientType);
  const includeWatermark = wantsWatermark(details);
  const includeLogo = readBoolean(details.yourLogo, details.includeLogo, details.showLogo);
  const includeLogoOverlay = readBoolean(
    details.logoOverlay,
    details.includeLogoOverlay,
    details.showLogoOverlay,
  );
  const includeCaption = readBoolean(details.socialCaption, details.showSocialCaption);
  const includeQrCode = readBoolean(details.qrCode, details.showQrCode);
  const fontColor = details.fontColor || '#111111';
  const outputSize = details.outputSize === 'backend' ? '' : details.outputSize;
  const watermarkOrientation = cleanText(details.watermarkOrientation || details.watermarkDirection || 'diagonal');
  const qrPosition = cleanText(details.qrPosition || details.qrCodePosition || 'right');
  const watermarkType = cleanText(details.watermarkType || details.downloadMode || 'digicard') || 'digicard';
  const generatedDate = cleanText(details.generatedDate || details.downloadDate || formatDownloadDate());
  const watermarkText = cleanText(
    details.watermarkText ||
      recipientName ||
      userDetails.advisorName ||
      userDetails.advisorMobile ||
      'POLICYBHANDAR',
  );
  const outgoingLogoUrl = includeLogo ? userDetails.logoUrl : '';
  const overlayLogoUrl = includeLogoOverlay
    ? pickFirstUrl(details.logoOverlayUrl, details.overlayLogoUrl, details.logoUrl, userDetails.logoUrl)
    : '';
  const logoOverlayX = Number.isFinite(Number(details.logoOverlayX)) ? Number(details.logoOverlayX) : 0.06;
  const logoOverlayY = Number.isFinite(Number(details.logoOverlayY)) ? Number(details.logoOverlayY) : 0.06;

  return {
    materialId: getMaterialId(item),
    recipientType,
    recipientName,
    name: recipientName,
    customerName: recipientName,
    displayName: recipientName,
    text: recipientName || userDetails.advisorName,
    watermarkText: includeWatermark ? watermarkText : '',
    fontColor,
    textColor: fontColor,
    watermarkOrientation,
    watermarkType,
    watermarkDirection: watermarkOrientation,
    qrPosition,
    qrCodePosition: qrPosition,
    generatedDate,
    downloadDate: generatedDate,
    outputSize,
    size: outputSize,
    includeLogo,
    showLogo: includeLogo,
    yourLogo: includeLogo,
    logoOverlay: includeLogoOverlay,
    includeLogoOverlay,
    showLogoOverlay: includeLogoOverlay,
    logoOverlayUrl: overlayLogoUrl,
    overlayLogoUrl,
    logoOverlayX,
    logoOverlayY,
    includeWatermark,
    watermark: includeWatermark,
    waterMark: includeWatermark,
    showWatermark: includeWatermark,
    socialCaption: includeCaption,
    showSocialCaption: includeCaption,
    includeSocialCaption: includeCaption,
    qrCode: includeQrCode,
    showQrCode: includeQrCode,
    includeQrCode,
    advisorName: userDetails.advisorName,
    advisorDesignation: userDetails.advisorDesignation,
    advisorMobile: userDetails.advisorMobile,
    advisorEmail: userDetails.advisorEmail,
    ...withLogoAliases(outgoingLogoUrl),
    ...withProfileAliases(includeLogo ? (userDetails.profileImageUrl || outgoingLogoUrl) : ''),
    qrCodeUrl: includeQrCode ? userDetails.qrCodeUrl : '',
    qrData: userDetails.qrData,
    templateSettings: getTemplateSettings(item),
  };
};

const extractJobId = (payload) => {
  const data = unwrap(payload);
  if (!data || typeof data !== 'object') return '';
  return (
    data.jobId ||
    data.job_id ||
    data.downloadJobId ||
    data.download_job_id ||
    data.id ||
    data.job?.id ||
    data.job?._id ||
    data.data?.jobId ||
    ''
  );
};

const pollDownloadJobUrl = async (jobId, attempts = 6) => {
  if (!jobId) return '';

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt < 2 ? 800 : 1600));
    const job = await getDownloadJob(jobId);
    const state = String(unwrap(job.data)?.status || '').toLowerCase();
    if (['failed', 'error', 'cancelled'].includes(state)) throw new Error('Media rendering failed. Please try again.');
    const url = normalizeDownloadUrl(extractUrl(job.data));
    if (url) return url;
  }

  return '';
};

const toDirectDownloadParams = (sourceUrl, materialId, payload) => ({
  file: sourceUrl,
  path: sourceUrl,
  materialId,
  recipientType: payload.recipientType,
  recipientName: payload.recipientName,
  name: payload.name,
  watermarkText: payload.watermarkText,
  fontColor: payload.fontColor,
  watermarkOrientation: payload.watermarkOrientation,
  watermarkType: payload.watermarkType,
  watermarkDirection: payload.watermarkDirection,
  qrPosition: payload.qrPosition,
  qrCodePosition: payload.qrCodePosition,
  generatedDate: payload.generatedDate,
  downloadDate: payload.downloadDate,
  outputSize: payload.outputSize,
  includeLogo: payload.includeLogo,
  showLogo: payload.showLogo,
  yourLogo: payload.yourLogo,
  logoOverlay: payload.logoOverlay,
  includeLogoOverlay: payload.includeLogoOverlay,
  showLogoOverlay: payload.showLogoOverlay,
  logoOverlayUrl: payload.logoOverlayUrl,
  overlayLogoUrl: payload.overlayLogoUrl,
  logoOverlayX: payload.logoOverlayX,
  logoOverlayY: payload.logoOverlayY,
  includeWatermark: payload.includeWatermark,
  watermark: payload.watermark,
  showWatermark: payload.showWatermark,
  socialCaption: payload.socialCaption,
  showSocialCaption: payload.showSocialCaption,
  includeSocialCaption: payload.includeSocialCaption,
  qrCode: payload.qrCode,
  showQrCode: payload.showQrCode,
  includeQrCode: payload.includeQrCode,
  advisorName: payload.advisorName,
  advisorDesignation: payload.advisorDesignation,
  advisorMobile: payload.advisorMobile,
  advisorEmail: payload.advisorEmail,
  ...withLogoAliases(payload.logoUrl),
  ...withProfileAliases(payload.profileImageUrl),
  qrCodeUrl: payload.qrCodeUrl,
  qrData: payload.qrData,
});

const resolveBackendDownloadUrl = async (item, details, options = {}) => {
  const sourceUrl = normalizeDownloadUrl(
    (options.preferMediaUrl ? getMediaUrl(item) : '') ||
      getDownloadSourceUrl(item) ||
      extractUrl(item),
  );

  const materialId = getMaterialId(item);
  const payload = toBackendPayload(details, item);
  if (!materialId) return '';

  try {
    const rendered = await downloadMaterial(materialId, payload);
    const renderedUrl = extractUrl(rendered.data);
    const normalized = normalizeDownloadUrl(renderedUrl);
    if (normalized) return normalized;

    const jobUrl = await pollDownloadJobUrl(extractJobId(rendered.data), options.pollAttempts || 6);
    if (jobUrl) return jobUrl;
  } catch (error) {
    console.log('Material render download unavailable:', error?.message || error);
  }

  if (sourceUrl) {
    try {
      const direct = await getDirectDownload(toDirectDownloadParams(sourceUrl, materialId, payload));

      const directUrl = extractUrl(direct.data);
      const normalized = normalizeDownloadUrl(directUrl);
      if (normalized) return normalized;
    } catch (error) {
      console.log('Download-direct by file unavailable:', error?.message || error);
    }
  }

  return '';
};

const getMediaWatermarkDetails = (user = {}, options = {}) => {
  const userDetails = getUserDetails({ user });
  const hasLogo = !!userDetails.logoUrl;
  const hasQr = !!userDetails.qrCodeUrl;

  return {
    user,
    recipientName: userDetails.advisorName,
    name: userDetails.advisorName,
    displayName: userDetails.advisorName,
    watermarkText: userDetails.advisorName,
    watermarkType: cleanText(options.watermarkType || options.downloadMode || 'digicard') || 'digicard',
    fontColor: '#111111',
    waterMark: true,
    watermark: true,
    includeWatermark: true,
    showWatermark: true,
    socialCaption: true,
    includeSocialCaption: true,
    showSocialCaption: true,
    yourLogo: hasLogo,
    includeLogoOverlay: hasLogo && !!userDetails.profileImageUrl && userDetails.logoUrl !== userDetails.profileImageUrl,
    logoOverlayUrl: userDetails.logoUrl,
    logoOverlayX: 0.94,
    logoOverlayY: 0.04,
    includeLogo: hasLogo,
    showLogo: hasLogo,
    qrCode: hasQr,
    includeQrCode: hasQr,
    showQrCode: hasQr,
    advisorName: userDetails.advisorName,
    advisorDesignation: userDetails.advisorDesignation,
    advisorMobile: userDetails.advisorMobile,
    advisorEmail: userDetails.advisorEmail,
    ...withLogoAliases(userDetails.logoUrl),
    ...withProfileAliases(userDetails.profileImageUrl || userDetails.logoUrl),
    qrCodeUrl: userDetails.qrCodeUrl,
    generatedDate: formatDownloadDate(),
  };
};

const withoutQuery = (value = '') => cleanText(value).split('?')[0].split('#')[0];

const isSameDownloadAsset = (left = '', right = '') =>
  !!left && !!right && withoutQuery(left) === withoutQuery(right);

const getWatermarkText = (details = {}) =>
  cleanText(details.recipientName || details.name || details.customerName || details.displayName);

const getWatermarkedFilename = (item, url) =>
  getDownloadFilename(item, url).replace(/\.(webp|png|jpe?g)$/i, '.jpg');

const getLocalComposerOptions = (details = {}, item = {}) => {
  const payload = toBackendPayload(details, item);
  return {
    recipientType: payload.recipientType,
    recipientName: payload.recipientName,
    watermarkText: payload.watermarkText,
    watermarkType: payload.watermarkType,
    fontColor: payload.fontColor,
    watermarkOrientation: payload.watermarkOrientation,
    qrPosition: payload.qrPosition,
    generatedDate: payload.generatedDate,
    includeWatermark: payload.includeWatermark,
    includeLogo: payload.includeLogo,
    logoOverlay: payload.logoOverlay,
    includeLogoOverlay: payload.includeLogoOverlay,
    showLogoOverlay: payload.showLogoOverlay,
    logoOverlayUrl: payload.logoOverlayUrl,
    overlayLogoUrl: payload.overlayLogoUrl,
    logoOverlayX: payload.logoOverlayX,
    logoOverlayY: payload.logoOverlayY,
    includeSocialCaption: payload.includeSocialCaption,
    includeQrCode: payload.includeQrCode,
    advisorName: payload.advisorName,
    advisorDesignation: payload.advisorDesignation,
    advisorMobile: payload.advisorMobile,
    advisorEmail: payload.advisorEmail,
    ...withLogoAliases(payload.logoUrl),
    ...withProfileAliases(payload.profileImageUrl),
    qrCodeUrl: payload.qrCodeUrl,
    qrData: payload.qrData,
  };
};

const hasLocalCustomizations = (options = {}) =>
  !!(
    options.recipientName ||
    options.includeWatermark ||
    options.includeLogo ||
    options.includeLogoOverlay ||
    options.includeSocialCaption ||
    options.includeQrCode
  );

const preparedFiles = new Map();
const PREPARED_TTL = 10 * 60 * 1000;

const preparePersonalizedFile = async (item, details, { remote = false, preferMediaUrl = false } = {}) => {
  const quotaUser = details.user || {};
  await assertCanDownload(quotaUser);
  const sourceUrl = normalizeDownloadUrl((preferMediaUrl ? getMediaUrl(item) : '') || getDownloadSourceUrl(item) || getMediaUrl(item) || extractUrl(item));
  if (!sourceUrl) throw new Error('The media file is not available. Please refresh and try again.');
  const customization = getLocalComposerOptions(details, item);
  const video = isVideoUrl(sourceUrl) || /reel|video|story/i.test(String(item?.type || item?.raw?.type || ''));
  const nativeMethod = video ? PolicyBhandarDownloader?.prepareCustomizedVideo : PolicyBhandarDownloader?.prepareCustomizedImage;
  const composeOnDevice = !remote && Platform.OS === 'android' && !!nativeMethod;
  // Android uses the same branded footer across delivery modes. QR/asset/text changes still rerender.
  const renderKey = composeOnDevice ? { ...customization, watermarkType: undefined } : customization;
  const key = JSON.stringify([sourceUrl, renderKey, remote]);
  const cached = preparedFiles.get(key);
  if (cached && Date.now() - cached.createdAt < PREPARED_TTL) return { ...await cached.promise, user: quotaUser };

  const promise = (async () => {
    const privateProfileAsset = [customization.logoUrl, customization.profileImageUrl].some((uri) => /^(file:|content:|data:|policybhandar:)/i.test(uri || ''));
    const privateOverlay = /^(file:|content:|data:|policybhandar:)/i.test(customization.logoOverlayUrl || '') && customization.logoOverlayUrl !== getAppOverlayLogoUrl(true);
    if (remote && (privateProfileAsset || privateOverlay)) {
      throw new Error('Please save your profile photo/logo online before creating a public link. You can still download and share the personalized file.');
    }
    const filename = video ? getDownloadFilename(item, sourceUrl).replace(/\.[a-z0-9]+$/i, '.mp4') : getWatermarkedFilename(item, sourceUrl);
    if (composeOnDevice) {
      const result = await nativeMethod(sourceUrl, filename, customization);
      const fileUrl = result?.fileUri || result?.contentUri || result?.uri;
      if (!fileUrl || !result.customized) throw new Error('Personalized media could not be prepared. Please try again.');
      return { ...result, url: fileUrl, filename: result.filename || filename, mimeType: result.mimeType || (video ? 'video/mp4' : 'image/jpeg'), user: quotaUser };
    }
    const renderedUrl = await resolveBackendDownloadUrl(item, details, { preferMediaUrl, pollAttempts: video ? 18 : 6 });
    if (!renderedUrl || (hasLocalCustomizations(customization) && isSameDownloadAsset(renderedUrl, sourceUrl))) {
      throw new Error('Personalized media is unavailable right now. Please retry; your original unbranded file has not been downloaded.');
    }
    const resolvedName = getDownloadFilename(item, renderedUrl);
    return { url: renderedUrl, filename: resolvedName, mimeType: getMimeType(resolvedName || renderedUrl), user: quotaUser };
  })();
  preparedFiles.set(key, { createdAt: Date.now(), promise });
  while (preparedFiles.size > 12) preparedFiles.delete(preparedFiles.keys().next().value);
  try { return await promise; }
  catch (error) { preparedFiles.delete(key); throw error; }
};

export const prepareTemplateShareUrl = (item, details = {}, options = {}) => preparePersonalizedFile(item, details, options);

export const downloadTemplateToDevice = async (item, details = {}) => {
  const prepared = await prepareTemplateShareUrl(item, details);
  return downloadPreparedFileToDevice(prepared, item, details.user || {});
};

const getMimeType = (url = '') => {
  const clean = String(url || '').split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.mp4') || clean.endsWith('.m4v')) return 'video/mp4';
  if (clean.endsWith('.mov')) return 'video/quicktime';
  if (clean.endsWith('.webm')) return 'video/webm';
  if (clean.endsWith('.mp3')) return 'audio/mpeg';
  if (clean.endsWith('.m4a')) return 'audio/mp4';
  if (clean.endsWith('.wav')) return 'audio/wav';
  if (clean.endsWith('.pdf')) return 'application/pdf';
  if (clean.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (clean.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (clean.endsWith('.doc')) return 'application/msword';
  if (clean.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  return clean.match(/\.(jpe?g)$/) ? 'image/jpeg' : 'application/octet-stream';
};

export const shareFileToWhatsApp = async (file = {}, message = '', whatsappOnly = true) => {
  const url = normalizeDownloadUrl(file.url || file.contentUri || file.fileUri || file.uri || '');
  if (!url) {
    throw new Error('Share file URL is not available.');
  }

  const filename = file.filename || getDownloadFilename(file.item || {}, url);
  const mimeType = file.mimeType || getMimeType(filename || url);

  if (Platform.OS === 'android' && PolicyBhandarDownloader?.shareFile) {
    if (file.user) await assertCanDownload(file.user);
    const result = await PolicyBhandarDownloader.shareFile(url, filename, mimeType, message, whatsappOnly);
    if (file.user) await recordDownload(file.user);
    return result;
  }

  return Share.share({
    message: message ? `${message}\n${url}` : url,
    url,
  });
};

export const shareFileToSocialApp = async (file = {}, message = '', targetApp = '') => {
  const url = normalizeDownloadUrl(file.url || file.contentUri || file.fileUri || file.uri || '');
  if (!url) {
    throw new Error('Share file URL is not available.');
  }

  const filename = file.filename || getDownloadFilename(file.item || {}, url);
  const mimeType = file.mimeType || getMimeType(filename || url);
  const target = String(targetApp || '').toLowerCase();

  if (Platform.OS === 'android' && PolicyBhandarDownloader?.shareFileToApp) {
    if (file.user) await assertCanDownload(file.user);
    const result = await PolicyBhandarDownloader.shareFileToApp(url, filename, mimeType, message, target);
    if (file.user) await recordDownload(file.user);
    return result;
  }

  if (target === 'whatsapp') {
    return shareFileToWhatsApp(file, message, true);
  }

  return shareFileToWhatsApp(file, message, false);
};

export const downloadPreparedFileToDevice = async (file = {}, item = {}, user = {}) => {
  await assertCanDownload(user);
  if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Storage permission is required to save this file to Downloads.');
  }

  const url = normalizeDownloadUrl(file.url || file.contentUri || file.fileUri || file.uri || '');
  if (!url) {
    throw new Error('Download URL is not available for this file.');
  }

  const filename = file.filename || getDownloadFilename(item, url);
  const mimeType = file.mimeType || getMimeType(filename || url);
  let result;

  if (Platform.OS === 'android' && PolicyBhandarDownloader?.download) {
    result = await PolicyBhandarDownloader.download(url, filename, mimeType);
    await recordDownload(user);
    return result;
  }

  await Linking.openURL(url);
  result = { filename, url };
  await recordDownload(user);
  return result;
};

export const prepareMediaShareUrl = (item, user = {}, options = {}) => preparePersonalizedFile(
  item, getMediaWatermarkDetails(user, options), { ...options, preferMediaUrl: true },
);

export const downloadMediaToDevice = async (item, user = {}, options = {}) => {
  const prepared = await prepareMediaShareUrl(item, user, options);
  return downloadPreparedFileToDevice(prepared, item, user);
};
