import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  NativeModules,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NativeVideoPlayer from '../components/NativeVideoPlayer';
import DownloadActionSheet from '../components/DownloadActionSheet';
import ProfileFooterPreview from '../components/ProfileFooterPreview';
import FastImage from '../components/FastImage';
import { useAuth } from '../context/AuthContext';
import {
  downloadPreparedFileToDevice,
  prepareMediaShareUrl,
  shareFileToWhatsApp,
} from '../services/downloads';
import { Colors } from '../theme/colors';
import {
  getMediaUrl,
  getThumbnailSource,
  isDocumentItem,
  isDocumentUrl,
  isImageUrl,
  isVideoUrl,
} from '../utils/material';

const { PolicyBhandarClipboard } = NativeModules;

const MediaViewerScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { user = {} } = useAuth() || {};
  const { item, title = 'Media' } = route.params || {};
  const [downloading, setDownloading] = useState(false);
  const [actionVisible, setActionVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [preparedAction, setPreparedAction] = useState(null);

  const mediaUrl = useMemo(() => getMediaUrl(item), [item]);
  const thumbnail = useMemo(() => getThumbnailSource(item), [item]);
  const isDocument = isDocumentItem(item, title);
  const mediaType = String(item?.type || item?.raw?.type || '').toLowerCase();
  const collectionTitle = String(title || item?.section || '').toLowerCase();
  const shouldPlayVideo =
    isVideoUrl(mediaUrl) ||
    mediaType.includes('reel') ||
    mediaType.includes('story') ||
    mediaType.includes('video') ||
    collectionTitle.includes('reel') ||
    collectionTitle.includes('story') ||
    collectionTitle.includes('stories') ||
    collectionTitle.includes('video') ||
    collectionTitle.includes('audio');
  const imageSource = thumbnail || (isImageUrl(mediaUrl) ? mediaUrl : null);
  const footerUser = useMemo(() => ({
    ...user,
    logoUrl:
      user.logoUrl ||
      user.logo ||
      user.companyLogo ||
      user.companyLogoUrl ||
      user.businessLogo ||
      user.profileLogo ||
      user.profileImage ||
      user.profileImageUrl ||
      user.profilePhoto ||
      user.avatar ||
      user.photo ||
      user.image ||
      user.profile?.logoUrl ||
      user.profile?.profileImage ||
      user.company?.logoUrl ||
      user.company?.profileImage,
    qrCodeUrl:
      user.qrCodeUrl ||
      user.qrUrl ||
      user.qrImage ||
      user.whatsappScannerImage ||
      user.whatsappScannerPhoto ||
      user.whatsappScannerUrl ||
      user.profile?.qrCodeUrl ||
      user.profile?.qrImage ||
      user.profile?.whatsappScannerImage ||
      user.company?.qrCodeUrl ||
      user.company?.qrUrl,
  }), [user]);

  const openExternal = async () => {
    if (mediaUrl) {
      try {
        await Linking.openURL(mediaUrl);
      } catch (_) {}
    }
  };

  const handleDirectDownload = async (watermarkType = 'digicard') => {
    if (!mediaUrl) {
      Alert.alert('Download failed', 'Download URL is not available for this media.');
      return;
    }

    try {
      setDownloading(true);
      setActionLoading(true);
      if (isDocument) {
        setPreparedAction({
          type: 'download',
          title: item?.title || 'POLICYBHANDAR document',
          result: { url: mediaUrl, item },
        });
        setActionVisible(false);
        return;
      }
      const result = await prepareShare(watermarkType);
      setPreparedAction({
        type: 'download',
        title: item?.title || 'POLICYBHANDAR media',
        result: { ...result, item },
      });
      setActionVisible(false);
    } catch (error) {
      Alert.alert('Preview failed', error?.message || 'Unable to prepare this media preview.');
    } finally {
      setDownloading(false);
      setActionLoading(false);
    }
  };

  const prepareShare = async (watermarkType = 'link') => {
    const result = await prepareMediaShareUrl(item, user, { watermarkType });
    return result;
  };

  const handleShareLink = async (watermarkType = 'link') => {
    try {
      setActionLoading(true);
      const result = isDocument ? { url: mediaUrl, item } : await prepareShare(watermarkType);
      const url = result.url;
      if (PolicyBhandarClipboard?.copyText) {
        await PolicyBhandarClipboard.copyText(url);
        Alert.alert('Copied', 'Generated link copied to clipboard.');
      } else {
        await Share.share({
          message: `${item?.title || 'POLICYBHANDAR media'}\n${url}`,
          url,
        });
      }
    } catch (error) {
      Alert.alert('Copy failed', error?.message || 'Unable to copy this link.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWhatsApp = async (watermarkType = 'whatsapp') => {
    try {
      setActionLoading(true);
      const result = isDocument ? { url: mediaUrl, item } : await prepareShare(watermarkType);
      setPreparedAction({
        type: 'whatsapp',
        title: item?.title || 'POLICYBHANDAR media',
        result: { ...result, item },
      });
      setActionVisible(false);
    } catch (error) {
      Alert.alert('WhatsApp failed', error?.message || 'Unable to open WhatsApp.');
    } finally {
      setActionLoading(false);
    }
  };

  const closePreparedPreview = () => {
    if (actionLoading || downloading) return;
    setPreparedAction(null);
  };

  const confirmPreparedAction = async () => {
    if (!preparedAction) return;
    try {
      setActionLoading(true);
      if (preparedAction.type === 'whatsapp') {
        await shareFileToWhatsApp(
          preparedAction.result,
          preparedAction.title,
          true,
        );
      } else {
        const result = await downloadPreparedFileToDevice(preparedAction.result, item, user);
        Alert.alert('Downloaded', `${result?.filename || 'Media'} saved to Downloads.`);
      }
      setPreparedAction(null);
    } catch (error) {
      Alert.alert(
        preparedAction.type === 'whatsapp' ? 'WhatsApp failed' : 'Download failed',
        error?.message || 'Unable to complete this action.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const preparedPreviewUrl = preparedAction?.result?.url || preparedAction?.result?.contentUri || preparedAction?.result?.uri || '';
  const preparedIsVideo = isVideoUrl(preparedPreviewUrl) || shouldPlayVideo;
  const preparedIsDocument = isDocumentUrl(preparedPreviewUrl) || isDocument;

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor="#111" barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {item?.title || title}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setActionVisible(true)} style={styles.iconBtn} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="download-outline" size={22} color={Colors.white} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={openExternal} style={styles.iconBtn}>
            <Ionicons name="open-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.playerWrap}>
        {shouldPlayVideo && isVideoUrl(mediaUrl) ? (
          <NativeVideoPlayer source={mediaUrl} poster={thumbnail} style={styles.player} />
        ) : imageSource ? (
          <FastImage
            source={typeof imageSource === 'string' ? { uri: imageSource } : imageSource}
            style={styles.imagePreview}
            resizeMode="contain"
            priority="high"
          />
        ) : isDocument ? (
          <View style={styles.documentPreview}>
            <MaterialIcons name={mediaType.includes('pdf') || mediaUrl.toLowerCase().includes('.pdf') ? 'picture-as-pdf' : 'description'} size={70} color="#FF6B5C" />
            <Text style={styles.documentTitle}>{item?.title || 'Document'}</Text>
            <Text style={styles.documentCopy}>Open or download this file to view it on your phone.</Text>
            <TouchableOpacity style={styles.documentOpenBtn} onPress={openExternal} activeOpacity={0.84}>
              <Ionicons name="open-outline" size={18} color="#fff" />
              <Text style={styles.documentOpenText}>Open File</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="play-circle-outline" size={54} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>Media is not available</Text>
            <Text style={styles.emptyCopy}>
              This item does not have a playable file URL yet.
            </Text>
          </View>
        )}
        <View style={styles.footerPreview}>
          <ProfileFooterPreview
            dark
            user={footerUser}
            showLogo
            showQrCode
            showSocialCaption
          />
        </View>
      </View>

      <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
        <Text style={styles.title}>{item?.title || 'Untitled'}</Text>
        {(item?.subtitle || item?.quote || item?.companyName) ? (
          <Text style={styles.description}>
            {item?.subtitle || item?.quote || item?.companyName}
          </Text>
        ) : null}
        {item?.language ? (
          <View style={styles.metaPill}>
            <Ionicons name="language-outline" size={14} color={Colors.primary} />
            <Text style={styles.metaText}>{item.language}</Text>
          </View>
        ) : null}
      </ScrollView>

      <DownloadActionSheet
        visible={actionVisible}
        title="Media options"
        loading={actionLoading || downloading}
        onClose={() => setActionVisible(false)}
        onDirectDownload={handleDirectDownload}
        onShareLink={handleShareLink}
        onWhatsApp={handleWhatsApp}
      />

      <Modal
        visible={!!preparedAction}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePreparedPreview}
      >
        <View style={styles.generatedModalWrap}>
          <TouchableOpacity
            style={styles.generatedBackdrop}
            activeOpacity={1}
            onPress={closePreparedPreview}
          />
          <View style={styles.generatedCard}>
            <View style={styles.generatedHeader}>
              <View style={styles.generatedTitleWrap}>
                <Text style={styles.generatedTitle}>
                  {preparedAction?.type === 'whatsapp' ? 'WhatsApp Preview' : 'DigiCard Preview'}
                </Text>
                <Text style={styles.generatedSubtitle} numberOfLines={1}>
                  {preparedAction?.title || 'POLICYBHANDAR media'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.generatedClose}
                onPress={closePreparedPreview}
                disabled={actionLoading}
                activeOpacity={0.82}
              >
                <MaterialIcons name="close" size={21} color={Colors.textGray} />
              </TouchableOpacity>
            </View>

            <View style={styles.generatedPreviewBox}>
              {preparedPreviewUrl && preparedIsVideo && !preparedIsDocument ? (
                <NativeVideoPlayer source={preparedPreviewUrl} poster={thumbnail} style={styles.generatedPreviewMedia} />
              ) : preparedPreviewUrl && !preparedIsDocument ? (
                <FastImage source={{ uri: preparedPreviewUrl }} style={styles.generatedPreviewMedia} resizeMode="contain" priority="high" />
              ) : preparedIsDocument ? (
                <View style={styles.generatedDocumentPreview}>
                  <MaterialIcons name={preparedPreviewUrl.toLowerCase().includes('.pdf') ? 'picture-as-pdf' : 'description'} size={50} color="#FF6B5C" />
                  <Text style={styles.generatedDocumentTitle} numberOfLines={2}>{preparedAction?.title || 'Document'}</Text>
                  <Text style={styles.generatedDocumentCopy}>This file will open/download as a document.</Text>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="play-circle-outline" size={48} color={Colors.textLight} />
                  <Text style={styles.emptyTitle}>Generated preview</Text>
                </View>
              )}
              {preparedPreviewUrl && !preparedIsDocument ? (
                <View style={styles.generatedFooterPreview} pointerEvents="none">
                  <ProfileFooterPreview
                    dark
                    user={footerUser}
                    showLogo
                    showQrCode
                    showSocialCaption
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.generatedActions}>
              <TouchableOpacity
                style={styles.generatedSecondary}
                onPress={closePreparedPreview}
                disabled={actionLoading}
                activeOpacity={0.82}
              >
                <Text style={styles.generatedSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.generatedPrimary, actionLoading && styles.generatedDisabled]}
                onPress={confirmPreparedAction}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons
                    name={preparedAction?.type === 'whatsapp' ? 'share' : 'file-download'}
                    size={19}
                    color="#fff"
                  />
                )}
                <Text style={styles.generatedPrimaryText}>
                  {preparedAction?.type === 'whatsapp' ? 'Share' : 'Download'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  header: {
    alignItems: 'center',
    backgroundColor: '#111',
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  iconBtn: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTextWrap: { flex: 1, paddingHorizontal: 6 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.62)', fontSize: 11, marginTop: 2 },
  playerWrap: {
    backgroundColor: '#000',
    flex: 1,
    justifyContent: 'flex-start',
  },
  player: {
    flex: 1,
    width: '100%',
  },
  imagePreview: {
    flex: 1,
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  documentPreview: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#101827',
    borderRadius: 18,
    maxWidth: '84%',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  documentTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
    textAlign: 'center',
  },
  documentCopy: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  documentOpenBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 22,
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  documentOpenText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  footerPreview: {
    width: '100%',
  },
  emptyTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
  },
  emptyCopy: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  details: {
    backgroundColor: Colors.white,
    maxHeight: 150,
  },
  detailsContent: {
    padding: 16,
  },
  title: {
    color: Colors.textDark,
    fontSize: 17,
    fontWeight: '800',
  },
  description: {
    color: Colors.textGray,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  metaPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0F0',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  generatedModalWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  generatedBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  generatedCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    elevation: 24,
    maxHeight: '88%',
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    width: '100%',
  },
  generatedHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  generatedTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  generatedTitle: {
    color: Colors.textDark,
    fontSize: 18,
    fontWeight: '900',
  },
  generatedSubtitle: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 3,
  },
  generatedClose: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  generatedPreviewBox: {
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    height: 430,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    width: '100%',
  },
  generatedPreviewMedia: {
    flex: 1,
    width: '100%',
  },
  generatedDocumentPreview: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  generatedDocumentTitle: {
    color: Colors.textDark,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
  },
  generatedDocumentCopy: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    textAlign: 'center',
  },
  generatedFooterPreview: {
    width: '100%',
  },
  generatedActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  generatedSecondary: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  generatedSecondaryText: {
    color: Colors.textDark,
    fontSize: 14,
    fontWeight: '800',
  },
  generatedPrimary: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  generatedPrimaryText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  generatedDisabled: {
    opacity: 0.66,
  },
});

export default MediaViewerScreen;
