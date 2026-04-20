import { Storage, KEYS } from './storage';
import { getHealthSummary, stepsToActivityLevel } from './health';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toDateString();
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function linearSlopePerDay(points) {
  if (points.length < 2) return 0;
  const n = points.length;
  const meanX = avg(points.map(p => p.x));
  const meanY = avg(points.map(p => p.y));
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export async function buildWeeklyContext(uid, plan) {
  const since = Date.now() - 7 * DAY_MS;

  const weightLog = (await Storage.get(KEYS.WEIGHT(uid))) || [];
  const adherence = (await Storage.get(KEYS.ADHERENCE(uid))) || [];

  const recentWeights = weightLog
    .filter(w => w.timestamp && w.timestamp >= since)
    .sort((a, b) => a.timestamp - b.timestamp);

  const slopeKgPerDay = linearSlopePerDay(
    recentWeights.map(w => ({ x: (w.timestamp - since) / DAY_MS, y: w.weight }))
  );
  const observedKgPerWeek = +(slopeKgPerDay * 7).toFixed(2);

  // Food log: aggregate last 7 days by date
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * DAY_MS);
    dates.push(dayKey(d));
  }
  const foodTotals = [];
  for (const d of dates) {
    const log = (await Storage.get(KEYS.FOODLOG(uid, d))) || [];
    if (log.length === 0) continue;
    const totals = log.reduce((acc, it) => ({
      calories: acc.calories + (it.calories || 0),
      protein:  acc.protein  + (it.protein  || 0),
      carbs:    acc.carbs    + (it.carbs    || 0),
      fat:      acc.fat      + (it.fat      || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    foodTotals.push({ date: d, ...totals });
  }
  const avgCalories = Math.round(avg(foodTotals.map(t => t.calories)));
  const avgProtein  = Math.round(avg(foodTotals.map(t => t.protein)));
  const loggingDays = foodTotals.length;

  // Workout adherence last 7 days
  const recentAdh = adherence.filter(a => a.timestamp && a.timestamp >= since);
  const completed = recentAdh.filter(a => a.completed).length;
  const skipped   = recentAdh.filter(a => a.completed === false).length;
  const totalSessionsPlanned = (plan?.workoutPlan || [])
    .filter(w => !/^rest$/i.test(w.type || '')).length;
  const adherencePct = totalSessionsPlanned > 0
    ? Math.round((completed / totalSessionsPlanned) * 100)
    : null;

  const targetCalories = plan?.dailyCalories || null;
  const calorieDelta = targetCalories && avgCalories
    ? avgCalories - targetCalories
    : null;

  return {
    daysSinceLastAdapt: plan?.adaptedAt
      ? Math.floor((Date.now() - plan.adaptedAt) / DAY_MS)
      : (plan?.generatedAt
          ? Math.floor((Date.now() - plan.generatedAt) / DAY_MS)
          : null),
    weight: {
      latest: recentWeights.length ? recentWeights[recentWeights.length - 1].weight : null,
      earliest: recentWeights.length ? recentWeights[0].weight : null,
      observedKgPerWeek,
      sampleCount: recentWeights.length,
    },
    nutrition: {
      avgCaloriesLast7d: avgCalories || null,
      avgProteinLast7d: avgProtein || null,
      targetCalories,
      calorieDeltaVsTarget: calorieDelta,
      loggingDays,
    },
    workout: {
      sessionsCompletedLast7d: completed,
      sessionsSkippedLast7d: skipped,
      sessionsPlannedPerWeek: totalSessionsPlanned,
      adherencePct,
    },
    health: await (async () => {
      try {
        const h = await getHealthSummary(uid, 7);
        return {
          avgStepsLast7d:    h.avgSteps,
          avgRestingHrLast7d: h.avgRestingHr,
          avgSleepHrLast7d:  h.avgSleep,
          avgActiveMinLast7d: h.avgActiveMin,
          inferredActivityLevel: stepsToActivityLevel(h.avgSteps),
          stepsSampleDays:   h.samples?.steps || 0,
        };
      } catch {
        return { avgStepsLast7d: null, stepsSampleDays: 0 };
      }
    })(),
  };
}

export function shouldAutoAdapt(plan, ctx) {
  if (!plan) return false;
  const lastTouch = plan.adaptedAt || plan.generatedAt || 0;
  const daysSince = (Date.now() - lastTouch) / DAY_MS;
  if (daysSince < 7) return false;
  // Need at least some new data to justify an adaptation
  const hasWeight = (ctx?.weight?.sampleCount || 0) >= 2;
  const hasFood   = (ctx?.nutrition?.loggingDays || 0) >= 2;
  const hasWork   = (ctx?.workout?.sessionsCompletedLast7d || 0) +
                    (ctx?.workout?.sessionsSkippedLast7d  || 0) >= 1;
  const hasHealth = (ctx?.health?.stepsSampleDays || 0) >= 3;
  return hasWeight || hasFood || hasWork || hasHealth;
}

export async function logSession(uid, entry) {
  const log = (await Storage.get(KEYS.ADHERENCE(uid))) || [];
  // dedupe by date+day
  const filtered = log.filter(e => !(e.date === entry.date && e.day === entry.day));
  const updated = [{ ...entry, timestamp: Date.now() }, ...filtered].slice(0, 200);
  await Storage.set(KEYS.ADHERENCE(uid), updated);
  return updated;
}
