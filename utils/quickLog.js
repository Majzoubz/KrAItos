import { Storage, KEYS } from './storage';
import { callAI, parseJSON } from './api';

export const TODAY = () => new Date().toDateString();

const mealTimeForHour = (h) => {
  if (h < 10) return 'Breakfast';
  if (h < 12) return 'Morning Snack';
  if (h < 15) return 'Lunch';
  if (h < 18) return 'Afternoon Snack';
  if (h < 21) return 'Dinner';
  return 'Late Snack';
};

export const currentMealTime = () => mealTimeForHour(new Date().getHours());

// Pull last N days of foodlog entries, group by name+mealTime to find favorites
export async function loadRecentMeals(uid, days = 14) {
  const entries = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const log = await Storage.get(KEYS.FOODLOG(uid, d.toDateString()));
    if (Array.isArray(log)) {
      log.forEach(e => entries.push({ ...e, _ageDays: i }));
    }
  }
  return entries;
}

// Top N most-frequent meals overall + per meal-slot
export async function getFavorites(uid, limit = 5) {
  const entries = await loadRecentMeals(uid, 21);
  const map = new Map();
  entries.forEach(e => {
    const key = (e.name || '').trim().toLowerCase();
    if (!key) return;
    const cur = map.get(key) || { count: 0, name: e.name, sample: e, slots: {} };
    cur.count += 1;
    cur.slots[e.mealTime || ''] = (cur.slots[e.mealTime || ''] || 0) + 1;
    if (e._ageDays < (cur.sample._ageDays ?? 999)) cur.sample = e;
    map.set(key, cur);
  });
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

// Return the meal a user "usually has" for a given meal slot in the last 14 days
export async function getUsualForSlot(uid, slot) {
  const entries = await loadRecentMeals(uid, 14);
  const matches = entries.filter(e => (e.mealTime || '').toLowerCase() === slot.toLowerCase());
  if (!matches.length) return null;
  const map = new Map();
  matches.forEach(e => {
    const key = (e.name || '').trim().toLowerCase();
    if (!key) return;
    const cur = map.get(key) || { count: 0, sample: e };
    cur.count += 1;
    if (e._ageDays < (cur.sample._ageDays ?? 999)) cur.sample = e;
    map.set(key, cur);
  });
  const top = [...map.values()].sort((a, b) => b.count - a.count)[0];
  return top ? top.sample : null;
}

// Yesterday's meal at the same slot
export async function getYesterdayMeal(uid, slot) {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const log = await Storage.get(KEYS.FOODLOG(uid, d.toDateString()));
  if (!Array.isArray(log)) return null;
  const matches = log.filter(e => (e.mealTime || '').toLowerCase() === slot.toLowerCase());
  return matches[matches.length - 1] || null;
}

// AI parse of a free-text description into a logged entry
const PARSE_SYSTEM = `You are a nutrition coach. Parse a brief meal description into accurate nutrition estimates. Use typical restaurant/home portions when unspecified. Return ONLY valid JSON, no markdown:
{"name":"clean meal name","calories":number,"protein":number,"carbs":number,"fat":number,"confidence":"low|medium|high"}`;

export async function parseMealDescription(text) {
  const raw = await callAI(PARSE_SYSTEM, text);
  const parsed = parseJSON(raw, null);
  if (!parsed) throw new Error('Could not understand that. Try "1 chicken caesar wrap" or "200g rice + 150g chicken".');
  return {
    name: parsed.name || text.slice(0, 60),
    calories: Math.max(0, Math.round(parseFloat(parsed.calories) || 0)),
    protein:  Math.max(0, Math.round((parseFloat(parsed.protein) || 0) * 10) / 10),
    carbs:    Math.max(0, Math.round((parseFloat(parsed.carbs)   || 0) * 10) / 10),
    fat:      Math.max(0, Math.round((parseFloat(parsed.fat)     || 0) * 10) / 10),
    confidence: parsed.confidence || 'medium',
  };
}

// Append an entry to today's food log
export async function appendToTodayLog(uid, entryFields) {
  const key = KEYS.FOODLOG(uid, TODAY());
  const existing = (await Storage.get(key)) || [];
  const entry = {
    id: Date.now(),
    addedAt: Date.now(),
    source: 'quicklog',
    mealTime: currentMealTime(),
    ...entryFields,
  };
  await Storage.set(key, [...existing, entry]);
  return entry;
}

// Pinned favorites the user explicitly stars
export async function loadPinnedFavorites(uid) {
  return (await Storage.get(KEYS.QUICK_FAVORITES(uid))) || [];
}
export async function pinFavorite(uid, entry) {
  const list = await loadPinnedFavorites(uid);
  const filtered = list.filter(e => (e.name || '').toLowerCase() !== (entry.name || '').toLowerCase());
  const next = [{ ...entry, pinnedAt: Date.now() }, ...filtered].slice(0, 12);
  await Storage.set(KEYS.QUICK_FAVORITES(uid), next);
  return next;
}
export async function unpinFavorite(uid, name) {
  const list = await loadPinnedFavorites(uid);
  const next = list.filter(e => (e.name || '').toLowerCase() !== (name || '').toLowerCase());
  await Storage.set(KEYS.QUICK_FAVORITES(uid), next);
  return next;
}
