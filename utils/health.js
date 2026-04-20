import AsyncStorage from '@react-native-async-storage/async-storage';
import * as impl from './health.impl';

export const dateKey = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const HKEY = (uid, dk) => `health_${uid || 'anon'}_${dk}`;
const PKEY = (uid) => `healthProfile_${uid || 'anon'}`;

const safeGet = async (k) => { try { const s = await AsyncStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } };
const safeSet = async (k, v) => { try { await AsyncStorage.setItem(k, JSON.stringify(v)); } catch {} };

export async function getHealthProfile(uid) {
  return (await safeGet(PKEY(uid))) || {
    provider: null,
    autoSync: false,
    connectedAt: null,
    permissions: {},
  };
}

export async function saveHealthProfile(uid, partial) {
  const ex = await getHealthProfile(uid);
  const merged = { ...ex, ...partial, updatedAt: Date.now() };
  await safeSet(PKEY(uid), merged);
  return merged;
}

export async function getHealthDay(uid, date = new Date()) {
  const dk = typeof date === 'string' ? date : dateKey(date);
  return await safeGet(HKEY(uid, dk));
}

export async function saveHealthDay(uid, date, data) {
  const dk = typeof date === 'string' ? date : dateKey(date);
  const ex = (await safeGet(HKEY(uid, dk))) || {};
  const merged = { ...ex, ...data, date: dk, updatedAt: Date.now() };
  await safeSet(HKEY(uid, dk), merged);
  return merged;
}

export async function getHealthHistory(uid, days = 7) {
  const out = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dk = dateKey(d);
    const day = await safeGet(HKEY(uid, dk));
    out.push({ date: dk, ...(day || {}) });
  }
  return out.reverse();
}

const _avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

export async function getHealthSummary(uid, days = 7) {
  const h = await getHealthHistory(uid, days);
  const steps   = h.filter(d => typeof d.steps === 'number').map(d => d.steps);
  const restHr  = h.filter(d => typeof d.restingHr === 'number').map(d => d.restingHr);
  const avgHr   = h.filter(d => typeof d.avgHr === 'number').map(d => d.avgHr);
  const sleep   = h.filter(d => typeof d.sleepHr === 'number').map(d => d.sleepHr);
  const active  = h.filter(d => typeof d.activeMin === 'number').map(d => d.activeMin);
  return {
    days: h,
    avgSteps: _avg(steps),
    avgRestingHr: _avg(restHr),
    avgHr: _avg(avgHr),
    avgSleep: sleep.length ? +(sleep.reduce((a, b) => a + b, 0) / sleep.length).toFixed(1) : null,
    avgActiveMin: _avg(active),
    samples: { steps: steps.length, restHr: restHr.length, sleep: sleep.length, active: active.length },
  };
}

export const stepsToActivityLevel = (avgSteps) => {
  if (avgSteps == null) return null;
  if (avgSteps < 5000)  return 'Sedentary';
  if (avgSteps < 7500)  return 'Lightly Active';
  if (avgSteps < 10000) return 'Moderately Active';
  if (avgSteps < 12500) return 'Very Active';
  return 'Extremely Active';
};

export const isStepCountingAvailable    = impl.isStepCountingAvailable;
export const requestPedometerPermission = impl.requestPedometerPermission;
export const getStepsToday              = impl.getStepsToday;
export const subscribeSteps             = impl.subscribeSteps;

export async function syncTodaySteps(uid) {
  try {
    const steps = await impl.getStepsToday();
    if (steps == null) return null;
    await saveHealthDay(uid, new Date(), { steps, source: 'pedometer', syncedAt: Date.now() });
    return steps;
  } catch { return null; }
}
