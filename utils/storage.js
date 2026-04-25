import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { db } from './firebase';

const CACHE_PREFIX = 'gg_cache_v1::';
const OUTBOX_KEY   = 'gg_outbox_v1';

let memoryOutbox = null;
let flushing = false;
let flushTimer = null;
let initialized = false;
const listeners = new Set();

function notify() {
  const status = { queued: (memoryOutbox || []).length, online: isOnline() };
  for (const fn of listeners) { try { fn(status); } catch {} }
}

export function subscribeSyncStatus(fn) {
  listeners.add(fn);
  fn({ queued: (memoryOutbox || []).length, online: isOnline() });
  return () => listeners.delete(fn);
}

export function isOnline() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // assume online on native; Firestore + outbox handle real failures
}

async function loadOutbox() {
  if (memoryOutbox) return memoryOutbox;
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    memoryOutbox = raw ? JSON.parse(raw) : [];
  } catch { memoryOutbox = []; }
  return memoryOutbox;
}

async function persistOutbox() {
  try { await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(memoryOutbox || [])); } catch {}
}

async function enqueue(op) {
  await loadOutbox();
  // collapse duplicate writes/removes for the same key — keep only the most recent
  memoryOutbox = memoryOutbox.filter(x => !(x.key === op.key && x.kind !== 'remove'));
  memoryOutbox.push({ ...op, queuedAt: Date.now() });
  await persistOutbox();
  notify();
}

async function writeRemote(op) {
  if (op.kind === 'set') {
    await setDoc(doc(db, 'userData', op.key), { value: op.value, updatedAt: Date.now() });
  } else if (op.kind === 'remove') {
    await deleteDoc(doc(db, 'userData', op.key));
  }
}

export async function flushOutbox() {
  if (flushing) return { flushed: 0, remaining: (memoryOutbox || []).length };
  if (!isOnline()) return { flushed: 0, remaining: (memoryOutbox || []).length };
  flushing = true;
  let flushed = 0;
  try {
    await loadOutbox();
    while (memoryOutbox.length > 0) {
      const op = memoryOutbox[0];
      try {
        await writeRemote(op);
        const idx = memoryOutbox.indexOf(op);
        if (idx >= 0) memoryOutbox.splice(idx, 1);
        await persistOutbox();
        flushed += 1;
      } catch {
        break;
      }
    }
  } finally {
    flushing = false;
    notify();
  }
  return { flushed, remaining: (memoryOutbox || []).length };
}

function scheduleFlush(delayMs = 4000) {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const r = await flushOutbox();
    if (r.remaining > 0) scheduleFlush(Math.min(60000, delayMs * 2));
  }, delayMs);
}

export async function initStorage() {
  if (initialized) return;
  initialized = true;
  await loadOutbox();
  notify();

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => { flushOutbox(); });
    window.addEventListener('focus', () => { flushOutbox(); });
  }
  // Initial drain attempt
  setTimeout(() => { flushOutbox(); }, 1500);
  // Periodic catch-up every 60s if queue not empty
  setInterval(() => {
    if ((memoryOutbox || []).length > 0) flushOutbox();
  }, 60000);
}

export const Storage = {
  async get(key) {
    // Cache-first
    let cached = null;
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (raw) cached = JSON.parse(raw);
    } catch {}

    // Always try remote, but don't block if cached
    const remotePromise = (async () => {
      try {
        const snap = await getDoc(doc(db, 'userData', key));
        if (!snap.exists()) return null;
        const value = snap.data().value;
        try { await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, t: Date.now() })); } catch {}
        return value;
      } catch { return undefined; } // undefined means "couldn't reach"
    })();

    if (cached) {
      // refresh cache in background, return cached now
      remotePromise.then(v => { if (v !== undefined && v !== null) {
        // already cached fresh value above
      }});
      return cached.value;
    }
    const remote = await remotePromise;
    return remote === undefined ? null : remote;
  },

  async set(key, value) {
    // Cache immediately so reads after this call see the new value
    try { await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, t: Date.now() })); } catch {}
    // Try remote
    try {
      await setDoc(doc(db, 'userData', key), { value, updatedAt: Date.now() });
      return true;
    } catch {
      await enqueue({ kind: 'set', key, value });
      scheduleFlush(2000);
      return true; // success from caller's POV; will sync later
    }
  },

  async remove(key) {
    try { await AsyncStorage.removeItem(CACHE_PREFIX + key); } catch {}
    try {
      await deleteDoc(doc(db, 'userData', key));
    } catch {
      await enqueue({ kind: 'remove', key });
      scheduleFlush(2000);
    }
  },

  // Convenience
  flush: flushOutbox,
  queueLength: () => (memoryOutbox || []).length,
  online: isOnline,
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
  MEAL_PREFS:  (uid)      => 'mealprefs_' + cleanUid(uid),
  WORKOUT_HISTORY: (uid)  => 'workouthistory_' + cleanUid(uid),
  ACTIVE_WORKOUT:  (uid)  => 'activeworkout_'  + cleanUid(uid),
  BARCODE_CACHE:   ()     => 'barcodecache_v1',
  MEASUREMENTS:    (uid)  => 'measurements_'   + cleanUid(uid),
  MEASUREMENTS_MIGRATION: (uid) => 'measurementsmig_' + cleanUid(uid),
  PROGRESS_PHOTOS: (uid)  => 'progressphotos_' + cleanUid(uid),
  WEEKLY_REVIEW:   (uid)  => 'weeklyreview_'   + cleanUid(uid),
  QUICK_FAVORITES: (uid)  => 'quickfavorites_' + cleanUid(uid),
  RECIPE_IMG_CACHE: ()    => 'recipeimgcache_v1',
};
