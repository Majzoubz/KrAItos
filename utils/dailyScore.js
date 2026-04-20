import { Storage, KEYS } from './storage';
import { getHealthDay } from './health';

const dateOnly = (d) => d.toDateString();

function pillarsFor({ foodLog, plan, healthDay, adherenceForDay, plannedDayType }) {
  const totals = (foodLog || []).reduce((acc, item) => ({
    calories: acc.calories + (item.calories || 0),
    protein:  acc.protein  + (item.protein  || 0),
  }), { calories: 0, protein: 0 });

  const calTarget = plan?.dailyCalories || 0;
  const protTarget = plan?.protein || 0;
  const stepsTarget = plan?.stepsTarget || 8000;

  // Calorie pillar: within ±10% of target (90%–110%); or any food logged if no target
  const calOk = calTarget
    ? totals.calories >= calTarget * 0.90 && totals.calories <= calTarget * 1.10
    : totals.calories > 0;

  // Protein pillar: at least 90% of target
  const protOk = protTarget
    ? totals.protein >= protTarget * 0.9
    : totals.protein >= 80;

  // Workout pillar: completed; OR today is a planned rest day (auto ✓)
  const isRestDay = plannedDayType ? /rest/i.test(plannedDayType) : false;
  const workoutOk = isRestDay || !!(adherenceForDay && adherenceForDay.completed);

  // Steps pillar
  const steps = healthDay?.steps || 0;
  const stepsOk = steps >= stepsTarget;

  return {
    calories: { ok: calOk, value: Math.round(totals.calories), target: calTarget, label: 'Calories' },
    protein:  { ok: protOk, value: Math.round(totals.protein),  target: protTarget, label: 'Protein' },
    workout:  { ok: workoutOk, value: workoutOk ? '✓' : '—', target: 1, label: 'Workout' },
    steps:    { ok: stepsOk, value: steps, target: stepsTarget, label: 'Steps' },
  };
}

function plannedDayTypeFor(plan, date) {
  if (!Array.isArray(plan?.workoutPlan) || !plan.workoutPlan.length) return null;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const name = dayNames[date.getDay()];
  const entry = plan.workoutPlan.find(w => (w.day || '').toLowerCase() === name.toLowerCase());
  return entry?.type || null;
}

export async function computeTodayScore(uid, plan, foodLog, healthToday) {
  const adherence = (await Storage.get(KEYS.ADHERENCE(uid))) || [];
  const today = new Date();
  const todayStr = today.toDateString();
  const todayAdh = adherence.find(e => e.date === todayStr);
  const pillars = pillarsFor({
    foodLog, plan, healthDay: healthToday,
    adherenceForDay: todayAdh,
    plannedDayType: plannedDayTypeFor(plan, today),
  });
  const hits = Object.values(pillars).filter(p => p.ok).length;
  return { pillars, hits, total: 4 };
}

// Compute scores for the past N days (newest last).
// Each day returns { date, label, hits } where hits is 0..4.
export async function computeRecentScores(uid, plan, days = 7, healthUid = uid) {
  const adherence = (await Storage.get(KEYS.ADHERENCE(uid))) || [];
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toDateString();
    const [foodLog, healthDay] = await Promise.all([
      Storage.get(KEYS.FOODLOG(uid, dateStr)),
      getHealthDay(healthUid, d),
    ]);
    const adh = adherence.find(e => e.date === dateStr);
    const pillars = pillarsFor({
      foodLog, plan, healthDay, adherenceForDay: adh,
      plannedDayType: plannedDayTypeFor(plan, d),
    });
    const hits = Object.values(pillars).filter(p => p.ok).length;
    out.push({
      date: dateStr,
      label: d.toLocaleDateString('en-US', { weekday: 'short' })[0],
      day: d.getDate(),
      hits,
      isToday: i === 0,
    });
  }
  return out;
}

// A day "counts" toward a streak when at least 2 of 4 pillars hit.
export function streakFromScores(scores, threshold = 2) {
  let streak = 0;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i].hits >= threshold) streak += 1;
    else if (scores[i].isToday) {
      // grace: if today is incomplete (0 hits), don't break the streak yet
      if (scores[i].hits === 0) continue;
      else break;
    } else break;
  }
  return streak;
}
