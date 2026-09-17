import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FastImage from './FastImage';
import {
  getMaterialKindMeta,
  getMediaUrl,
  getThumbnailSource,
  isDocumentItem,
  isMediaItem,
  isVideoUrl,
} from '../utils/material';

const initialsForTitle = (title = '') =>
  String(title || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '?';

const MediaCardPreview = React.memo(({ item = {}, sectionTitle = '', imageStyle, placeholderStyle, initialsStyle, subtitleStyle }) => {
  const image = getThumbnailSource(item);
  const imageSource = typeof image === 'string' ? { uri: image } : image;
  const mediaUrl = getMediaUrl(item);
  const kindMeta = getMaterialKindMeta(item, sectionTitle);
  const isDocument = isDocumentItem(item, sectionTitle);
  const shouldShowVideoPlaceholder = !image && mediaUrl && (isVideoUrl(mediaUrl) || isMediaItem(item, sectionTitle));

  if (imageSource) {
    return (
      <>
        <FastImage source={imageSource} style={imageStyle} resizeMode="cover" />
        <View style={[styles.typeBadge, { backgroundColor: kindMeta.color }]}>
          <MaterialIcons name={kindMeta.icon} size={12} color="#fff" />
          <Text style={styles.typeBadgeText}>{kindMeta.label}</Text>
        </View>
      </>
    );
  }

  if (shouldShowVideoPlaceholder) {
    return (
      <>
        <View style={[styles.placeholder, styles.videoPlaceholder, imageStyle, placeholderStyle]}>
          <MaterialIcons name="play-circle-outline" size={34} color="#FFFFFF" />
          <Text style={[styles.videoLabel, subtitleStyle]} numberOfLines={2}>
            {item.title || 'Video'}
          </Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: kindMeta.color }]}>
          <MaterialIcons name={kindMeta.icon} size={12} color="#fff" />
          <Text style={styles.typeBadgeText}>{kindMeta.label}</Text>
        </View>
      </>
    );
  }

  if (isDocument) {
    return (
      <View style={[styles.placeholder, styles.documentPlaceholder, placeholderStyle]}>
        <MaterialIcons name={kindMeta.icon} size={42} color="#FF6B5C" />
        <Text style={[initialsStyle, styles.documentType]}>{kindMeta.label}</Text>
        <Text style={subtitleStyle} numberOfLines={3}>{item.title || 'Document'}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.placeholder, placeholderStyle]}>
      <Text style={initialsStyle}>{initialsForTitle(item.title)}</Text>
      {(item.subtitle || item.quote) ? (
        <Text style={subtitleStyle} numberOfLines={4}>{item.subtitle || item.quote}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  documentPlaceholder: {
    backgroundColor: '#101827',
    gap: 6,
    padding: 12,
  },
  documentType: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 2,
  },
  videoPlaceholder: {
    backgroundColor: '#101827',
    gap: 6,
    padding: 10,
  },
  videoLabel: {
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
  },
  typeBadge: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.94)',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    top: 7,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});

export default MediaCardPreview;
