import Storage from './storage';
import { getAllMaterialSubcategories, getMaterialCategories, getMaterialSubcategories } from './api';
import serviceTreeSnapshot from '../data/materialServiceTreeSnapshot.json';

const CACHE_KEY = '@policybhandar_material_service_tree_v15';
const LEGACY_CACHE_KEYS = [];
let serviceTreeMemory = null;
let serviceTreeMemorySavedAt = 0;
let serviceTreePromise = null;
const SERVICE_TREE_TIMEOUT_MS = 7000;
const SERVICE_TREE_CACHE_TTL_MS = 15 * 60 * 1000;
const SERVICE_TREE_STALE_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SERVICE_TREE = [
  {
    category: {
      _id: '6a2aa7ca7338eca4e0e9320d',
      name: 'Agent',
      isLeaderCategory: false,
    },
    subcategories: [
      {
        _id: '6a4f8359c746fb12c75340a8',
        categoryId: '6a2aa7ca7338eca4e0e9320d',
        parentSubcategoryId: null,
        name: 'General Insurance',
        isMainSubcategory: true,
      },
      {
        _id: '6a2aa7e27338eca4e0e9320e',
        categoryId: '6a2aa7ca7338eca4e0e9320d',
        parentSubcategoryId: null,
        name: 'Health Insurance',
        isMainSubcategory: true,
      },
      {
        _id: '6a2aac657338eca4e0e9321c',
        categoryId: '6a2aa7ca7338eca4e0e9320d',
        parentSubcategoryId: null,
        name: 'Life Insurance',
        isMainSubcategory: true,
      },
      {
        _id: '6a3b6f6339f18bc0a3d1b7f0',
        categoryId: '6a2aa7ca7338eca4e0e9320d',
        parentSubcategoryId: null,
        name: 'Mutual Fund',
        isMainSubcategory: true,
      },
    ],
  },
  {
    category: {
      _id: '6a3116b7c9b6c0e590559860',
      name: 'Leader',
      isLeaderCategory: true,
    },
    subcategories: [
      {
        _id: '6a312454c9b6c0e590559868',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Appreciations',
      },
      {
        _id: '6a312481c9b6c0e59055986b',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Certificates',
      },
      {
        _id: '6a3125a9c9b6c0e59055986f',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Follow Up- Scripts',
      },
      {
        _id: '6a3125c2c9b6c0e590559870',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Google Forms -Formats',
      },
      {
        _id: '6a31262dc9b6c0e590559872',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Leader Intro - Profile',
      },
      {
        _id: '6a31249bc9b6c0e59055986d',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Objection Handling',
      },
      {
        _id: '6a36814a39f18bc0a3d1b756',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Recruitment',
      },
      {
        _id: '6a312470c9b6c0e59055986a',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Sales Tips',
      },
      {
        _id: '6a31245bc9b6c0e590559869',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Success Stories',
      },
      {
        _id: '6a31248bc9b6c0e59055986c',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Trainings',
      },
      {
        _id: '6a31259ac9b6c0e59055986e',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: "Whats'app Scripts",
      },
      {
        _id: '6a3125eac9b6c0e590559871',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Whatsapp API- Panel -Formats',
      },
      {
        _id: '6a64979dcecdd603ccac2069',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: null,
        name: 'Presentation Skill',
      },
      {
        _id: '6a312a0fc9b6c0e590559897',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: '6a31262dc9b6c0e590559872',
        name: 'Health Insurance',
      },
      {
        _id: '6a312a04c9b6c0e590559896',
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: '6a31262dc9b6c0e590559872',
        name: 'Life Insurance',
      },
      ...[
        ['6a312755c9b6c0e59055987c', "Banker's / Ex Banker's Objections"],
        ['6a3126b0c9b6c0e590559875', 'Business Owners- Objections'],
        ['6a312721c9b6c0e59055987a', 'Gen- Z- Objections'],
        ['6a312c8dc9b6c0e5905598a0', 'General Insurance Agent -Objection'],
        ['6a312c7dc9b6c0e59055989f', 'Health Insurance Agent- Objections'],
        ['6a3126ecc9b6c0e590559878', "House Wife's-Objections"],
        ['6a31276ac9b6c0e59055987d', 'Influencers - Objections'],
        ['6a312c6dc9b6c0e59055989e', 'LIC Agent- Objections'],
        ['6a3126ddc9b6c0e590559877', 'Mutual Fund Distributors- Objections'],
        ['6a3126cfc9b6c0e590559876', 'Professionals- CA/CS/ Advocates'],
        ['6a3129a6c9b6c0e590559895', 'Recently Retired- Objections'],
        ['6a312666c9b6c0e590559873', 'Salaried Person- Objections'],
        ['6a312689c9b6c0e590559874', 'Self Employed - Objections'],
        ['6a31277ac9b6c0e59055987e', 'Social Workers- Objections'],
        ['6a312703c9b6c0e590559879', 'Un Employed- Objections'],
        ['6a312790c9b6c0e59055987f', 'Working Ladies- Objections'],
      ].map(([id, name]) => ({
        _id: id,
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: '6a31249bc9b6c0e59055986d',
        name,
      })),
      ...[
        ['6a3681a139f18bc0a3d1b757', 'Aditya Birla'],
        ['6a3681af39f18bc0a3d1b758', 'HDFC Life'],
        ['6a3681ba39f18bc0a3d1b759', 'ICICI Lombard Health'],
        ['6a3681d039f18bc0a3d1b75a', 'Policy Bazaar'],
        ['6a3681db39f18bc0a3d1b75b', 'Star Health'],
        ['6a3681ed39f18bc0a3d1b75c', 'TATA AIA Life'],
        ['6a3681f539f18bc0a3d1b75d', 'TATA AIG Health'],
      ].map(([id, name]) => ({
        _id: id,
        categoryId: '6a3116b7c9b6c0e590559860',
        parentSubcategoryId: '6a36814a39f18bc0a3d1b756',
        name,
      })),
    ],
  },
  {
    category: {
      _id: '6a3b70d939f18bc0a3d1b801',
      name: 'Greetings & Festival (FREE)',
      isLeaderCategory: false,
    },
    subcategories: [
      {
        _id: '6a3b729d39f18bc0a3d1b802',
        categoryId: '6a3b70d939f18bc0a3d1b801',
        parentSubcategoryId: null,
        name: 'Anniversary',
      },
      {
        _id: '6a3b72a039f18bc0a3d1b803',
        categoryId: '6a3b70d939f18bc0a3d1b801',
        parentSubcategoryId: null,
        name: 'Birthday',
      },
      {
        _id: '6a3b72a439f18bc0a3d1b804',
        categoryId: '6a3b70d939f18bc0a3d1b801',
        parentSubcategoryId: null,
        name: 'Daily Motivation',
      },
      {
        _id: '6a3b72a639f18bc0a3d1b805',
        categoryId: '6a3b70d939f18bc0a3d1b801',
        parentSubcategoryId: null,
        name: 'Special Days',
      },
      {
        _id: '6a3b72aa39f18bc0a3d1b806',
        categoryId: '6a3b70d939f18bc0a3d1b801',
        parentSubcategoryId: null,
        name: 'Stories',
      },
    ],
  },
];

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.categories)) return payload.categories;
  if (Array.isArray(payload?.subcategories)) return payload.subcategories;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (payload?.data && typeof payload.data === 'object') return unwrapList(payload.data);
  if (payload?.result && typeof payload.result === 'object') return unwrapList(payload.result);
  if (payload?.payload && typeof payload.payload === 'object') return unwrapList(payload.payload);
  return [];
};

const getId = (value) => String(value?._id || value?.id || '');

const readId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value.value || '');
  return String(value || '');
};

const freshParams = () => ({
  fresh: Date.now(),
  cacheBust: Math.random().toString(36).slice(2),
});

const getParentId = (value) => {
  const parent =
    value?.parentSubcategoryId ??
    value?.parentSubCategoryId ??
    value?.parentSubcategory ??
    value?.parentSubCategory ??
    value?.parent_subcategory_id ??
    value?.parentId ??
    value?.parent_id ??
    value?.parent;
  if (parent === undefined || parent === null || parent === '') return '';
  return typeof parent === 'object' ? getId(parent) : String(parent);
};

const getCategoryId = (subcategory = {}) =>
  readId(
    subcategory.categoryId ||
    subcategory.category ||
    subcategory.materialCategoryId ||
    subcategory.materialCategory,
  );

const buildSubcategoryTree = (subcategories = []) => {
  const byParent = new Map();
  subcategories.forEach((item) => {
    const parentId = getParentId(item);
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(item);
  });

  const build = (parentId = '', depth = 0) =>
    (byParent.get(parentId) || []).map((item) => ({
      ...item,
      depth,
      children: build(getId(item), depth + 1),
    }));

  return build();
};

const sanitizeGroups = (groups = []) =>
  groups
    .filter((group) => group?.category && getId(group.category))
    .map((group) => ({
      category: group.category,
      subcategories: Array.isArray(group.subcategories) ? group.subcategories : [],
      tree: Array.isArray(group.tree) ? group.tree : buildSubcategoryTree(group.subcategories || []),
      loading: !!group.loading,
    }));

export const getDefaultMaterialServiceTree = () =>
  sanitizeGroups(serviceTreeSnapshot?.length ? serviceTreeSnapshot : DEFAULT_SERVICE_TREE)
    .map((group) => ({ ...group, loading: false }));

const withHardTimeout = (promise, timeout = SERVICE_TREE_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Service tree request timed out.')), timeout);
    }),
  ]);

export const loadCachedMaterialServiceTree = async ({ allowStale = false } = {}) => {
  try {
    const keys = [CACHE_KEY, ...LEGACY_CACHE_KEYS];
    for (const key of keys) {
      const raw = await Storage.getItem(key);
      if (!raw) continue;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const savedAt = Number(parsed?.savedAt || 0);
      const maxAge = allowStale ? SERVICE_TREE_STALE_TTL_MS : SERVICE_TREE_CACHE_TTL_MS;
      if (!savedAt || Date.now() - savedAt > maxAge) continue;
      const groups = sanitizeGroups(parsed?.groups || []);
      if (groups.length) return groups;
    }
    return [];
  } catch (_) {
    return [];
  }
};

export const fetchMaterialServiceTree = async ({ onPartial, timeout = 9000, forceRefresh = false } = {}) => {
  const memoryIsFresh = serviceTreeMemory?.length && Date.now() - serviceTreeMemorySavedAt <= SERVICE_TREE_CACHE_TTL_MS;
  if (!forceRefresh && memoryIsFresh) {
    onPartial?.(serviceTreeMemory);
    return serviceTreeMemory;
  }

  if (!forceRefresh && serviceTreePromise) {
    const finalGroups = await withHardTimeout(serviceTreePromise, timeout + 1500);
    onPartial?.(finalGroups);
    return finalGroups;
  }

  const cached = await loadCachedMaterialServiceTree({ allowStale: true });
  if (cached.length) onPartial?.(cached.map((group) => ({ ...group, loading: false })));

  serviceTreePromise = (async () => {
    const requestOptions = {
      timeout,
      token: null,
      cache: !forceRefresh,
      ...(forceRefresh ? { params: freshParams() } : {}),
    };
    const categoryResponse = await withHardTimeout(
      getMaterialCategories(requestOptions),
      timeout + 1000,
    );
    const categories = unwrapList(categoryResponse.data);
    if (!categories.length) throw new Error('No service categories returned by backend.');
    let groups = categories.map((category) => ({
      category,
      subcategories: [],
      tree: [],
      loading: true,
    }));

    let allSubcategories = [];
    try {
      const allResponse = await withHardTimeout(
        getAllMaterialSubcategories(requestOptions),
        timeout + 1000,
      );
      allSubcategories = unwrapList(allResponse.data);
    } catch (_) {
      allSubcategories = [];
    }

    if (allSubcategories.length) {
      groups = groups.map((group) => {
        const categoryId = getId(group.category);
        const subcategories = allSubcategories.filter((subcategory) => getCategoryId(subcategory) === categoryId);
        return {
          ...group,
          subcategories,
          tree: buildSubcategoryTree(subcategories),
          loading: false,
        };
      });
      onPartial?.(groups);
    } else {
      await Promise.all(categories.map(async (category) => {
        const categoryId = getId(category);
        let subcategories = [];
        try {
          const response = await withHardTimeout(
            getMaterialSubcategories(categoryId, requestOptions),
            timeout + 1000,
          );
          subcategories = unwrapList(response.data);
        } catch (_) {}

        groups = groups.map((group) => (
          getId(group.category) === categoryId
            ? {
              ...group,
              subcategories,
              tree: buildSubcategoryTree(subcategories),
              loading: false,
            }
            : group
        ));
        onPartial?.(groups);
      }));
    }

    const finalGroups = sanitizeGroups(groups).map((group) => ({ ...group, loading: false }));
    serviceTreeMemory = finalGroups;
    serviceTreeMemorySavedAt = Date.now();
    try {
      await Storage.setItem(CACHE_KEY, JSON.stringify({ groups: finalGroups, savedAt: serviceTreeMemorySavedAt }));
    } catch (_) {}
    return finalGroups;
  })();

  try {
    return await withHardTimeout(serviceTreePromise, timeout + 1500);
  } finally {
    serviceTreePromise = null;
  }
};
