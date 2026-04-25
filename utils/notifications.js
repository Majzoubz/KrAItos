import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestPermission, hasPermission, scheduleAll, cancelAll,
  scheduleOneShot, cancelByCategory,
} from './notifications.impl';
import { tActive, setActiveLanguage } from '../i18n/translations';

const SETTINGS_KEY = 'greengain_settings';

async function ensureActiveLanguageLoaded() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.language === 'string') {
      setActiveLanguage(parsed.language);
    }
  } catch {}
}

export const PREF_KEY = 'greengain_notifications_enabled';
export const CATEGORY_PREFS_KEY = 'greengain_notification_prefs_v1';

export const DEFAULT_PREFS = {
  meals:        true,   // mealPlan-driven meal reminders
  water:        true,   // hourly water reminders during day
  dinnerCheck:  true,   // 8pm "did you log dinner?"
  workout:      true,   // 30 min before scheduled workout
  weekly:       true,   // Sunday morning weekly check-in
};

export function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hour: h, minute: min };
}

export function buildMealReminders(mealPlan) {
  if (!Array.isArray(mealPlan)) return [];
  const out = [];
  for (const m of mealPlan) {
    const t = parseTimeString(m?.time);
    if (!t) continue;
    const name = m.meal || tActive('notif.meal.defaultName');
    const foods = Array.isArray(m.foods) && m.foods.length
      ? m.foods.slice(0, 2).join(', ') : null;
    out.push({
      category: 'meal',
      hour: t.hour, minute: t.minute,
      title: tActive('notif.meal.title', { name }),
      body: foods
        ? tActive('notif.meal.bodyWith', { name, foods })
        : tActive('notif.meal.bodyDefault', { name: name.toLowerCase() }),
    });
    let preH = t.hour, preM = t.minute - 15;
    if (preM < 0) { preM += 60; preH -= 1; }
    if (preH < 0) preH += 24;
    out.push({
      category: 'meal',
      hour: preH, minute: preM,
      title: tActive('notif.meal.preTitle', { name }),
      body: tActive('notif.meal.preBody', { name: name.toLowerCase(), time: m.time }),
    });
  }
  return out;
}

export function buildWaterReminders() {
  // Hourly nudges 9am–9pm
  const out = [];
  const messages = [
    tActive('notif.water.body1'),
    tActive('notif.water.body2'),
    tActive('notif.water.body3'),
    tActive('notif.water.body4'),
    tActive('notif.water.body5'),
  ];
  for (let h = 9; h <= 21; h++) {
    out.push({
      category: 'water',
      hour: h, minute: 0,
      title: tActive('notif.water.title'),
      body: messages[h % messages.length],
    });
  }
  return out;
}

export function buildDinnerCheckReminder() {
  return [{
    category: 'dinnerCheck',
    hour: 20, minute: 0, // 8 PM
    title: tActive('notif.dinner.title'),
    body: tActive('notif.dinner.body'),
  }];
}

export function buildWeeklyCheckin() {
  // Sunday 9 AM weekly check-in. Native uses WEEKLY trigger; web schedules next Sunday.
  return [{
    category: 'weekly',
    weekday: 1,         // 1 = Sunday on iOS Calendar trigger spec (impl handles)
    hour: 9, minute: 0,
    title: tActive('notif.weekly.title'),
    body: tActive('notif.weekly.body'),
  }];
}

export function buildWorkoutReminders(plan) {
  // Look at plan.workoutPlan or plan.weeklyPlan for "time" fields like "07:00 AM"
  const out = [];
  const week = plan?.weeklyPlan || plan?.workoutPlan?.days || [];
  if (!Array.isArray(week)) return out;
  // Map JS day-of-week (0=Sun) to plan's "Monday" etc, if present.
  const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  for (const day of week) {
    if (!day || day.rest) continue;
    const t = parseTimeString(day.time);
    if (!t) continue;
    let preH = t.hour, preM = t.minute - 30;
    if (preM < 0) { preM += 60; preH -= 1; }
    if (preH < 0) preH += 24;
    const wd = day.day && dayMap[day.day] != null ? dayMap[day.day] : null;
    const focus = day.focus || day.name;
    out.push({
      category: 'workout',
      weekday: wd != null ? wd + 1 : undefined, // iOS expects 1..7 with 1=Sun
      hour: preH, minute: preM,
      title: tActive('notif.workout.title'),
      body: focus
        ? tActive('notif.workout.bodyWithFocus', { focus })
        : tActive('notif.workout.bodyDefault'),
    });
  }
  return out;
}

export async function getNotificationsEnabled() {
  try {
    const v = await AsyncStorage.getItem(PREF_KEY);
    return v === null ? true : v === '1';
  } catch { return true; }
}

export async function setNotificationsEnabledPref(enabled) {
  try { await AsyncStorage.setItem(PREF_KEY, enabled ? '1' : '0'); } catch {}
}

export async function getCategoryPrefs() {
  try {
    const raw = await AsyncStorage.getItem(CATEGORY_PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_PREFS }; }
}

export async function setCategoryPref(category, value) {
  const prefs = await getCategoryPrefs();
  prefs[category] = !!value;
  try { await AsyncStorage.setItem(CATEGORY_PREFS_KEY, JSON.stringify(prefs)); } catch {}
  return prefs;
}

export { requestPermission, hasPermission };

export async function setNotificationsEnabled(enabled) {
  await setNotificationsEnabledPref(enabled);
  if (!enabled) await cancelAll();
}

/** One-shot legacy entry — schedules JUST meal reminders (kept for compat). */
export async function scheduleMealReminders(mealPlan, { force = false } = {}) {
  const enabled = await getNotificationsEnabled();
  if (!enabled) return { scheduled: 0, reason: 'disabled' };
  const granted = force ? await requestPermission() : await hasPermission();
  if (!granted) return { scheduled: 0, reason: 'permission' };
  await ensureActiveLanguageLoaded();
  const reminders = buildMealReminders(mealPlan);
  if (!reminders.length) return { scheduled: 0, reason: 'empty' };
  await cancelByCategory('meal');
  return scheduleAll(reminders, mealPlan);
}

/** Smart scheduler — schedules every category according to user prefs. */
export async function scheduleSmartReminders(plan, { force = false } = {}) {
  const enabled = await getNotificationsEnabled();
  if (!enabled) return { scheduled: 0, reason: 'disabled' };
  const granted = force ? await requestPermission() : await hasPermission();
  if (!granted) return { scheduled: 0, reason: 'permission' };
  await ensureActiveLanguageLoaded();
  const prefs = await getCategoryPrefs();
  await cancelAll();

  let total = 0;
  const buckets = [];
  if (prefs.meals       && plan?.mealPlan) buckets.push(...buildMealReminders(plan.mealPlan));
  if (prefs.water)                          buckets.push(...buildWaterReminders());
  if (prefs.dinnerCheck)                    buckets.push(...buildDinnerCheckReminder());
  if (prefs.workout     && plan)            buckets.push(...buildWorkoutReminders(plan));
  if (prefs.weekly)                         buckets.push(...buildWeeklyCheckin());

  if (!buckets.length) return { scheduled: 0, reason: 'empty' };
  const r = await scheduleAll(buckets, plan?.mealPlan || []);
  total += r?.scheduled || 0;
  return { scheduled: total };
}

export async function cancelAllMealReminders() {
  await cancelAll();
}

export async function rescheduleNow(getPlan) {
  try {
    const plan = typeof getPlan === 'function' ? await getPlan() : getPlan;
    if (!plan) return { scheduled: 0 };
    return await scheduleSmartReminders(plan);
  } catch { return { scheduled: 0, reason: 'error' }; }
}

export { scheduleOneShot };
