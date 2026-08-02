import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';

const ActionRow = ({ icon, iconLib = 'MaterialIcons', title, subtitle, onPress, disabled }) => {
  const Icon = iconLib === 'Ionicons' ? Ionicons : MaterialIcons;
  return (
    <TouchableOpacity
      style={[styles.actionRow, disabled && styles.actionRowDisabled]}
      onPress={onPress}
      activeOpacity={0.82}
      disabled={disabled}
    >
      <View style={styles.actionIcon}>
        <Icon name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={Colors.textLight} />
    </TouchableOpacity>
  );
};

const DownloadActionSheet = ({
  visible,
  title = 'Download options',
  loading = false,
  onClose,
  onDirectDownload,
  onShareLink,
  onWhatsApp,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.wrapper}>
        <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose} />
        <View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 0) }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>Choose how you want to use this file.</Text>
            </View>
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.82}>
                <MaterialIcons name="close" size={22} color={Colors.textGray} />
              </TouchableOpacity>
            )}
          </View>

          <ActionRow
            icon="file-download"
            title="DigiCard"
            subtitle="Download with your profile footer"
            onPress={() => onDirectDownload?.('digicard')}
            disabled={loading}
          />
          <ActionRow
            icon="logo-whatsapp"
            iconLib="Ionicons"
            title="WhatsApp"
            subtitle="Generate QR footer and send on WhatsApp"
            onPress={() => onWhatsApp?.('whatsapp')}
            disabled={loading}
          />
          <ActionRow
            icon="content-copy"
            title="Copy Link"
            subtitle="Copy the generated file link"
            onPress={() => onShareLink?.('link')}
            disabled={loading}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    elevation: 24,
    paddingHorizontal: 18,
    paddingBottom: 10,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    width: '100%',
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  closeBtn: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    color: Colors.textDark,
    fontSize: 19,
    fontWeight: '900',
  },
  subtitle: {
    color: Colors.textGray,
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    alignItems: 'center',
    borderBottomColor: '#F0F0F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
  },
  actionRowDisabled: {
    opacity: 0.62,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: Colors.textDark,
    fontSize: 15,
    fontWeight: '800',
  },
  actionSubtitle: {
    color: Colors.textGray,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
});

export default DownloadActionSheet;
