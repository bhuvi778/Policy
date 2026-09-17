import { Linking, NativeModules, Platform, Share } from 'react-native';
import { BASE_URL, downloadMaterial, getDirectDownload, getDownloadJob } from './api';
import {
  getDownloadFilename,
  getDownloadSourceUrl,
  getMaterialId,
  getMediaUrl,
  getTemplateSettings,
  isVideoUrl,
} from '../utils/material';
import { assertCanDownload, recordDownload } from './downloadQuota';

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
  profileImage: logoUrl,
  profileImageUrl: logoUrl,
  profilePhoto: logoUrl,
  profilePhotoUrl: logoUrl,
  profilePicture: logoUrl,
  profilePictureUrl: logoUrl,
  profilePic: logoUrl,
  avatar: logoUrl,
  avatarUrl: logoUrl,
  photo: logoUrl,
  photoUrl: logoUrl,
  image: logoUrl,
  imageUrl: logoUrl,
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
    advisorName: pickFirstText(
      details.advisorName,
      user.name,
      user.fullName,
      user.full_name,
      user.advisorName,
      profile.name,
      profile.fullName,
      'Insurance Advisor',
    ),
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
    qrCodeUrl: payload.qrCodeUrl,
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

export const downloadTemplateToDevice = async (item, details = {}) => {
  const quotaUser = details.user || {};
  await assertCanDownload(quotaUser);

  const sourceAssetUrl = normalizeDownloadUrl(getDownloadSourceUrl(item) || extractUrl(item));
  const localOptions = getLocalComposerOptions(details, item);
  const canApplyLocalComposer =
    Platform.OS === 'android' &&
    !!sourceAssetUrl &&
    !isVideoUrl(sourceAssetUrl) &&
    hasLocalCustomizations(localOptions);

  let result;

  if (canApplyLocalComposer && PolicyBhandarDownloader?.downloadCustomizedImage) {
    result = await PolicyBhandarDownloader.downloadCustomizedImage(
      sourceAssetUrl,
      getWatermarkedFilename(item, sourceAssetUrl),
      localOptions,
    );
    await recordDownload(quotaUser);
    return result;
  }

  if (canApplyLocalComposer && PolicyBhandarDownloader?.downloadImageWithWatermark) {
    result = await PolicyBhandarDownloader.downloadImageWithWatermark(
      sourceAssetUrl,
      getWatermarkedFilename(item, sourceAssetUrl),
      getWatermarkText(details) || localOptions.recipientName || localOptions.advisorName,
      localOptions,
    );
    await recordDownload(quotaUser);
    return result;
  }

  const renderedUrl = await resolveBackendDownloadUrl(item, details);
  const sourceUrl = normalizeDownloadUrl(
    renderedUrl || sourceAssetUrl,
  );

  if (!sourceUrl) {
    throw new Error('Download URL is not available for this template.');
  }

  const filename = getDownloadFilename(item, sourceUrl);
  const mimeType = sourceUrl.toLowerCase().includes('.mp4') ? 'video/mp4' : 'image/*';

  if (Platform.OS === 'android' && PolicyBhandarDownloader?.download) {
    result = await PolicyBhandarDownloader.download(sourceUrl, filename, mimeType);
    await recordDownload(quotaUser);
    return result;
  }

  await Linking.openURL(sourceUrl);
  result = { filename, url: sourceUrl };
  await recordDownload(quotaUser);
  return result;
};

export const prepareTemplateShareUrl = async (item, details = {}) => {
  const quotaUser = details.user || {};
  await assertCanDownload(quotaUser);

  const sourceAssetUrl = normalizeDownloadUrl(getDownloadSourceUrl(item) || extractUrl(item));
  const localOptions = getLocalComposerOptions(details, item);
  const canApplyLocalComposer =
    Platform.OS === 'android' &&
    !!sourceAssetUrl &&
    !isVideoUrl(sourceAssetUrl) &&
    hasLocalCustomizations(localOptions);

  if (canApplyLocalComposer && PolicyBhandarDownloader?.downloadCustomizedImage) {
    const result = await PolicyBhandarDownloader.downloadCustomizedImage(
      sourceAssetUrl,
      getWatermarkedFilename(item, sourceAssetUrl),
      localOptions,
    );
    await recordDownload(quotaUser);
    return {
      url: result?.contentUri || result?.fileUri || result?.uri || result?.url || sourceAssetUrl,
      filename: result?.filename || getWatermarkedFilename(item, sourceAssetUrl),
      mimeType: 'image/png',
      savedToDevice: true,
    };
  }

  const renderedUrl = await resolveBackendDownloadUrl(item, details);
  const sourceUrl = normalizeDownloadUrl(renderedUrl || sourceAssetUrl);

  if (!sourceUrl) {
    throw new Error('Share URL is not available for this template.');
  }

  const filename = getDownloadFilename(item, sourceUrl);
  return {
    url: sourceUrl,
    filename,
    mimeType: getMimeType(filename || sourceUrl),
  };
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
    return PolicyBhandarDownloader.shareFile(url, filename, mimeType, message, whatsappOnly);
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
    return PolicyBhandarDownloader.shareFileToApp(url, filename, mimeType, message, target);
  }

  if (target === 'whatsapp') {
    return shareFileToWhatsApp(file, message, true);
  }

  return shareFileToWhatsApp(file, message, false);
};

export const downloadPreparedFileToDevice = async (file = {}, item = {}, user = {}) => {
  await assertCanDownload(user);

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

export const downloadMediaToDevice = async (item, user = {}, options = {}) => {
  await assertCanDownload(user);

  const materialId = getMaterialId(item);
  const rawSourceUrl = normalizeDownloadUrl(
    getMediaUrl(item) ||
      getDownloadSourceUrl(item) ||
      extractUrl(item),
  );
  const renderedUrl = await resolveBackendDownloadUrl(
    item,
    getMediaWatermarkDetails(user, options),
    { preferMediaUrl: true, pollAttempts: 18 },
  );
  const sourceUrl = normalizeDownloadUrl(renderedUrl || rawSourceUrl);

  if (!sourceUrl) {
    throw new Error('Download URL is not available for this media.');
  }

  const filename = getDownloadFilename(item, sourceUrl);
  const mimeType = getMimeType(filename || sourceUrl);
  let result;

  if (Platform.OS === 'android' && PolicyBhandarDownloader?.download) {
    result = await PolicyBhandarDownloader.download(sourceUrl, filename, mimeType);
    await recordDownload(user);
    return result;
  }

  await Linking.openURL(sourceUrl);
  result = { filename, url: sourceUrl };
  await recordDownload(user);
  return result;
};

export const prepareMediaShareUrl = async (item, user = {}, options = {}) => {
  await assertCanDownload(user);

  const rawSourceUrl = normalizeDownloadUrl(
    getMediaUrl(item) ||
      getDownloadSourceUrl(item) ||
      extractUrl(item),
  );
  const renderedUrl = await resolveBackendDownloadUrl(
    item,
    getMediaWatermarkDetails(user, options),
    { preferMediaUrl: true, pollAttempts: 18 },
  );
  const sourceUrl = normalizeDownloadUrl(renderedUrl || rawSourceUrl);

  if (!sourceUrl) {
    throw new Error('Share URL is not available for this media.');
  }

  const filename = getDownloadFilename(item, sourceUrl);
  return {
    url: sourceUrl,
    filename,
    mimeType: getMimeType(filename || sourceUrl),
  };
};
