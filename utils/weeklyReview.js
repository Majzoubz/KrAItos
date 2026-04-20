import { Storage, KEYS } from './storage';
import { callAI, parseJSON } from './api';
import { buildWeeklyContext } from './planAdapter';

const weekKey = (d = new Date()) => {
  const day = d.getDay(); // 0=Sun
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  return sunday.toISOString().slice(0, 10);
};

export async function getLatestReview(uid) {
  const list = (await Storage.get(KEYS.WEEKLY_REVIEW(uid))) || [];
  return list[list.length - 1] || null;
}

export async function getAllReviews(uid) {
  return (await Storage.get(KEYS.WEEKLY_REVIEW(uid))) || [];
}

export function isReviewDue(latestReview) {
  // Show banner on Sundays + Mondays unless we already have one for the current week.
  const today = new Date();
  const weekday = today.getDay(); // 0=Sun, 1=Mon
  const todayWeek = weekKey(today);
  if (latestReview?.weekStart === todayWeek) return false;
  return weekday === 0 || weekday === 1;
}

export async function markReviewSeen(uid, weekStart) {
  const list = (await Storage.get(KEYS.WEEKLY_REVIEW(uid))) || [];
  const next = list.map(r => r.weekStart === weekStart ? { ...r, seen: true } : r);
  await Storage.set(KEYS.WEEKLY_REVIEW(uid), next);
  return next;
}

const SYSTEM = `You are an elite personal coach (strength + nutrition). Given a user's last 7 days of self-tracked data, write a brief weekly review. Be specific, kind, and practical. Reference their actual numbers. Return ONLY valid JSON, no markdown:
{
  "title": "short headline (max 8 words)",
  "summary": "2-3 sentence honest recap of the week",
  "wins": ["concrete thing they did well", "another"],
  "misses": ["concrete thing that slipped", "another"],
  "adjustments": ["one specific change to make next week", "another"],
  "nextFocus": "the ONE thing to prioritize next week (1 sentence)"
}`;

export async function generateWeeklyReview(uid, plan) {
  const ctx = await buildWeeklyContext(uid, plan);
  const profile = plan?.userProfile || {};
  const userMsg = `User profile: ${profile.gender || '?'}, ${profile.age || '?'}y, ${profile.weight || '?'}kg, goal: ${profile.goal || '?'} (target ${profile.targetWeight || '?'}kg).
Plan targets: ${plan?.dailyCalories || '?'} kcal, ${plan?.protein || '?'}g protein, ${plan?.carbs || '?'}g carbs, ${plan?.fat || '?'}g fat.
Last 7 days observed:
- Weight: latest ${ctx?.weight?.latest ?? '?'}kg, change ${ctx?.weight?.observedKgPerWeek ?? '?'}kg/wk
- Nutrition: avg ${ctx?.nutrition?.avgCaloriesLast7d ?? '?'} kcal (${ctx?.nutrition?.calorieDeltaVsTarget >= 0 ? '+' : ''}${ctx?.nutrition?.calorieDeltaVsTarget ?? '?'} vs target), avg ${ctx?.nutrition?.avgProteinLast7d ?? '?'}g protein, logged on ${ctx?.nutrition?.loggingDays ?? '?'}/7 days
- Workouts: ${ctx?.workout?.sessionsCompletedLast7d ?? 0} done, ${ctx?.workout?.sessionsSkippedLast7d ?? 0} skipped (${ctx?.workout?.adherencePct ?? '?'}% adherence)
- Health: avg ${ctx?.health?.avgStepsLast7d ?? '?'} steps/day, ${ctx?.health?.avgSleepHrLast7d ?? '?'}h sleep, inferred activity: ${ctx?.health?.inferredActivityLevel ?? '?'}

Write the JSON review now.`;

  const raw = await callAI(SYSTEM, userMsg);
  const parsed = parseJSON(raw, null);
  if (!parsed) throw new Error('Could not parse AI response');

  const review = {
    weekStart: weekKey(),
    generatedAt: Date.now(),
    seen: false,
    context: ctx,
    ...parsed,
  };

  const list = (await Storage.get(KEYS.WEEKLY_REVIEW(uid))) || [];
  // replace if same week
  const filtered = list.filter(r => r.weekStart !== review.weekStart);
  const next = [...filtered, review].slice(-12);
  await Storage.set(KEYS.WEEKLY_REVIEW(uid), next);
  return review;
}
