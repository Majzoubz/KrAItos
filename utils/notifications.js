import AsyncStorage from '@react-native-async-storage/async-storage';

export const PREF_KEY = 'greengain_notifications_enabled';

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

export function buildReminders(mealPlan) {
  if (!Array.isArray(mealPlan)) return [];
  const out = [];
  for (const m of mealPlan) {
    const t = parseTimeString(m?.time);
    if (!t) continue;
    const name = m.meal || 'Meal';
    const foods = Array.isArray(m.foods) && m.foods.length
      ? m.foods.slice(0, 2).join(', ') : null;
    out.push({
      hour: t.hour, minute: t.minute,
      title: `Time for ${name}`,
      body: foods ? `${name}: ${foods}` : `It's time to eat your ${name.toLowerCase()}.`,
    });
    let preH = t.hour, preM = t.minute - 15;
    if (preM < 0) { preM += 60; preH -= 1; }
    if (preH < 0) preH += 24;
    out.push({
      hour: preH, minute: preM,
      title: `${name} in 15 minutes`,
      body: `Get ready — ${name.toLowerCase()} at ${m.time}.`,
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

import { requestPermission, hasPermission, scheduleAll, cancelAll } from './notifications.impl';

export { requestPermission, hasPermission };

export async function setNotificationsEnabled(enabled) {
  await setNotificationsEnabledPref(enabled);
  if (!enabled) await cancelAll();
}

export async function scheduleMealReminders(mealPlan, { force = false } = {}) {
  const enabled = await getNotificationsEnabled();
  if (!enabled) return { scheduled: 0, reason: 'disabled' };
  const granted = force ? await requestPermission() : await hasPermission();
  if (!granted) return { scheduled: 0, reason: 'permission' };
  const reminders = buildReminders(mealPlan);
  if (!reminders.length) return { scheduled: 0, reason: 'empty' };
  await cancelAll();
  return scheduleAll(reminders, mealPlan);
}

export async function cancelAllMealReminders() {
  await cancelAll();
}
