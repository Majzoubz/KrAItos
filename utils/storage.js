import AsyncStorage from '@react-native-async-storage/async-storage';

export const Storage = {
  async get(key) {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },
  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  },
  async remove(key) {
    try { await AsyncStorage.removeItem(key); } catch {}
  },
};

export const KEYS = {
  USERS:    'fitlife_users',
  SESSION:  'fitlife_session',
  PLAN:     (email) => 'fitlife_plan_' + email,
  MEALS:    (email) => 'fitlife_meals_' + email,
};