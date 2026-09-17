import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, ActivityIndicator, Text, Modal, Pressable, TouchableOpacity, Image, InteractionManager } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Header from '../components/Header';
import BannerCarousel from '../components/BannerCarousel';
import FeatureCards from '../components/FeatureCards';
import ContentTypeTiles from '../components/ContentTypeTiles';
import ContentGrid from '../components/ContentGrid';
import FloatingBar from '../components/FloatingBar';
import DrawerSidebar from '../components/DrawerSidebar';
import BottomMenuSheet from '../components/BottomMenuSheet';
import { Colors } from '../theme/colors';
import Storage from '../services/storage';
import {
  createEmptySectionState,
  loadAnyCachedHomeContent,
  loadCachedScopedHomeContent,
  loadHomeContent,
  invalidateHomeContentCache,
  getUserProfileRole,
  normalizeProfileRole,
  primeCategoryMapFromServiceTree,
} from '../services/contentMapper';
import { useAuth } from '../context/AuthContext';
import { BRAND, getSubscriptionInfo, loadDynamicNotifications } from '../services/appData';
import {
  fetchMaterialServiceTree,
  getDefaultMaterialServiceTree,
  loadCachedMaterialServiceTree,
} from '../services/materialServiceTree';
import { getMaterialSubcategories } from '../services/api';
import { getMediaUrl, isImageUrl, isVideoUrl } from '../utils/material';
const EMPTY_SECTIONS = createEmptySectionState();
const HOME_BANNER_LIMIT = 5;
const HOME_ROW_PREVIEW_LIMIT = 8;
const HOME_INITIAL_BANNER_GROUP_LIMIT = 8;
const HOME_BANNER_GROUP_DISPLAY_LIMIT = 18;
const LAST_HOME_SCOPE_KEY = '@policybhandar_last_home_scope_v1';

const sectionsHaveContent = (sectionState = {}) =>
  Object.values(sectionState || {}).some((items) => Array.isArray(items) && items.length > 0);

const getScopeCacheKey = (scope = {}) => [
  normalizeProfileRole(scope.profileRole) || 'agent',
  String(scope.categoryId || ''),
  String(scope.subcategoryId || ''),
].join(':');

const getServiceScope = (category, subcategory, role, label = '') => ({
  profileRole: normalizeProfileRole(role) || 'agent',
  categoryId: getId(category),
  subcategoryId: subcategory ? getId(subcategory) : '',
  label: label || subcategory?.name || subcategory?.title || subcategory?.label || category?.name || category?.title || category?.label || '',
});

const isValidDisplayName = (value = '') => {
  const text = String(value || '').trim();
  return !!text && !/^\+?\d[\d\s-]{7,}$/.test(text) && text.toLowerCase() !== 'user';
};

const BannerSkeleton = () => (
  <View style={styles.bannerSkeleton}>
    <ActivityIndicator color={Colors.primary} />
    <Text style={styles.bannerSkeletonText}>Syncing latest banners...</Text>
  </View>
);

const LoadingRows = ({ loaded }) => (
  <View style={styles.syncSection}>
    <View style={styles.syncHeader}>
      <View style={styles.redBar} />
      <Text style={styles.syncTitle}>{loaded ? 'Updating content' : 'Loading content'}</Text>
    </View>
    <View style={styles.syncCards}>
      <View style={styles.syncCard} />
      <View style={styles.syncCard} />
      <View style={styles.syncCard} />
    </View>
  </View>
);

const normalizeText = (value = '') =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const getId = (value) => String(value?._id || value?.id || '');

const getCategoryRole = (category = {}) => {
  const name = normalizeText(category.name || category.label || category.title);
  if (name.includes('leader')) return 'leader';
  if (name.includes('agent') || name.includes('advisor')) return 'agent';
  return '';
};

const isSharedCategory = (category = {}) => {
  const name = normalizeText(category.name || category.label || category.title);
  return ['greeting', 'festival', 'birthday', 'anniversary', 'free', 'other'].some((keyword) => name.includes(keyword));
};

const collectExpandableIds = (nodes = [], acc = {}) => {
  nodes.forEach((node) => {
    const id = getId(node);
    const children = Array.isArray(node.children) ? node.children : [];
    if (id && children.length) acc[id] = false;
    collectExpandableIds(children, acc);
  });
  return acc;
};

const roleTitle = (role = '') => (normalizeProfileRole(role) === 'leader' ? 'Leader' : 'Agent');

const serviceLabel = (item = {}, fallback = 'Service') =>
  String(item.name || item.title || item.label || fallback).trim();

const compactServiceLabel = (item = {}, fallback = 'Service') =>
  serviceLabel(item, fallback).replace(/\s*\(FREE\)\s*/i, '').trim();

const getChildren = (node = {}) => (Array.isArray(node.children) ? node.children : []);

const getParentSubcategoryId = (node = {}) => {
  const parent =
    node.parentSubcategoryId ??
    node.parentSubCategoryId ??
    node.parentSubcategory ??
    node.parentSubCategory ??
    node.parent_subcategory_id ??
    node.parentId ??
    node.parent_id ??
    node.parent;
  if (parent === undefined || parent === null || parent === '') return '';
  return typeof parent === 'object' ? getId(parent) : String(parent);
};

const unwrapApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.subcategories)) return payload.subcategories;
  return [];
};

const getNodeChildrenFromGroup = (group = {}, node = {}) => {
  const directChildren = getChildren(node);
  if (directChildren.length) return directChildren;
  const nodeId = getId(node);
  if (!nodeId || !Array.isArray(group.subcategories)) return [];
  return group.subcategories
    .filter((item) => getParentSubcategoryId(item) === nodeId)
    .map((item) => ({
      ...item,
      depth: Number.isFinite(item.depth) ? item.depth : (Number(node.depth || 0) + 1),
      children: getChildren(item),
    }));
};

const nodeHasNestedOptions = (group = {}, node = {}, children = getNodeChildrenFromGroup(group, node)) =>
  children.some((child) => getNodeChildrenFromGroup(group, child).length > 0);

const getItemKey = (item = {}, fallback = '') =>
  String(item.id || item._id || item.raw?._id || item.raw?.id || item.downloadUrl || item.fileUrl || item.mediaUrl || item.image || fallback);

const uniqueItems = (items = []) =>
  Array.from(
    new Map(
      items
        .filter(Boolean)
        .map((item, index) => [getItemKey(item, index), item]),
    ).values(),
  );

const itemText = (item = {}) =>
  normalizeText([
    item.title,
    item.subtitle,
    item.section,
    item.type,
    item.language,
    item.categoryName,
    item.subcategoryName,
    item.raw?.title,
    item.raw?.type,
    item.raw?.categoryName,
    item.raw?.subcategoryName,
  ].filter(Boolean).join(' '));

const getAssetUrl = (item = {}) =>
  String(getMediaUrl(item) || item.downloadUrl || item.fileUrl || item.image || item.thumbnail || item.raw?.downloadUrl || item.raw?.fileUrl || '');

const isVideoContentItem = (item = {}) => {
  const text = itemText(item);
  return isVideoUrl(getAssetUrl(item)) || text.includes('reel') || text.includes('video');
};

const isPdfContentItem = (item = {}) => {
  const text = itemText(item);
  const asset = getAssetUrl(item).toLowerCase();
  return !isVideoContentItem(item) && (text.includes('pdf') || text.includes('brochure') || /\.(pdf)(\?|#|$)/i.test(asset));
};

const isPresentationContentItem = (item = {}) => {
  const text = itemText(item);
  const asset = getAssetUrl(item).toLowerCase();
  return !isVideoContentItem(item) && (text.includes('presentation') || text.includes('ppt') || /\.(ppt|pptx)(\?|#|$)/i.test(asset));
};

const getImageAssetUrl = (item = {}) => {
  const visual = String(
    item.thumbnail ||
    item.thumbnailUrl ||
    item.image ||
    item.imageUrl ||
    item.raw?.thumbnail ||
    item.raw?.thumbnailUrl ||
    item.raw?.image ||
    item.raw?.imageUrl ||
    '',
  );
  if (visual && !isVideoUrl(visual)) return visual;

  const asset = getAssetUrl(item);
  if (asset && !isVideoUrl(asset)) return asset;
  return '';
};

const getPlanRoles = (user = {}) => {
  const activePlan = user.activePlan && typeof user.activePlan === 'object' ? user.activePlan : {};
  const planText = normalizeText([
    activePlan.name,
    activePlan.segment,
    user.subscriptionType,
    user.planName,
    user.role,
    user.designation,
  ].filter(Boolean).join(' '));
  const registeredRole = getUserProfileRole(user);

  if (
    planText.includes('all free') ||
    planText.includes('allfree') ||
    user.hasLeaderAccess ||
    planText.includes('combo') ||
    planText.includes('leader general') ||
    planText.includes('leader health') ||
    planText.includes('leader life') ||
    planText.includes('leader mutual')
  ) {
    return ['agent', 'leader'];
  }

  if (planText.includes('leader') || registeredRole === 'leader') return ['leader'];
  return [normalizeProfileRole(registeredRole) || 'agent'];
};

const HomeScreen = ({ navigation }) => {
  const { user: authUser, logout, refreshProfile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scopePickerOpen, setScopePickerOpen] = useState(false);
  const [scopePickerShown, setScopePickerShown] = useState(false);
  const [scopeRestoreChecked, setScopeRestoreChecked] = useState(false);
  const [serviceTree, setServiceTree] = useState(() => getDefaultMaterialServiceTree());
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [scopeExpanded, setScopeExpanded] = useState({});
  const [scopeNodeLoading, setScopeNodeLoading] = useState({});
  const [selectedRoleForPicker, setSelectedRoleForPicker] = useState('');
  const [selectedScopeTab, setSelectedScopeTab] = useState('agent');
  const [scopePath, setScopePath] = useState([]);
  const [homeScope, setHomeScope] = useState(null);
  const [activeNav, setActiveNav] = useState('home');
  const [sections, setSections] = useState(EMPTY_SECTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notificationCount, setNotificationCount] = useState(0);
  const [hasContentLoaded, setHasContentLoaded] = useState(false);
  const [visibleGroupLimit, setVisibleGroupLimit] = useState(HOME_INITIAL_BANNER_GROUP_LIMIT);
  const scopedSectionsCache = useRef(new Map());
  const prefetchedScopeKeys = useRef(new Set());
  const prefetchedImageUrls = useRef(new Set());
  const lastServiceRefreshRef = useRef(0);
  const activeScopeKeyRef = useRef('');
  const contentRequestRef = useRef(0);
  const subscription = getSubscriptionInfo(authUser || {});
  const allowedPlanRoles = useMemo(() => getPlanRoles(authUser || {}), [authUser]);
  const effectiveHomeRole = homeScope?.profileRole || allowedPlanRoles[0] || getUserProfileRole(authUser || {}) || 'agent';

  const loadContent = useCallback(async (opts = { showAlert: false, silent: true }) => {
    const { showAlert, silent } = opts;
    const isScopedHome = !!(homeScope?.categoryId || homeScope?.subcategoryId);
    const isRoleOnlyScope = !!homeScope && !isScopedHome;
    const shouldFetchAll = false;
    const preferCacheFirst = !showAlert && (silent || isScopedHome);
    const requestId = ++contentRequestRef.current;
    if (!silent) setLoading(true);
    if (!silent) setError('');
    try {
      const content = await loadHomeContent({}, {
        includeFallbacks: false,
        includeTaxonomy: true,
        forceFreshTaxonomy: showAlert,
        fetchAll: shouldFetchAll,
        useCached: !showAlert,
        preferCacheFirst,
        scopedLimit: 160,
        scopedMaxPages: isScopedHome ? 3 : 2,
        maxDirectQueries: isScopedHome ? 18 : undefined,
        forceFreshMaterials: showAlert,
        user: authUser,
        profileRole: effectiveHomeRole,
        categoryId: homeScope?.categoryId || '',
        subcategoryId: homeScope?.subcategoryId || '',
      });
      if (requestId !== contentRequestRef.current) return;
      const nextSections = content?.sections || EMPTY_SECTIONS;
      const nextHasContent = sectionsHaveContent(nextSections);
      if (isScopedHome && nextHasContent) {
        scopedSectionsCache.current.set(getScopeCacheKey(homeScope), nextSections);
      }
      setSections((currentSections) => {
        const currentHasContent = sectionsHaveContent(currentSections);
        if (!nextHasContent && currentHasContent && silent) {
          return currentSections;
        }
        return nextSections;
      });
      setHasContentLoaded(true);
      if (showAlert) Alert.alert('Refresh', 'Latest POLICYBHANDAR content loaded.');

      if ((content?.source === 'cache' && (isScopedHome || isRoleOnlyScope)) || (!silent && isRoleOnlyScope)) {
        loadHomeContent({}, {
          includeFallbacks: false,
          includeTaxonomy: true,
          forceFreshTaxonomy: false,
          fetchAll: false,
          useCached: false,
          scopedLimit: 160,
          scopedMaxPages: isScopedHome ? 3 : 2,
          maxDirectQueries: isScopedHome ? 18 : undefined,
          forceFreshMaterials: false,
          user: authUser,
          profileRole: effectiveHomeRole,
          categoryId: homeScope?.categoryId || '',
          subcategoryId: homeScope?.subcategoryId || '',
        })
          .then((freshContent) => {
            if (requestId !== contentRequestRef.current) return;
            if (freshContent?.sections && sectionsHaveContent(freshContent.sections)) {
              setSections(freshContent.sections);
              if (isScopedHome) {
                scopedSectionsCache.current.set(getScopeCacheKey(homeScope), freshContent.sections);
              }
            }
          })
          .catch(() => {});
      } else if (silent && !isScopedHome) {
        loadHomeContent({}, {
          includeFallbacks: false,
          includeTaxonomy: true,
          forceFreshTaxonomy: false,
          fetchAll: false,
          useCached: false,
          forceFreshMaterials: false,
          user: authUser,
          profileRole: effectiveHomeRole,
          categoryId: homeScope?.categoryId || '',
          subcategoryId: homeScope?.subcategoryId || '',
        })
          .then((freshContent) => {
            if (requestId !== contentRequestRef.current) return;
            if (freshContent?.sections) {
              setSections((currentSections) => (
                sectionsHaveContent(freshContent.sections) || !sectionsHaveContent(currentSections)
                  ? freshContent.sections
                  : currentSections
              ));
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      if (!silent) setError(err.message || 'Unable to load content right now.');
      if (showAlert) Alert.alert('Refresh failed', err.message || 'Unable to load content right now.');
    } finally {
      setHasContentLoaded(true);
      if (!silent) setLoading(false);
    }
  }, [authUser, effectiveHomeRole, homeScope]);

  useEffect(() => {
    let active = true;
    let timer = null;

    if (homeScope) {
      loadContent({ silent: false });
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    }

    if (subscription.active) {
      setSections(EMPTY_SECTIONS);
      setHasContentLoaded(true);
      setLoading(false);
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    }

    loadAnyCachedHomeContent({ user: authUser, profileRole: effectiveHomeRole })
      .then((cached) => {
        if (active && cached?.sections) {
          setSections(cached.sections);
          setHasContentLoaded(true);
        }
        timer = setTimeout(() => {
          if (active) loadContent({ silent: true });
        }, cached?.sections ? 180 : 0);
      })
      .catch(() => {
        timer = setTimeout(() => {
          if (active) loadContent({ silent: true });
        }, 0);
      });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [authUser, effectiveHomeRole, homeScope, loadContent, subscription.active]);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      refreshProfile?.();
    });
    return unsubscribe;
  }, [navigation, refreshProfile]);

  useEffect(() => {
    if (!subscription.active || !authUser || scopePickerShown || !scopeRestoreChecked) return;
    setSelectedRoleForPicker(allowedPlanRoles[0] || 'agent');
    setSelectedScopeTab(normalizeProfileRole(allowedPlanRoles[0]) || 'agent');
    setScopePath([]);
    setScopePickerOpen(true);
    setScopePickerShown(true);
  }, [allowedPlanRoles, authUser, scopePickerShown, scopeRestoreChecked, subscription.active]);

  useEffect(() => {
    if (!subscription.active || servicesLoaded || servicesLoading) return undefined;
    let active = true;
    let showedAny = false;
    let fallbackTimer = null;
    setServicesLoading(true);
    setServicesError('');

    const rememberExpandedGroups = (groups = []) => {
      if (!groups.length) return;
      setScopeExpanded((current) => ({
        ...groups.reduce((acc, group) => {
          const categoryId = getId(group.category);
          if (categoryId) acc[categoryId] = current[categoryId] ?? true;
          collectExpandableIds(group.tree || [], acc);
          return acc;
        }, {}),
        ...current,
      }));
    };

    const showGroups = (groups = []) => {
      if (!active || !groups.length) return;
      showedAny = true;
      const visibleGroups = groups.map((group) => ({ ...group, loading: false }));
      setServiceTree((current) => {
        const nextHasTree = visibleGroups.some((group) => Array.isArray(group.tree) && group.tree.length);
        const currentHasTree = current.some((group) => Array.isArray(group.tree) && group.tree.length);
        return !nextHasTree && currentHasTree ? current : visibleGroups;
      });
      primeCategoryMapFromServiceTree(visibleGroups);
      rememberExpandedGroups(visibleGroups);
    };

    const defaultGroups = getDefaultMaterialServiceTree();
    showGroups(defaultGroups);
    loadCachedMaterialServiceTree({ allowStale: true }).then(showGroups).catch(() => {});
    fallbackTimer = setTimeout(() => {
      if (!showedAny) showGroups(defaultGroups);
    }, 700);

    lastServiceRefreshRef.current = Date.now();
    fetchMaterialServiceTree({
      timeout: 9000,
      forceRefresh: false,
      onPartial: (groups) => {
        showGroups(groups);
      },
    })
      .then((groups) => {
        if (!active) return;
        if (groups.length) showGroups(groups);
        setServicesLoaded(true);
      })
      .catch((err) => {
        if (active) {
          setServiceTree((current) => {
            if (current.length) return current.map((group) => ({ ...group, loading: false }));
            return defaultGroups;
          });
          setServicesError(err?.message || 'Unable to load backend services right now.');
          setServicesLoaded(true);
        }
      })
      .finally(() => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (active) setServicesLoading(false);
      });

    return () => {
      active = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [servicesLoaded, servicesLoading, subscription.active]);

  useEffect(() => {
    if (!subscription.active || !scopePickerOpen || servicesLoading) return undefined;
    const now = Date.now();
    if (now - lastServiceRefreshRef.current < 120000) return undefined;

    let active = true;
    lastServiceRefreshRef.current = now;
    setServicesLoading(true);
    setServicesError('');

    const rememberExpandedGroups = (groups = []) => {
      if (!groups.length) return;
      setScopeExpanded((current) => ({
        ...groups.reduce((acc, group) => {
          const categoryId = getId(group.category);
          if (categoryId) acc[categoryId] = current[categoryId] ?? true;
          collectExpandableIds(group.tree || [], acc);
          return acc;
        }, {}),
        ...current,
      }));
    };

    fetchMaterialServiceTree({
      timeout: 9000,
      forceRefresh: false,
      onPartial: (groups) => {
        if (!active || !groups.length) return;
        setServiceTree(groups);
        primeCategoryMapFromServiceTree(groups);
        rememberExpandedGroups(groups);
      },
    })
      .then((groups) => {
        if (!active || !groups.length) return;
        const finalGroups = groups.map((group) => ({ ...group, loading: false }));
        setServiceTree(finalGroups);
        primeCategoryMapFromServiceTree(finalGroups);
        rememberExpandedGroups(finalGroups);
        setServicesLoaded(true);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setServicesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [scopePickerOpen, servicesLoading, subscription.active]);

  useEffect(() => {
    let timer = null;
    const refreshNotifications = () => {
      loadDynamicNotifications()
        .then((items) => setNotificationCount(items.filter((item) => item.unread).length))
        .catch(() => setNotificationCount(0));
    };
    timer = setTimeout(refreshNotifications, 700);
    const unsubscribe = navigation.addListener?.('focus', refreshNotifications);
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [navigation]);

  const handleViewAll = useCallback((title, data, options = {}) => {
    navigation.navigate('ViewAll', { title, data, ...options });
  }, [navigation]);

  const handleMediaPress = useCallback((item, title) => {
    navigation.navigate('MediaViewer', { item, title });
  }, [navigation]);

  const handleMenuItemPress = useCallback((item) => {
    if (item.id === 'prospect') {
      navigation.navigate('ProspectManagement');
      return;
    }
    navigation.navigate('MenuSection', {
      sectionId: item.id,
      title: item.label.replace('\n', ' '),
      profileRole: item.profileRole,
      previewRole: item.profileRole,
      rolePreviewOnly: item.rolePreviewOnly,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      serviceCategoryName: item.serviceCategoryName,
      serviceSubcategoryName: item.serviceSubcategoryName,
    });
  }, [navigation]);

  const handleFeatureCardPress = useCallback((card) => {
    if (card.route) {
      navigation.navigate(card.route);
    } else {
      Alert.alert(card.label, 'Feature coming soon!');
    }
  }, [navigation]);

  const handleContentTypePress = useCallback((tile, availableTiles = []) => {
    if (!tile?.data?.length) {
      Alert.alert(tile?.title || 'Content', 'No content is available for this type right now.');
      return;
    }
    handleViewAll(tile.title, tile.data, {
      activeContentTypeId: tile.id,
      contentTypeTiles: availableTiles,
    });
  }, [handleViewAll]);

  const handleDrawerNavigate = useCallback((id) => {
    setActiveNav(id);
    setDrawerOpen(false);
    setMenuOpen(false);
    if (id !== 'home') setScopePickerOpen(false);
    const routeMap = {
      profile: 'MyProfile',
      subscription: 'Subscription',
      training: 'Training',
      about: 'AboutUs',
      contact: 'ContactUs',
      rate: 'RateUs',
      terms: 'Terms',
      privacy: 'Privacy',
    };
    if (id === 'home') {
      return;
    }
    const route = routeMap[id];
    if (route) navigation.navigate(route);
  }, [navigation]);

  const handleDrawerLogout = useCallback(async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [logout, navigation]);

  const hasAnyContent = sectionsHaveContent(sections);
  useEffect(() => {
    setVisibleGroupLimit(HOME_INITIAL_BANNER_GROUP_LIMIT);
    const task = InteractionManager.runAfterInteractions(() => {
      setVisibleGroupLimit(HOME_BANNER_GROUP_DISPLAY_LIMIT);
    });
    return () => task?.cancel?.();
  }, [homeScope?.categoryId, homeScope?.subcategoryId, effectiveHomeRole]);

  useEffect(() => {
    if (!hasAnyContent) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const imageUrls = Object.values(sections || {})
        .flatMap((items) => Array.isArray(items) ? items : [])
        .flatMap((item) => Array.isArray(item?.data) ? [item, ...item.data.slice(0, 2)] : [item])
        .map(getImageAssetUrl)
        .filter(Boolean);
      Array.from(new Set(imageUrls))
        .filter((url) => !prefetchedImageUrls.current.has(url))
        .slice(0, 10)
        .forEach((url) => {
          prefetchedImageUrls.current.add(url);
          Image.prefetch(url).catch(() => {});
        });
    });
    return () => task?.cancel?.();
  }, [hasAnyContent, sections]);

  const shouldShowEmptyState = hasContentLoaded && !loading && !hasAnyContent && (!!error || !!homeScope);
  const visibleBanners = (sections.banners || []).slice(0, HOME_BANNER_LIMIT);
  const scopedHomeActive = !!(homeScope?.categoryId || homeScope?.subcategoryId);
  const groupedItems = useMemo(
    () => uniqueItems((sections.bannerGroups || []).flatMap((group) => Array.isArray(group?.data) ? group.data : [])),
    [sections.bannerGroups],
  );
  const visibleBannerGroups = useMemo(
    () => (sections.bannerGroups || []).slice(0, visibleGroupLimit),
    [sections.bannerGroups, visibleGroupLimit],
  );
  const contentTypeTiles = useMemo(() => {
    const allTextItems = uniqueItems([
      ...(sections.recentUpdates || []),
      ...(sections.dailyMotivation || []),
      ...(sections.birthday || []),
      ...(sections.anniversary || []),
      ...(sections.festival || []),
      ...(sections.specialDays || []),
      ...(sections.knowledge || []),
      ...(sections.news || []),
      ...(sections.licplans || []),
      ...(sections.digitalCards || []),
      ...(sections.concepts || []),
    ]);
    const groupedBannerItems = uniqueItems(groupedItems.filter((item) => {
      const text = itemText(item);
      return text.includes('banner') && !isVideoContentItem(item) && !isPdfContentItem(item) && !isPresentationContentItem(item);
    }));
    const imageItems = uniqueItems(groupedItems.filter((item) => {
      const asset = getAssetUrl(item);
      return isImageUrl(asset) && !isVideoContentItem(item) && !isPdfContentItem(item) && !isPresentationContentItem(item);
    }));
    const fileTypeItems = uniqueItems([...groupedItems, ...allTextItems]);
    const fallbackSliderBanners = groupedItems.length ? [] : (sections.banners || []);
    const pdfItems = uniqueItems(fileTypeItems.filter(isPdfContentItem));
    const presentationItems = uniqueItems(fileTypeItems.filter(isPresentationContentItem));
    const tiles = [
      { id: 'recent', title: 'Recent', data: allTextItems.filter((item) => !isVideoContentItem(item)), active: true },
      { id: 'bannersImages', title: 'Banners (Images)', data: uniqueItems([...groupedBannerItems, ...imageItems, ...fallbackSliderBanners]) },
      { id: 'reels', title: 'Reels & Videos', data: uniqueItems(sections.freeAiVideos || []) },
      { id: 'pdfs', title: 'PDFs & Brochures', data: pdfItems },
      { id: 'presentations', title: 'PPT Presentations', data: uniqueItems(presentationItems) },
    ];
    return tiles.map((tile) => ({ ...tile, count: tile.data.length }));
  }, [groupedItems, sections]);
  const roleOptions = useMemo(() => Array.from(new Set(allowedPlanRoles.map((role) => normalizeProfileRole(role) || 'agent'))), [allowedPlanRoles]);
  const selectedTabRole = normalizeProfileRole(selectedScopeTab);
  const selectedPickerRole = selectedTabRole || normalizeProfileRole(selectedRoleForPicker) || roleOptions[0] || 'agent';
  const scopedServiceTree = useMemo(
    () => serviceTree.filter((group) => {
      const categoryRole = getCategoryRole(group.category);
      return isSharedCategory(group.category) || !categoryRole || categoryRole === selectedPickerRole;
    }),
    [selectedPickerRole, serviceTree],
  );
  const selectedRoleGroup = useMemo(
    () => scopedServiceTree.find((group) => getCategoryRole(group.category) === selectedPickerRole),
    [scopedServiceTree, selectedPickerRole],
  );
  const sharedServiceGroups = useMemo(
    () => serviceTree.filter((group) => isSharedCategory(group.category)),
    [serviceTree],
  );
  const scopeTabs = useMemo(() => {
    const groupForRole = (role) => serviceTree.find((group) => getCategoryRole(group.category) === role);
    const roleTabs = ['agent', 'leader'].map((role) => ({
      id: role,
      role,
      label: roleTitle(role),
      icon: role === 'leader' ? 'workspace-premium' : 'support-agent',
      group: groupForRole(role),
    }));
    const sharedTabs = sharedServiceGroups.map((group) => ({
      id: `shared:${getId(group.category) || compactServiceLabel(group.category, 'greetings').toLowerCase()}`,
      role: selectedPickerRole,
      label: compactServiceLabel(group.category, 'Greetings'),
      icon: 'redeem',
      group,
    }));
    return [...roleTabs, ...sharedTabs].filter((tab, index, tabs) => (
      tab.group || index < 2 || tab.label
    )).filter((tab, index, tabs) => tabs.findIndex((item) => item.id === tab.id) === index);
  }, [selectedPickerRole, serviceTree, sharedServiceGroups]);
  const selectedScopeTabInfo = useMemo(
    () => scopeTabs.find((tab) => tab.id === selectedScopeTab) || scopeTabs[0] || null,
    [scopeTabs, selectedScopeTab],
  );
  const selectedScopeGroup = selectedScopeTabInfo?.group || null;
  const canCloseScopePicker = !!homeScope;

  useEffect(() => {
    if (!scopeTabs.length) return;
    if (!scopeTabs.some((tab) => tab.id === selectedScopeTab)) {
      setSelectedScopeTab(scopeTabs[0].id);
      setScopePath([]);
    }
  }, [scopeTabs, selectedScopeTab]);

  const openScopePicker = useCallback(() => {
    const nextRole = normalizeProfileRole(homeScope?.profileRole) || effectiveHomeRole;
    const restoredPath = Array.isArray(homeScope?.scopePath) ? homeScope.scopePath : [];
    setSelectedRoleForPicker(nextRole);
    setSelectedScopeTab(homeScope?.scopeTab || nextRole);
    setScopePath(restoredPath);
    if (restoredPath.length) {
      setScopeExpanded((current) => ({
        ...current,
        ...restoredPath.reduce((acc, node) => {
          const id = getId(node);
          if (id && getChildren(node).length) acc[id] = true;
          return acc;
        }, {}),
      }));
    }
    setScopePickerOpen(true);
  }, [effectiveHomeRole, homeScope]);

  const applyHomeScope = useCallback((nextScope) => {
    const scopeKey = getScopeCacheKey(nextScope);
    contentRequestRef.current += 1;
    activeScopeKeyRef.current = scopeKey;
    const cachedSections = scopedSectionsCache.current.get(scopeKey);
    setHomeScope(nextScope);
    setScopePickerOpen(false);
    setError('');
    Storage.setItem(LAST_HOME_SCOPE_KEY, JSON.stringify({
      profileRole: nextScope.profileRole,
      categoryId: nextScope.categoryId,
      subcategoryId: nextScope.subcategoryId,
      label: nextScope.label,
      scopeTab: nextScope.scopeTab,
      scopePath: nextScope.scopePath || [],
    })).catch(() => {});
    if (cachedSections) {
      setSections(cachedSections);
      setHasContentLoaded(true);
      setLoading(false);
    } else {
      setLoading(true);
      setSections(EMPTY_SECTIONS);
      setHasContentLoaded(false);
      const cachePromise = nextScope.categoryId || nextScope.subcategoryId
        ? loadCachedScopedHomeContent({
          user: authUser,
          profileRole: nextScope.profileRole,
          categoryId: nextScope.categoryId,
          subcategoryId: nextScope.subcategoryId,
        })
        : loadAnyCachedHomeContent({
          user: authUser,
          profileRole: nextScope.profileRole,
        });
      cachePromise
        .then((cached) => {
          if (activeScopeKeyRef.current !== scopeKey || !cached?.sections) return;
          setSections(cached.sections);
          setHasContentLoaded(true);
          setLoading(false);
        })
        .catch(() => {});
    }
  }, [authUser]);

  useEffect(() => {
    if (!subscription.active || !authUser || scopePickerShown) return undefined;
    let active = true;
    Storage.getItem(LAST_HOME_SCOPE_KEY)
      .then((raw) => {
        if (!active || scopePickerShown) return;
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.categoryId || saved?.subcategoryId) {
          setSelectedRoleForPicker(normalizeProfileRole(saved.profileRole) || allowedPlanRoles[0] || 'agent');
          setSelectedScopeTab(saved.scopeTab || normalizeProfileRole(saved.profileRole) || allowedPlanRoles[0] || 'agent');
          setScopePath(Array.isArray(saved.scopePath) ? saved.scopePath : []);
          applyHomeScope(saved);
          setScopePickerShown(true);
          return;
        }
        setScopeRestoreChecked(true);
      })
      .catch(() => setScopeRestoreChecked(true));
    return () => {
      active = false;
    };
  }, [allowedPlanRoles, applyHomeScope, authUser, scopePickerShown, subscription.active]);

  const applyServiceScope = useCallback((category, subcategory = null, path = []) => {
    const categoryRole = getCategoryRole(category);
    const nextRole = categoryRole || selectedPickerRole;
    const categoryName = category?.name || category?.title || category?.label || roleTitle(nextRole);
    const subcategoryName = subcategory?.name || subcategory?.title || subcategory?.label || '';
    const pathLabels = [
      selectedScopeTabInfo?.label || roleTitle(nextRole),
      ...path.map((node) => serviceLabel(node, 'Sub option')),
    ];
    applyHomeScope({
      ...getServiceScope(category, subcategory, nextRole, subcategoryName || categoryName),
      label: pathLabels.filter(Boolean).join(' / '),
      scopeTab: selectedScopeTabInfo?.id || nextRole,
      scopePath: path,
    });
  }, [applyHomeScope, selectedPickerRole, selectedScopeTabInfo]);

  const handleScopeTabPress = useCallback((tab) => {
    setSelectedScopeTab(tab.id);
    setSelectedRoleForPicker(normalizeProfileRole(tab.role) || selectedPickerRole || 'agent');
    setScopePath([]);
  }, [selectedPickerRole]);

  const toggleScopeExpanded = useCallback((id, path = []) => {
    setScopeExpanded((current) => ({ ...current, [id]: !(current[id] ?? false) }));
    setScopePath(path);
  }, []);

  const hydrateScopeGroupChildren = useCallback(async (group, node) => {
    const categoryId = getId(group?.category);
    const nodeId = getId(node);
    if (!categoryId || !nodeId) return [];

    try {
      setScopeNodeLoading((current) => ({ ...current, [nodeId]: true }));
      const response = await getMaterialSubcategories(categoryId, { timeout: 9000, token: null });
      const subcategories = unwrapApiList(response.data);
      if (!subcategories.length) return [];

      let hydratedGroup = null;
      setServiceTree((currentGroups) => currentGroups.map((item) => {
        if (getId(item.category) !== categoryId) return item;
        hydratedGroup = {
          ...item,
          subcategories,
          loading: false,
        };
        return hydratedGroup;
      }));

      const lookupGroup = hydratedGroup || { ...group, subcategories };
      return getNodeChildrenFromGroup(lookupGroup, node);
    } catch (_) {
      return [];
    } finally {
      setScopeNodeLoading((current) => ({ ...current, [nodeId]: false }));
    }
  }, []);

  const handleScopeNodePress = useCallback(async (node, path = []) => {
    const nodeId = getId(node);
    if (nodeId && scopeNodeLoading[nodeId]) return;
    let children = getNodeChildrenFromGroup(selectedScopeGroup, node);
    const nextPath = path.length ? path : [...scopePath, node];
    if (!children.length && selectedScopeGroup?.category) {
      children = await hydrateScopeGroupChildren(selectedScopeGroup, node);
    }
    if (children.length && nodeHasNestedOptions(selectedScopeGroup, node, children)) {
      toggleScopeExpanded(getId(node), nextPath);
      return;
    }
    if (selectedScopeGroup?.category) {
      applyServiceScope(selectedScopeGroup.category, node, nextPath);
    }
  }, [applyServiceScope, hydrateScopeGroupChildren, scopeNodeLoading, scopePath, selectedScopeGroup, toggleScopeExpanded]);

  const handleScopeBack = useCallback(() => {
    if (scopePath.length) {
      setScopePath((current) => current.slice(0, -1));
      return;
    }
    if (canCloseScopePicker) setScopePickerOpen(false);
  }, [canCloseScopePicker, scopePath.length]);

  const handleScopeRequestClose = useCallback(() => {
    if (scopePath.length) {
      setScopePath((current) => current.slice(0, -1));
      return;
    }
    if (canCloseScopePicker) setScopePickerOpen(false);
  }, [canCloseScopePicker, scopePath.length]);

  const renderScopeOption = useCallback((node, path = []) => {
    const id = getId(node);
    const children = getNodeChildrenFromGroup(selectedScopeGroup, node);
    const hasChildren = children.length > 0;
    const canDrillDown = hasChildren && nodeHasNestedOptions(selectedScopeGroup, node, children);
    const isOpen = !!scopeExpanded[id];
    const isNodeLoading = !!scopeNodeLoading[id];
    const iconName = canDrillDown ? (isOpen ? 'folder-open' : 'folder') : 'article';
    const nextPath = [...path, node];

    return (
      <View key={id || node.name}>
        <TouchableOpacity
          style={[styles.scopeBrowseOption, { marginLeft: Math.min((node.depth || 0) * 12, 34) }, canDrillDown && styles.scopeBrowseOptionParent]}
          activeOpacity={0.84}
          onPress={() => handleScopeNodePress(node, nextPath)}
        >
          <View style={[styles.scopeBrowseIcon, canDrillDown && styles.scopeBrowseIconParent]}>
            <MaterialIcons name={iconName} size={19} color={canDrillDown ? Colors.primary : Colors.textGray} />
          </View>
          <View style={styles.scopeBrowseCopy}>
            <Text style={styles.scopeBrowseTitle} numberOfLines={2}>{serviceLabel(node, 'Sub option')}</Text>
            <Text style={styles.scopeBrowseMeta} numberOfLines={1}>
              {canDrillDown ? `${children.length} sub options` : isNodeLoading ? 'Checking sub options...' : 'Tap to open content'}
            </Text>
          </View>
          {isNodeLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <MaterialIcons name={canDrillDown ? (isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down') : 'chevron-right'} size={22} color={Colors.textLight} />
          )}
        </TouchableOpacity>
        {canDrillDown && isOpen ? children.map((child) => renderScopeOption(child, nextPath)) : null}
      </View>
    );
  }, [handleScopeNodePress, scopeExpanded, scopeNodeLoading, selectedScopeGroup]);

  const drawerUser = {
    name: isValidDisplayName(authUser?.name) ? authUser.name.trim().toUpperCase() : '',
    mobile: authUser?.mobile || BRAND.phone,
    designation: authUser?.designation || '',
    company: {
      name: BRAND.name,
      phone: BRAND.phone,
      email: authUser?.email || BRAND.email,
    },
  };

  return (
    <View style={styles.root}>
      <Header
        onMenuPress={() => setDrawerOpen(true)}
        onSearchPress={() => navigation.navigate('Search')}
        onRefreshPress={async () => {
          await invalidateHomeContentCache().catch(() => {});
          await fetchMaterialServiceTree({
            timeout: 9000,
            forceRefresh: true,
            onPartial: (groups) => {
              if (!groups?.length) return;
              setServiceTree(groups);
              primeCategoryMapFromServiceTree(groups);
            },
          }).catch(() => {});
          setServicesLoaded(false);
          loadContent({ showAlert: true, silent: false });
        }}
        onNotificationPress={() => navigation.navigate('Notifications')}
        notificationCount={notificationCount}
      />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        overScrollMode="never"
      >
        {error ? (
          <View style={styles.statusBar}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.statusText}>Refreshing latest POLICYBHANDAR content...</Text>
          </View>
        ) : null}

        {subscription.active ? (
          <View style={styles.scopeBar}>
            <View style={styles.scopeBarCopy}>
              <Text style={styles.scopeBarLabel}>Showing</Text>
              <Text style={styles.scopeBarTitle} numberOfLines={1}>
                {homeScope?.label || `${roleTitle(effectiveHomeRole)} home`}
              </Text>
            </View>
            <TouchableOpacity style={styles.scopeChangeBtn} onPress={openScopePicker} activeOpacity={0.82}>
              <MaterialIcons name="tune" size={17} color={Colors.primary} />
              <Text style={styles.scopeChangeText}>Change</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {shouldShowEmptyState ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No content available right now.</Text>
          </View>
        ) : (
          <>
            {visibleBanners.length ? <BannerCarousel banners={visibleBanners} /> : (!hasContentLoaded || loading ? <BannerSkeleton /> : null)}
            <FeatureCards onCardPress={handleFeatureCardPress} />
            <ContentTypeTiles
              tiles={contentTypeTiles}
              onPress={(tile) => handleContentTypePress(tile, contentTypeTiles)}
            />

            {visibleBannerGroups.map((group, index) => {
              if (!group?.data?.length && !scopedHomeActive) return null;
              const groupTitle = group.title || group.bannerGroupTitle || homeScope?.label || `Templates ${index + 1}`;
              const previewData = Array.isArray(group.previewData) && group.previewData.length
                ? group.previewData
                : (Array.isArray(group.data) ? group.data.slice(0, HOME_ROW_PREVIEW_LIMIT) : []);
              return (
                <ContentGrid
                  key={group.id || groupTitle}
                  title={groupTitle}
                  data={previewData}
                  onViewAll={() => handleViewAll(groupTitle, Array.isArray(group.data) ? group.data : [])}
                  onItemPress={(item) => handleMediaPress(item, groupTitle)}
                />
              );
            })}

            {!scopedHomeActive && sections.recentUpdates.length ? (
              <ContentGrid
                title="Recent Updates"
                data={sections.recentUpdates}
                onViewAll={() => handleViewAll('Recent Updates', sections.recentUpdates)}
                onItemPress={(item) => handleMediaPress(item, 'Recent Updates')}
              />
            ) : null}

            {!scopedHomeActive && sections.dailyMotivation.length ? (
              <ContentGrid
                title="Daily Motivation"
                data={sections.dailyMotivation}
                onViewAll={() => handleViewAll('Daily Motivation', sections.dailyMotivation)}
                onItemPress={(item) => handleMediaPress(item, 'Daily Motivation')}
              />
            ) : null}

            {!scopedHomeActive && sections.birthday.length ? (
              <ContentGrid
                title="Birthday"
                data={sections.birthday}
                onViewAll={() => handleViewAll('Birthday', sections.birthday)}
                onItemPress={(item) => handleMediaPress(item, 'Birthday')}
              />
            ) : null}

            {!scopedHomeActive && sections.anniversary.length ? (
              <ContentGrid
                title="Anniversary"
                data={sections.anniversary}
                onViewAll={() => handleViewAll('Anniversary', sections.anniversary)}
                onItemPress={(item) => handleMediaPress(item, 'Anniversary')}
              />
            ) : null}

            {!scopedHomeActive && sections.festival.length ? (
              <ContentGrid
                title="Festival"
                data={sections.festival}
                onViewAll={() => handleViewAll('Festival', sections.festival)}
                onItemPress={(item) => handleMediaPress(item, 'Festival')}
              />
            ) : null}

            {!scopedHomeActive && sections.specialDays.length ? (
              <ContentGrid
                title="Monthly Days"
                data={sections.specialDays}
                onViewAll={() => handleViewAll('Monthly Days', sections.specialDays)}
                onItemPress={(item) => handleMediaPress(item, 'Monthly Days')}
              />
            ) : null}

            {!scopedHomeActive && sections.concepts.length ? (
              <ContentGrid
                title="Concepts"
                data={sections.concepts}
                onViewAll={() => handleViewAll('Concepts', sections.concepts)}
                onItemPress={(item) => handleMediaPress(item, 'Concepts')}
              />
            ) : null}

            {!scopedHomeActive && sections.knowledge.length ? (
              <ContentGrid
                title="Knowledge Centre"
                data={sections.knowledge}
                onViewAll={() => handleViewAll('Knowledge Centre', sections.knowledge)}
                onItemPress={(item) => handleMediaPress(item, 'Knowledge Centre')}
              />
            ) : null}

            {!scopedHomeActive && sections.news.length ? (
              <ContentGrid
                title="News & Articles"
                data={sections.news}
                onViewAll={() => handleViewAll('News & Articles', sections.news)}
                onItemPress={(item) => handleMediaPress(item, 'News & Articles')}
              />
            ) : null}

            {!scopedHomeActive && sections.licplans.length ? (
              <ContentGrid
                title="LIC Plans"
                data={sections.licplans}
                onViewAll={() => handleViewAll('LIC Plans', sections.licplans)}
                onItemPress={(item) => handleMediaPress(item, 'LIC Plans')}
              />
            ) : null}

            {!scopedHomeActive && sections.digitalCards.length ? (
              <ContentGrid
                title="Digital Cards"
                data={sections.digitalCards}
                onViewAll={() => handleViewAll('Digital Cards', sections.digitalCards)}
                onItemPress={(item) => handleMediaPress(item, 'Digital Cards')}
              />
            ) : null}

            {!hasAnyContent ? <LoadingRows loaded={hasContentLoaded} /> : null}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      <FloatingBar
        onMenuPress={() => setMenuOpen(true)}
      />

      <DrawerSidebar
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeItem={activeNav}
        onNavigate={handleDrawerNavigate}
        onLogout={handleDrawerLogout}
        userData={drawerUser}
      />

      <BottomMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onItemPress={handleMenuItemPress}
      />

      <Modal
        visible={scopePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={handleScopeRequestClose}
      >
        <View style={styles.scopeModalRoot}>
          <Pressable style={styles.scopeBackdrop} onPress={() => { if (canCloseScopePicker) setScopePickerOpen(false); }} />
          <View style={styles.scopeSheet}>
            <View style={styles.scopeHandle} />
            <View style={styles.scopeHeader}>
              <TouchableOpacity
                style={styles.scopeMenuBtn}
                onPress={() => setDrawerOpen(true)}
                activeOpacity={0.82}
              >
                <MaterialIcons name="menu" size={24} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.scopeHeaderCopy}>
                <Text style={styles.scopeTitle}>Choose section</Text>
              </View>
              <TouchableOpacity
                style={[styles.scopeCloseBtn, !canCloseScopePicker && styles.scopeCloseBtnDisabled]}
                onPress={() => { if (canCloseScopePicker) setScopePickerOpen(false); }}
                disabled={!canCloseScopePicker}
              >
                <MaterialIcons name="close" size={24} color={canCloseScopePicker ? Colors.textGray : '#C8C8C8'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.roleChipRow}
              style={styles.roleChipScroller}
            >
              {scopeTabs.slice(0, 3).map((tab) => {
                  const active = selectedScopeTabInfo?.id === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.roleChip, String(tab.id || '').startsWith('shared:') && styles.roleChipWide, active && styles.roleChipActive]}
                      onPress={() => handleScopeTabPress(tab)}
                      activeOpacity={0.82}
                    >
                      <MaterialIcons name={tab.icon} size={18} color={active ? '#fff' : Colors.primary} />
                      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]} numberOfLines={1}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <ScrollView style={styles.scopeList} showsVerticalScrollIndicator={false}>
              {servicesLoading && !serviceTree.length ? (
                <View style={styles.scopeLoading}>
                  <ActivityIndicator color={Colors.primary} />
                  <Text style={styles.scopeLoadingText}>Loading backend services...</Text>
                </View>
              ) : servicesError && !serviceTree.length ? (
                <View style={styles.scopeEmpty}>
                  <Text style={styles.scopeEmptyText}>{servicesError}</Text>
                </View>
              ) : selectedScopeGroup ? (
                <View style={styles.scopeBrowseList}>
                  {selectedScopeGroup.tree?.length ? selectedScopeGroup.tree.map((node) => renderScopeOption(node, [])) : (
                    selectedScopeGroup.loading ? (
                      <View style={styles.scopeGroupLoading}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.scopeGroupLoadingText}>Loading sub options...</Text>
                      </View>
                    ) : (
                      <View style={styles.scopeEmpty}>
                        <Text style={styles.scopeEmptyText}>No sub options found for this section.</Text>
                      </View>
                    )
                  )}
                </View>
              ) : (
                <View style={styles.scopeEmpty}>
                  <Text style={styles.scopeEmptyText}>No services found for this section right now.</Text>
                </View>
              )}
            </ScrollView>
          </View>
          <DrawerSidebar
            visible={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            activeItem={activeNav}
            onNavigate={handleDrawerNavigate}
            onLogout={handleDrawerLogout}
            userData={drawerUser}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sectionBg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },
  loaderWrap: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.sectionBg,
    paddingTop: 10,
  },
  statusBar: {
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: { color: Colors.textGray, fontSize: 12 },
  errorText: { color: Colors.primary, fontSize: 12 },
  scopeBar: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scopeBarCopy: {
    flex: 1,
    paddingRight: 12,
  },
  scopeBarLabel: {
    color: Colors.textLight,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scopeBarTitle: {
    color: Colors.textDark,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  scopeChangeBtn: {
    alignItems: 'center',
    borderColor: '#F0C9C4',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scopeChangeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  bannerSkeleton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    height: 210,
    justifyContent: 'center',
  },
  bannerSkeletonText: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  syncSection: {
    backgroundColor: Colors.white,
    marginBottom: 8,
    paddingBottom: 14,
  },
  syncHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  syncTitle: {
    color: Colors.textDark,
    fontSize: 16,
    fontWeight: '700',
  },
  syncCards: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
  },
  syncCard: {
    backgroundColor: '#EEEEEE',
    borderRadius: 8,
    flex: 1,
    height: 104,
  },
  redBar: {
    width: 4,
    height: 18,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  initialLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 360,
    paddingHorizontal: 18,
    paddingTop: 28,
  },
  initialLoaderTitle: {
    color: Colors.textDark,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  initialLoaderText: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  loaderSkeleton: {
    marginTop: 22,
    width: '100%',
  },
  skeletonBlock: {
    backgroundColor: '#E9E9E9',
    borderRadius: 8,
  },
  skeletonHero: {
    height: 130,
    marginHorizontal: 14,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 14,
  },
  skeletonCard: {
    backgroundColor: '#EEEEEE',
    borderRadius: 8,
    flex: 1,
    height: 88,
  },
  emptyWrap: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  emptyText: { color: Colors.textGray, fontSize: 13, textAlign: 'center' },
  bottomPad: { height: 96 },
  scopeModalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  scopeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  scopeSheet: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    elevation: 20,
    maxHeight: '78%',
    paddingBottom: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: '100%',
  },
  scopeHandle: {
    alignSelf: 'center',
    backgroundColor: '#D7D7D7',
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 46,
  },
  scopeHeader: {
    alignItems: 'center',
    borderBottomColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  scopeMenuBtn: {
    alignItems: 'center',
    backgroundColor: '#FFF1EF',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  scopeHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  scopeTitle: {
    color: Colors.textDark,
    fontSize: 22,
    fontWeight: '900',
  },
  scopeCloseBtn: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  scopeCloseBtnDisabled: {
    opacity: 0.65,
  },
  roleChipScroller: {
    maxHeight: 54,
    marginTop: 12,
  },
  roleChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  roleChip: {
    alignItems: 'center',
    borderColor: '#F0C9C4',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: 100,
  },
  roleChipWide: {
    width: 158,
  },
  roleChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleChipText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  roleChipTextActive: {
    color: Colors.white,
  },
  scopeList: {
    marginTop: 10,
  },
  scopeLoading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 26,
  },
  scopeLoadingText: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '600',
  },
  scopeGroupLoading: {
    alignItems: 'center',
    borderTopColor: '#EFEFEF',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  scopeGroupLoadingText: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '600',
  },
  scopeGroup: {
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
  },
  scopeCategory: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  scopeCategoryCopy: {
    flex: 1,
  },
  scopeCategoryTitle: {
    color: Colors.textDark,
    fontSize: 15,
    fontWeight: '900',
  },
  scopeCategoryMeta: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 2,
  },
  scopeNodeWrap: {
    borderTopColor: '#EFEFEF',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scopeNode: {
    alignItems: 'center',
    backgroundColor: '#FCFCFC',
    flexDirection: 'row',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scopeNodeParent: {
    backgroundColor: '#FFFDFC',
  },
  scopeNodeText: {
    color: Colors.textDark,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  scopeBrowseList: {
    gap: 8,
    paddingBottom: 6,
  },
  scopeBrowseOption: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    padding: 10,
  },
  scopeBrowseOptionParent: {
    backgroundColor: '#FFFDFC',
  },
  scopeBrowseIcon: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  scopeBrowseIconParent: {
    backgroundColor: '#FFF0EE',
  },
  scopeBrowseCopy: {
    flex: 1,
  },
  scopeBrowseTitle: {
    color: Colors.textDark,
    fontSize: 13,
    fontWeight: '900',
  },
  scopeBrowseMeta: {
    color: Colors.textGray,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  scopeEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  scopeEmptyText: {
    color: Colors.textGray,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default HomeScreen;
