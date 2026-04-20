import { Storage, KEYS } from './storage';

const dayStr = (d) => d.toDateString();

export async function computeLogStreak(uid, maxLookback = 60) {
  if (!uid) return 0;
  const now = new Date();
  let streak = 0;
  let started = false;
  for (let i = 0; i < maxLookback; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    let log = null;
    try { log = await Storage.get(KEYS.FOODLOG(uid, dayStr(d))); } catch {}
    const has = Array.isArray(log) && log.length > 0;
    if (i === 0 && !has) {
      continue;
    }
    if (has) {
      streak += 1;
      started = true;
    } else if (started) {
      break;
    } else {
      break;
    }
  }
  return streak;
}

export async function computeWeeklyBadges(uid, plan) {
  if (!uid) return { logDays: 0, proteinDays: 0, calorieDays: 0 };
  const calTarget = plan?.dailyCalories || 2000;
  const proteinTarget = plan?.protein || 150;
  let logDays = 0;
  let proteinDays = 0;
  let calorieDays = 0;
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    let log = null;
    try { log = await Storage.get(KEYS.FOODLOG(uid, dayStr(d))); } catch {}
    if (!Array.isArray(log) || log.length === 0) continue;
    logDays += 1;
    const totals = log.reduce((a, x) => ({
      protein: a.protein + (x.protein || 0),
      calories: a.calories + (x.calories || 0),
    }), { protein: 0, calories: 0 });
    if (totals.protein >= proteinTarget * 0.9) proteinDays += 1;
    if (Math.abs(totals.calories - calTarget) <= calTarget * 0.12) calorieDays += 1;
  }
  return { logDays, proteinDays, calorieDays };
}
