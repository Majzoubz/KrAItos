import { Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const isWeb     = Platform.OS === 'web';
export const isMobile  = !isWeb;
export const isWideWeb = isWeb && width > 768;

// Web gets sidebar layout, mobile gets bottom nav
export const LAYOUT = isWideWeb ? 'sidebar' : 'bottomnav';