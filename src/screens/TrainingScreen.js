import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getSubscriptionInfo } from '../services/appData';
import { getPlans, getTrainingCategories, getTrainings } from '../services/api';

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.categories)) return payload.categories;
  if (Array.isArray(payload?.trainings)) return payload.trainings;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const normalizeName = (value = '') =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const namesFrom = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => item?.name || item?.title || item?.label || item)
    .filter(Boolean)
    .map(normalizeName);

const getId = (value) => String(value?._id || value?.id || '');

const getYouTubeId = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;
  const match = text.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match?.[1] || '';
};

const getTrainingThumbnail = (training = {}) => {
  const direct = training.thumbnail || training.image || training.imageUrl;
  if (direct) return direct;
  const youtubeId = getYouTubeId(training.youtubeVideoId || training.videoUrl || training.url);
  return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '';
};

const getTrainingUrl = (training = {}) => {
  const direct = training.videoUrl || training.url || training.fileUrl;
  if (direct && String(direct).startsWith('http')) return direct;
  const youtubeId = getYouTubeId(training.youtubeVideoId || direct);
  return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : '';
};

const mergeCategoriesWithTrainings = (categories = [], trainings = []) => {
  const byId = new Map();
  const merged = [];

  categories
    .filter((category) => category?.isActive !== false)
    .forEach((category) => {
      const id = getId(category);
      if (id) byId.set(id, category);
      merged.push(category);
    });

  trainings.forEach((training) => {
    const category = training.categoryId || training.category;
    if (category && typeof category === 'object') {
      const id = getId(category);
      if (id && !byId.has(id)) {
        byId.set(id, category);
        merged.push(category);
      }
    }
  });

  return merged;
};

const TrainingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user = {} } = useAuth() || {};
  const subscription = getSubscriptionInfo(user);
  const [categories, setCategories] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  const allowedTrainingNames = useMemo(() => {
    const rawActivePlan = user.activePlan;
    const activePlanId = typeof rawActivePlan === 'object' ? getId(rawActivePlan) : String(rawActivePlan || '');
    const plan =
      user.subscription ||
      user.plan ||
      user.membership ||
      (typeof rawActivePlan === 'object' ? rawActivePlan : null) ||
      plans.find((item) => {
        const idMatches = activePlanId && getId(item) === activePlanId;
        const nameMatches = normalizeName(item?.name) === normalizeName(user.subscriptionType || user.planName);
        return idMatches || nameMatches;
      }) ||
      {};
    return namesFrom(plan.allowedTrainingCategories || plan.trainingCategories || plan.allowedTrainings);
  }, [plans, user]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      getTrainingCategories().then((res) => unwrapList(res.data)).catch(() => []),
      getTrainings({ page: 1, limit: 80 }).then((res) => unwrapList(res.data)).catch(() => []),
      getPlans().then((res) => unwrapList(res.data)).catch(() => []),
    ])
      .then(([nextCategories, nextTrainings, nextPlans]) => {
        if (!active) return;
        setCategories(mergeCategoriesWithTrainings(nextCategories, nextTrainings));
        setTrainings(nextTrainings);
        setPlans(nextPlans);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const openTrainingVideo = async (training) => {
    const url = getTrainingUrl(training);
    if (!url) {
      Alert.alert('Video unavailable', 'This training does not have a valid video URL yet.');
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (_) {
      Alert.alert('Unable to open video', 'Please try again after checking YouTube or browser access.');
    }
  };

  const renderTraining = (training) => {
    const thumbnail = getTrainingThumbnail(training);
    return (
      <TouchableOpacity
        key={getId(training) || `${training.title}-${training.youtubeVideoId}`}
        style={styles.lessonCard}
        activeOpacity={0.86}
        onPress={() => openTrainingVideo(training)}
      >
        <View style={styles.lessonThumb}>
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} style={styles.lessonImage} resizeMode="cover" />
          ) : (
            <MaterialIcons name="play-circle-outline" size={30} color={Colors.textLight} />
          )}
          <View style={styles.playBadge}>
            <MaterialIcons name="play-arrow" size={18} color="#fff" />
          </View>
        </View>
        <View style={styles.lessonCopy}>
          <Text style={styles.lessonTitle} numberOfLines={2}>
            {training.title || 'Training video'}
          </Text>
          {training.description ? (
            <Text style={styles.lessonDescription} numberOfLines={2}>
              {training.description}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategory = ({ item }) => {
    const title = item.name || item.title || 'Training';
    const normalized = normalizeName(title);
    const categoryTrainings = trainings.filter((training) => {
      const category = training.categoryId || training.category || {};
      const categoryId = typeof category === 'object' ? getId(category) : String(category || '');
      const categoryName = typeof category === 'object' ? category.name || category.title : category;
      return categoryId === getId(item) || normalizeName(categoryName) === normalized;
    });
    const explicitlyAllowed = !allowedTrainingNames.length || allowedTrainingNames.includes(normalized);
    const locked = !subscription.active || !explicitlyAllowed || item.isPremium === true;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <MaterialIcons name={locked ? 'lock' : 'school'} size={24} color={locked ? Colors.textLight : Colors.primary} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardMeta}>
              {locked ? 'Locked by current plan' : `${categoryTrainings.length || 0} video${categoryTrainings.length === 1 ? '' : 's'}`}
            </Text>
          </View>
          {locked ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnLocked]}
              onPress={() => navigation.navigate('Subscription')}
              activeOpacity={0.85}
            >
              <Text style={[styles.actionText, styles.actionTextLocked]}>Upgrade</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {!locked ? (
          categoryTrainings.length ? (
            <View style={styles.lessonList}>
              {categoryTrainings.map(renderTraining)}
            </View>
          ) : (
            <Text style={styles.noLessons}>No videos added in this category yet.</Text>
          )
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Training</Text>
          <Text style={styles.headerSub}>{subscription.name}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Loading training access...</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item, index) => getId(item) || `${item.name || 'training'}-${index}`}
          renderItem={renderCategory}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No training content is available yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.sectionBg },
  header: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  iconBtn: { padding: 6 },
  headerCopy: { flex: 1, marginLeft: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  loadingWrap: { alignItems: 'center', flex: 1, justifyContent: 'center', gap: 10 },
  loadingText: { color: Colors.textGray, fontSize: 13 },
  listContent: { padding: 14, paddingBottom: 30 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 1,
    marginBottom: 10,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cardCopy: { flex: 1 },
  cardTitle: { color: Colors.textDark, fontSize: 15, fontWeight: '800' },
  cardMeta: { color: Colors.textGray, fontSize: 12, marginTop: 2 },
  actionBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionBtnLocked: { backgroundColor: '#F2F2F2' },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  actionTextLocked: { color: Colors.primary },
  lessonList: { gap: 10, marginTop: 12 },
  lessonCard: {
    backgroundColor: '#FAFAFA',
    borderColor: Colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  lessonThumb: {
    alignItems: 'center',
    backgroundColor: '#EEE',
    height: 82,
    justifyContent: 'center',
    position: 'relative',
    width: 112,
  },
  lessonImage: { height: '100%', width: '100%' },
  playBadge: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 15,
    bottom: 8,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    width: 30,
  },
  lessonCopy: { flex: 1, justifyContent: 'center', padding: 10 },
  lessonTitle: { color: Colors.textDark, fontSize: 14, fontWeight: '800', lineHeight: 19 },
  lessonDescription: { color: Colors.textGray, fontSize: 12, lineHeight: 16, marginTop: 4 },
  noLessons: { color: Colors.textGray, fontSize: 12, marginTop: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 50 },
  emptyText: { color: Colors.textGray, fontSize: 13 },
});

export default TrainingScreen;
