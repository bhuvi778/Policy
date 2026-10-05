import { Platform } from 'react-native';

// iOS keeps plan purchase only in the post-registration flow until App Store billing is added.
export const SHOW_PLAN_ENTRY_POINTS = Platform.OS !== 'ios';
