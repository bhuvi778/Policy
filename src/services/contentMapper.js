import {
  getMaterials,
  getMaterialCategories,
  getMaterialSubcategories,
  getAllMaterialSubcategories,
  createMaterial,
  BASE_URL,
} from './api';
import Storage from './storage';
import { readContentCache, writeContentCache } from './contentCacheStorage';
import { getDefaultMaterialServiceTree, loadCachedMaterialServiceTree } from './materialServiceTree';
import { isImageUrl, isVideoUrl } from '../utils/material';
import templateSeedCatalog from '../data/templateSeedCatalog.json';
import { sectionsHaveContent } from '../utils/contentState';

const HOME_REQUEST_TIMEOUT_MS = 9000;
const HOME_BATCH_LIMIT = 48;
const HOME_ROLE_PAGE_LIMIT = 160;
const HOME_SCOPED_PAGE_LIMIT = 160;
const HOME_SCOPED_MAX_PAGES = 3;
const HOME_SCOPED_MAX_DIRECT_QUERIES = 24;
const HOME_SCOPED_DIRECT_QUERY_CONCURRENCY = 3;
const HOME_SECTION_LIMIT = 16;
const HOME_BANNER_LIMIT = 5;
const HOME_MEDIA_LIMIT = 80;
const HOME_BANNER_GROUP_LIMIT = 80;
const HOME_GROUP_ITEM_LIMIT = 360;
const SEED_CONTROL_KEY = '@policybhandar_material_seed_last_attempt';
const SEED_SUCCESS_FLAG = '@policybhandar_material_seed_success';
const SEED_TAG = 'policybhandar-seed';
const HOME_CACHE_KEY = '@policybhandar_home_sections_cache_v1';
const HOME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HOME_CACHE_SCHEMA = 20;
const CATEGORY_MAP_CACHE_KEY = '@policybhandar_material_taxonomy_cache_v7';
const CATEGORY_MAP_CACHE_SCHEMA = 7;
const homeSectionsMemoryCache = new Map();
const homeCacheWrites = new Map();
const recentMaterialRecords = new Map();
let materialSearchIndex = null;
let materialRecordsRevision = 0;
const COLORS = [
  '#B71C1C',
  '#1A237E',
  '#006064',
  '#1B5E20',
  '#4A148C',
  '#BF360C',
  '#37474F',
  '#880E4F',
  '#0D47A1',
  '#E65100',
];

const cleanText = (value = '') => String(value || '').trim();

const freshParams = () => ({
  fresh: Date.now(),
  cacheBust: Math.random().toString(36).slice(2),
});

const readIdValue = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return cleanText(value._id || value.id || value.value || value.key || '');
  return cleanText(value);
};

const getSubcategoryHierarchyMeta = (subcategoryId = '', taxonomy = categoryMapCache) => {
  const ids = [];
  const seen = new Set();
  let current = readIdValue(subcategoryId);

  while (current && !seen.has(current)) {
    seen.add(current);
    ids.push(current);
    current = readIdValue(taxonomy.subcategoryParents?.[current]);
  }

  const rootId = ids[ids.length - 1] || ids[0] || '';
  const parentId = ids[1] || '';
  return {
    subcategoryLineageIds: ids,
    rootSubcategoryId: rootId,
    rootSubcategoryName: taxonomy.subcategoryNames?.[rootId] || '',
    parentSubcategoryId: parentId,
    parentSubcategoryName: taxonomy.subcategoryNames?.[parentId] || '',
  };
};

const resolveAssetPath = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return normalizeAssetUrl(value);
  if (typeof value !== 'object') return '';

  return normalizeAssetUrl(
    cleanText(value.url) ||
    cleanText(value.path) ||
    cleanText(value.src) ||
    cleanText(value.uri) ||
    cleanText(value.secure_url) ||
    cleanText(value.location) ||
    cleanText(value.fileUrl) ||
    cleanText(value.downloadUrl) ||
    cleanText(value.thumbnail) ||
    cleanText(value.thumbnailUrl) ||
    cleanText(value.poster) ||
    ''
  );
};

const normalizeAssetUrl = (value = '') => {
  const raw = cleanText(value);
  if (!raw) return '';
  if (/^(https?:|file:|content:|data:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${BASE_URL.replace(/\/$/, '')}${raw}`;
  return `${BASE_URL.replace(/\/$/, '')}/${raw.replace(/^\/+/, '')}`;
};

const firstAssetUrl = (item = {}, ...candidates) => {
  const candidatesList = candidates
    .flat()
    .concat([
      item,
      item.raw,
      item.file,
      item.media,
      item.meta,
      item.meta?.file,
      item.fileMeta,
    ])
    .filter(Boolean);

  for (const candidate of candidatesList) {
    const value = resolveAssetPath(candidate);
    if (value) return value;
  }

  const nested =
    resolveAssetPath(item.download) ||
    resolveAssetPath(item.links?.download) ||
    resolveAssetPath(item.results?.file) ||
    resolveAssetPath(item?.raw?.download) ||
    resolveAssetPath(item?.raw?.file) ||
    resolveAssetPath(item?.raw?.links?.download);

  return nested;
};

const firstImageAssetUrl = (...candidates) => {
  for (const candidate of candidates.flat().filter(Boolean)) {
    const value = resolveAssetPath(candidate);
    if (value && !isVideoUrl(value)) return value;
  }
  return '';
};

const normalizeName = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeText = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SECTION_BY_KEY = {
  reels: 'freeAiVideos',
  stories: 'stories',
  dailyMotivation: 'dailyMotivation',
  birthday: 'birthday',
  anniversary: 'anniversary',
  festival: 'festival',
  specialDays: 'specialDays',
  knowledge: 'knowledge',
  news: 'news',
  licplans: 'licplans',
  digitalCards: 'digitalCards',
};

const HOME_SECTION_ORDER = [
  'banners',
  'bannerGroups',
  'freeAiVideos',
  'stories',
  'recentUpdates',
  'dailyMotivation',
  'birthday',
  'anniversary',
  'festival',
  'specialDays',
  'knowledge',
  'news',
  'licplans',
  'digitalCards',
  'concepts',
];

const SECTION_KEYWORDS = {
  banners: ['banner', 'banners', 'slider', 'carousel', 'hero', 'featured'],
  freeAiVideos: ['reel', 'reels', 'video', 'videos'],
  stories: ['story', 'stories'],
  dailyMotivation: ['motivation', 'daily motivation'],
  birthday: ['birthday', 'bday'],
  anniversary: ['anniversary'],
  festival: ['festival', 'festive'],
  specialDays: ['special days', 'special day', 'monthly', 'monthy', 'calendar'],
  knowledge: ['knowledge', 'education', 'guide', 'learning', 'tips', 'insight'],
  news: ['news', 'article', 'article'],
  licplans: ['lic', 'life insurance', 'term', 'ulip', 'insurance', 'plan'],
  digitalCards: ['digital card', 'digitalcard', 'nfc', 'profile card'],
};

const PROFILE_ROLES = ['agent', 'leader'];
const SHARED_ROLE_CATEGORY_KEYWORDS = [
  'greetings',
  'greeting',
  'festival',
  'birthday',
  'anniversary',
  'daily motivation',
  'special days',
  'story',
  'stories',
];

export const normalizeProfileRole = (value = '') => {
  const text = normalizeText(value);
  if (!text) return '';
  if (text.includes('leader')) return 'leader';
  if (text.includes('agent') || text.includes('advisor') || text.includes('insurance advisor')) return 'agent';
  return '';
};

export const getUserProfileRole = (user = {}) => {
  const profile = user.profile || {};
  const values = [
    user.designation,
    user.profileType,
    user.accountType,
    user.role,
    user.memberType,
    profile.designation,
    profile.profileType,
    profile.role,
  ];

  for (const value of values) {
    const role = normalizeProfileRole(value);
    if (role) return role;
  }

  return '';
};

const getHomeCacheKey = (role = '', scope = {}) => {
  const baseKey = role ? `${HOME_CACHE_KEY}_${role}` : HOME_CACHE_KEY;
  const categoryId = cleanText(scope.categoryId);
  const subcategoryId = cleanText(scope.subcategoryId);
  if (!categoryId && !subcategoryId) return baseKey;
  return `${baseKey}_scope_${categoryId || 'all'}_${subcategoryId || 'all'}`;
};

const CATEGORY_MAP_CACHE_TTL_MS = 10 * 60 * 1000;
let categoryMapCache = {
  fetchedAt: 0,
  categories: {},
  categoryNames: {},
  subcategories: {},
  subcategoryNames: {},
  subcategoryParents: {},
  subcategoryChildren: {},
  subcategoryCategories: {},
  subcategoryOrder: {},
};

const getParentSubcategoryId = (subcategory = {}) => {
  const parent =
    subcategory.parentSubcategoryId ??
    subcategory.parentSubCategoryId ??
    subcategory.parentSubcategory ??
    subcategory.parentSubCategory ??
    subcategory.parent_subcategory_id ??
    subcategory.parentId ??
    subcategory.parent_id ??
    subcategory.parent;
  if (parent === undefined || parent === null || parent === '') return '';
  return typeof parent === 'object' ? readIdValue(parent) : String(parent || '');
};

const buildCategoryMapFromGroups = (groups = []) => {
  const categoryNames = {};
  const subcategoryNames = {};
  const subcategoryParents = {};
  const subcategoryChildren = {};
  const subcategoryCategories = {};
  const subcategoryOrder = {};

  groups.forEach((group) => {
    const categoryId = readIdValue(group?.category);
    if (!categoryId) return;
    categoryNames[categoryId] = group?.category?.name || group?.category?.title || group?.category?.label || '';
    const subcategories = Array.isArray(group?.subcategories) ? group.subcategories : [];
    subcategories.forEach((subcategory, index) => {
      const subId = readIdValue(subcategory);
      if (!subId) return;
      const categoryRef = subcategory.categoryId || subcategory.category || categoryId;
      const subCategoryId = typeof categoryRef === 'object' ? readIdValue(categoryRef) : String(categoryRef || categoryId);
      const parentId = getParentSubcategoryId(subcategory);
      subcategoryNames[subId] = subcategory.name || subcategory.title || subcategory.label || '';
      subcategoryParents[subId] = parentId;
      subcategoryCategories[subId] = subCategoryId;
      subcategoryOrder[subId] = index;
      if (parentId) {
        if (!subcategoryChildren[parentId]) subcategoryChildren[parentId] = [];
        subcategoryChildren[parentId].push(subId);
      }
    });
  });

  return {
    fetchedAt: Date.now(),
    categories: categoryNames,
    categoryNames,
    subcategories: subcategoryNames,
    subcategoryNames,
    subcategoryParents,
    subcategoryChildren,
    subcategoryCategories,
    subcategoryOrder,
  };
};

const hasCategoryMapData = (taxonomy = {}) =>
  Object.keys(taxonomy.categoryNames || taxonomy.categories || {}).length > 0 ||
  Object.keys(taxonomy.subcategoryNames || taxonomy.subcategories || {}).length > 0;

const normalizeCategoryMapPayload = (payload = {}) => {
  const taxonomy = payload.taxonomy || payload;
  if (!hasCategoryMapData(taxonomy)) return null;
  return {
    fetchedAt: Number(payload.savedAt ?? taxonomy.fetchedAt ?? Date.now()),
    categories: taxonomy.categoryNames || taxonomy.categories || {},
    categoryNames: taxonomy.categoryNames || taxonomy.categories || {},
    subcategories: taxonomy.subcategoryNames || taxonomy.subcategories || {},
    subcategoryNames: taxonomy.subcategoryNames || taxonomy.subcategories || {},
    subcategoryParents: taxonomy.subcategoryParents || {},
    subcategoryChildren: taxonomy.subcategoryChildren || {},
    subcategoryCategories: taxonomy.subcategoryCategories || {},
    subcategoryOrder: taxonomy.subcategoryOrder || {},
  };
};

const applyCategoryMap = (taxonomy = {}) => {
  const normalized = normalizeCategoryMapPayload(taxonomy);
  if (!normalized) return categoryMapCache;
  Object.assign(categoryMapCache, normalized);
  return categoryMapCache;
};

const loadCachedCategoryMap = async ({ allowStale = false } = {}) => {
  try {
    const raw = await Storage.getItem(CATEGORY_MAP_CACHE_KEY);
    if (raw) {
      const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (payload?.schemaVersion === CATEGORY_MAP_CACHE_SCHEMA) {
        const taxonomy = normalizeCategoryMapPayload(payload);
        if (taxonomy && (allowStale || Date.now() - Number(payload.savedAt || 0) <= CATEGORY_MAP_CACHE_TTL_MS)) {
          return taxonomy;
        }
      }
    }

    const cachedGroups = await loadCachedMaterialServiceTree({ allowStale });
    if (cachedGroups.length) return buildCategoryMapFromGroups(cachedGroups);
  } catch (_) {}
  return null;
};

const saveCategoryMap = async (taxonomy = {}) => {
  try {
    if (!hasCategoryMapData(taxonomy)) return;
    await Storage.setItem(CATEGORY_MAP_CACHE_KEY, JSON.stringify({
      schemaVersion: CATEGORY_MAP_CACHE_SCHEMA,
      savedAt: Date.now(),
      taxonomy,
    }));
  } catch (_) {}
};

export const primeCategoryMapFromServiceTree = (groups = [], { fresh = true } = {}) => {
  const taxonomy = buildCategoryMapFromGroups(groups);
  if (hasCategoryMapData(taxonomy)) {
    if (!fresh) {
      taxonomy.fetchedAt = categoryMapCache.fetchedAt || 0;
      for (const key of Object.keys(taxonomy).filter((name) => name !== 'fetchedAt')) {
        if (key === 'subcategoryChildren') {
          const parents = new Set([...Object.keys(taxonomy[key]), ...Object.keys(categoryMapCache[key] || {})]);
          taxonomy[key] = Object.fromEntries([...parents].map((parent) => [parent, Array.from(new Set([
            ...(taxonomy[key][parent] || []), ...(categoryMapCache[key]?.[parent] || []),
          ]))]));
        } else taxonomy[key] = { ...taxonomy[key], ...categoryMapCache[key] };
      }
    }
    applyCategoryMap(taxonomy);
    if (fresh) saveCategoryMap(taxonomy);
  }
  return categoryMapCache;
};

export const createEmptySectionState = () =>
  HOME_SECTION_ORDER.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

const sanitizeCachedSections = (sections = {}) =>
  HOME_SECTION_ORDER.reduce((acc, key) => {
    const list = Array.isArray(sections[key]) ? sections[key] : [];
    // Preview limits belong to the screen, never to the persisted full list.
    acc[key] = list.map((item) => {
      const normalizedItem = {
        ...item,
        id: item?.id || item?._id || `${key}-cache-${String(Math.random()).slice(2, 8)}`,
      };

      if (key === 'bannerGroups') {
        const fullData = Array.isArray(item?.data) ? item.data : [];
        return {
          ...normalizedItem,
          data: fullData,
          previewData: Array.isArray(item?.previewData)
            ? item.previewData.slice(0, HOME_SECTION_LIMIT)
            : fullData.slice(0, HOME_SECTION_LIMIT),
          count: Number(item?.count || fullData.length),
        };
      }

      return normalizedItem;
    });
    return acc;
  }, {});

const isCacheFresh = (timestamp) => {
  const savedAt = Number(timestamp);
  if (!Number.isFinite(savedAt)) return false;
  return Date.now() - savedAt <= HOME_CACHE_TTL_MS;
};

const buildCachePayload = (sections = {}) => ({
  schemaVersion: HOME_CACHE_SCHEMA,
  source: 'backend',
  sections: sanitizeCachedSections(sections),
  savedAt: Date.now(),
});

const mergeCachedItems = (previous = [], incoming = []) => [...new Map(
  [...previous, ...incoming].map((item) => [item?.id || item?._id || item?.fileUrl || item?.url || item, item]),
).values()];
const mergePartialSections = (previous = {}, incoming = {}) => Object.fromEntries(
  HOME_SECTION_ORDER.map((key) => {
    if (key !== 'bannerGroups') return [key, mergeCachedItems(previous[key], incoming[key])];
    const oldGroups = new Map((previous[key] || []).map((group) => [group.id || group.title, group]));
    const groups = mergeCachedItems(previous[key], incoming[key]).map((group) => {
      const old = oldGroups.get(group.id || group.title);
      const data = mergeCachedItems(old?.data, group.data);
      return { ...group, data, previewData: data.slice(0, HOME_SECTION_LIMIT), count: data.length };
    });
    return [key, groups];
  }),
);

const rememberCachedMaterials = (items) => {
  const seen = new Set();
  items.forEach((item) => {
    const record = item?.raw || item;
    const id = String(record?._id || record?.id || '');
    if (!id || id.startsWith('seed-') || seen.has(id)) return;
    seen.add(id);
    if (recentMaterialRecords.get(id) !== record) {
      recentMaterialRecords.set(id, record);
      materialRecordsRevision += 1;
    }
  });
};

const loadCachedHomeSections = async (role = '', options = {}) => {
  try {
    const cacheKey = getHomeCacheKey(role, options.scope || {});
    const memorySections = homeSectionsMemoryCache.get(cacheKey);
    if (memorySections) return memorySections;

    const payload = await readContentCache(cacheKey);
    if (!payload) return null;
    if (payload?.schemaVersion < 19 || payload?.source !== 'backend') return null;
    if (!options.allowStale && !isCacheFresh(payload?.savedAt)) return null;

    let sections = sanitizeCachedSections(payload?.sections || {});
    if (payload.schemaVersion < HOME_CACHE_SCHEMA) {
      const bundled = loadBundledHomeSections(role, options.scope || {}, await loadImmediateTaxonomy());
      if (bundled) sections = mergePartialSections(bundled, sections);
      await saveCachedHomeSections(sections, role, options.scope || {});
    }
    const hasData = sectionsHaveContent(sections);
    if (hasData) {
      homeSectionsMemoryCache.set(cacheKey, sections);
      rememberCachedMaterials(flattenHomeSectionItems(sections));
      return sections;
    }
    return null;
  } catch (_) {
    return null;
  }
};

const saveCachedHomeSections = async (sections = {}, role = '', scope = {}) => {
  try {
    const cacheKey = getHomeCacheKey(role, scope);
    const sanitizedSections = sanitizeCachedSections(sections);
    homeSectionsMemoryCache.set(cacheKey, sanitizedSections);
    const payload = buildCachePayload(sanitizedSections);
    const write = (homeCacheWrites.get(cacheKey) || Promise.resolve())
      .catch(() => {})
      .then(() => writeContentCache(cacheKey, payload));
    homeCacheWrites.set(cacheKey, write);
    await write;
    if (homeCacheWrites.get(cacheKey) === write) homeCacheWrites.delete(cacheKey);
  } catch (_) {}
};

// Scope selection must not wait for the entire remote service tree.
const loadImmediateTaxonomy = async () => {
  if (hasCategoryMapData(categoryMapCache)) return categoryMapCache;
  const saved = await loadCachedCategoryMap({ allowStale: true });
  const fallback = buildCategoryMapFromGroups(getDefaultMaterialServiceTree());
  fallback.fetchedAt = 0;
  return applyCategoryMap(saved || fallback);
};

export const loadAnyCachedHomeContent = async (options = {}) => {
  const role = normalizeProfileRole(options.profileRole) || getUserProfileRole(options.user || {});
  const sections = await loadCachedHomeSections(role, { allowStale: true })
    || loadBundledHomeSections(role, {}, await loadImmediateTaxonomy());
  if (!sections) return null;
  return {
    categories: [],
    subcategories: { greetings: [], agent: [] },
    sections,
    source: 'cache',
  };
};

export const loadCachedScopedHomeContent = async (options = {}) => {
  const role = normalizeProfileRole(options.profileRole) || getUserProfileRole(options.user || {});
  const scope = {
    categoryId: cleanText(options.categoryId),
    subcategoryId: cleanText(options.subcategoryId),
  };
  if (!scope.categoryId && !scope.subcategoryId) return null;
  const sections = await loadCachedHomeSections(role, { allowStale: true, scope })
    || loadBundledHomeSections(role, scope, await loadImmediateTaxonomy())
    || await loadReusableCachedSections(role, scope, await loadImmediateTaxonomy());
  if (!sections) return null;
  return {
    categories: [],
    subcategories: { greetings: [], agent: [] },
    sections,
    source: 'cache',
  };
};

export const findByName = (items, names = []) => {
  const targets = names.map(normalizeName);
  return items.find((item) => {
    const name = normalizeName(item.name || item.title || '');
    return targets.some((target) => name.includes(target) || target.includes(name));
  });
};

const findApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  for (const key of ['data', 'items', 'materials', 'categories', 'subcategories', 'results', 'result', 'payload']) {
    const list = findApiList(payload[key]);
    if (list) return list;
  }
  return null;
};
export const unwrapList = (payload) => findApiList(payload) || [];
const readMaterialList = (payload) => {
  const list = findApiList(payload);
  if (!list) throw new Error('The content server returned an invalid response. Please retry in a moment.');
  return list;
};
const readMaterialTotal = (payload, fallback) => Number(
  payload?.total ?? payload?.pagination?.total ?? payload?.data?.total
    ?? payload?.data?.pagination?.total ?? payload?.count ?? fallback,
);

export const normalizeMaterial = (item, index = 0, section = '', taxonomy = categoryMapCache, { indexRecord = true } = {}) => {
  const record = item.raw || item;
  const recordId = record._id || record.id;
  if (indexRecord && recordId && recentMaterialRecords.get(String(recordId)) !== record) {
    recentMaterialRecords.set(String(recordId), record);
    materialRecordsRevision += 1;
  }
  const category = typeof item.categoryId === 'object' ? item.categoryId : null;
  const subcategory = typeof item.subcategoryId === 'object' ? item.subcategoryId : null;
  const categoryId = readIdValue(category?._id || item.categoryId);
  const subcategoryId = readIdValue(subcategory?._id || item.subcategoryId);
  const subcategoryMeta = getSubcategoryHierarchyMeta(subcategoryId, taxonomy);
  const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
  const fileUrl = firstAssetUrl(
    item,
    item.renderedUrl,
    item.rendered_url,
    item.outputUrl,
    item.output_url,
    item.downloadUrl,
    item.download_url,
    item.fileUrl,
    item.videoUrl,
    item.url,
    item.mediaUrl,
    item.path,
  ) || '';
  const resolvedImage = firstImageAssetUrl(
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
  const thumbnail = resolvedImage || (isImageUrl(fileUrl) ? fileUrl : null);
  const mediaUrl = isVideoUrl(fileUrl) ? fileUrl : fileUrl;

  return {
    id: String(item._id || item.id || `${section}-${index}`),
    title: item.title || item.name || 'Untitled',
    subtitle: item.description || item.companyName || tags.join(', '),
    quote: item.description || '',
    section,
    image: thumbnail,
    thumbnail,
    mediaUrl,
    fileUrl,
    downloadUrl:
      firstAssetUrl(item, fileUrl, item.downloadUrl, resolvedImage) ||
      item.fileUrl ||
      item.outputUrl ||
      item.url ||
      '',
    type: item.type || '',
    language: item.language || '',
    companyName: item.companyName || '',
    tags,
    categoryId,
    subcategoryId,
    categoryName: category?.name || taxonomy.categoryNames?.[categoryId] || '',
    subcategoryName: subcategory?.name || taxonomy.subcategoryNames?.[subcategoryId] || '',
    ...subcategoryMeta,
    isPremium: !!item.isPremium,
    watermarkTemplateId: item.watermarkTemplateId || null,
    color: COLORS[index % COLORS.length],
    raw: item,
  };
};

const normalizeSeedItem = (item, sectionKey, index = 0, title = '') => {
  const raw = {
    ...item,
    section: title || sectionKey,
    raw: item,
    tags: Array.from(
      new Set(
        [
          ...(Array.isArray(item.tags) ? item.tags : []),
          SEED_TAG,
          ...(Array.isArray(item.seedTags) ? item.seedTags : []),
        ].filter(Boolean),
      ),
    ),
    type: item.type || 'Template',
    _id: item._id || item.id || `seed-${sectionKey}-${index}`,
  };

  return normalizeMaterial(raw, index, title || sectionKey, categoryMapCache, { indexRecord: false });
};

const buildSeedCatalogSections = () => {
  const groups = Array.isArray(templateSeedCatalog?.templateGroups)
    ? templateSeedCatalog.templateGroups
    : [];

  const sections = {
    banners: [],
    freeAiVideos: [],
    stories: [],
    recentUpdates: [],
    dailyMotivation: [],
    birthday: [],
    anniversary: [],
    festival: [],
    specialDays: [],
    concepts: [],
    knowledge: [],
    news: [],
    licplans: [],
    digitalCards: [],
  };

  groups.forEach((group = {}) => {
    const sectionKey = SECTION_BY_KEY[group.sectionKey];
    if (!sectionKey) return;

    const sectionItems = Array.isArray(group.items) ? group.items : [];
    const sectionName = group.section || sectionKey;

    sectionItems.forEach((item, index) => {
      sections[sectionKey].push(
        normalizeSeedItem(
          {
            ...item,
            title: item.title || sectionName,
            description: item.description || `${sectionName} template`,
            tags: [...(group.tags || []), ...(Array.isArray(item.tags) ? item.tags : [])],
          },
          sectionKey,
          index,
          sectionName,
        ),
      );
    });
  });

  return {
    ...sections,
    concepts: sections.licplans,
    recentUpdates: [
      ...sections.news,
      ...sections.knowledge,
      ...sections.birthday,
      ...sections.anniversary,
      ...sections.dailyMotivation,
    ],
  };
};

const CATALOG_FALLBACKS = buildSeedCatalogSections();

export const EMPTY_FALLBACKS = CATALOG_FALLBACKS;

export const normalizeMaterials = (payload, section) =>
  unwrapList(payload).map((item, index) => normalizeMaterial(item, index, section));

export const normalizeMaterialsForUser = async (payload, section, user = {}) => {
  const role = getUserProfileRole(user);
  const taxonomy = await loadImmediateTaxonomy();
  if (role) extractCategoryMaps().catch(() => {});
  return filterMaterialsForRole(unwrapList(payload), role, taxonomy)
    .map((item, index) => normalizeMaterial(item, index, section, taxonomy));
};

const matchesSectionKeyword = (text, matches = []) =>
  matches.some((key) => text.includes(key));

let categoryMapRequest = null;
const fetchCategoryMaps = async (options = {}) => {
  const now = Date.now();
  const forceFresh = !!options.forceFresh;
  if (!forceFresh && categoryMapCache.fetchedAt && now - categoryMapCache.fetchedAt < CATEGORY_MAP_CACHE_TTL_MS) {
    return categoryMapCache;
  }

  const cachedTaxonomy = forceFresh ? null : await loadCachedCategoryMap({ allowStale: false });
  if (!forceFresh && cachedTaxonomy) {
    return applyCategoryMap(cachedTaxonomy);
  }

  const staleTaxonomy = await loadCachedCategoryMap({ allowStale: true });
  if (staleTaxonomy) {
    applyCategoryMap(staleTaxonomy);
  }

  const taxonomyRequestOptions = {
    token: null,
    timeout: 9000,
    cache: !forceFresh,
    ...(forceFresh ? { params: freshParams() } : {}),
  };
  const bulkSubcategories = getAllMaterialSubcategories(taxonomyRequestOptions)
    .then((response) => unwrapList(response.data)).catch(() => null);
  const categories = await getMaterialCategories(taxonomyRequestOptions)
    .then((response) => unwrapList(response.data))
    .catch(() => []);

  if (!categories.length) {
    return hasCategoryMapData(categoryMapCache) ? categoryMapCache : staleTaxonomy || categoryMapCache;
  }

  const categoryNames = {};
  const categoryIds = [];
  for (const category of categories) {
    const id = String(category._id || '');
    if (id) {
      categoryNames[id] = category.name || '';
      categoryIds.push(id);
    }
  }

  const subcategoryNames = {};
  const subcategoryParents = {};
  const subcategoryChildren = {};
  const subcategoryCategories = {};
  const subcategoryOrder = {};
  const failedCategoryIds = new Set();
  const allSubcategories = await bulkSubcategories;
  const subcategoryQueries = categoryIds.map((id) =>
    (allSubcategories?.length
      ? Promise.resolve({ data: allSubcategories.filter((item) => readIdValue(item.categoryId || item.category) === id) })
      : getMaterialSubcategories(id, taxonomyRequestOptions))
      .then((response) => {
        const items = unwrapList(response.data);
        items.forEach((subcategory, index) => {
          const subId = String(subcategory._id || subcategory.id || '');
          if (!subId) return;
          const parent = subcategory.parentSubcategoryId || subcategory.parentId || subcategory.parent;
          const parentId = parent && typeof parent === 'object' ? String(parent._id || parent.id || '') : String(parent || '');
          const categoryRef = subcategory.categoryId || subcategory.category || id;
          const categoryId = categoryRef && typeof categoryRef === 'object' ? String(categoryRef._id || categoryRef.id || '') : String(categoryRef || id);
          subcategoryNames[subId] = subcategory.name || '';
          subcategoryParents[subId] = parentId;
          subcategoryCategories[subId] = categoryId;
          subcategoryOrder[subId] = index;
          if (parentId) {
            if (!subcategoryChildren[parentId]) subcategoryChildren[parentId] = [];
            subcategoryChildren[parentId].push(subId);
          }
        });
      })
      .catch(() => { failedCategoryIds.add(id); }),
  );

  await Promise.allSettled(subcategoryQueries);
  // A failed category request is not evidence that its subcategories were deleted.
  for (const [subId, categoryId] of Object.entries(categoryMapCache.subcategoryCategories || {})) {
    if (!failedCategoryIds.has(categoryId)) continue;
    subcategoryNames[subId] = categoryMapCache.subcategoryNames[subId];
    subcategoryParents[subId] = categoryMapCache.subcategoryParents[subId];
    subcategoryCategories[subId] = categoryId;
    subcategoryOrder[subId] = categoryMapCache.subcategoryOrder[subId];
    const parent = subcategoryParents[subId];
    if (parent) {
      if (!subcategoryChildren[parent]) subcategoryChildren[parent] = [];
      subcategoryChildren[parent].push(subId);
    }
  }
  const nextTaxonomy = {
    fetchedAt: now,
    categories: categoryNames,
    categoryNames,
    subcategories: subcategoryNames,
    subcategoryNames,
    subcategoryParents,
    subcategoryChildren,
    subcategoryCategories,
    subcategoryOrder,
  };
  if (hasCategoryMapData(nextTaxonomy)) applyCategoryMap(nextTaxonomy);
  saveCategoryMap(categoryMapCache);
  return categoryMapCache;
};

const extractCategoryMaps = async (options = {}) => {
  if (categoryMapRequest) return categoryMapRequest;
  const request = fetchCategoryMaps(options);
  categoryMapRequest = request;
  try { return await request; }
  finally { if (categoryMapRequest === request) categoryMapRequest = null; }
};

const getObjectName = (value) => {
  if (!value || typeof value !== 'object') return '';
  return value.name || value.title || value.label || '';
};

const getTaxonomyName = (taxonomy = categoryMapCache, type, id) => {
  const key = String(id || '');
  if (!key) return '';
  if (type === 'category') {
    return taxonomy.categoryNames?.[key] || taxonomy.categories?.[key] || '';
  }
  return taxonomy.subcategoryNames?.[key] || taxonomy.subcategories?.[key] || '';
};

const getDescendantSubcategoryIds = (subcategoryId = '', taxonomy = categoryMapCache) => {
  const rootId = cleanText(subcategoryId);
  if (!rootId) return [];
  const result = new Set([rootId]);
  const stack = [...(taxonomy.subcategoryChildren?.[rootId] || [])];

  while (stack.length) {
    const id = cleanText(stack.pop());
    if (!id || result.has(id)) continue;
    result.add(id);
    stack.push(...(taxonomy.subcategoryChildren?.[id] || []));
  }

  return Array.from(result);
};

const sortSubcategoryIdsByBackendOrder = (ids = [], taxonomy = categoryMapCache) =>
  Array.from(new Set(ids.map(cleanText).filter(Boolean))).sort((left, right) => {
    const leftOrder = Number.isFinite(Number(taxonomy.subcategoryOrder?.[left]))
      ? Number(taxonomy.subcategoryOrder[left])
      : 999999;
    const rightOrder = Number.isFinite(Number(taxonomy.subcategoryOrder?.[right]))
      ? Number(taxonomy.subcategoryOrder[right])
      : 999999;
    return leftOrder - rightOrder;
  });

const getOrderedDescendantSubcategoryIds = (subcategoryId = '', taxonomy = categoryMapCache) =>
  sortSubcategoryIdsByBackendOrder(getDescendantSubcategoryIds(subcategoryId, taxonomy), taxonomy);

const getCategorySubcategoryIds = (categoryId = '', taxonomy = categoryMapCache, { rootsOnly = false } = {}) => {
  const selectedCategoryId = cleanText(categoryId);
  if (!selectedCategoryId) return [];
  const ids = Object.keys(taxonomy.subcategoryNames || taxonomy.subcategories || {})
    .filter((id) => cleanText(taxonomy.subcategoryCategories?.[id]) === selectedCategoryId);
  const filtered = rootsOnly
    ? ids.filter((id) => !cleanText(taxonomy.subcategoryParents?.[id]))
    : ids;
  return sortSubcategoryIdsByBackendOrder(filtered, taxonomy);
};

const getRoleCategoryId = (role = '', taxonomy = categoryMapCache) => {
  const normalizedRole = normalizeProfileRole(role);
  if (!normalizedRole) return '';

  const entries = Object.entries(taxonomy.categoryNames || taxonomy.categories || {});
  const exactMatch = entries.find(([, name]) => normalizeText(name) === normalizedRole);
  if (exactMatch) return exactMatch[0];

  const includesMatch = entries.find(([, name]) => normalizeText(name).includes(normalizedRole));
  return includesMatch ? includesMatch[0] : '';
};

const buildMaterialSearchText = (item = {}, taxonomy = categoryMapCache, normalize = normalizeText) => {
  const raw = item.raw && item.raw !== item ? item.raw : {};
  const category = typeof item.categoryId === 'object' ? item.categoryId : raw.categoryId;
  const subcategory = typeof item.subcategoryId === 'object' ? item.subcategoryId : raw.subcategoryId;
  const categoryId = typeof item.categoryId === 'object' ? item.categoryId?._id : item.categoryId || raw.categoryId;
  const subcategoryId =
    typeof item.subcategoryId === 'object' ? item.subcategoryId?._id : item.subcategoryId || raw.subcategoryId;
  const tags = [
    ...(Array.isArray(item.tags) ? item.tags : []),
    ...(Array.isArray(raw.tags) ? raw.tags : []),
  ];

  return normalize(
    [
      item.title,
      item.name,
      item.description,
      item.companyName,
      item.category,
      item.subcategory,
      item.categoryName,
      item.subcategoryName,
      item.section,
      item.type,
      item.fileName,
      item.filename,
      item.originalName,
      item.originalname,
      item.file?.name,
      item.file?.filename,
      item.file?.originalname,
      item.media?.name,
      item.media?.filename,
      item.meta?.name,
      item.meta?.filename,
      item.fileUrl,
      item.downloadUrl,
      item.image,
      raw.title,
      raw.name,
      raw.description,
      raw.companyName,
      raw.category,
      raw.subcategory,
      raw.categoryName,
      raw.subcategoryName,
      raw.type,
      raw.fileName,
      raw.filename,
      raw.originalName,
      raw.originalname,
      raw.file?.name,
      raw.file?.filename,
      raw.file?.originalname,
      raw.media?.name,
      raw.media?.filename,
      getObjectName(category),
      getObjectName(subcategory),
      getTaxonomyName(taxonomy, 'category', categoryId),
      getTaxonomyName(taxonomy, 'subcategory', subcategoryId),
      tags.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  );
};

const buildMaterialCategoryText = (item = {}, taxonomy = categoryMapCache) => {
  const raw = item.raw && item.raw !== item ? item.raw : {};
  const category = typeof item.categoryId === 'object' ? item.categoryId : raw.categoryId;
  const categoryId = typeof item.categoryId === 'object' ? item.categoryId?._id : item.categoryId || raw.categoryId;

  return normalizeText(
    [
      getObjectName(category),
      item.categoryName,
      raw.categoryName,
      item.category,
      raw.category,
      getTaxonomyName(taxonomy, 'category', categoryId),
    ]
      .filter(Boolean)
      .join(' '),
  );
};

const isSharedRoleCategory = (categoryText = '', searchText = '') => {
  const category = normalizeText(categoryText);
  if (SHARED_ROLE_CATEGORY_KEYWORDS.some((keyword) => category.includes(normalizeText(keyword)))) {
    return true;
  }

  if (!category) {
    return SHARED_ROLE_CATEGORY_KEYWORDS.some((keyword) => searchText.includes(normalizeText(keyword)));
  }

  return false;
};

const isMaterialAllowedForRole = (item = {}, role = '', taxonomy = categoryMapCache) => {
  const normalizedRole = normalizeProfileRole(role);
  if (!normalizedRole) return true;

  const categoryText = buildMaterialCategoryText(item, taxonomy);
  const searchText = buildMaterialSearchText(item, taxonomy);
  if (isSharedRoleCategory(categoryText, searchText)) return true;

  const hasExplicitRoleCategory = PROFILE_ROLES.some((candidate) => categoryText.includes(candidate));
  if (hasExplicitRoleCategory) return categoryText.includes(normalizedRole);

  return true;
};

const filterMaterialsForRole = (items = [], role = '', taxonomy = categoryMapCache) => {
  const normalizedRole = normalizeProfileRole(role);
  if (!normalizedRole) return items;
  return items.filter((item) => isMaterialAllowedForRole(item, normalizedRole, taxonomy));
};

const searchableRecords = () => {
  const snapshot = require('../data/materialCatalogSnapshot.json');
  return [...new Map([
    ...(snapshot.materials || []), ...recentMaterialRecords.values(),
  ].map((item) => [String(item._id || item.id || item.fileUrl), item])).values()];
};

// Preserve Hindi and other scripts; taxonomy classifiers still use their
// existing English keyword normalization independently of the Search screen.
const normalizeSearchText = (value = '') => String(value || '').toLowerCase()
  .replace(/[\u0000-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007f\u2000-\u206f]+/g, ' ').trim();
const materialSearchPlan = (query, taxonomy, role = '') => {
  const normalized = normalizeSearchText(query);
  const roots = normalized ? Object.entries(taxonomy.subcategoryNames || {}).filter(([id, name]) => {
    if (!isMaterialAllowedForRole({ categoryId: taxonomy.subcategoryCategories?.[id] }, role, taxonomy)) return false;
    const canonical = normalizeSearchText(String(name).replace(/\s*\(\s*done\b[^)]*\)/gi, ''));
    // Broad single-word queries such as Festival must still find Diwali/Holi
    // records outside a generic Festival folder. Insurance aliases are precise.
    return (normalized.includes(' ') && canonical === normalized) || canonical === `${normalized} insurance`;
  }).map(([id]) => id) : [];
  return {
    terms: normalized.split(/\s+/).filter(Boolean),
    scope: new Set(roots.flatMap((id) => getOrderedDescendantSubcategoryIds(id, taxonomy))),
  };
};
const matchesMaterialSearch = (item, text, plan) => plan.scope.size
  ? getMaterialSubcategoryIds(item).some((id) => plan.scope.has(id))
  : plan.terms.every((term) => text.includes(term));

export const loadCachedMaterialMatches = async (query, options = {}) => {
  const taxonomy = await loadImmediateTaxonomy();
  const role = normalizeProfileRole(options.profileRole) || getUserProfileRole(options.user || {});
  const signature = `${role}:${taxonomy.fetchedAt}:${Object.keys(taxonomy.subcategoryNames || {}).length}:${materialRecordsRevision}`;
  if (materialSearchIndex?.signature !== signature) {
    materialSearchIndex = {
      signature,
      records: filterMaterialsForRole(searchableRecords(), role, taxonomy)
        .filter((item) => item.isActive !== false)
        .map((item) => {
          const subcategoryId = readIdValue(item.subcategoryId);
          const lineage = getSubcategoryHierarchyMeta(subcategoryId, taxonomy).subcategoryLineageIds || [];
          return { item, text: normalizeSearchText(`${buildMaterialSearchText(item, taxonomy, normalizeSearchText)} ${lineage.map((id) => getTaxonomyName(taxonomy, 'subcategory', id)).join(' ')}`) };
        }),
    };
  }
  const plan = materialSearchPlan(query, taxonomy, role);
  const records = materialSearchIndex.records.filter(({ item, text }) =>
    (!options.predicate || options.predicate(item, text)) && matchesMaterialSearch(item, text, plan));
  const matches = records.slice(0, options.limit ?? records.length)
    .map(({ item }, index) => normalizeMaterial(item, index, options.section || 'Materials', taxonomy));
  // Normalizing these same indexed records also registers them for Home reuse.
  materialSearchIndex.signature = `${role}:${taxonomy.fetchedAt}:${Object.keys(taxonomy.subcategoryNames || {}).length}:${materialRecordsRevision}`;
  return matches;
};

export const searchMaterialContent = async (query, options = {}) => {
  const cached = await loadCachedMaterialMatches(query, options);
  options.onCached?.(cached);
  try {
    // Search the live tag index once; do not scan an arbitrary first page after it.
    const response = await getMaterials(options.params || { tag: query, page: 1, limit: 100 }, { token: null, timeout: 9000 });
    const fresh = await normalizeMaterialsForUser(response.data, options.section || 'Materials', options.user || {});
    const role = normalizeProfileRole(options.profileRole) || getUserProfileRole(options.user || {});
    const plan = materialSearchPlan(query, categoryMapCache, role);
    const matching = filterMaterialsForRole(fresh, role, categoryMapCache).filter((item) => {
      const text = buildMaterialSearchText(item, categoryMapCache, normalizeSearchText);
      return (!options.predicate || options.predicate(item.raw || item, text)) && matchesMaterialSearch(item, text, plan);
    });
    return [...new Map([...cached, ...matching].map((item) => [item.id, item])).values()];
  } catch (error) {
    if (cached.length) return cached;
    throw error;
  }
};

const hasExplicitVideoSignal = (item = {}) => {
  const type = normalizeText(`${item?.type || ''} ${item?.raw?.type || ''}`);
  const mediaUrl = firstAssetUrl(
    item,
    item.fileUrl,
    item.videoUrl,
    item.mediaUrl,
    item.url,
    item.outputUrl,
    item.downloadUrl,
  );

  return (
    isVideoUrl(mediaUrl) ||
    type.includes('reel') ||
    type.includes('video') ||
    type.includes('audio')
  );
};

const isBannerMaterial = (item, taxonomy = categoryMapCache) => {
  if (hasExplicitVideoSignal(item)) return false;
  const type = normalizeText(`${item?.type || ''} ${item?.raw?.type || ''}`);
  const allText = buildMaterialSearchText(item, taxonomy);
  return type.includes('banner') || matchesSectionKeyword(allText, SECTION_KEYWORDS.banners);
};

const isStoryMaterial = (item, taxonomy = categoryMapCache) => {
  const type = normalizeText(`${item?.type || ''} ${item?.raw?.type || ''}`);
  const allText = buildMaterialSearchText(item, taxonomy);
  return type.includes('story') || allText.includes('story') || allText.includes('stories');
};

const isReelOrVideoMaterial = (item, taxonomy = categoryMapCache) => {
  if (isBannerMaterial(item, taxonomy) || isStoryMaterial(item, taxonomy)) return false;

  const type = normalizeText(`${item?.type || ''} ${item?.raw?.type || ''}`);
  const allText = buildMaterialSearchText(item, taxonomy);
  return (
    hasExplicitVideoSignal(item) ||
    type.includes('reel') ||
    type.includes('video') ||
    type.includes('audio') ||
    allText.includes('reel') ||
    allText.includes('video') ||
    allText.includes('audio')
  );
};

const getItemIdValue = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value || '');
};

const collectIdValues = (...values) => {
  const ids = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const id = getItemIdValue(value);
    if (id) ids.push(id);
  };
  values.forEach(visit);
  return Array.from(new Set(ids.map(cleanText).filter(Boolean)));
};

const getMaterialCategoryIds = (item = {}) => {
  const raw = item.raw && item.raw !== item ? item.raw : {};
  return collectIdValues(
    item.categoryId,
    item.category,
    item.categoryIds,
    item.categories,
    item.materialCategoryId,
    item.materialCategory,
    item.file?.categoryId,
    item.media?.categoryId,
    raw.categoryId,
    raw.category,
    raw.categoryIds,
    raw.categories,
    raw.materialCategoryId,
    raw.materialCategory,
  );
};

const getMaterialSubcategoryIds = (item = {}) => {
  const raw = item.raw && item.raw !== item ? item.raw : {};
  return collectIdValues(
    item.subcategoryId,
    item.subCategoryId,
    item.subcategory,
    item.subCategory,
    item.subcategoryIds,
    item.subCategoryIds,
    item.subcategories,
    item.materialSubcategoryId,
    item.materialSubcategory,
    item.file?.subcategoryId,
    item.media?.subcategoryId,
    raw.subcategoryId,
    raw.subCategoryId,
    raw.subcategory,
    raw.subCategory,
    raw.subcategoryIds,
    raw.subCategoryIds,
    raw.subcategories,
    raw.materialSubcategoryId,
    raw.materialSubcategory,
  );
};

const isMaterialInTaxonomyScope = (item = {}, scope = {}, taxonomy = categoryMapCache) => {
  const selectedCategoryId = cleanText(scope.categoryId);
  const selectedSubcategoryIds = new Set((scope.subcategoryIds || []).map(cleanText).filter(Boolean));
  const itemSubcategoryIds = getMaterialSubcategoryIds(item);

  if (selectedSubcategoryIds.size) {
    return itemSubcategoryIds.some((id) => selectedSubcategoryIds.has(id));
  }

  if (!selectedCategoryId) return true;

  const itemCategoryIds = getMaterialCategoryIds(item);
  if (itemCategoryIds.includes(selectedCategoryId)) return true;

  return itemSubcategoryIds.some((id) => cleanText(taxonomy.subcategoryCategories?.[id]) === selectedCategoryId);
};

const filterMaterialsForTaxonomyScope = (items = [], scope = {}, taxonomy = categoryMapCache) =>
  items.filter((item) => isMaterialInTaxonomyScope(item, scope, taxonomy));

const titleCase = (value = '') =>
  cleanText(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

const deriveBannerGroupNameFromTitle = (value = '') => {
  const title = cleanText(value)
    .replace(/\b(banner|banners|template|templates)\b/gi, ' ')
    .replace(/\s+\d+$/g, '')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return title ? titleCase(title) : '';
};

const getBannerGroupTitle = (item = {}, normalizedItem = {}, taxonomy = categoryMapCache) => {
  const raw = item.raw && item.raw !== item ? item.raw : {};
  const subcategoryId = getItemIdValue(item.subcategoryId || raw.subcategoryId || normalizedItem.subcategoryId);
  const categoryId = getItemIdValue(item.categoryId || raw.categoryId || normalizedItem.categoryId);
  const tagTitle = [...(Array.isArray(item.tags) ? item.tags : []), ...(Array.isArray(raw.tags) ? raw.tags : [])]
    .map(cleanText)
    .find((tag) => tag && !matchesSectionKeyword(normalizeText(tag), SECTION_KEYWORDS.banners));

  return (
    cleanText(getObjectName(item.subcategoryId)) ||
    cleanText(getObjectName(raw.subcategoryId)) ||
    cleanText(normalizedItem.subcategoryName) ||
    cleanText(item.subcategoryName || raw.subcategoryName || item.subcategory || raw.subcategory) ||
    cleanText(getTaxonomyName(taxonomy, 'subcategory', subcategoryId)) ||
    cleanText(tagTitle) ||
    deriveBannerGroupNameFromTitle(item.title || item.name || raw.title || raw.name) ||
    cleanText(getObjectName(item.categoryId)) ||
    cleanText(getObjectName(raw.categoryId)) ||
    cleanText(normalizedItem.categoryName) ||
    cleanText(item.categoryName || raw.categoryName || item.category || raw.category) ||
    cleanText(getTaxonomyName(taxonomy, 'category', categoryId)) ||
    'Banners'
  );
};

const addBannerToGroups = (groups, groupIndex, item, normalizedItem, taxonomy = categoryMapCache, groupingScope = {}) => {
  const raw = item.raw && item.raw !== item ? item.raw : {};
  const subcategoryId = getItemIdValue(item.subcategoryId || raw.subcategoryId || normalizedItem.subcategoryId);
  const categoryId = getItemIdValue(item.categoryId || raw.categoryId || normalizedItem.categoryId);
  const scopedGroupId = resolveScopedGroupSubcategoryId(subcategoryId, categoryId, taxonomy, groupingScope);
  const effectiveSubcategoryId = scopedGroupId || subcategoryId;
  const title =
    cleanText(taxonomy.subcategoryNames?.[effectiveSubcategoryId]) ||
    getBannerGroupTitle(item, normalizedItem, taxonomy) ||
    cleanText(normalizedItem?.section) ||
    cleanText(normalizedItem?.title) ||
    'Templates';
  const groupKey = effectiveSubcategoryId || categoryId || normalizeName(title) || 'banners';

  if (!groupIndex.has(groupKey)) {
    const group = {
      id: `banner-group-${groupKey}`,
      title,
      data: [],
      sortOrder: Number.isFinite(Number(taxonomy.subcategoryOrder?.[effectiveSubcategoryId]))
        ? Number(taxonomy.subcategoryOrder[effectiveSubcategoryId])
        : 999999,
    };
    groupIndex.set(groupKey, group);
    groups.push(group);
  }

  const group = groupIndex.get(groupKey);
  if (!group.data.some((entry) => entry.id === normalizedItem.id)) {
    group.data.push({
      ...normalizedItem,
      section: title,
      bannerGroupTitle: title,
    });
  }
};

const getOrderedScopeGroupIds = ({
  parentSubcategoryId = '',
  categoryId = '',
  taxonomy = categoryMapCache,
} = {}) => {
  const parentId = cleanText(parentSubcategoryId);
  const selectedCategoryId = cleanText(categoryId);

  const childIds = parentId
    ? (Array.isArray(taxonomy.subcategoryChildren?.[parentId]) ? taxonomy.subcategoryChildren[parentId] : [])
    : Object.keys(taxonomy.subcategoryNames || taxonomy.subcategories || {})
      .filter((id) =>
        cleanText(taxonomy.subcategoryCategories?.[id]) === selectedCategoryId &&
        !cleanText(taxonomy.subcategoryParents?.[id])
      );

  return childIds
    .map(cleanText)
    .filter(Boolean)
    .sort((left, right) => {
      const leftOrder = Number.isFinite(Number(taxonomy.subcategoryOrder?.[left]))
        ? Number(taxonomy.subcategoryOrder[left])
        : 999999;
      const rightOrder = Number.isFinite(Number(taxonomy.subcategoryOrder?.[right]))
        ? Number(taxonomy.subcategoryOrder[right])
        : 999999;
      return leftOrder - rightOrder;
    });
};

const resolveScopedGroupSubcategoryId = (
  itemSubcategoryId = '',
  itemCategoryId = '',
  taxonomy = categoryMapCache,
  scope = {},
) => {
  const subcategoryId = cleanText(itemSubcategoryId);
  const selectedParentId = cleanText(scope?.parentSubcategoryId);
  const selectedCategoryId = cleanText(scope?.categoryId || itemCategoryId);
  if (!subcategoryId) return '';

  const lineage = getSubcategoryHierarchyMeta(subcategoryId, taxonomy).subcategoryLineageIds || [subcategoryId];
  if (selectedParentId) {
    if (subcategoryId === selectedParentId) return selectedParentId;
    const childUnderParent = lineage.find((id) => cleanText(taxonomy.subcategoryParents?.[id]) === selectedParentId);
    return childUnderParent || subcategoryId;
  }

  if (selectedCategoryId) {
    const rootForCategory = [...lineage].reverse().find((id) =>
      cleanText(taxonomy.subcategoryCategories?.[id]) === selectedCategoryId &&
      !cleanText(taxonomy.subcategoryParents?.[id])
    );
    return rootForCategory || subcategoryId;
  }

  return subcategoryId;
};

const addExpectedBannerGroups = (groups, groupIndex, scope = {}, taxonomy = categoryMapCache) => {
  const childIds = getOrderedScopeGroupIds({
    parentSubcategoryId: scope?.parentSubcategoryId,
    categoryId: scope?.categoryId,
    taxonomy,
  });

  childIds.forEach((childId, index) => {
    const groupKey = cleanText(childId);
    if (!groupKey) return;
    const sortOrder = Number.isFinite(Number(taxonomy.subcategoryOrder?.[groupKey]))
      ? Number(taxonomy.subcategoryOrder[groupKey])
      : index;
    const title = cleanText(taxonomy.subcategoryNames?.[groupKey]) || `Folder ${index + 1}`;

    if (groupIndex.has(groupKey)) {
      const group = groupIndex.get(groupKey);
      group.title = group.title || title;
      group.sortOrder = Math.min(Number(group.sortOrder ?? sortOrder), sortOrder);
      return;
    }

    const group = {
      id: `banner-group-${groupKey}`,
      title,
      data: [],
      previewData: [],
      count: 0,
      sortOrder,
      expectedFolder: true,
    };
    groupIndex.set(groupKey, group);
    groups.push(group);
  });
};

const buildSectionByHeuristics = (item, taxonomy = categoryMapCache, options = {}) => {
  const allText = buildMaterialSearchText(item, taxonomy);
  const title = normalizeText(`${item.title || ''} ${item.name || ''} ${item.raw?.title || ''} ${item.raw?.name || ''}`);

  if (options.allowBannerSection && isBannerMaterial(item, taxonomy)) {
    return 'banners';
  }

  if (isStoryMaterial(item, taxonomy)) {
    return 'stories';
  }

  if (isReelOrVideoMaterial(item, taxonomy)) {
    return 'freeAiVideos';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.dailyMotivation)) {
    return 'dailyMotivation';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.birthday)) {
    return 'birthday';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.anniversary)) {
    return 'anniversary';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.festival)) {
    return 'festival';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.specialDays)) {
    return 'specialDays';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.knowledge)) {
    return 'knowledge';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.news)) {
    return 'news';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.licplans) || title.includes('policy') || title.includes('plan')) {
    return 'licplans';
  }

  if (matchesSectionKeyword(allText, SECTION_KEYWORDS.digitalCards)) {
    return 'digitalCards';
  }

  return 'recentUpdates';
};

const countBannerMaterials = (items = []) =>
  items.filter((item) => {
    if (!isBannerMaterial(item)) return false;
    const normalized = normalizeMaterial(item, 0, 'banners');
    const image = normalized.image || normalized.thumbnail || normalized.fileUrl || normalized.downloadUrl;
    return image && (typeof image !== 'string' || isImageUrl(image));
  }).length;

const fetchAllMaterials = async ({ fetchAll = false, minBannerItems = HOME_BANNER_LIMIT, forceFresh = false } = {}) => {
  const requestOptions = { timeout: HOME_REQUEST_TIMEOUT_MS, token: null, cache: !forceFresh };
  const requestParams = forceFresh ? freshParams() : {};
  const [firstPage, reelPage] = await Promise.all([
    getMaterials({ page: 1, limit: HOME_BATCH_LIMIT, ...requestParams }, requestOptions),
    getMaterials({ type: 'Reel', page: 1, limit: HOME_MEDIA_LIMIT, ...requestParams }, requestOptions)
      .catch(() => null),
  ]);
  const payload = firstPage.data;
  const firstList = [
    ...readMaterialList(payload),
    ...unwrapList(reelPage?.data),
  ];
  const seen = new Set();
  const dedupedFirstList = firstList.filter((item) => {
    const key = String(item?._id || item?.id || item?.fileUrl || item?.url || '');
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const total = readMaterialTotal(payload, firstList.length);

  if (total <= dedupedFirstList.length || !total) return dedupedFirstList;

  const totalPages = Math.ceil(total / HOME_BATCH_LIMIT);
  const maxPages = fetchAll ? totalPages : Math.min(totalPages, 2);
  if (maxPages <= 1) return firstList;

  const remaining = [];
  for (let page = 2; page <= maxPages; page += 1) {
    const response = await getMaterials({ page, limit: HOME_BATCH_LIMIT, ...requestParams }, requestOptions)
      .then((res) => readMaterialList(res.data))
      .catch(() => []);
    remaining.push(...response);
    if (remaining.length + dedupedFirstList.length >= total) break;
    if (!fetchAll && countBannerMaterials([...dedupedFirstList, ...remaining]) >= minBannerItems) break;
  }

  return [...dedupedFirstList, ...remaining].slice(0, total);
};

const fetchMaterialPagesForParams = async (params = {}, options = {}) => {
  const limit = options.limit || 180;
  const timeout = options.timeout || 6500;
  const maxPages = options.maxPages || 3;
  const forceFresh = !!options.forceFresh;
  const requestOptions = { timeout, token: null, cache: !forceFresh };
  const requestParams = forceFresh ? freshParams() : {};
  const firstResponse = await getMaterials({ ...params, page: 1, limit, ...requestParams }, requestOptions);
  const firstPayload = firstResponse.data;
  const firstList = readMaterialList(firstPayload);
  options.onPage?.(firstList);
  const total = readMaterialTotal(firstPayload, firstList.length);
  const totalPages = total ? Math.ceil(total / limit) : 1;
  const pageLimit = Math.min(totalPages, maxPages);
  if (pageLimit < totalPages) options.onIncomplete?.();

  if (pageLimit <= 1) return firstList;

  const rest = await Promise.all(
    Array.from({ length: pageLimit - 1 }, (_, index) => index + 2).map((page) =>
      getMaterials({ ...params, page, limit, ...requestParams }, requestOptions)
        .then((response) => {
          const items = readMaterialList(response.data);
          options.onPage?.(items);
          return items;
        })
        .catch((error) => { options.onError?.(error); return []; }),
    ),
  );

  return [...firstList, ...rest.flat()];
};

const runInBatches = async (items = [], batchSize = HOME_SCOPED_DIRECT_QUERY_CONCURRENCY, mapper = async () => []) => {
  const results = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map(mapper));
    results.push(...batchResults);
  }
  return results;
};

const flattenFetchedResponses = (responses = []) =>
  responses.flatMap((value) => {
    if (!Array.isArray(value)) return value ? [value] : [];
    return value.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));
  }).filter(Boolean);

const buildSectionsFromMaterials = (items, fallbacks = {}, options = {}) => {
  const taxonomy = options.taxonomy || categoryMapCache;
  const fallbackData = { ...fallbacks };
  const sections = HOME_SECTION_ORDER.reduce(
    (acc, key) => {
      acc[key] = [];
      return acc;
    },
    {},
  );

  const useFallbacks = options.includeFallbacks !== false;
  const limit = options.sectionLimit || HOME_SECTION_LIMIT;
  const bannerLimit = options.bannerLimit || HOME_BANNER_LIMIT;
  const mediaLimit = options.mediaLimit || HOME_MEDIA_LIMIT;
  const groupItemLimit = options.groupItemLimit || HOME_GROUP_ITEM_LIMIT;
  const groupAllBySubcategory = !!options.groupAllBySubcategory;
  const groupingScope = {
    parentSubcategoryId: cleanText(options.expectedGroupParentId),
    categoryId: cleanText(options.expectedGroupCategoryId),
  };
  const bannerSeen = new Set();
  const bannerGroupIndex = new Map();

  for (const item of items) {
    if (isBannerMaterial(item, taxonomy)) {
      const groupSection = 'bannerGroups';
      const normalizedBanner = normalizeMaterial(item, sections.banners.length, 'banners', taxonomy);
      const normalizedTemplate = { ...normalizedBanner, section: groupSection };
      const bannerImage =
        normalizedBanner.image ||
        normalizedBanner.thumbnail ||
        normalizedBanner.fileUrl ||
        normalizedBanner.downloadUrl;
      const bannerKey = normalizedBanner.id || bannerImage || normalizedBanner.title;

      if (
        bannerImage &&
        (typeof bannerImage !== 'string' || isImageUrl(bannerImage)) &&
        !bannerSeen.has(bannerKey)
      ) {
        bannerSeen.add(bannerKey);
        sections.banners.push({
          ...normalizedBanner,
          type: normalizedBanner.type || 'Banner',
          image: bannerImage,
          thumbnail: normalizedBanner.thumbnail || bannerImage,
          downloadUrl: normalizedBanner.downloadUrl || normalizedBanner.fileUrl || bannerImage,
        });
      }

      addBannerToGroups(sections.bannerGroups, bannerGroupIndex, item, normalizedTemplate, taxonomy, groupingScope);
      const thematicSection = buildSectionByHeuristics(item, taxonomy);
      if (thematicSection && sections[thematicSection]) {
        sections[thematicSection].push({ ...normalizedBanner, section: thematicSection });
      }
      continue;
    }

    const section = buildSectionByHeuristics(item, taxonomy);
    if (!section || !sections[section]) {
      const normalizedFallback = normalizeMaterial(item, sections.recentUpdates.length, 'recentUpdates', taxonomy);
      sections.recentUpdates.push(normalizedFallback);
      continue;
    }
    const normalizedItem = normalizeMaterial(item, sections[section].length, section, taxonomy);
    sections[section].push(normalizedItem);

    if (groupAllBySubcategory) {
      const groupedItem = { ...normalizedItem, section: 'bannerGroups' };
      addBannerToGroups(sections.bannerGroups, bannerGroupIndex, item, groupedItem, taxonomy, groupingScope);
    }
  }

  if (groupAllBySubcategory) {
    addExpectedBannerGroups(sections.bannerGroups, bannerGroupIndex, groupingScope, taxonomy);
  }

  Object.keys(sections).forEach((key) => {
    const sectionItems = sections[key];
    const maxItems =
      key === 'banners'
        ? bannerLimit
        : key === 'bannerGroups'
          ? (groupAllBySubcategory ? sectionItems.length : HOME_BANNER_GROUP_LIMIT)
          : key === 'freeAiVideos'
            ? mediaLimit
            : limit;

    if (!sectionItems.length && useFallbacks && fallbackData[key]?.length) {
      sections[key] = fallbackData[key].slice(0, maxItems);
    } else if (key === 'bannerGroups') {
      sections[key] = sectionItems
        .slice()
        .sort((left, right) => (left.sortOrder ?? 999999) - (right.sortOrder ?? 999999))
        .slice(0, maxItems)
        .map((group) => {
          const fullData = Array.isArray(group.data) ? group.data.slice(0, groupItemLimit) : [];
          return {
            ...group,
            data: fullData,
            previewData: fullData.slice(0, limit),
            count: fullData.length,
          };
        });
    } else {
      sections[key] = sectionItems.slice(0, maxItems);
    }
  });

  const directRecentUpdates = sections.recentUpdates;
  sections.recentUpdates = Array.from(
    new Map(
      [
        ...directRecentUpdates,
        ...sections.news,
        ...sections.knowledge,
        ...sections.birthday,
        ...sections.anniversary,
        ...sections.dailyMotivation,
        ...sections.festival,
        ...sections.specialDays,
      ].map((item) => [item.id, item]),
    ).values(),
  ).slice(0, limit);

  if (!sections.concepts.length) {
    sections.concepts = sections.licplans;
  }

  return sections;
};

const flattenHomeSectionItems = (sections = {}) =>
  Object.values(sections)
    .flatMap((value) => {
      if (!Array.isArray(value)) return [];
      return value.flatMap((entry) => {
        if (Array.isArray(entry?.data)) return entry.data;
        return entry;
      });
    })
    .filter(Boolean);

// Home and Menu are two views of the same real materials. Reuse their saved
// records only after filtering by role and the selected taxonomy scope.
const loadReusableCachedSections = async (role, scope, taxonomy) => {
  if (!Storage.getAllKeys) return null;
  const categoryId = cleanText(scope.categoryId);
  const subcategoryIds = scope.subcategoryId
    ? getOrderedDescendantSubcategoryIds(scope.subcategoryId, taxonomy) : [];
  const keys = await Storage.getAllKeys().catch(() => []);
  const candidates = keys.filter((key) => {
    if (key.includes(':chunk:')) return false;
    if (key === getHomeCacheKey(role)) return true;
    if (categoryId && key.startsWith(`${getHomeCacheKey(role)}_scope_${categoryId}_`)) return true;
    if (!key.startsWith('@policybhandar_menu_content_v1:')) return false;
    try {
      const [savedRole, , savedCategory] = JSON.parse(key.slice(key.indexOf(':') + 1));
      return savedRole === role && (!categoryId || savedCategory === categoryId);
    } catch (_) { return false; }
  });
  const records = await runInBatches(candidates, 4, async (key) => {
    try {
      const saved = await readContentCache(key);
      if (saved?.sections && (saved.source !== 'backend' || saved.schemaVersion < 19)) return [];
      return (saved?.sections ? flattenHomeSectionItems(saved.sections) : saved?.data || [])
        .map((item) => item.raw || item);
    } catch (_) { return []; }
  });
  const items = filterMaterialsForRole(filterMaterialsForTaxonomyScope(
    flattenFetchedResponses(records), { categoryId, subcategoryIds }, taxonomy,
  ), role, taxonomy);
  const unique = [...new Map(items.map((item) => [item._id || item.id || item.fileUrl, item])).values()];
  const sections = buildSectionsFromMaterials(unique, {}, {
    includeFallbacks: false, taxonomy, groupAllBySubcategory: true,
    expectedGroupParentId: scope.subcategoryId, expectedGroupCategoryId: categoryId,
  });
  if (!sectionsHaveContent(sections)) return null;
  await saveCachedHomeSections(sections, role, scope);
  return sections;
};

const loadBundledHomeSections = (role, scope, taxonomy) => {
  // This is a dated snapshot of real public backend records, not sample templates.
  // It gives a new installation content while the live service refreshes it.
  const snapshot = require('../data/materialCatalogSnapshot.json');
  const records = recentMaterialRecords.size ? searchableRecords() : snapshot.materials || [];
  const materials = filterMaterialsForRole(filterMaterialsForTaxonomyScope(records, {
    categoryId: scope.categoryId,
    subcategoryIds: scope.subcategoryId ? getOrderedDescendantSubcategoryIds(scope.subcategoryId, taxonomy) : [],
  }, taxonomy), role, taxonomy);
  const sections = buildSectionsFromMaterials(materials, {}, {
    taxonomy, includeFallbacks: false, groupAllBySubcategory: true,
    expectedGroupParentId: scope.subcategoryId, expectedGroupCategoryId: scope.categoryId,
    sectionLimit: Math.max(materials.length, 240), mediaLimit: Math.max(materials.length, HOME_MEDIA_LIMIT), groupItemLimit: Math.max(materials.length, 2000),
  });
  if (!sectionsHaveContent(sections)) return null;
  saveCachedHomeSections(sections, role, scope);
  return sections;
};

const loadMaterialsForTaxonomy = async ({
  categoryId = '',
  subcategoryId = '',
  subcategoryIds = [],
  querySubcategoryIds = [],
  title = '',
  role = '',
  user = {},
  limit = HOME_SCOPED_PAGE_LIMIT,
  maxPages = HOME_SCOPED_MAX_PAGES,
  maxDirectQueries = HOME_SCOPED_MAX_DIRECT_QUERIES,
  forceFreshTaxonomy = false,
  forceFreshMaterials = false,
  onPartial,
  onComplete,
  taxonomyOverride,
} = {}) => {
  const subcategoryIdList = Array.from(new Set([
    ...subcategoryIds,
    subcategoryId,
  ].map(cleanText).filter(Boolean)));
  const querySubcategoryIdList = Array.from(new Set([
    ...querySubcategoryIds,
    subcategoryId,
  ].map(cleanText).filter(Boolean)));
  const params = {
    page: 1,
    limit: 120,
    ...(categoryId ? { categoryId } : {}),
  };

  try {
    const taxonomy = taxonomyOverride || await loadImmediateTaxonomy();
    if (!taxonomyOverride) extractCategoryMaps({ forceFresh: forceFreshTaxonomy }).catch(() => {});
    const received = new Map();
    const failures = [];
    let complete = true;
    const scopeFilter = () => ({
      categoryId,
      subcategoryIds: subcategoryId ? getOrderedDescendantSubcategoryIds(subcategoryId, taxonomy) : [],
    });
    const rememberScopedDescendants = (items, query) => {
      if (!query.subcategoryId) return;
      for (const item of items) {
        if (categoryId && !getMaterialCategoryIds(item).includes(categoryId)) continue;
        for (const id of getMaterialSubcategoryIds(item)) {
          if (id === query.subcategoryId || taxonomy.subcategoryCategories[id]) continue;
          // The recursive subcategory endpoint is authoritative about membership.
          // New descendants must not be discarded just because the bundled menu is older.
          taxonomy.subcategoryCategories[id] = categoryId;
          taxonomy.subcategoryParents[id] = query.subcategoryId;
          taxonomy.subcategoryNames[id] = getObjectName(item.subcategoryId) || item.subcategoryName || '';
          taxonomy.subcategoryChildren[query.subcategoryId] = Array.from(new Set([
            ...(taxonomy.subcategoryChildren[query.subcategoryId] || []), id,
          ]));
        }
      }
    };
    const publish = (items) => {
      flattenFetchedResponses([items]).forEach((item) => received.set(String(item?._id || item?.id || item?.fileUrl || Math.random()), item));
      const scoped = filterMaterialsForTaxonomyScope([...received.values()], scopeFilter(), taxonomy);
      const partial = filterMaterialsForRole(scoped, role, taxonomy);
      if (partial.length) onPartial?.(partial);
      return items;
    };
    const materialQueryIds = querySubcategoryIdList.length ? querySubcategoryIdList : subcategoryIdList;
    const directQueryIds = materialQueryIds.filter((id) => id !== subcategoryId).slice(0, maxDirectQueries);
    const firstChildId = directQueryIds[0];
    const shouldFetchCategoryWide = !!categoryId && materialQueryIds.length > maxDirectQueries;
    let successfulQueries = 0;
    const fetchScope = (query, pageLimit = limit) => fetchMaterialPagesForParams(query, {
      timeout: 12000, limit: pageLimit, maxPages, forceFresh: forceFreshMaterials,
      onPage: (items) => { rememberScopedDescendants(items, query); publish(items); },
      onError: (error) => failures.push(error),
      onIncomplete: () => { complete = false; },
    }).then((items) => { successfulQueries += 1; return items; })
      .catch((error) => { failures.push(error); return []; });
    const parentScopedResponse = subcategoryId
      ? fetchScope({ ...params, subcategoryId })
      : Promise.resolve([]);
    const categoryWideResponse = firstChildId && subcategoryId
      ? fetchScope({ ...params, subcategoryId: firstChildId })
      : categoryId ? fetchScope(params)
      : Promise.resolve([]);
    const responses = await Promise.all([
      parentScopedResponse,
      categoryWideResponse,
    ]);
    // If the server cannot be reached, repeating the same failure for every
    // child adds minutes of waiting without discovering any content.
    if (!successfulQueries && failures.length) throw failures[0];
    if (directQueryIds.length && !shouldFetchCategoryWide) {
      const remainingIds = firstChildId && subcategoryId ? directQueryIds.slice(1) : directQueryIds;
      for (let index = 0; index < remainingIds.length; index += HOME_SCOPED_DIRECT_QUERY_CONCURRENCY) {
        const failuresBefore = failures.length;
        const batch = remainingIds.slice(index, index + HOME_SCOPED_DIRECT_QUERY_CONCURRENCY);
        responses.push(...await Promise.all(batch.map((id) => fetchScope({ ...params, subcategoryId: id }))));
        if (failures.length - failuresBefore >= batch.length) break;
      }
    }
    const deduped = Array.from(
      new Map(
        flattenFetchedResponses(responses)
          .map((item) => [String(item?._id || item?.id || item?.fileUrl || Math.random()), item]),
      ).values(),
    );
    const scopedList = filterMaterialsForTaxonomyScope(deduped, scopeFilter(), taxonomy);
    const list = filterMaterialsForRole(scopedList, role, taxonomy);
    if (!list.length && failures.length) throw failures[0];
    onComplete?.(complete && !failures.length && materialQueryIds.length <= maxDirectQueries);
    return list;
  } catch (error) {
    throw error;
  }
};

export const loadHomeContent = async (fallbacks = {}, options = {}) => {
  const includeFallbacks = options.includeFallbacks === true;
  const useCached = options.useCached !== false;
  const fetchAll = !!options.fetchAll;
  const role = normalizeProfileRole(options.profileRole) || getUserProfileRole(options.user || {});
  const selectedCategoryId = cleanText(options.categoryId);
  const selectedSubcategoryId = cleanText(options.subcategoryId);
  const hasScopedSelection = !!(selectedCategoryId || selectedSubcategoryId);
  const scopeCache = hasScopedSelection
    ? { categoryId: selectedCategoryId, subcategoryId: selectedSubcategoryId }
    : {};
  let cachedSections = await loadCachedHomeSections(role, {
      scope: scopeCache,
      allowStale: true,
    });
  const fallbackData = includeFallbacks ? { ...EMPTY_FALLBACKS, ...fallbacks } : { ...fallbacks };
  const taxonomy = options.includeTaxonomy || hasScopedSelection || options.forceFreshTaxonomy
    ? await loadImmediateTaxonomy() : categoryMapCache;
  if (!cachedSections && hasScopedSelection) {
    cachedSections = await loadReusableCachedSections(role, scopeCache, taxonomy);
  }
  if (!cachedSections) cachedSections = loadBundledHomeSections(role, scopeCache, taxonomy);

  if (useCached && options.preferCacheFirst && cachedSections) {
    return {
      categories: [],
      subcategories: { greetings: [], agent: [] },
      sections: cachedSections,
      source: 'cache',
    };
  }

  try {
    if (options.includeTaxonomy || options.forceFreshTaxonomy) {
      extractCategoryMaps({ forceFresh: !!options.forceFreshTaxonomy }).catch(() => {});
    }
    const selectedRootSubcategoryIds = selectedCategoryId && !selectedSubcategoryId
      ? getCategorySubcategoryIds(selectedCategoryId, taxonomy, { rootsOnly: true })
      : [];
    const selectedSubcategoryIds = selectedSubcategoryId
      ? getOrderedDescendantSubcategoryIds(selectedSubcategoryId, taxonomy)
      : selectedRootSubcategoryIds.length
        ? selectedRootSubcategoryIds.flatMap((id) => getOrderedDescendantSubcategoryIds(id, taxonomy))
        : [];
    const roleCategoryId = !hasScopedSelection && fetchAll ? getRoleCategoryId(role, taxonomy) : '';
    // The unscoped Home query is a latest-page refresh, not a complete catalog.
    let scopeComplete = hasScopedSelection;
    const directScopedMaterials = hasScopedSelection
      ? await loadMaterialsForTaxonomy({
        categoryId: selectedCategoryId,
        subcategoryId: selectedSubcategoryId,
        subcategoryIds: selectedSubcategoryIds,
        querySubcategoryIds: selectedSubcategoryId ? selectedSubcategoryIds : selectedRootSubcategoryIds,
        title: 'Content',
        role,
      user: options.user || {},
      limit: options.scopedLimit || HOME_SCOPED_PAGE_LIMIT,
      maxPages: options.scopedMaxPages || HOME_SCOPED_MAX_PAGES,
      maxDirectQueries: options.maxDirectQueries || HOME_SCOPED_MAX_DIRECT_QUERIES,
      forceFreshTaxonomy: !!options.forceFreshTaxonomy,
      forceFreshMaterials: !!options.forceFreshMaterials,
      taxonomyOverride: taxonomy,
      onComplete: (complete) => { scopeComplete = complete; },
      onPartial: (items) => {
        const partialSections = buildSectionsFromMaterials(items, fallbackData, {
          includeFallbacks, taxonomy, sectionLimit: 240, groupItemLimit: 2000,
          groupAllBySubcategory: true, expectedGroupParentId: selectedSubcategoryId,
          expectedGroupCategoryId: selectedCategoryId,
        });
        if (sectionsHaveContent(partialSections)) {
          cachedSections = mergePartialSections(cachedSections || {}, partialSections);
          saveCachedHomeSections(cachedSections, role, scopeCache);
          options.onPartial?.({ sections: cachedSections, source: 'backend' });
        }
      },
    })
      : [];
    const materials = hasScopedSelection
      ? directScopedMaterials
      : roleCategoryId
        ? await fetchMaterialPagesForParams(
          { categoryId: roleCategoryId },
          { timeout: 9000, limit: HOME_ROLE_PAGE_LIMIT, maxPages: fetchAll ? 8 : 4 },
        )
        : await fetchAllMaterials({ fetchAll, forceFresh: !!options.forceFreshMaterials });
    const scopedMaterials = materials;
    const filteredMaterials = filterMaterialsForRole(scopedMaterials, role, taxonomy);
    const fetchedSections = buildSectionsFromMaterials(filteredMaterials, fallbackData, {
      includeFallbacks,
      taxonomy,
      sectionLimit: hasScopedSelection || roleCategoryId ? 240 : undefined,
      bannerLimit: roleCategoryId ? 12 : undefined,
      mediaLimit: roleCategoryId ? 500 : undefined,
      groupItemLimit: hasScopedSelection || roleCategoryId ? 2000 : undefined,
      groupAllBySubcategory: hasScopedSelection || !!roleCategoryId,
      expectedGroupParentId: selectedSubcategoryId,
      expectedGroupCategoryId: selectedCategoryId || roleCategoryId,
    });
    const sections = !scopeComplete && cachedSections
      ? mergePartialSections(cachedSections, fetchedSections) : fetchedSections;

    if (sectionsHaveContent(sections)) {
      await saveCachedHomeSections(sections, role, scopeCache);
      return {
        categories: taxonomy ? Object.values(taxonomy.categories) : [],
        subcategories: { greetings: [], agent: [] },
        sections,
        source: 'backend',
      };
    }

    if (cachedSections) {
      return {
        categories: taxonomy ? Object.values(taxonomy.categories) : [],
        subcategories: { greetings: [], agent: [] },
        sections: cachedSections,
        source: 'cache',
      };
    }

    return {
      categories: Object.values(taxonomy.categories || {}),
      subcategories: { greetings: [], agent: [] }, sections, source: 'empty',
    };
  } catch (_) {}

  if (cachedSections) {
    return {
      categories: [],
      subcategories: { greetings: [], agent: [] },
      sections: cachedSections,
      source: 'cache',
    };
  }

  return {
    categories: [],
    subcategories: { greetings: [], agent: [] },
    sections: buildSectionsFromMaterials([], fallbackData, { includeFallbacks }),
    source: includeFallbacks ? 'fallback' : 'unavailable',
  };
};

export const invalidateHomeContentCache = async () => {
  homeSectionsMemoryCache.clear();
  recentMaterialRecords.clear();
  materialSearchIndex = null;
  materialRecordsRevision += 1;
  categoryMapCache = {
    fetchedAt: 0,
    categories: {},
    categoryNames: {},
    subcategories: {},
    subcategoryNames: {},
    subcategoryParents: {},
    subcategoryChildren: {},
    subcategoryCategories: {},
    subcategoryOrder: {},
  };

  const keys = await Storage.getAllKeys().catch(() => []);
  const dynamicKeys = keys.filter((key) => (
    String(key).startsWith(HOME_CACHE_KEY) ||
    String(key).startsWith('@policybhandar_home_sections_cache_') ||
    String(key).startsWith('@policybhandar_material_taxonomy_cache_') ||
    String(key).startsWith('@policybhandar_material_service_tree_')
  ));
  await Storage.multiRemove(Array.from(new Set([
    HOME_CACHE_KEY,
    getHomeCacheKey('agent'),
    getHomeCacheKey('leader'),
    CATEGORY_MAP_CACHE_KEY,
    ...dynamicKeys,
  ])));
};

export const ensureSeedTemplatesForMissingGroups = async (sections = {}, seedOptions = {}) => {
  const requiredGroups = [
    'dailyMotivation',
    'birthday',
    'anniversary',
    'festival',
    'specialDays',
    'knowledge',
    'news',
    'licplans',
    'digitalCards',
  ];

  const missingGroups = requiredGroups.filter(
    (key) => !Array.isArray(sections[key]) || sections[key].length === 0,
  );

  if (!missingGroups.length) {
    return { skipped: true, reason: 'all-required-groups-present' };
  }

  return seedTemplatesToBackend({
    ...seedOptions,
    sections: seedOptions.sections || missingGroups,
  });
};

const flattenSections = (sections = {}, sectionNames = []) => {
  const selected = sectionNames.length ? sectionNames : Object.keys(sections);
  return selected
    .flatMap((key) => {
      const sectionItems = sections[key] || [];
      return sectionItems.map((item, index) => ({
        ...item,
        section: item.section || key,
        id: item.id || item._id || `${key}-${index}`,
      }));
    })
    .filter((item, index, array) => {
      const value = `${item.title || ''}-${item.fileUrl || item.image || index}`;
      return array.findIndex((entry) => `${entry.title || ''}-${entry.fileUrl || entry.image || ''}` === value) === index;
    });
};

const isSeedDue = async () => {
  const success = await Storage.getItem(SEED_SUCCESS_FLAG);
  if (success === 'done') return false;

  const nextAllowedRaw = await Storage.getItem(SEED_CONTROL_KEY);
  if (!nextAllowedRaw) return true;

  const nextAllowed = Number(nextAllowedRaw);
  if (!Number.isFinite(nextAllowed)) return true;

  return Date.now() >= nextAllowed;
};

export const buildSeedPayload = (item, sectionName) => {
  const title = item.title || 'POLICYBHANDAR Template';
  const description = item.description || item.subtitle || item.quote || sectionName || '';
  return {
    title,
    description,
    type: item.type || 'Template',
    fileUrl: item.fileUrl || item.image || item.downloadUrl || '',
    thumbnail: item.thumbnail || item.image,
    category: sectionName || 'General',
    subcategory: item.subcategoryName || 'Templates',
    tags: Array.from(new Set([...(item.tags || []), SEED_TAG, 'POLICYBHANDAR'])),
    isPremium: !!item.isPremium,
    isActive: true,
    isDownloadable: true,
  };
};

const tryCreateOnBackend = async (payload) => {
  try {
    await createMaterial(payload, { timeout: 7000 });
    return true;
  } catch (error) {
    if (String(error?.message || '').includes('404') || String(error?.message || '').includes('Cannot POST')) {
      return false;
    }
    return false;
  }
};

export const seedTemplatesToBackend = async (seedOptions = {}) => {
  const {
    sections = [],
    ...seedInputs
  } = seedOptions;

  const fallbackData = { ...EMPTY_FALLBACKS, ...seedInputs };
  if (!(await isSeedDue())) return { skipped: true, reason: 'cooldown-active' };

  const defaultSectionNames = [
    'dailyMotivation',
    'recentUpdates',
    'birthday',
    'anniversary',
    'festival',
    'specialDays',
    'licplans',
    'knowledge',
    'news',
    'concepts',
    'digitalCards',
    'stories',
    'freeAiVideos',
  ];
  const sectionNames = Array.isArray(sections) && sections.length ? sections : defaultSectionNames;
  const baseTemplates = flattenSections(fallbackData, sectionNames);

  if (!baseTemplates.length) {
    await Storage.setItem(SEED_CONTROL_KEY, String(Date.now() + 12 * 60 * 60 * 1000));
    return { created: 0, skipped: 0, failed: 0, reason: 'no-base-templates' };
  }

  await Storage.setItem(SEED_CONTROL_KEY, String(Date.now() + 10 * 60 * 1000));

  try {
    const seededAlready = await getMaterials({ tag: SEED_TAG, page: 1, limit: 1 }, { timeout: 7000 })
      .then((response) => unwrapList(response.data).length > 0)
      .catch(() => false);

      if (seededAlready) {
        await Storage.setItem(SEED_SUCCESS_FLAG, 'done');
        return { created: 0, skipped: 0, failed: 0, alreadySeeded: true };
      }
    } catch (_) {}

    let created = 0;
    let failed = 0;
    for (const item of baseTemplates) {
      const payload = buildSeedPayload(item, item.section || 'Templates');
      if (!payload.fileUrl) continue;

      const ok = await tryCreateOnBackend(payload);
      if (ok) {
        created += 1;
      } else {
        failed += 1;
      }
    }

    if (created > 0) {
      await Storage.setItem(SEED_SUCCESS_FLAG, 'done');
      return {
        created,
        skipped: baseTemplates.length - created - failed,
        failed,
      };
    } else {
      await Storage.setItem(SEED_CONTROL_KEY, String(Date.now() + 60 * 60 * 1000));
      return {
        created: 0,
        skipped: baseTemplates.length - failed,
        failed,
      };
    }
  };

const menuItemsFromSections = (sectionId, sections, role) => {
  const sectionMap = {
    motivation: sections.dailyMotivation,
    greetings: [...(sections.birthday || []), ...(sections.anniversary || []), ...(sections.festival || []), ...(sections.specialDays || [])],
    concepts: sections.concepts,
    knowledge: sections.knowledge,
    news: sections.news,
    licplans: sections.licplans,
    audiovideo: sections.freeAiVideos,
    leaders: role === 'leader' ? sections.recentUpdates : [],
    mixplan: sections.concepts,
    mycontent: sections.recentUpdates,
    marketing: sections.recentUpdates,
    digitalcard: sections.digitalCards,
    prospect: [],
  };
  return [...new Map((sectionMap[sectionId] || sections.recentUpdates || []).map((item) => [item.id, item])).values()];
};

const loadMenuSectionFromBackend = async (sectionId, title, fallbacks = {}, options = {}) => {
  const role = normalizeProfileRole(options.profileRole) || getUserProfileRole(options.user || {});
  const selectedCategoryId = cleanText(options.categoryId);
  const selectedSubcategoryId = cleanText(options.subcategoryId);
  const selectedTitle = options.serviceSubcategoryName || options.serviceCategoryName || title;
  const taxonomy = await loadImmediateTaxonomy();
  extractCategoryMaps({ forceFresh: !!options.forceFreshTaxonomy }).catch(() => {});
  const selectedRootSubcategoryIds = selectedCategoryId && !selectedSubcategoryId
    ? getCategorySubcategoryIds(selectedCategoryId, taxonomy, { rootsOnly: true })
    : [];
  const selectedSubcategoryIds = selectedSubcategoryId
    ? getOrderedDescendantSubcategoryIds(selectedSubcategoryId, taxonomy)
    : selectedRootSubcategoryIds.length
      ? selectedRootSubcategoryIds.flatMap((id) => getOrderedDescendantSubcategoryIds(id, taxonomy))
      : [];

  if (selectedCategoryId || selectedSubcategoryId) {
    let complete = true;
    const directData = await loadMaterialsForTaxonomy({
      categoryId: selectedCategoryId,
      subcategoryId: selectedSubcategoryId,
      subcategoryIds: selectedSubcategoryIds,
      querySubcategoryIds: selectedSubcategoryId ? selectedSubcategoryIds : selectedRootSubcategoryIds,
      title: selectedTitle,
      role,
      user: options.user || {},
      taxonomyOverride: taxonomy,
      onComplete: (value) => { complete = value; },
      onPartial: (data) => options.onPartial?.({ title: selectedTitle, data, source: 'backend' }),
    });
    return { title: selectedTitle, data: directData, complete, source: directData.length ? 'backend' : 'empty' };
  }

  const home = await loadHomeContent(fallbacks, {
    includeFallbacks: false,
    includeTaxonomy: true,
    fetchAll: !(selectedCategoryId || selectedSubcategoryId),
    useCached: true,
    ...options,
  });

  if (selectedCategoryId || selectedSubcategoryId) {
    const allItems = Array.from(
      new Map(
        flattenHomeSectionItems(home.sections)
          .filter(Boolean)
          .map((item) => [item.id || item._id, item]),
      ).values(),
    );
    const data = filterMaterialsForTaxonomyScope(allItems, {
      categoryId: selectedCategoryId,
      subcategoryIds: selectedSubcategoryIds,
    }, taxonomy);

    return {
      title: selectedTitle,
      data,
    };
  }

  return {
    title,
    data: menuItemsFromSections(sectionId, home.sections, role),
    source: home.source,
  };
};

export const loadMenuSection = async (sectionId, title, fallbacks = {}, options = {}) => {
  const role = normalizeProfileRole(options.profileRole) || getUserProfileRole(options.user || {});
  const key = `@policybhandar_menu_content_v1:${JSON.stringify([role, sectionId, options.categoryId || '', options.subcategoryId || ''])}`;
  let cached = null;
  try {
    cached = await readContentCache(key);
    if (cached?.data?.length) rememberCachedMaterials(cached.data);
    if (cached?.data?.length) options.onCached?.({ ...cached, source: 'cache' });
  } catch (_) {}
  if (!cached?.data?.length) {
    const scoped = options.categoryId || options.subcategoryId;
    const savedHome = scoped
      ? await loadCachedScopedHomeContent({ ...options, profileRole: role })
      : await loadAnyCachedHomeContent({ ...options, profileRole: role });
    if (savedHome) {
      cached = { title, data: scoped ? [...new Map(flattenHomeSectionItems(savedHome.sections)
        .map((item) => [item.id || item._id, item])).values()] : menuItemsFromSections(sectionId, savedHome.sections, role) };
      if (cached.data.length) options.onCached?.({ ...cached, source: 'cache' });
    }
  }
  try {
    const result = await loadMenuSectionFromBackend(sectionId, title, fallbacks, {
      ...options,
      onPartial: (partial) => {
        cached = { ...partial, data: mergeCachedItems(cached?.data, partial.data) };
        const write = (homeCacheWrites.get(key) || Promise.resolve()).catch(() => {})
          .then(() => writeContentCache(key, cached));
        homeCacheWrites.set(key, write);
        options.onPartial?.(cached);
      },
    });
    if (result?.data?.length) {
      if (result.complete === false) result.data = mergeCachedItems(cached?.data, result.data);
      await homeCacheWrites.get(key)?.catch(() => {});
      await writeContentCache(key, result);
      homeCacheWrites.delete(key);
      return result;
    }
    return cached?.data?.length ? { ...cached, source: 'cache' } : { title, data: [], source: result.source || 'unavailable' };
  } catch (error) {
    if (cached?.data?.length) return { ...cached, source: 'cache' };
    throw error;
  }
};
