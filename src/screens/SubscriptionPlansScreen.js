import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { BRAND, getSubscriptionInfo } from '../services/appData';
import { getUserProfileRole, normalizeProfileRole } from '../services/contentMapper';
import {
  createPaymentOrder,
  createPaymentSubscription,
  getAllMaterialSubcategories,
  getMaterialCategories,
  getPlans,
  validatePaymentCoupon,
} from '../services/api';

const LOGO = require('../assets/images/policybhandar_logo.png');

const FALLBACK_PLANS = [
  {
    _id: 'monthly-access',
    name: 'Monthly Access',
    price: 100,
    validityDays: 30,
    dailyDownloadLimit: 20,
    features: ['Marketing content access', 'Profile and prospect tools', 'Download support', 'Representative assistance'],
    isActive: true,
  },
  {
    _id: 'starter-access',
    name: 'Starter Access',
    price: 50,
    validityDays: 30,
    dailyDownloadLimit: 10,
    features: ['Core content access', 'Basic downloads', 'WhatsApp support'],
    isActive: true,
  },
];

const toTitleCase = (value = '') =>
  String(value)
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase());

const getPlanId = (plan) => plan?._id || plan?.id || plan?.razorpayPlanId || plan?.name;

const isAllFreePlan = (plan = {}) =>
  String(plan?.name || plan?.planName || '').toLowerCase().replace(/[\s_-]+/g, '') === 'allfree';

const unwrapList = (payload) => {
  const source =
    payload?.data?.data ||
    payload?.data?.plans ||
    payload?.data ||
    payload?.plans ||
    payload;

  return Array.isArray(source) ? source : [];
};

const extractPlans = (payload) => {
  return unwrapList(payload)
    .filter((plan) => plan?.isActive !== false && Number(plan?.price) > 0 && !isAllFreePlan(plan));
};

const formatPrice = (price) => {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return 'Custom';
  if (amount <= 0) return 'Not available';
  return `Rs. ${amount.toLocaleString('en-IN')}`;
};

const getDurationLabel = (days) => {
  const value = Number(days);
  if (!Number.isFinite(value) || value <= 0) return 'Flexible';
  if (value % 365 === 0) return `${value / 365} year${value === 365 ? '' : 's'}`;
  if (value % 30 === 0) return `${value / 30} month${value === 30 ? '' : 's'}`;
  return `${value} days`;
};

const getDownloadLimitLabel = (limit) => {
  const value = Number(limit);
  if (Number.isFinite(value) && value < 0) return 'Unlimited';
  if (Number.isFinite(value) && value > 0) return String(value);
  return 'By plan';
};

const namesFrom = (items = []) =>
  items
    .map((item) => item?.name || item?.title)
    .filter(Boolean);

const filterPlansForRole = (plans = [], user = {}) => {
  const role = getUserProfileRole(user);
  if (!role) return plans;

  const scoped = plans.filter((plan) => {
    const categories = namesFrom(plan?.allowedCategories);
    const roleCategories = categories
      .map((name) => normalizeProfileRole(name))
      .filter(Boolean);

    return !roleCategories.length || roleCategories.includes(role);
  });

  return scoped.length ? scoped : plans;
};

const getFeatures = (plan) => {
  const explicit = Array.isArray(plan?.features)
    ? plan.features.map((item) => (typeof item === 'string' ? item : item?.name || item?.title)).filter(Boolean)
    : [];

  const coverage = [
    ...namesFrom(plan?.allowedCategories),
    ...namesFrom(plan?.allowedSubcategories),
    ...namesFrom(plan?.allowedTrainingCategories),
  ];

  const generated = [
    plan?.dailyDownloadLimit
      ? `${getDownloadLimitLabel(plan.dailyDownloadLimit)} downloads${Number(plan.dailyDownloadLimit) < 0 ? '' : ' per day'}`
      : null,
    coverage.length ? `Access: ${coverage.slice(0, 2).join(', ')}${coverage.length > 2 ? ' +' : ''}` : null,
    plan?.razorpayPlanId ? 'Online payment eligible' : 'Activation support included',
  ].filter(Boolean);

  return [...explicit, ...generated].slice(0, 4);
};

const getAddonOptions = (plan = {}) => {
  const source = [
    plan.addons,
    plan.addOns,
    plan.optionalAddons,
    plan.optionalAddOns,
    plan.extraOptions,
    plan.extras,
    plan.additionalOptions,
    plan.optionalServices,
  ].find((items) => Array.isArray(items) && items.length);

  if (!source) return [];

  return Array.from(
    new Map(
      source
        .map((item, index) => {
          const option = typeof item === 'string' ? { name: item } : item || {};
          const id = String(option._id || option.id || option.key || option.name || index);
          return [
            id,
            {
              id,
              name: option.name || option.title || option.label || `Add-on ${index + 1}`,
              price: option.price ?? option.amount ?? option.extraAmount ?? 0,
              raw: option,
            },
          ];
        })
        .filter(([id]) => !!id),
    ).values(),
  );
};

const getCategoryId = (item = {}) => String(item?._id || item?.id || item?.key || '');

const getCategoryPrice = (item = {}) => {
  const amount = Number(item?.addonPrice ?? item?.price ?? item?.amount ?? 1499);
  return Number.isFinite(amount) && amount > 0 ? amount : 1499;
};

const normalizeCategoryOption = (item = {}) => {
  const id = getCategoryId(item);
  if (!id) return null;
  return {
    id,
    name: item.name || item.title || 'Category',
    addonPrice: getCategoryPrice(item),
    isLeaderCategory: item.isLeaderCategory === true,
    raw: item,
  };
};

const buildPlanCategoryOptions = (categoriesPayload, subcategoriesPayload) => {
  const categories = unwrapList(categoriesPayload)
    .filter((item) => item?.isLeaderCategory === true)
    .map(normalizeCategoryOption)
    .filter(Boolean);
  const subcategories = unwrapList(subcategoriesPayload)
    .filter((item) => item?.isMainSubcategory === true)
    .map(normalizeCategoryOption)
    .filter(Boolean);

  return Array.from(
    new Map([...categories, ...subcategories].map((item) => [item.id, item])).values(),
  );
};

const calculateAddonsTotal = (categoryOptions = [], selectedAddonIds = []) =>
  selectedAddonIds.reduce((total, id) => {
    const option = categoryOptions.find((item) => item.id === id);
    return total + (option?.addonPrice || 1499);
  }, 0);

const findPaymentUrl = (payload) => {
  const values = [
    payload?.paymentUrl,
    payload?.paymentLink,
    payload?.short_url,
    payload?.url,
    payload?.data?.paymentUrl,
    payload?.data?.paymentLink,
    payload?.data?.short_url,
    payload?.data?.url,
    payload?.subscription?.short_url,
    payload?.data?.subscription?.short_url,
  ];
  return values.find((value) => typeof value === 'string' && value.startsWith('http'));
};

const StatPill = ({ icon, label, value, color }) => (
  <View style={styles.statPill}>
    <MaterialIcons name={icon} size={18} color={color} />
    <View style={styles.statCopy}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  </View>
);

const PlanCard = ({ plan, selected, recommended, onPress }) => {
  const features = getFeatures(plan);
  const duration = getDurationLabel(plan?.validityDays);

  return (
    <TouchableOpacity
      style={[styles.planCard, selected && styles.planCardSelected]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.planHeaderRow}>
        <View style={styles.planTitleWrap}>
          <Text style={styles.planName}>{toTitleCase(plan?.name || 'Membership Plan')}</Text>
          <Text style={styles.planMeta}>{duration} validity</Text>
        </View>
        <View style={[styles.selectCircle, selected && styles.selectCircleOn]}>
          {selected ? <MaterialIcons name="check" size={16} color="#fff" /> : null}
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.planPrice}>{formatPrice(plan?.price)}</Text>
        {recommended ? (
          <View style={styles.badge}>
            <MaterialIcons name="workspace-premium" size={14} color={Colors.gold} />
            <Text style={styles.badgeText}>Recommended</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.metricRow}>
        <StatPill icon="event-available" label="Validity" value={duration} color={Colors.primary} />
        <StatPill
          icon="file-download"
          label="Daily limit"
          value={getDownloadLimitLabel(plan?.dailyDownloadLimit)}
          color="#2980B9"
        />
      </View>

      <View style={styles.featureList}>
        {features.length ? features.map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <MaterialIcons name="check-circle" size={16} color="#27AE60" />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        )) : (
          <View style={styles.featureRow}>
            <MaterialIcons name="check-circle" size={16} color="#27AE60" />
            <Text style={styles.featureText}>Full membership access after activation</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const SubscriptionPlansScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { user, refreshProfile, logout } = useAuth();
  const fromRegistration = !!route?.params?.fromRegistration;
  const subscription = getSubscriptionInfo(user);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [paymentMode, setPaymentMode] = useState('');

  const selectedPlan = useMemo(
    () => plans.find((plan) => getPlanId(plan) === selectedPlanId) || plans[0],
    [plans, selectedPlanId]
  );

  const continueForActiveProfile = useCallback((profile = user) => {
    if (!fromRegistration) return false;
    if (!getSubscriptionInfo(profile).active) return false;
    navigation.replace('Onboarding');
    return true;
  }, [fromRegistration, navigation, user]);

  const recommendedId = useMemo(() => {
    const priced = plans.filter((plan) => Number.isFinite(Number(plan?.price)));
    if (!priced.length) return getPlanId(plans[0]);
    return getPlanId(priced.reduce((best, plan) => (
      Number(plan.price) > Number(best.price) ? plan : best
    ), priced[0]));
  }, [plans]);

  const addonOptions = useMemo(() => getAddonOptions(selectedPlan), [selectedPlan]);
  const selectedCategoryCount = Number(selectedPlan?.categoryCount || 1);
  const categoryAddonTotal = useMemo(
    () => calculateAddonsTotal(categoryOptions, selectedAddonIds),
    [categoryOptions, selectedAddonIds],
  );
  const explicitAddonTotal = useMemo(
    () => addonOptions
      .filter((option) => selectedAddonIds.includes(option.id))
      .reduce((total, option) => total + (Number(option.price) || 0), 0),
    [addonOptions, selectedAddonIds],
  );
  const discountAmount = useMemo(() => {
    if (!coupon) return 0;
    const subtotal = Number(selectedPlan?.price || 0) + categoryAddonTotal + explicitAddonTotal;
    const raw = coupon.discountType === 'PERCENTAGE'
      ? (subtotal * Number(coupon.discountValue || 0)) / 100
      : Number(coupon.discountValue || 0);
    return Math.min(Math.max(raw || 0, 0), subtotal);
  }, [categoryAddonTotal, coupon, explicitAddonTotal, selectedPlan]);
  const estimatedTotal = useMemo(
    () => Math.round(Math.max(Number(selectedPlan?.price || 0) + categoryAddonTotal + explicitAddonTotal - discountAmount, 0) * 1.18),
    [categoryAddonTotal, discountAmount, explicitAddonTotal, selectedPlan],
  );

  useEffect(() => {
    loadPlans(false);
  }, [user]);

  useEffect(() => {
    if (checkoutVisible && !categoryOptions.length && !categoryLoading) {
      loadCategoryOptions();
    }
  }, [categoryLoading, categoryOptions.length, checkoutVisible]);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', () => {
      refreshProfile?.()
        .then((freshProfile) => {
          continueForActiveProfile(freshProfile || user);
        })
        .catch(() => {});
    });
    return unsubscribe;
  }, [continueForActiveProfile, navigation, refreshProfile, user]);

  useEffect(() => {
    continueForActiveProfile(user);
  }, [continueForActiveProfile, user]);

  const refreshMembership = async () => {
    loadPlans(true);
    const freshProfile = await refreshProfile?.().catch(() => null);
    continueForActiveProfile(freshProfile || user);
  };

  const goBackToLogin = async () => {
    await logout?.();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const loadPlans = async (isRefresh) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await getPlans();
      const nextPlans = extractPlans(res);
      const safePlans = filterPlansForRole(nextPlans.length ? nextPlans : FALLBACK_PLANS, user);
      setPlans(safePlans);
      setSelectedPlanId((current) => (
        safePlans.some((plan) => getPlanId(plan) === current)
          ? current
          : getPlanId(safePlans[0])
      ));
      if (!nextPlans.length) {
        setError('Live plans are empty, showing default membership options.');
      }
    } catch (err) {
      const safeFallbackPlans = filterPlansForRole(FALLBACK_PLANS, user);
      setPlans(safeFallbackPlans);
      setSelectedPlanId((current) => (
        safeFallbackPlans.some((plan) => getPlanId(plan) === current)
          ? current
          : getPlanId(safeFallbackPlans[0])
      ));
      setError(err?.data?.error || err?.data?.message || err?.message || 'Unable to load live plans.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategoryOptions = async () => {
    setCategoryLoading(true);
    try {
      const [categoriesRes, subcategoriesRes] = await Promise.all([
        getMaterialCategories({ timeout: 10000, token: null }),
        getAllMaterialSubcategories({ timeout: 10000, token: null }),
      ]);
      setCategoryOptions(buildPlanCategoryOptions(categoriesRes.data, subcategoriesRes.data));
    } catch (err) {
      console.log('Unable to load payment category options:', err?.message);
    } finally {
      setCategoryLoading(false);
    }
  };

  const continueNext = () => {
    if (!subscription.active) {
      Alert.alert('Plan required', 'Please activate one paid membership plan to continue.');
      return;
    }
    if (fromRegistration) {
      navigation.replace('Onboarding');
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Home');
    }
  };

  const openWhatsApp = async (plan) => {
    const message = [
      'Hi POLICYBHANDAR, I want to activate a membership plan.',
      `Plan: ${toTitleCase(plan?.name || 'Membership Plan')}`,
      `Price: ${formatPrice(plan?.price)}`,
      `Validity: ${getDurationLabel(plan?.validityDays)}`,
      user?.name ? `Name: ${user.name}` : null,
      user?.mobile ? `Mobile: ${user.mobile}` : null,
    ].filter(Boolean).join('\n');

    const url = `https://wa.me/91${BRAND.phone}?text=${encodeURIComponent(message)}`;
    await Linking.openURL(url);
  };

  const handleTakePlan = () => {
    if (!selectedPlan) {
      Alert.alert('Select plan', 'Please select a membership plan first.');
      return;
    }
    setSelectedCategoryIds([]);
    setSelectedAddonIds([]);
    setCouponCode('');
    setCoupon(null);
    setCouponError('');
    setPaymentMode('');
    setCheckoutVisible(true);
  };

  const toggleAddon = (id) => {
    setSelectedAddonIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const toggleCategory = (option) => {
    if (!option?.id || !selectedPlan) return;
    const id = option.id;
    const isFreeSelected = selectedCategoryIds.includes(id);
    const isAddonSelected = selectedAddonIds.includes(id);

    if (isFreeSelected) {
      setSelectedCategoryIds((current) => current.filter((item) => item !== id));
      return;
    }
    if (isAddonSelected) {
      setSelectedAddonIds((current) => current.filter((item) => item !== id));
      return;
    }

    if (option.isLeaderCategory && !selectedPlan?.isLeaderIncluded) {
      setSelectedAddonIds((current) => [...current, id]);
      return;
    }
    if (selectedCategoryIds.length < selectedCategoryCount) {
      setSelectedCategoryIds((current) => [...current, id]);
      return;
    }
    setSelectedAddonIds((current) => [...current, id]);
  };

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    try {
      const res = await validatePaymentCoupon(code);
      const payload = res?.data?.data || res?.data?.coupon || res?.data;
      setCoupon({ ...payload, code: payload?.code || code });
    } catch (err) {
      setCoupon(null);
      setCouponError(err?.data?.error || err?.data?.message || err?.message || 'Invalid coupon code');
    }
  };

  const clearCoupon = () => {
    setCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handlePaymentCheckout = async (mode = 'direct') => {
    if (!selectedPlan) return;
    if (
      selectedCategoryIds.length < selectedCategoryCount &&
      categoryOptions.length >= selectedCategoryCount
    ) {
      Alert.alert(
        'Select category',
        `Please select ${selectedCategoryCount} categor${selectedCategoryCount === 1 ? 'y' : 'ies'} for this plan.`,
      );
      return;
    }
    setProcessing(true);
    setPaymentMode(mode);
    try {
      const explicitSelectedAddons = addonOptions
        .filter((option) => selectedAddonIds.includes(option.id))
        .map((option) => option.id);
      const categorySelectedAddons = selectedAddonIds
        .filter((id) => categoryOptions.some((option) => option.id === id));
      const selectedAddons = [
        ...categorySelectedAddons,
        ...explicitSelectedAddons,
      ];
      const body = {
        planId: getPlanId(selectedPlan),
        addons: selectedAddons,
        selectedAddons,
        extraOptions: selectedAddons,
        couponCode: coupon?.code,
      };
      const res = mode === 'trial'
        ? await createPaymentSubscription(body)
        : await createPaymentOrder(body);
      const paymentUrl = findPaymentUrl(res.data);
      const checkoutData = res?.data?.data || {};
      const razorpayKey = res?.data?.key || res?.data?.data?.key || res?.data?.razorpayKey || '';

      if (paymentUrl) {
        setCheckoutVisible(false);
        navigation.navigate('PaymentWebView', {
          url: paymentUrl,
          title: toTitleCase(selectedPlan?.name || 'Membership Payment'),
        });
        return;
      }

      if (razorpayKey && (checkoutData.id || checkoutData.subscription_id)) {
        setCheckoutVisible(false);
        navigation.navigate('PaymentWebView', {
          title: mode === 'trial' ? '15 Days Free Trial' : toTitleCase(selectedPlan?.name || 'Membership Payment'),
          checkout: {
            mode,
            key: razorpayKey,
            data: checkoutData,
            planId: getPlanId(selectedPlan),
            planName: selectedPlan.name,
            selectedCategories: selectedCategoryIds,
            selectedAddons,
            couponCode: coupon?.code || '',
            user: {
              name: user?.name || '',
              email: user?.email || '',
              mobile: user?.mobile || '',
            },
          },
        });
        return;
      }

      Alert.alert(
        'Plan request created',
        'Your membership request has been sent. Please complete activation before continuing.'
      );
    } catch (err) {
      Alert.alert(
        'Payment link unavailable',
        'Online checkout is not available right now. You can send the selected plan request on WhatsApp.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'WhatsApp', onPress: () => openWhatsApp(selectedPlan) },
        ]
      );
    } finally {
      setProcessing(false);
      setPaymentMode('');
    }
  };

  const callSupport = () => Linking.openURL(`tel:${BRAND.phone}`);

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={subscription.active && !fromRegistration ? continueNext : goBackToLogin}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Membership Plan</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={refreshMembership} disabled={refreshing || loading}>
          <MaterialIcons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 128 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshMembership}
            colors={[Colors.primary]}
          />
        }
      >
        <View style={styles.introBand}>
          <View style={styles.logoWrap}>
            <View style={styles.logoClip}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </View>
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.kicker}>Profile completed</Text>
            <Text style={styles.title}>Choose access for your POLICYBHANDAR tools</Text>
            <Text style={styles.subtitle}>
              Pick an active paid plan to unlock downloads, marketing content, and agent workflow features.
            </Text>
          </View>
        </View>

        <View style={styles.progressRow}>
          <View style={styles.progressItemDone}>
            <MaterialIcons name="person" size={17} color="#fff" />
            <Text style={styles.progressTextDone}>Details</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressItemActive}>
            <MaterialIcons name="card-membership" size={17} color={Colors.primary} />
            <Text style={styles.progressTextActive}>Plan</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.notice}>
            <MaterialIcons name="info-outline" size={18} color="#8A5A00" />
            <Text style={styles.noticeText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Available Plans</Text>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : (
          plans.map((plan) => {
            const id = getPlanId(plan);
            return (
              <PlanCard
                key={id}
                plan={plan}
                selected={id === selectedPlanId}
                recommended={id === recommendedId}
                onPress={() => setSelectedPlanId(id)}
              />
            );
          })
        )}

        <View style={styles.supportBand}>
          <View style={styles.supportIcon}>
            <MaterialIcons name="support-agent" size={24} color={Colors.primary} />
          </View>
          <View style={styles.supportCopy}>
            <Text style={styles.supportTitle}>Need help choosing?</Text>
            <Text style={styles.supportText}>Our team can activate the right plan for your profile.</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={callSupport}>
            <MaterialIcons name="call" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.primaryBtn, processing && { opacity: 0.72 }]}
          onPress={handleTakePlan}
          disabled={processing || loading}
          activeOpacity={0.86}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="payment" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Take Selected Plan</Text>
            </>
          )}
        </TouchableOpacity>
        {subscription.active ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={continueNext} disabled={processing}>
            <Text style={styles.secondaryBtnText}>
              {fromRegistration ? 'Continue to onboarding' : 'Back'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.secondaryBtn} onPress={goBackToLogin} disabled={processing}>
            <Text style={styles.secondaryBtnText}>Back to login</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={checkoutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckoutVisible(false)}
      >
        <View style={styles.checkoutRoot}>
          <Pressable style={styles.checkoutBackdrop} onPress={() => setCheckoutVisible(false)} />
          <View style={styles.checkoutCard}>
            <View style={styles.checkoutHeader}>
              <View style={styles.checkoutTitleWrap}>
                <Text style={styles.checkoutTitle}>Confirm plan</Text>
                <Text style={styles.checkoutSubtitle} numberOfLines={1}>
                  {toTitleCase(selectedPlan?.name || 'Membership Plan')}
                </Text>
              </View>
              <TouchableOpacity style={styles.checkoutClose} onPress={() => setCheckoutVisible(false)}>
                <MaterialIcons name="close" size={21} color={Colors.textGray} />
              </TouchableOpacity>
            </View>

            <View style={styles.checkoutSummary}>
              <Text style={styles.checkoutPlan}>{formatPrice(selectedPlan?.price)}</Text>
              <Text style={styles.checkoutMeta}>{getDurationLabel(selectedPlan?.validityDays)} validity</Text>
            </View>

            <Text style={styles.addonHeading}>Select categories</Text>
            <Text style={styles.categoryHint}>
              Select up to {selectedCategoryCount} included categor{selectedCategoryCount === 1 ? 'y' : 'ies'}. Extra selections become add-ons.
            </Text>
            {categoryLoading ? (
              <View style={styles.noAddonBox}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.noAddonText}>Loading categories...</Text>
              </View>
            ) : categoryOptions.length ? (
              <ScrollView style={styles.categoryList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {categoryOptions.map((option) => {
                  const freeSelected = selectedCategoryIds.includes(option.id);
                  const addonSelected = selectedAddonIds.includes(option.id);
                  const active = freeSelected || addonSelected;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.addonRow, active && styles.addonRowActive]}
                      onPress={() => toggleCategory(option)}
                      activeOpacity={0.84}
                    >
                      <MaterialIcons
                        name={active ? 'check-box' : 'check-box-outline-blank'}
                        size={22}
                        color={active ? Colors.primary : Colors.textLight}
                      />
                      <View style={styles.addonCopy}>
                        <Text style={styles.addonName}>{option.name}</Text>
                        <Text style={styles.addonPrice}>
                          {freeSelected ? 'Included' : addonSelected ? `Add-on ${formatPrice(option.addonPrice)}` : option.isLeaderCategory ? 'Leader category' : 'Available'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.noAddonBox}>
                <MaterialIcons name="info-outline" size={18} color={Colors.textLight} />
                <Text style={styles.noAddonText}>No category options are configured right now.</Text>
              </View>
            )}

            <Text style={styles.addonHeading}>Optional add-ons</Text>
            {addonOptions.length ? addonOptions.map((option) => {
              const active = selectedAddonIds.includes(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.addonRow, active && styles.addonRowActive]}
                  onPress={() => toggleAddon(option.id)}
                  activeOpacity={0.84}
                >
                  <MaterialIcons
                    name={active ? 'check-box' : 'check-box-outline-blank'}
                    size={22}
                    color={active ? Colors.primary : Colors.textLight}
                  />
                  <View style={styles.addonCopy}>
                    <Text style={styles.addonName}>{option.name}</Text>
                    <Text style={styles.addonPrice}>{Number(option.price) > 0 ? formatPrice(option.price) : 'Included after approval'}</Text>
                  </View>
                </TouchableOpacity>
              );
            }) : (
              <View style={styles.noAddonBox}>
                <MaterialIcons name="info-outline" size={18} color={Colors.textLight} />
                <Text style={styles.noAddonText}>No extra add-ons are attached to this plan right now.</Text>
              </View>
            )}

            <Text style={styles.addonHeading}>Coupon</Text>
            <View style={styles.couponRow}>
              <TextInput
                style={styles.couponInput}
                value={couponCode}
                onChangeText={(value) => {
                  setCouponCode(value.toUpperCase());
                  if (coupon) setCoupon(null);
                }}
                placeholder="Enter code"
                placeholderTextColor={Colors.textLight}
                autoCapitalize="characters"
                editable={!coupon}
              />
              <TouchableOpacity
                style={[styles.couponBtn, (!couponCode.trim() && !coupon) && { opacity: 0.5 }]}
                onPress={coupon ? clearCoupon : applyCoupon}
                disabled={!couponCode.trim() && !coupon}
              >
                <Text style={styles.couponBtnText}>{coupon ? 'Remove' : 'Apply'}</Text>
              </TouchableOpacity>
            </View>
            {couponError ? <Text style={styles.couponError}>{couponError}</Text> : null}
            {coupon ? <Text style={styles.couponSuccess}>Coupon applied: {coupon.code}</Text> : null}

            <View style={styles.checkoutSummaryCompact}>
              <Text style={styles.checkoutMeta}>Estimated payable with GST</Text>
              <Text style={styles.checkoutPlan}>{formatPrice(estimatedTotal)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.checkoutPrimary, processing && { opacity: 0.72 }]}
              onPress={() => handlePaymentCheckout('trial')}
              disabled={processing}
              activeOpacity={0.86}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="autorenew" size={20} color="#fff" />
                  <Text style={styles.checkoutPrimaryText}>Start 15 Days Free Trial</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.checkoutSecondary, processing && { opacity: 0.72 }]}
              onPress={() => handlePaymentCheckout('direct')}
              disabled={processing}
              activeOpacity={0.86}
            >
              <MaterialIcons name="payment" size={20} color={Colors.primary} />
              <Text style={styles.checkoutSecondaryText}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F6F8' },
  checkoutRoot: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  checkoutBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  checkoutCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 22,
    maxHeight: '92%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    width: '100%',
  },
  checkoutHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  checkoutTitleWrap: { flex: 1, minWidth: 0 },
  checkoutTitle: {
    color: Colors.textDark,
    fontSize: 19,
    fontWeight: '900',
  },
  checkoutSubtitle: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 2,
  },
  checkoutClose: {
    alignItems: 'center',
    backgroundColor: '#F4F4F4',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  checkoutSummary: {
    backgroundColor: '#FFF7F5',
    borderColor: '#F3D0CC',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  checkoutPlan: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  checkoutMeta: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  addonHeading: {
    color: Colors.textDark,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryHint: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 8,
  },
  categoryList: {
    marginBottom: 10,
    maxHeight: 210,
  },
  addonRow: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    padding: 11,
  },
  addonRowActive: {
    backgroundColor: '#FFF6F5',
    borderColor: '#E6A9A3',
  },
  addonCopy: { flex: 1 },
  addonName: {
    color: Colors.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  addonPrice: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 2,
  },
  noAddonBox: {
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    padding: 11,
  },
  noAddonText: {
    color: Colors.textGray,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  couponRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  couponInput: {
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: Colors.textDark,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  couponBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 15,
  },
  couponBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  couponError: {
    color: '#C0392B',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  couponSuccess: {
    color: '#229954',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  checkoutSummaryCompact: {
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderColor: '#F3D0CC',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 12,
  },
  checkoutPrimary: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
  },
  checkoutSecondary: {
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderColor: '#E6A9A3',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 46,
  },
  checkoutPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  checkoutSecondaryText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    elevation: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  introBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    marginBottom: 14,
  },
  logoWrap: {
    width: 82,
    height: 82,
    borderRadius: 8,
    backgroundColor: '#FFF4F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoClip: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    width: 70,
  },
  logo: { width: 70, height: 70 },
  introCopy: { flex: 1 },
  kicker: {
    color: '#27AE60',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textDark,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  subtitle: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressItemDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#27AE60',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D8DDE6',
    marginHorizontal: 8,
  },
  progressTextDone: { color: '#fff', fontSize: 12, fontWeight: '800' },
  progressTextActive: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF8E6',
    borderWidth: 1,
    borderColor: '#F5DF9C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: {
    flex: 1,
    color: '#7A5600',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    color: Colors.textDark,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  loadingBox: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECEFF3',
    marginBottom: 12,
  },
  loadingText: { color: Colors.textGray, fontSize: 13, marginTop: 8 },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E3E7EE',
    padding: 14,
    marginBottom: 12,
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF8F7',
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planTitleWrap: { flex: 1, paddingRight: 10 },
  planName: { color: Colors.textDark, fontSize: 17, fontWeight: '800' },
  planMeta: { color: Colors.textGray, fontSize: 12, marginTop: 3 },
  selectCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#CCD3DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectCircleOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 10,
  },
  planPrice: { color: Colors.primary, fontSize: 24, fontWeight: '900' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 14,
    backgroundColor: '#FFF5DC',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: { color: '#805C00', fontSize: 11, fontWeight: '800' },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statPill: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F6F8FB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statCopy: { flex: 1 },
  statLabel: { color: Colors.textGray, fontSize: 10, fontWeight: '700' },
  statValue: { color: Colors.textDark, fontSize: 13, fontWeight: '800', marginTop: 2 },
  featureList: { marginTop: 12, gap: 8 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    flex: 1,
    color: Colors.textDark,
    fontSize: 13,
    lineHeight: 18,
  },
  supportBand: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E3E7EE',
    padding: 12,
    marginTop: 2,
  },
  supportIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  supportCopy: { flex: 1 },
  supportTitle: { color: Colors.textDark, fontSize: 14, fontWeight: '800' },
  supportText: { color: Colors.textGray, fontSize: 12, marginTop: 2, lineHeight: 17 },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#27AE60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E6E9EF',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: Platform.OS === 'ios' ? 0.08 : 0,
    shadowRadius: 10,
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: Colors.textGray, fontSize: 13, fontWeight: '700' },
});

export default SubscriptionPlansScreen;
