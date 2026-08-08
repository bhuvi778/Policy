import { BASE_URL } from '../services/api';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.m3u8'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.doc', '.docx'];

const cleanUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim();
};

const normalizeAssetUrl = (value = '') => {
  const raw = cleanUrl(value);
  if (!raw) return '';
  if (/^(https?:|file:|content:|data:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${BASE_URL.replace(/\/$/, '')}${raw}`;
  return `${BASE_URL.replace(/\/$/, '')}/${raw.replace(/^\/+/, '')}`;
};

const readAssetUrl = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return normalizeAssetUrl(value);
  if (typeof value !== 'object') return '';

  const url =
    cleanUrl(value.url) ||
    cleanUrl(value.path) ||
    cleanUrl(value.src) ||
    cleanUrl(value.uri) ||
    cleanUrl(value.secure_url) ||
    cleanUrl(value.location) ||
    cleanUrl(value.fileUrl) ||
    cleanUrl(value.downloadUrl) ||
    cleanUrl(value.thumbnail) ||
    cleanUrl(value.thumbnailUrl) ||
    cleanUrl(value.poster) ||
    '';
  return normalizeAssetUrl(url);
};

const resolveUrlFromItem = (item = {}, ...candidates) => {
  const list = [...candidates.filter(Boolean), item.raw, item.file, item.output, item.media];
  for (const candidate of list) {
    const url = readAssetUrl(candidate);
    if (url) return url;
  }

  return (
    readAssetUrl(item.download) ||
    readAssetUrl(item.links?.download) ||
    readAssetUrl(item.results?.file) ||
    readAssetUrl(item.raw?.download) ||
    readAssetUrl(item.raw?.file) ||
    readAssetUrl(item.raw?.links?.download) ||
    readAssetUrl(item.raw?.result?.file) ||
    ''
  );
};

const firstImageUrl = (...candidates) => {
  for (const candidate of candidates.flat().filter(Boolean)) {
    const url = readAssetUrl(candidate);
    if (url && !isVideoUrl(url)) return url;
  }
  return '';
};

const lowerPath = (value = '') => {
  const path = cleanUrl(value).split('?')[0].split('#')[0];
  return path.toLowerCase();
};

const getItemText = (item = {}) =>
  [
    item.title,
    item.name,
    item.type,
    item.section,
    item.categoryName,
    item.subcategoryName,
    item.raw?.title,
    item.raw?.name,
    item.raw?.type,
    item.raw?.section,
    item.raw?.categoryName,
    item.raw?.subcategoryName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const isPresentationMetadata = (item = {}, sectionTitle = '') => {
  const text = `${getItemText(item)} ${sectionTitle || ''}`.toLowerCase();
  return text.includes('ppt') || text.includes('presentation') || text.includes('powerpoint');
};

const isPdfMetadata = (item = {}, sectionTitle = '') => {
  const text = `${getItemText(item)} ${sectionTitle || ''}`.toLowerCase();
  return text.includes('pdf') || text.includes('brochure');
};

const firstUrlWithExtension = (extensions = [], ...candidates) => {
  for (const candidate of candidates.flat().filter(Boolean)) {
    const url = readAssetUrl(candidate);
    const path = lowerPath(url);
    if (url && extensions.some((ext) => path.endsWith(ext))) return url;
  }
  return '';
};

const getPresentationSourceUrl = (item = {}) =>
  firstUrlWithExtension(
    ['.ppt', '.pptx'],
    item.pptUrl,
    item.ppt_url,
    item.pptxUrl,
    item.pptx_url,
    item.presentationUrl,
    item.presentation_url,
    item.powerpointUrl,
    item.powerpoint_url,
    item.documentUrl,
    item.document_url,
    item.fileUrl,
    item.file_url,
    item.downloadUrl,
    item.download_url,
    item.url,
    item.file,
    item.document,
    item.presentation,
    item.download,
    item.links?.download,
    item.raw?.pptUrl,
    item.raw?.ppt_url,
    item.raw?.pptxUrl,
    item.raw?.pptx_url,
    item.raw?.presentationUrl,
    item.raw?.presentation_url,
    item.raw?.powerpointUrl,
    item.raw?.powerpoint_url,
    item.raw?.documentUrl,
    item.raw?.document_url,
    item.raw?.fileUrl,
    item.raw?.file_url,
    item.raw?.downloadUrl,
    item.raw?.download_url,
    item.raw?.url,
    item.raw?.file,
    item.raw?.document,
    item.raw?.presentation,
    item.raw?.download,
    item.raw?.links?.download,
  );

export const isVideoUrl = (value = '') => {
  const path = lowerPath(value);
  return VIDEO_EXTENSIONS.some((ext) => path.endsWith(ext));
};

export const isImageUrl = (value = '') => {
  const path = lowerPath(value);
  return IMAGE_EXTENSIONS.some((ext) => path.endsWith(ext));
};

export const isDocumentUrl = (value = '') => {
  const path = lowerPath(value);
  return DOCUMENT_EXTENSIONS.some((ext) => path.endsWith(ext));
};

export const getMaterialId = (item = {}) =>
  String(item._id || item.id || item.raw?._id || item.raw?.id || '');

export const getMediaUrl = (item = {}) => {
  if (isPresentationMetadata(item)) {
    const presentationUrl = getPresentationSourceUrl(item);
    if (presentationUrl) return cleanUrl(presentationUrl);
  }

  return cleanUrl(
    resolveUrlFromItem(
      item,
      item.renderedUrl,
      item.rendered_url,
      item.outputUrl,
      item.output_url,
      item.downloadUrl,
      item.download_url,
      item.mediaUrl,
      item.videoUrl,
      item.fileUrl,
      item.url,
    ) ||
    resolveUrlFromItem(
      item.raw,
      item.raw?.renderedUrl,
      item.raw?.rendered_url,
      item.raw?.outputUrl,
      item.raw?.output_url,
      item.raw?.downloadUrl,
      item.raw?.download_url,
      item.raw?.mediaUrl,
      item.raw?.videoUrl,
      item.raw?.fileUrl,
      item.raw?.url,
    ) ||
    ''
  );
};

export const getDownloadSourceUrl = (item = {}) => {
  if (isPresentationMetadata(item)) {
    const presentationUrl = getPresentationSourceUrl(item);
    if (presentationUrl) return cleanUrl(presentationUrl);
  }

  return cleanUrl(
    resolveUrlFromItem(
      item,
      item.downloadUrl,
      item.download_url,
      item.image,
      item.imageUrl,
      item.file,
      item.fileUrl,
      item.outputUrl,
      item.output_url,
      item.renderedUrl,
      item.rendered_url,
      item.sourceUrl,
      item.source_url,
      item.mediaUrl,
      item.url,
      item.path,
    ) ||
    resolveUrlFromItem(
      item.raw,
      item.raw?.downloadUrl,
      item.raw?.download_url,
      item.raw?.file,
      item.raw?.image,
      item.raw?.fileUrl,
      item.raw?.file_url,
      item.raw?.outputUrl,
      item.raw?.output_url,
      item.raw?.renderedUrl,
      item.raw?.rendered_url,
      item.raw?.sourceUrl,
      item.raw?.source_url,
      item.raw?.source,
      item.raw?.url,
    ) ||
    ''
  );
};

export const getThumbnailSource = (item = {}) => {
  const thumbnail = firstImageUrl(
    item.thumbnail,
    item.thumbnailUrl,
    item.thumbnail_url,
    item.thumbnailImage,
    item.thumbnail_image,
    item.thumbnailImageUrl,
    item.thumbnail_image_url,
    item.thumb,
    item.thumbUrl,
    item.thumb_url,
    item.videoThumbnail,
    item.video_thumbnail,
    item.videoThumbnailUrl,
    item.video_thumbnail_url,
    item.poster,
    item.posterUrl,
    item.poster_url,
    item.posterImage,
    item.posterImageUrl,
    item.cover,
    item.coverUrl,
    item.cover_url,
    item.coverImage,
    item.coverImageUrl,
    item.previewImage,
    item.previewImageUrl,
    item.preview_image,
    item.previewUrl,
    item.preview_url,
    item.image,
    item.imageUrl,
    item.raw?.thumbnail,
    item.raw?.thumbnailUrl,
    item.raw?.thumbnail_url,
    item.raw?.thumbnailImage,
    item.raw?.thumbnail_image,
    item.raw?.thumbnailImageUrl,
    item.raw?.thumbnail_image_url,
    item.raw?.thumb,
    item.raw?.thumbUrl,
    item.raw?.thumb_url,
    item.raw?.videoThumbnail,
    item.raw?.video_thumbnail,
    item.raw?.videoThumbnailUrl,
    item.raw?.video_thumbnail_url,
    item.raw?.poster,
    item.raw?.posterUrl,
    item.raw?.posterImage,
    item.raw?.posterImageUrl,
    item.raw?.cover,
    item.raw?.coverUrl,
    item.raw?.cover_url,
    item.raw?.coverImage,
    item.raw?.coverImageUrl,
    item.raw?.previewImage,
    item.raw?.previewImageUrl,
    item.raw?.preview_image,
    item.raw?.previewUrl,
    item.raw?.preview_url,
    item.file?.thumbnail,
    item.file?.thumbnailUrl,
    item.file?.thumbnailImage,
    item.file?.poster,
    item.media?.thumbnail,
    item.media?.thumbnailUrl,
    item.media?.thumbnailImage,
    item.media?.videoThumbnail,
    item.media?.poster,
    item.output?.thumbnail,
    item.output?.thumbnailUrl,
    item.watermarkTemplateId?.thumbnail,
    item.watermarkTemplateId?.thumbnailUrl,
    item.watermarkTemplateId?.image,
  );
  if (thumbnail) return thumbnail;

  const mediaUrl = getMediaUrl(item);
  if (isImageUrl(mediaUrl)) return mediaUrl;

  const image = item.image || item.raw?.image;
  if (typeof image === 'string' && isVideoUrl(image)) return null;
  return image || null;
};

export const getMaterialKind = (item = {}, sectionTitle = '') => {
  const mediaUrl = getMediaUrl(item);
  const downloadUrl = getDownloadSourceUrl(item);
  const url = mediaUrl || downloadUrl;
  const typeText = `${getItemText(item)} ${sectionTitle || ''} ${url || ''}`.toLowerCase();

  if (
    isVideoUrl(url) ||
    typeText.includes('reel') ||
    typeText.includes('video') ||
    typeText.includes('story')
  ) {
    return 'video';
  }
  if (isPresentationMetadata(item, sectionTitle) || /\.(ppt|pptx)(\?|#|$)/i.test(url || '')) {
    return 'ppt';
  }
  if (isPdfMetadata(item, sectionTitle) || /\.pdf(\?|#|$)/i.test(url || '')) {
    return 'pdf';
  }
  if (isDocumentUrl(url)) return 'doc';
  return 'image';
};

export const getMaterialKindMeta = (item = {}, sectionTitle = '') => {
  const kind = getMaterialKind(item, sectionTitle);
  switch (kind) {
    case 'video':
      return { kind, label: 'VIDEO', icon: 'play-circle-outline', color: '#C0392B' };
    case 'ppt':
      return { kind, label: 'PPT', icon: 'slideshow', color: '#D35400' };
    case 'pdf':
      return { kind, label: 'PDF', icon: 'picture-as-pdf', color: '#C0392B' };
    case 'doc':
      return { kind, label: 'DOC', icon: 'description', color: '#34495E' };
    default:
      return { kind, label: 'IMAGE', icon: 'image', color: '#2E7D32' };
  }
};

export const isMediaItem = (item = {}, sectionTitle = '') => {
  const type = String(item.type || item.raw?.type || '').toLowerCase();
  const section = String(item.section || sectionTitle || '').toLowerCase();
  const mediaUrl = getMediaUrl(item);

  return (
    isVideoUrl(mediaUrl) ||
    type.includes('reel') ||
    type.includes('video') ||
    type.includes('story') ||
    type.includes('stories') ||
    section.includes('reel') ||
    section.includes('video') ||
    section.includes('story') ||
    section.includes('stories') ||
    section.includes('audio')
  );
};

export const isDocumentItem = (item = {}, sectionTitle = '') => {
  const type = String(item.type || item.raw?.type || '').toLowerCase();
  const section = String(item.section || sectionTitle || '').toLowerCase();
  const mediaUrl = getMediaUrl(item);

  return (
    isDocumentUrl(mediaUrl) ||
    type.includes('pdf') ||
    type.includes('ppt') ||
    type.includes('presentation') ||
    type.includes('powerpoint') ||
    type.includes('brochure') ||
    section.includes('pdf') ||
    section.includes('ppt') ||
    section.includes('presentation') ||
    section.includes('powerpoint') ||
    section.includes('brochure')
  );
};

export const isMediaCollection = (title = '', data = []) => {
  const normalizedTitle = String(title || '').toLowerCase();
  if (
    normalizedTitle.includes('reel') ||
    normalizedTitle.includes('video') ||
    normalizedTitle.includes('story') ||
    normalizedTitle.includes('stories') ||
    normalizedTitle.includes('audio')
  ) {
    return true;
  }
  return data.some((item) => isMediaItem(item, title));
};

export const getTemplateSettings = (item = {}) => {
  const template = item.watermarkTemplateId || item.raw?.watermarkTemplateId || {};
  return {
    templateName: template.name || item.raw?.templateName || '',
    layoutType: template.layoutType || item.raw?.layoutType || '',
    textColor: template.textColor || item.raw?.textColor || '#ffffff',
    accentColor: template.accentColor || item.raw?.accentColor || '',
    sizeScale: template.sizeScale || item.raw?.sizeScale || '',
    imageScale: template.imageScale || item.raw?.imageScale || '',
  };
};

export const getDownloadFilename = (item = {}, url = '') => {
  const title = String(item.title || item.name || 'POLICYBHANDAR-template')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'POLICYBHANDAR-template';

  const clean = lowerPath(url || getDownloadSourceUrl(item));
  const extMatch = clean.match(/\.[a-z0-9]+$/i);
  const isPresentation = isPresentationMetadata(item);
  let ext = extMatch?.[0] || '';
  if (isPresentation && (!ext || ext === '.pdf')) {
    ext = '.pptx';
  } else if (!ext) {
    ext = isVideoUrl(clean) ? '.mp4' : isDocumentUrl(clean) ? '.pdf' : '.jpg';
  }
  return `${title}-${Date.now()}${ext}`;
};
