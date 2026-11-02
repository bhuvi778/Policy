import { NativeModules, Platform } from 'react-native';

// Distribution metadata is used for store-specific presentation, not checkout gating.
export const IS_PLAY_STORE_BUILD = Platform.OS === 'android' && NativeModules.PolicyBhandarDistribution?.channel !== 'direct';
export const APP_VERSION = NativeModules.PolicyBhandarDistribution?.versionName || '';
