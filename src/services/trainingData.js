import { getTrainingCategories, getTrainings } from './api';
import { loadPublicDisplayData } from './publicDataCache';

const list = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data) return list(payload.data);
  for (const key of ['categories', 'trainings', 'items']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw Error('Training server returned an invalid list');
};

export const loadTrainingCategories = (options = {}) => loadPublicDisplayData('training-categories', async () => {
  const response = await getTrainingCategories({ token: null, timeout: 9000 });
  return list(response.data);
}, options);

export const loadTrainingVideos = (options = {}) => loadPublicDisplayData('training-videos', async () => {
  const records = new Map();
  for (let page = 1; page <= 20; page += 1) {
    const response = await getTrainings({ page, limit: 100 }, { token: null, timeout: 9000 });
    const items = list(response.data);
    let added = 0;
    items.forEach((item) => {
      const key = String(item._id || item.id || item.videoUrl || item.youtubeVideoId);
      if (!records.has(key)) added += 1;
      records.set(key, item);
    });
    if (items.length < 100 || !added) return [...records.values()];
  }
  throw Error('Training pagination limit reached');
}, options);
