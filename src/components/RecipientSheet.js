import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeModules,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/AuthContext';
import DownloadActionSheet from './DownloadActionSheet';
import ProfileFooterPreview from './ProfileFooterPreview';
import FastImage from './FastImage';
import { getAdvisorDisplayName, pickFirst } from '../services/appData';
import { prepareTemplateShareUrl, shareFileToWhatsApp } from '../services/downloads';
import { Colors } from '../theme/colors';
import { getDownloadSourceUrl, getTemplateSettings } from '../utils/material';

const RECIPIENT_TYPES = ['Dear', 'Respected', 'Other', 'None'];
const FONT_COLORS = ['#111111', '#C0392B', '#1A237E', '#1B5E20', '#4A148C', '#FFFFFF'];
const OUTPUT_SIZES = [
  { id: 'backend', label: 'Backend' },
  { id: 'banner', label: 'Banner' },
  { id: 'story', label: 'Story' },
  { id: 'sheet', label: 'Sheet' },
];
const QR_POSITIONS = [
  { id: 'right', label: 'QR Right' },
  { id: 'left', label: 'QR Left' },
];

const { PolicyBhandarClipboard } = NativeModules;

const assetUrl = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  return value.url || value.uri || value.path || value.src || value.secure_url || value.fileUrl || value.imageUrl || value.location || '';
};

const firstAssetUrl = (...values) => {
  for (const value of values) {
    const url = assetUrl(value);
    if (url) return url;
  }
  return '';
};

const buildQrImageUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:|file:|content:|data:)/i.test(raw) && /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(raw)) {
    return raw;
  }
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(raw)}`;
};

const CheckOption = ({ label, checked, onToggle }) => (
  <TouchableOpacity style={styles.optItem} onPress={onToggle} activeOpacity={0.8}>
    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
      {checked && <MaterialIcons name="check" size={13} color="#fff" />}
    </View>
    <Text style={styles.optText}>{label}</Text>
  </TouchableOpacity>
);

const RecipientSheet = ({ visible, onClose, onSubmit, onDownload, item }) => {
  const insets = useSafeAreaInsets();
  const { user = {} } = useAuth() || {};
  const [recipientType, setRecipientType] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [yourLogo, setYourLogo] = useState(false);
  const [waterMark, setWaterMark] = useState(true);
  const [socialCaption, setSocialCaption] = useState(true);
  const [qrCode, setQrCode] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [fontColor, setFontColor] = useState('#111111');
  const [colorsOpen, setColorsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [outputSize, setOutputSize] = useState('backend');
  const [qrPosition, setQrPosition] = useState('right');
  const [downloading, setDownloading] = useState(false);
  const [actionVisible, setActionVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [preparedAction, setPreparedAction] = useState(null);

  const templateSettings = getTemplateSettings(item || {});
  const advisorName = getAdvisorDisplayName(user);
  const advisorDesignation = pickFirst(user.designation, user.role, 'Insurance Advisor');
  const defaultRecipientName = advisorName && advisorName !== 'Insurance Advisor' ? advisorName : '';
  const logoUrl = firstAssetUrl(
    user.logoUrl,
    user.logo,
    user.companyLogo,
    user.companyLogoUrl,
    user.businessLogo,
    user.profileLogo,
    user.profileImage,
    user.profileImageUrl,
    user.profilePhoto,
    user.profilePhotoUrl,
    user.profile_picture,
    user.profilePicture,
    user.profilePictureUrl,
    user.profilePic,
    user.profile_pic,
    user.avatar,
    user.avatarUrl,
    user.photo,
    user.photoUrl,
    user.image,
    user.imageUrl,
    user.profile?.logoUrl,
    user.profile?.logo,
    user.profile?.profileImage,
    user.profile?.profileImageUrl,
    user.profile?.profilePhoto,
    user.profile?.profilePhotoUrl,
    user.profile?.profile_picture,
    user.profile?.profilePicture,
    user.profile?.profilePictureUrl,
    user.profile?.profilePic,
    user.profile?.profile_pic,
    user.profile?.avatar,
    user.profile?.avatarUrl,
    user.profile?.photo,
    user.profile?.photoUrl,
    user.profile?.image,
    user.profile?.imageUrl,
    user.company?.logoUrl,
    user.company?.logo,
    user.company?.profileImage,
    user.company?.profileImageUrl,
    user.company?.profilePhoto,
    user.company?.profilePhotoUrl,
    user.company?.profilePicture,
    user.company?.profilePictureUrl,
    user.company?.profilePic,
    user.company?.avatar,
    user.company?.avatarUrl,
    user.company?.photo,
    user.company?.photoUrl,
    user.company?.image,
    user.company?.imageUrl,
  );
  const uploadedQrCodeUrl = firstAssetUrl(
    user.qrCodeUrl,
    user.qrUrl,
    user.qrImage,
    user.whatsappScannerImage,
    user.whatsappScannerPhoto,
    user.whatsappScannerUrl,
    user.profile?.qrCodeUrl,
    user.profile?.qrUrl,
    user.profile?.qrImage,
    user.profile?.whatsappScannerImage,
    user.company?.qrCodeUrl,
    user.company?.qrUrl,
  );
  const qrData = pickFirst(
    user.customLink,
    user.website,
    user.websiteUrl,
    user.profile?.customLink,
    user.company?.website,
    user.email ? `mailto:${user.email}` : '',
    user.mobile ? `tel:${user.mobile}` : '',
  );
  const qrCodeUrl = uploadedQrCodeUrl || buildQrImageUrl(qrData);
  const previewUrl = firstAssetUrl(item?.image, item?.thumbnail, item?.imageUrl, getDownloadSourceUrl(item || {}));
  const languageLabel = item?.language || item?.raw?.language || '';

  useEffect(() => {
    if (visible) {
      setRecipientName(defaultRecipientName);
      setFontColor('#111111');
      setOutputSize('backend');
      setQrPosition('right');
    }
  }, [defaultRecipientName, visible]);

  const reset = () => {
    setRecipientType('');
    setRecipientName(defaultRecipientName);
    setYourLogo(false);
    setWaterMark(true);
    setSocialCaption(true);
    setQrCode(false);
    setDropOpen(false);
    setColorsOpen(false);
    setSettingsOpen(false);
    setOutputSize('backend');
    setQrPosition('right');
    setDownloading(false);
    setActionVisible(false);
    setActionLoading(false);
    setPreparedAction(null);
  };

  const handleClose = () => {
    if (downloading) return;
    reset();
    onClose();
  };

  const buildPayload = (watermarkType = 'digicard') => {
    const includeLogo = waterMark && yourLogo;
    const includeSocialCaption = waterMark && socialCaption;
    const forceQrFooter = watermarkType === 'whatsapp' || watermarkType === 'link';
    const includeQrCode = waterMark && (qrCode || forceQrFooter);

    return {
      recipientType,
      recipientName,
      name: recipientName || advisorName,
      displayName: recipientName || advisorName,
      yourLogo: includeLogo,
      waterMark,
      watermark: waterMark,
      includeWatermark: waterMark,
      watermarkText: recipientName || advisorName,
      socialCaption: includeSocialCaption,
      qrCode: includeQrCode,
      fontColor,
      outputSize,
      qrPosition,
      watermarkType,
      item,
      user,
      advisorName: recipientName || advisorName,
      advisorDesignation,
      advisorMobile: user.mobile || user.phone || '',
      advisorEmail: user.email || '',
      logoUrl: includeLogo ? logoUrl : '',
      qrCodeUrl: includeQrCode ? qrCodeUrl : '',
      qrData,
    };
  };

  const handleDirectDownload = async (watermarkType = 'digicard') => {
    const payload = buildPayload(watermarkType);
    try {
      setDownloading(true);
      setActionLoading(true);
      const result = await prepareTemplateShareUrl(item, payload);
      setPreparedAction({
        type: 'download',
        title: item?.title || 'POLICYBHANDAR template',
        payload,
        result: { ...result, item },
      });
      setActionVisible(false);
    } catch (_) {
      Alert.alert('Preview failed', 'Unable to prepare this template preview.');
    } finally {
      setDownloading(false);
      setActionLoading(false);
    }
  };

  const prepareShare = async (watermarkType = 'link') => {
    const result = await prepareTemplateShareUrl(item, buildPayload(watermarkType));
    return result;
  };

  const handleShareLink = async (watermarkType = 'link') => {
    try {
      setActionLoading(true);
      const result = await prepareShare(watermarkType);
      const url = result.url;
      if (PolicyBhandarClipboard?.copyText) {
        await PolicyBhandarClipboard.copyText(url);
        Alert.alert('Copied', 'Generated link copied to clipboard.');
      } else {
        await Share.share({
          message: `${item?.title || 'POLICYBHANDAR template'}\n${url}`,
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
      const result = await prepareShare(watermarkType);
      setPreparedAction({
        type: 'whatsapp',
        title: item?.title || 'POLICYBHANDAR template',
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
        reset();
        onClose();
        return;
      }

      if (preparedAction.result?.savedToDevice) {
        Alert.alert('Downloaded', `${preparedAction.result?.filename || 'Template'} saved to Downloads.`);
      } else if (onDownload) {
        await onDownload(preparedAction.payload);
      } else if (onSubmit) {
        await onSubmit(preparedAction.payload);
      }
      reset();
      onClose();
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.wrapper}>
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}
          >
            <View style={styles.titleRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.title}>Template Download</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {item?.title || 'Fill details and save to phone'}
                </Text>
              </View>
              <View style={styles.colorPreview}>
                <View style={[styles.colorDot, { backgroundColor: fontColor }]} />
              </View>
            </View>

            <View style={styles.previewCard}>
              {languageLabel ? (
                <View style={styles.languageBadge}>
                  <MaterialIcons name="language" size={13} color={Colors.primary} />
                  <Text style={styles.languageText}>{languageLabel}</Text>
                </View>
              ) : null}
              <View style={styles.previewMedia}>
                {previewUrl ? (
                  <FastImage
                    source={typeof previewUrl === 'string' ? { uri: previewUrl } : previewUrl}
                    style={styles.previewImage}
                    resizeMode="cover"
                    priority="high"
                  />
                ) : (
                  <View style={styles.previewEmpty}>
                    <MaterialIcons name="image" size={34} color={Colors.textLight} />
                    <Text style={styles.previewEmptyText}>Template preview</Text>
                  </View>
                )}
              </View>
              {waterMark ? (
                <ProfileFooterPreview
                  user={user}
                  name={recipientName || advisorName}
                  showLogo={yourLogo}
                  showQrCode={qrCode}
                  showSocialCaption={socialCaption}
                  logoUrl={yourLogo ? logoUrl : ''}
                  qrCodeUrl={qrCode ? qrCodeUrl : ''}
                  fontColor={fontColor}
                  qrPosition={qrPosition}
                />
              ) : null}
            </View>

            <View style={styles.dropWrapper}>
              <Text style={styles.dropLabel}>Recipient Type</Text>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setDropOpen(!dropOpen)}
                activeOpacity={0.85}
              >
                <Text style={[styles.dropText, !recipientType && styles.dropPlaceholder]}>
                  {recipientType || '--- Select Type ---'}
                </Text>
                <MaterialIcons
                  name={dropOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={22}
                  color={Colors.textGray}
                />
              </TouchableOpacity>
              {dropOpen ? (
                <View style={styles.dropList}>
                  {RECIPIENT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={styles.dropItem}
                      onPress={() => {
                        setRecipientType(type);
                        setDropOpen(false);
                      }}
                    >
                      <Text style={styles.dropItemText}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.nameRow}>
              <TextInput
                style={styles.nameInput}
                placeholder="Recipient Name"
                placeholderTextColor={Colors.textLight}
                value={recipientName}
                onChangeText={setRecipientName}
              />
              <TouchableOpacity onPress={() => setRecipientName('')} style={styles.clearBtn}>
                <MaterialIcons name="delete-outline" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.optRow}>
              <CheckOption label="Your Logo" checked={yourLogo} onToggle={() => setYourLogo(!yourLogo)} />
              <CheckOption label="Profile Footer" checked={waterMark} onToggle={() => setWaterMark(!waterMark)} />
              <TouchableOpacity
                style={styles.optItem}
                onPress={() => setColorsOpen(!colorsOpen)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="palette" size={20} color={Colors.textGray} />
                <Text style={styles.optText}>Font Color</Text>
              </TouchableOpacity>
            </View>

            {colorsOpen ? (
              <View style={styles.swatchRow}>
                {FONT_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.swatch, { backgroundColor: color }, fontColor === color && styles.swatchActive]}
                    onPress={() => setFontColor(color)}
                    activeOpacity={0.85}
                  >
                    {fontColor === color ? (
                      <MaterialIcons
                        name="check"
                        size={16}
                        color={color === '#FFFFFF' ? Colors.primary : '#fff'}
                      />
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.optRow}>
              <CheckOption
                label="Social Caption"
                checked={socialCaption}
                onToggle={() => setSocialCaption(!socialCaption)}
              />
              <CheckOption label="QR Code" checked={qrCode} onToggle={() => setQrCode(!qrCode)} />
              <TouchableOpacity
                style={styles.optItem}
                onPress={() => setSettingsOpen(!settingsOpen)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="settings" size={20} color={Colors.textGray} />
                <Text style={styles.optText}>Settings</Text>
              </TouchableOpacity>
            </View>

            {settingsOpen ? (
              <View style={styles.settingsBox}>
                <Text style={styles.settingsTitle}>Download Size</Text>
                <Text style={styles.settingsCopy}>
                  Backend default keeps the size configured for this material.
                </Text>
                <View style={styles.sizeRow}>
                  {OUTPUT_SIZES.map((size) => (
                    <TouchableOpacity
                      key={size.id}
                      style={[styles.sizeChip, outputSize === size.id && styles.sizeChipActive]}
                      onPress={() => setOutputSize(size.id)}
                    >
                      <Text style={[styles.sizeChipText, outputSize === size.id && styles.sizeChipTextActive]}>
                        {size.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {qrCode ? (
                  <>
                    <Text style={[styles.settingsTitle, styles.settingsSubTitle]}>Footer QR Position</Text>
                    <View style={styles.sizeRow}>
                      {QR_POSITIONS.map((position) => (
                        <TouchableOpacity
                          key={position.id}
                          style={[styles.sizeChip, qrPosition === position.id && styles.sizeChipActive]}
                          onPress={() => setQrPosition(position.id)}
                        >
                          <Text style={[styles.sizeChipText, qrPosition === position.id && styles.sizeChipTextActive]}>
                            {position.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                ) : null}
                {(templateSettings.layoutType || templateSettings.sizeScale || templateSettings.imageScale) ? (
                  <Text style={styles.backendMeta} numberOfLines={2}>
                    {templateSettings.layoutType || 'Backend layout'}
                    {templateSettings.sizeScale ? ` | Size ${templateSettings.sizeScale}%` : ''}
                    {templateSettings.imageScale ? ` | Image ${templateSettings.imageScale}%` : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
              onPress={() => setActionVisible(true)}
              activeOpacity={0.85}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="file-download" size={20} color="#fff" />
              )}
              <Text style={styles.downloadText}>{downloading ? 'Preparing...' : 'Download'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <DownloadActionSheet
          visible={actionVisible}
          title="Template options"
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
            <Pressable style={styles.generatedBackdrop} onPress={closePreparedPreview} />
            <View style={styles.generatedCard}>
              <View style={styles.generatedHeader}>
                <View style={styles.generatedTitleWrap}>
                  <Text style={styles.generatedTitle}>
                    {preparedAction?.type === 'whatsapp' ? 'WhatsApp Preview' : 'DigiCard Preview'}
                  </Text>
                  <Text style={styles.generatedSubtitle} numberOfLines={1}>
                    {preparedAction?.title || 'POLICYBHANDAR template'}
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
                {preparedPreviewUrl ? (
                  <FastImage source={{ uri: preparedPreviewUrl }} style={styles.generatedPreviewImage} resizeMode="contain" priority="high" />
                ) : (
                  <View style={styles.previewEmpty}>
                    <MaterialIcons name="image" size={34} color={Colors.textLight} />
                    <Text style={styles.previewEmptyText}>Generated preview</Text>
                  </View>
                )}
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
                  style={[styles.generatedPrimary, actionLoading && styles.downloadBtnDisabled]}
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
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  sheetContent: { paddingBottom: 2 },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 14,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleCopy: { flex: 1, paddingRight: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#111' },
  subtitle: { color: Colors.textGray, fontSize: 12, marginTop: 3 },
  colorPreview: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  colorDot: {
    borderColor: Colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  previewCard: {
    backgroundColor: '#F8FAFC',
    borderColor: Colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  languageBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderColor: '#F1D0CB',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    right: 8,
    top: 8,
    zIndex: 2,
  },
  languageText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  previewMedia: {
    aspectRatio: 1.32,
    backgroundColor: '#EEF1F5',
    width: '100%',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  generatedModalWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  generatedBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.56)',
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
    backgroundColor: '#F7F7F7',
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 430,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  generatedPreviewImage: {
    height: '100%',
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
  previewEmpty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  previewEmptyText: {
    color: Colors.textGray,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  dropWrapper: { marginBottom: 14 },
  dropLabel: { fontSize: 11, color: Colors.textGray, marginBottom: 4, marginLeft: 4, fontWeight: '500' },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dropText: { fontSize: 15, color: Colors.textDark, fontWeight: '500' },
  dropPlaceholder: { color: Colors.textLight },
  dropList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: '#fff',
    elevation: 6,
  },
  dropItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dropItemText: { fontSize: 14, color: Colors.textDark },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  nameInput: { flex: 1, fontSize: 15, color: Colors.textDark, paddingVertical: 12 },
  clearBtn: { padding: 4 },
  optRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  optItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  optText: { fontSize: 12.5, color: Colors.textDark, fontWeight: '500', flexShrink: 1 },
  swatchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  swatch: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  swatchActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  optionPanel: {
    backgroundColor: '#FFF8F7',
    borderColor: '#F1D0CB',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 10,
  },
  optionTitle: {
    color: Colors.textDark,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 7,
  },
  segmentChip: {
    alignItems: 'center',
    borderColor: Colors.border,
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 6,
  },
  segmentChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  segmentChipText: {
    color: Colors.primary,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  segmentChipTextActive: {
    color: Colors.white,
  },
  settingsBox: {
    backgroundColor: '#FAFAFA',
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  settingsTitle: { color: Colors.textDark, fontSize: 13, fontWeight: '800' },
  settingsSubTitle: { marginTop: 12 },
  settingsCopy: { color: Colors.textGray, fontSize: 12, lineHeight: 17, marginTop: 4 },
  sizeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  sizeChip: {
    borderColor: Colors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  sizeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sizeChipText: { color: Colors.textDark, fontSize: 12, fontWeight: '700' },
  sizeChipTextActive: { color: Colors.white },
  backendMeta: { color: Colors.textLight, fontSize: 11, lineHeight: 16, marginTop: 9 },
  downloadBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 2,
    paddingVertical: 16,
  },
  downloadBtnDisabled: { opacity: 0.72 },
  downloadText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});

export default RecipientSheet;
