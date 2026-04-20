import { callAI, parseJSON } from './api';
import { Storage, KEYS } from './storage';

export async function generatePlanFromOnboarding(data, userEmail) {
  const age = calculateAge(data.birthday);
  const heightStr = data.units === 'Imperial'
    ? `${data.heightFt}'${data.heightIn}" (${Math.round((parseInt(data.heightFt) * 30.48) + (parseInt(data.heightIn) * 2.54))}cm)`
    : `${data.height}cm`;
  const weightStr = data.units === 'Imperial'
    ? `${data.weight}lbs (${Math.round(parseFloat(data.weight) * 0.4536)}kg)`
    : `${data.weight}kg`;
  const targetStr = data.units === 'Imperial'
    ? `${data.targetWeight}lbs`
    : `${data.targetWeight}kg`;

  const userProfile = [
    `Age: ${age}`,
    `Gender: ${data.gender}`,
    `Height: ${heightStr}`,
    `Current Weight: ${weightStr}`,
    `Highest Weight: ${data.maxWeight}${data.units === 'Imperial' ? 'lbs' : 'kg'}`,
    `Recent Weight Trend: ${data.weightTrend}`,
    `Body Fat Estimate: ${data.bodyFat}`,
    `Activity Level: ${data.activityLevel}`,
    `Training Experience: ${data.trainingExp}`,
    `Cardio Experience: ${data.cardioExp}`,
    `Exercise Frequency: ${data.exerciseFreq} days/week`,
    `Primary Goal: ${data.goal}`,
    `Target Weight: ${targetStr}`,
    `Weekly Rate of Change: ${data.weeklyRate}`,
    `Diet Preference: ${data.diet}`,
    `Preferred Exercise Types: ${(data.exerciseType || []).join(', ')}`,
    `Calorie Distribution: ${data.calDistribution}`,
    `Protein Target: ${data.proteinIntake}`,
  ].join('\n');

  const freqNum = parseInt(data.exerciseFreq) || 3;
  const exTypes = (data.exerciseType || []).join(', ') || 'General fitness';

  const systemPrompt = `You are an elite S&C coach with credentials from NSCA-CSCS, certified nutritionist (RD), and 20+ years programming for professional athletes (NFL combine prep, IFBB pro bodybuilders, Olympic weightlifters, CrossFit Games competitors, marathon runners, and elite calisthenics athletes like FitnessFAQs). Apply evidence-based principles: progressive overload, periodization (Schoenfeld, Helms, Israetel research), volume landmarks (MEV/MAV/MRV), exercise selection by SFR (stimulus-to-fatigue ratio), and proper warm-up/cool-down protocols.

Generate a comprehensive personalized plan. Return ONLY valid JSON, no markdown, no extra text. Structure:
{
  "summary": "3-4 sentences: assessment of current state, the training philosophy you chose, and why it fits this user",
  "bmi": number,
  "bmiCategory": "string",
  "dailyCalories": number,
  "protein": number, "proteinPct": number,
  "carbs": number,   "carbsPct": number,
  "fat": number,     "fatPct": number,
  "mealPlan": [
    {"meal": "Breakfast", "time": "7:00 AM", "foods": ["food w/ portion"], "calories": 0, "protein": 0, "carbs": 0, "fat": 0},
    {"meal": "Morning Snack", "time": "10:00 AM", "foods": ["food w/ portion"], "calories": 0, "protein": 0, "carbs": 0, "fat": 0},
    {"meal": "Lunch", "time": "12:30 PM", "foods": ["food w/ portion"], "calories": 0, "protein": 0, "carbs": 0, "fat": 0},
    {"meal": "Afternoon Snack", "time": "3:30 PM", "foods": ["food w/ portion"], "calories": 0, "protein": 0, "carbs": 0, "fat": 0},
    {"meal": "Dinner", "time": "7:00 PM", "foods": ["food w/ portion"], "calories": 0, "protein": 0, "carbs": 0, "fat": 0}
  ],
  "trainingPhilosophy": "1-2 sentences naming the methodology you chose (e.g., 'Push/Pull/Legs hypertrophy split inspired by Dr. Mike Israetel's RP Hypertrophy', 'Calisthenics progressive skill ladder a la FitnessFAQs/GMB', '5/3/1 BBB powerlifting + conditioning', 'Norwegian Singles for runners', 'CrossFit-style conditioning with strength bias') and why it suits this user",
  "weeklyVolume": "e.g. 'Chest: 14 sets/wk, Back: 16, Quads: 12, ...' — only the muscle groups relevant to chosen modality",
  "workoutPlan": [
    {
      "day": "Monday",
      "type": "string — split name e.g. 'Upper Body Hypertrophy', 'Lower Push', 'Calisthenics Pull Skills', 'Tempo Run', 'Active Recovery', 'Rest'",
      "focus": "string — primary adaptation: 'Strength', 'Hypertrophy', 'Skill', 'Endurance', 'Power', 'Conditioning', 'Recovery'",
      "duration": "e.g. '55 min'",
      "warmup": ["3-5 short warm-up items, e.g. '5 min easy bike', 'Band pull-aparts 2x15', 'Empty bar bench 2x10'"],
      "exercises": [
        {
          "name": "specific exercise (use proper names: Barbell Back Squat, Romanian Deadlift, Weighted Pull-Up, Archer Push-Up, Pistol Squat Negatives, Tempo Run @ Z3, etc.)",
          "sets": number,
          "reps": "string — e.g. '5', '8-10', '3x5 cluster', '30s on/30s off', '20 min @ RPE 6'",
          "rest": "e.g. '2-3 min', '90s', '60s'",
          "rpe": "optional, e.g. 'RPE 7-8' or '@ 75% 1RM' or 'AMRAP-2'",
          "notes": "1 short technique cue or progression note: e.g. 'Pause 1s at chest', 'Full ROM, control eccentric', 'Progress to weighted when 3x8 clean'"
        }
      ],
      "cooldown": ["2-3 items: e.g. 'Pigeon stretch 60s/side', '5 min walk', 'Box breathing 2 min'"]
    }
  ],
  "progressionNotes": ["3-5 bullets describing how to progress weekly: load increments, deload cadence, what to do when you stall"],
  "weeklyTips": ["5 actionable tips specific to this plan and user goal"],
  "waterGoal": number,
  "sleepRecommendation": "string"
}

CRITICAL TRAINING RULES:
1. The workoutPlan array MUST have EXACTLY 7 entries (Monday through Sunday).
2. EXACTLY ${freqNum} of those days must be active training days. The other ${7 - freqNum} days must be "Rest" or "Active Recovery" with empty exercises [] (Rest) or 1-2 light exercises (Active Recovery).
3. The training modalities MUST come from the user's preferences: ${exTypes}. Do NOT add modalities the user did not request.
   - If only "Calisthenics": program a calisthenics skill + strength split (push/pull/legs bodyweight, progressions like pseudo-planche → tuck planche, archer pull-up → one-arm pull-up negatives, pistol squat progressions). NO barbell work.
   - If only "Cardio/Running": program a periodized running plan (easy Z2, tempo, intervals, long run) — no lifting.
   - If "Weightlifting" + "Cardio": program a hybrid (e.g., 4 lift days + 1-2 conditioning days, separate sessions or finishers).
   - If "HIIT": include 1-2 true HIIT sessions plus complementary work.
   - If "Yoga/Mobility": include dedicated mobility flows.
4. Use professional programming for the chosen modality:
   - Beginners (Training Experience: Beginner): linear progression, compound focus, 3 sets x 5-10 reps, RPE 6-7.
   - Intermediate: undulating periodization, mix of strength (3-6 reps) + hypertrophy (8-12) + accessory (12-15).
   - Advanced: block periodization, intensity techniques (drop sets, rest-pause, clusters), higher volume with deloads.
5. Warm-up: always specific, 5-10 min total. Cool-down: 3-5 min mobility/breathing.
6. Exercise order: compounds first, then accessories, then isolation, then conditioning/core last.
7. For fat loss goals: keep strength stimulus, add 2-3 conditioning slots; for muscle gain: maximize quality volume, minimize cardio interference; for endurance: polarize Z2 (~80%) and high-intensity (~20%).
8. ALL macro grams must align with proteinPct/carbsPct/fatPct that sum to 100. Use 4 kcal/g protein & carbs, 9 kcal/g fat.
9. Be specific with exercise names — no generic "back exercise". No filler. Every exercise must have purpose.

User wants ${freqNum} training days/week. Honor it exactly.`;

  const raw = await callAI(systemPrompt, userProfile);
  const parsed = parseJSON(raw, null);

  if (!parsed || !parsed.dailyCalories) {
    return null;
  }

  const weightKg = data.units === 'Imperial'
    ? Math.round(parseFloat(data.weight) * 0.4536)
    : parseFloat(data.weight);
  const heightCm = data.units === 'Imperial'
    ? Math.round((parseInt(data.heightFt || 0) * 30.48) + (parseInt(data.heightIn || 0) * 2.54))
    : parseFloat(data.height);

  const planData = {
    ...parsed,
    generatedAt: Date.now(),
    userProfile: {
      age,
      gender: data.gender,
      weight: weightKg,
      startWeight: weightKg,
      targetWeight: data.units === 'Imperial'
        ? Math.round(parseFloat(data.targetWeight || 0) * 0.4536)
        : parseFloat(data.targetWeight || 0) || null,
      height: heightCm,
      goal: data.goal,
      activity: data.activityLevel,
      diet: data.diet,
      exerciseType: data.exerciseType,
      weeklyRate: data.weeklyRate,
    },
  };

  await Storage.set(KEYS.PLAN(userEmail), planData);
  return planData;
}

export async function adaptPlan(prevPlan, onboardingData, weeklyContext, userEmail) {
  if (!prevPlan) return null;

  const ctxLines = [
    `Days since last update: ${weeklyContext.daysSinceLastAdapt ?? 'unknown'}`,
    `Goal: ${onboardingData?.goal || 'unspecified'} | Target weekly rate: ${onboardingData?.weeklyRate || 'unspecified'}`,
    '',
    '== Weight (last 7 days) ==',
    `Earliest: ${weeklyContext.weight.earliest ?? 'n/a'} kg`,
    `Latest:   ${weeklyContext.weight.latest ?? 'n/a'} kg`,
    `Observed weekly trend: ${weeklyContext.weight.observedKgPerWeek} kg/week (sample size ${weeklyContext.weight.sampleCount})`,
    '',
    '== Nutrition (last 7 days) ==',
    `Target calories (current plan): ${weeklyContext.nutrition.targetCalories ?? 'n/a'}`,
    `Average actual calories:        ${weeklyContext.nutrition.avgCaloriesLast7d ?? 'n/a'}`,
    `Average actual protein:         ${weeklyContext.nutrition.avgProteinLast7d ?? 'n/a'} g`,
    `Days the user actually logged:  ${weeklyContext.nutrition.loggingDays}/7`,
    weeklyContext.nutrition.calorieDeltaVsTarget !== null
      ? `Calorie drift vs target: ${weeklyContext.nutrition.calorieDeltaVsTarget > 0 ? '+' : ''}${weeklyContext.nutrition.calorieDeltaVsTarget} kcal/day`
      : '',
    '',
    '== Workout adherence (last 7 days) ==',
    `Sessions completed: ${weeklyContext.workout.sessionsCompletedLast7d}`,
    `Sessions skipped:   ${weeklyContext.workout.sessionsSkippedLast7d}`,
    `Sessions planned/week: ${weeklyContext.workout.sessionsPlannedPerWeek}`,
    weeklyContext.workout.adherencePct !== null
      ? `Adherence: ${weeklyContext.workout.adherencePct}%`
      : '',
    '',
    '== Wearable / Health (last 7 days) ==',
    weeklyContext.health?.avgStepsLast7d != null
      ? `Average daily steps: ${weeklyContext.health.avgStepsLast7d} (${weeklyContext.health.stepsSampleDays} days of data)`
      : 'Average daily steps: no data',
    weeklyContext.health?.inferredActivityLevel
      ? `Steps imply activity level: ${weeklyContext.health.inferredActivityLevel} (originally selected: ${onboardingData?.activityLevel || onboardingData?.activity || 'unspecified'})`
      : '',
    weeklyContext.health?.avgRestingHrLast7d != null
      ? `Resting HR avg: ${weeklyContext.health.avgRestingHrLast7d} bpm`
      : '',
    weeklyContext.health?.avgSleepHrLast7d != null
      ? `Sleep avg: ${weeklyContext.health.avgSleepHrLast7d} hr/night`
      : '',
    weeklyContext.health?.avgActiveMinLast7d != null
      ? `Active minutes avg: ${weeklyContext.health.avgActiveMinLast7d} min/day`
      : '',
  ].filter(Boolean).join('\n');

  const prevPlanSummary = JSON.stringify({
    dailyCalories: prevPlan.dailyCalories,
    protein: prevPlan.protein,
    carbs: prevPlan.carbs,
    fat: prevPlan.fat,
    proteinPct: prevPlan.proteinPct,
    carbsPct: prevPlan.carbsPct,
    fatPct: prevPlan.fatPct,
    trainingPhilosophy: prevPlan.trainingPhilosophy,
    weeklyVolume: prevPlan.weeklyVolume,
    workoutPlan: prevPlan.workoutPlan,
    progressionNotes: prevPlan.progressionNotes,
  });

  const systemPrompt = `You are an elite S&C coach + RD nutritionist conducting a WEEKLY CHECK-IN with a client. You have the previous plan and this week's actual data (weight trend, calorie/protein adherence, workout adherence). Apply evidence-based adaptive coaching:

ADAPTATION RULES:
1. WEIGHT TREND VS GOAL:
   - If observed weekly rate is within ±25% of target: hold calories steady, congratulate.
   - If progress is too slow (<75% of target rate): for fat loss reduce calories 100-200/day; for muscle gain add 100-200/day.
   - If progress is too fast (>125% of target rate, especially for muscle gain or aggressive cuts): pull back 100-200/day to protect lean mass / health.
   - If observedKgPerWeek conflicts with calorie adherence (e.g., user lost weight but ate above target), trust the SCALE — TDEE is higher than estimated.
2. CALORIE ADHERENCE:
   - If user consistently undereats target by >300 kcal: lower the prescribed target to a realistic number they will actually hit (sustainability > theoretical optimum).
   - If user consistently overshoots by >200 kcal AND results stalled: keep target, add an accountability tip.
3. PROTEIN: if avg protein < 0.8x prescribed, surface a focused tip; do not punish, suggest practical sources.
4. WORKOUT ADHERENCE:
   - >=80%: progress (add ~2.5-5% load on main lifts, +1 set on lagging muscle group OR advance calisthenics progression).
   - 50-79%: hold volume, reinforce 1-2 priority sessions.
   - <50% with >=2 sessions/week planned: REDUCE planned sessions by 1 (consolidate into compounds), make it sustainable, note that adherence beats theoretical optimum.
5. WEARABLE / STEPS:
   - If avgStepsLast7d is provided AND it implies a different activity level than the user originally selected (e.g. selected "Sedentary" but averaging 11k steps, or selected "Very Active" but averaging 4k), TRUST THE DATA: re-estimate TDEE for the inferred level and adjust dailyCalories accordingly (typically ±150-300 kcal). Call this out in changesThisWeek.
   - If resting HR is trending down with consistent training: positive cardio adaptation — congratulate.
   - If sleep avg < 6.5 hr: surface a recovery tip and consider slightly reducing training volume (sleep gates recovery).
6. KEEP CONTINUITY: the trainingPhilosophy stays the same unless adherence collapsed; tweak loads/volume not the whole split. The user should recognize their plan.
7. If logging is sparse (loggingDays<3 and sampleCount<2), keep plan unchanged but produce a friendly nudge in changesThisWeek.

Return ONLY valid JSON (no markdown, no extra text), the SAME schema as the original plan PLUS one new field "changesThisWeek". The mealPlan, workoutPlan, weeklyVolume, progressionNotes etc. should be the UPDATED versions reflecting the adaptations above.

ADDITIONAL FIELD:
"changesThisWeek": {
  "summary": "2-3 sentences plain-English: how the user did this week and what you adjusted",
  "adjustments": [
    {"area": "Calories" | "Macros" | "Training Volume" | "Training Frequency" | "Exercise Selection" | "Recovery", "before": "old value", "after": "new value", "why": "1 sentence reasoning citing the data"}
  ],
  "wins": ["1-3 short positives observed"],
  "focusNextWeek": ["1-3 short priorities"]
}

If literally nothing needs to change, still return the full plan unchanged with changesThisWeek explaining why (e.g., insufficient data, on-track).`;

  const userMsg = `=== PREVIOUS PLAN ===\n${prevPlanSummary}\n\n=== THIS WEEK'S ACTUAL DATA ===\n${ctxLines}\n\nProduce the updated plan now.`;

  const raw = await callAI(systemPrompt, userMsg);
  const parsed = parseJSON(raw, null);
  if (!parsed || !parsed.dailyCalories) return null;

  const adaptationLog = Array.isArray(prevPlan.adaptationLog) ? prevPlan.adaptationLog : [];
  if (parsed.changesThisWeek) {
    adaptationLog.unshift({
      at: Date.now(),
      ...parsed.changesThisWeek,
    });
  }

  const updated = {
    ...parsed,
    generatedAt: prevPlan.generatedAt || Date.now(),
    adaptedAt: Date.now(),
    userProfile: prevPlan.userProfile,
    adaptationLog: adaptationLog.slice(0, 12),
  };

  await Storage.set(KEYS.PLAN(userEmail), updated);
  return updated;
}

function calculateAge(birthday) {
  if (!birthday) return 25;
  const parts = birthday.match(/(\d+)/g);
  if (!parts || parts.length < 3) return 25;
  let year, month, day;
  if (parts[0].length === 4) {
    [year, month, day] = parts.map(Number);
  } else {
    [month, day, year] = parts.map(Number);
  }
  if (year < 100) year += 2000;
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;
  return Math.max(10, Math.min(100, age));
}
