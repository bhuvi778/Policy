import { NativeModules, Platform } from 'react-native';

// Old installations without the constant must not accidentally expose store purchases.
export const IS_PLAY_STORE_BUILD = Platform.OS === 'android' && NativeModules.PolicyBhandarDistribution?.channel !== 'direct';
export const APP_VERSION = NativeModules.PolicyBhandarDistribution?.versionName || '';
