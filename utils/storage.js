import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'fitlife_data_';

export const Storage = {
  async get(key) {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async set(key, value) {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },

  async remove(key) {
    try { await AsyncStorage.removeItem(PREFIX + key); } catch {}
  },
};

const cleanUid = (uid) => uid ? uid.replace(/__at__/g, '@').replace(/__dot__/g, '.') : uid;

export const KEYS = {
  PLAN:      (uid)        => 'plan_'    + cleanUid(uid),
  MEALS:     (uid)        => 'meals_'   + cleanUid(uid),
  WEIGHT:    (uid)        => 'weight_'  + cleanUid(uid),
  CALLOG:    (uid)        => 'callog_'  + cleanUid(uid),
  CALTARGET: (uid)        => 'caltarget_' + cleanUid(uid),
  WATER:     (uid, date)  => 'water_'   + cleanUid(uid) + '_' + date.replace(/ /g, '_'),
  FOODLOG:   (uid, date)  => 'foodlog_' + cleanUid(uid) + '_' + date.replace(/ /g, '_'),
};
