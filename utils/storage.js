import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export const Storage = {
  async get(key) {
    try {
      const snap = await getDoc(doc(db, 'userData', key));
      return snap.exists() ? snap.data().value : null;
    } catch { return null; }
  },

  async set(key, value) {
    try {
      await setDoc(doc(db, 'userData', key), { value, updatedAt: Date.now() });
      return true;
    } catch { return false; }
  },

  async remove(key) {
    try { await deleteDoc(doc(db, 'userData', key)); } catch {}
  },
};

const cleanUid = (uid) => uid ? uid.replace(/__at__/g, '@').replace(/__dot__/g, '.') : uid;

export const KEYS = {
  ONBOARDING:(uid)        => 'onboarding_' + cleanUid(uid),
  PLAN:      (uid)        => 'plan_'    + cleanUid(uid),
  MEALS:     (uid)        => 'meals_'   + cleanUid(uid),
  WEIGHT:    (uid)        => 'weight_'  + cleanUid(uid),
  CALLOG:    (uid)        => 'callog_'  + cleanUid(uid),
  CALTARGET: (uid)        => 'caltarget_' + cleanUid(uid),
  WATER:     (uid, date)  => 'water_'   + cleanUid(uid) + '_' + date.replace(/ /g, '_'),
  FOODLOG:   (uid, date)  => 'foodlog_' + cleanUid(uid) + '_' + date.replace(/ /g, '_'),
  ADHERENCE: (uid)        => 'adherence_' + cleanUid(uid),
  PANTRY:    (uid)        => 'pantry_'    + cleanUid(uid),
  GROCERY:   (uid)        => 'grocery_'   + cleanUid(uid),
  FRIDGE:    (uid)        => 'fridge_'    + cleanUid(uid),
  SAVED_MEALS: (uid)      => 'savedmeals_'+ cleanUid(uid),
  WEEKLY_PLAN: (uid)      => 'weekplan_'  + cleanUid(uid),
};
