import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserProfileRole } from '../services/contentMapper';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';
import { fetchMaterialServiceTree, getDefaultMaterialServiceTree, loadCachedMaterialServiceTree } from '../services/materialServiceTree';

const { height: SH } = Dimensions.get('window');
const SHEET_H = SH * 0.72;
const ROLE_OPTIONS = [
  { id: 'agent', label: 'Agent', icon: 'support-agent' },
  { id: 'leader', label: 'Leader', icon: 'workspace-premium' },
];
const SHARED_CATEGORY_KEYWORDS = ['greeting', 'festival', 'other', 'free'];

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
  return SHARED_CATEGORY_KEYWORDS.some((keyword) => name.includes(keyword));
};

const iconForCategory = (category = {}) => {
  const name = normalizeText(category.name);
  if (name.includes('leader')) return 'workspace-premium';
  if (name.includes('greeting') || name.includes('festival')) return 'card-giftcard';
  return 'support-agent';
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

const BottomMenuSheet = ({ visible, onClose, onItemPress }) => {
  const insets = useSafeAreaInsets();
  const { user = {} } = useAuth() || {};
  const registeredRole = getUserProfileRole(user) || 'agent';
  const [serviceTree, setServiceTree] = useState(() => getDefaultMaterialServiceTree());
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [servicesError, setServicesError] = useState('');
  const [expanded, setExpanded] = useState({});
  const lastServiceRefreshRef = useRef(0);
  const visibleServices = useMemo(() => {
    const priority = (group = {}) => {
      const role = getCategoryRole(group.category);
      if (role === registeredRole) return 0;
      if (role && role !== registeredRole) return 1;
      if (isSharedCategory(group.category)) return 2;
      return 3;
    };
    return [...serviceTree].sort((left, right) => priority(left) - priority(right));
  }, [registeredRole, serviceTree]);
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (!visible || loadingServices) return undefined;
    const now = Date.now();
    const shouldRefresh = !servicesLoaded || now - lastServiceRefreshRef.current > 30000;
    if (!shouldRefresh) return undefined;

    let active = true;
    let showedAny = false;
    let fallbackTimer = null;
    lastServiceRefreshRef.current = now;
    setLoadingServices(true);
    setServicesError('');

    const applyGroups = (groups = [], final = false) => {
      if (!active || !groups.length) return;
      showedAny = true;
      setServiceTree(groups);
      const complete = final;
      if (complete) {
        setServicesLoaded(true);
        setLoadingServices(false);
      }
      setExpanded((current) => ({
        ...groups.reduce((acc, group) => {
          acc[getId(group.category)] = current[getId(group.category)] ?? true;
          collectExpandableIds(group.tree || [], acc);
          return acc;
        }, {}),
        ...current,
      }));
    };

    loadCachedMaterialServiceTree({ allowStale: true })
      .then(applyGroups)
      .catch(() => {});

    fallbackTimer = setTimeout(() => {
      if (!active || showedAny) return;
      applyGroups(getDefaultMaterialServiceTree());
    }, 1200);

    fetchMaterialServiceTree({
      timeout: 9000,
      forceRefresh: true,
      onPartial: applyGroups,
    })
      .then((groups) => applyGroups(groups, true))
      .catch((err) => {
        if (active) {
          if (!showedAny) {
            const fallbackGroups = getDefaultMaterialServiceTree();
            applyGroups(fallbackGroups, true);
            setServicesError('');
          } else {
            setServicesError('');
          }
          setServicesLoaded(true);
        }
      })
      .finally(() => {
        if (active) setLoadingServices(false);
      });

    return () => {
      active = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [loadingServices, servicesLoaded, visible]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.setValue(SHEET_H);
      backdropOp.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_H, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [visible, registeredRole, translateY, backdropOp]);

  if (!mounted) return null;

  const openMenuItem = (item) => {
    onClose();
    setTimeout(() => {
      onItemPress && onItemPress({
        ...item,
        profileRole: item.profileRole || registeredRole,
        rolePreviewOnly: !!item.rolePreviewOnly,
      });
    }, 200);
  };

  const toggleExpanded = (id) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  };

  const openService = (category, subcategory = null) => {
    const target = subcategory || category;
    const categoryRole = getCategoryRole(category);
    const serviceRole = categoryRole || registeredRole;
    openMenuItem({
      id: subcategory ? `subcategory:${getId(subcategory)}` : `category:${getId(category)}`,
      label: target.name || target.label || target.title || 'Services',
      categoryId: getId(category),
      subcategoryId: subcategory ? getId(subcategory) : '',
      serviceCategoryName: category.name || '',
      serviceSubcategoryName: subcategory?.name || '',
      profileRole: serviceRole,
      rolePreviewOnly: !!categoryRole && categoryRole !== registeredRole,
    });
  };

  const renderSubcategoryNode = (category, node) => {
    const id = getId(node);
    const children = Array.isArray(node.children) ? node.children : [];
    const hasChildren = children.length > 0;
    const canDrillDown = hasChildren;
    const isOpen = !!expanded[id];
    const rowIcon = canDrillDown ? (isOpen ? 'folder-open' : 'folder') : 'article';

    return (
      <View key={id || node.name}>
        <TouchableOpacity
          style={[styles.serviceRow, { paddingLeft: 14 + Math.min(node.depth || 0, 3) * 16 }]}
          onPress={() => (canDrillDown ? toggleExpanded(id) : openService(category, node))}
          activeOpacity={0.82}
        >
          <MaterialIcons name={rowIcon} size={17} color={canDrillDown ? Colors.primary : Colors.textLight} />
          <Text style={styles.serviceText} numberOfLines={2}>
            {node.name || 'Subcategory'}
          </Text>
          {canDrillDown ? (
            <MaterialIcons
              name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={22}
              color={Colors.textGray}
            />
          ) : (
            <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
          )}
        </TouchableOpacity>
        {canDrillDown && isOpen ? children.map((child) => renderSubcategoryNode(category, child)) : null}
      </View>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOp }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }], paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.handle} />

        <View style={styles.sheetHdr}>
          <View>
            <Text style={styles.sheetTitle}>Menu</Text>
            <Text style={styles.sheetSubTitle}>
              {ROLE_OPTIONS.find((role) => role.id === registeredRole)?.label || 'Agent'} profile
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={22} color="#888" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.serviceList}
        >
          {loadingServices && !serviceTree.length ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading backend services...</Text>
            </View>
          ) : null}
          {visibleServices.length ? visibleServices.map(({ category, tree, loading }) => {
            const categoryId = getId(category);
            const isOpen = !!expanded[categoryId];
            const categoryRole = getCategoryRole(category);
            return (
              <View key={categoryId || category.name} style={styles.serviceGroup}>
                <TouchableOpacity
                  style={styles.serviceHeader}
                  onPress={() => toggleExpanded(categoryId)}
                  activeOpacity={0.84}
                >
                  <View style={styles.serviceHeaderLeft}>
                    <View style={styles.serviceIcon}>
                      <MaterialIcons name={iconForCategory(category)} size={18} color={Colors.primary} />
                    </View>
                    <View style={styles.serviceCopy}>
                      <Text style={styles.serviceTitle} numberOfLines={1}>
                        {category.name || 'Services'}
                      </Text>
                      <Text style={styles.serviceMeta} numberOfLines={1}>
                        {categoryRole ? `${categoryRole} services` : 'Available for both roles'}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons
                    name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={24}
                    color={Colors.textGray}
                  />
                </TouchableOpacity>
                {isOpen ? (
                  tree.length ? tree.map((node) => renderSubcategoryNode(category, node)) : (
                    loading ? (
                      <View style={styles.loadingRowCompact}>
                        <ActivityIndicator size="small" color={Colors.primary} />
                        <Text style={styles.loadingText}>Loading sub options...</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.serviceRow} onPress={() => openService(category)} activeOpacity={0.82}>
                        <View style={styles.serviceDot} />
                        <Text style={styles.serviceText}>View all {category.name}</Text>
                        <MaterialIcons name="chevron-right" size={20} color={Colors.textLight} />
                      </TouchableOpacity>
                    )
                  )
                ) : null}
              </View>
            );
          }) : !loadingServices ? (
            <View style={styles.emptyServices}>
              <MaterialIcons name="cloud-off" size={28} color={Colors.textLight} />
              <Text style={styles.emptyServicesTitle}>Backend services unavailable</Text>
              <Text style={styles.emptyServicesText}>
                {servicesError || 'No backend service categories found right now.'}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetHdr: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  sheetSubTitle: { color: Colors.textGray, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginHorizontal: 16, marginBottom: 10 },
  roleWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    zIndex: 3,
  },
  roleButton: {
    alignItems: 'center',
    backgroundColor: '#FFF8F7',
    borderColor: '#F2D2CC',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 12,
  },
  roleButtonLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  roleIcon: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  roleLabel: { color: Colors.textDark, fontSize: 14, fontWeight: '800' },
  roleMeta: { color: Colors.textGray, fontSize: 11, marginTop: 2 },
  roleDropdown: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 8,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  roleOption: {
    alignItems: 'center',
    borderBottomColor: '#F2F2F2',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  roleOptionActive: { backgroundColor: '#FFF4F3' },
  roleOptionText: { color: Colors.textDark, flex: 1, fontSize: 13, fontWeight: '700' },
  roleOptionTextActive: { color: Colors.primary },
  currentPill: {
    backgroundColor: '#FDECE9',
    borderRadius: 10,
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  serviceList: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  loadingRowCompact: {
    alignItems: 'center',
    borderTopColor: '#F4F4F4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
  },
  loadingText: { color: Colors.textGray, fontSize: 12, fontWeight: '700' },
  emptyServices: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingHorizontal: 24,
  },
  emptyServicesTitle: {
    color: Colors.textDark,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyServicesText: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    textAlign: 'center',
  },
  serviceGroup: {
    borderColor: '#F1F1F1',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  serviceHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFDFC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 12,
  },
  serviceHeaderLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  serviceIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF4F3',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  serviceCopy: { flex: 1 },
  serviceTitle: { color: Colors.textDark, fontSize: 14, fontWeight: '800' },
  serviceMeta: { color: Colors.textGray, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  serviceRow: {
    alignItems: 'center',
    borderTopColor: '#F4F4F4',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
    paddingRight: 12,
  },
  serviceDot: {
    backgroundColor: Colors.primary,
    borderRadius: 3,
    height: 6,
    opacity: 0.65,
    width: 6,
  },
  serviceText: {
    color: Colors.textDark,
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
  },
  expandBtn: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 16,
  },
  menuItem: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  menuLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    width: 64,
    lineHeight: 14,
  },
});

export default BottomMenuSheet;
