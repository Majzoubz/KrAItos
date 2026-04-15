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

  const systemPrompt = `You are an elite certified fitness coach and registered dietitian with 20 years of experience. Based on the user's complete profile, generate a comprehensive personalized fitness and nutrition plan. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure:
{
  "summary": "3-4 sentence personalized assessment of the user's current state and recommended approach",
  "bmi": number,
  "bmiCategory": "string",
  "dailyCalories": number,
  "protein": number,
  "proteinPct": number,
  "carbs": number,
  "carbsPct": number,
  "fat": number,
  "fatPct": number,
  "mealPlan": [
    {"meal": "Breakfast", "time": "7:00 AM", "foods": ["food item with portion"], "calories": number, "protein": number, "carbs": number, "fat": number},
    {"meal": "Morning Snack", "time": "10:00 AM", "foods": ["food item"], "calories": number, "protein": number, "carbs": number, "fat": number},
    {"meal": "Lunch", "time": "12:30 PM", "foods": ["food item with portion"], "calories": number, "protein": number, "carbs": number, "fat": number},
    {"meal": "Afternoon Snack", "time": "3:30 PM", "foods": ["food item"], "calories": number, "protein": number, "carbs": number, "fat": number},
    {"meal": "Dinner", "time": "7:00 PM", "foods": ["food item with portion"], "calories": number, "protein": number, "carbs": number, "fat": number}
  ],
  "workoutPlan": [
    {"day": "Monday", "type": "Push (Chest/Shoulders/Triceps)", "duration": "60 min", "exercises": [{"name": "exercise name", "sets": 3, "reps": "8-12", "rest": "90s"}]},
    {"day": "Tuesday", "type": "Cardio", "duration": "30 min", "exercises": [{"name": "exercise name", "sets": 1, "reps": "30 min", "rest": ""}]},
    {"day": "Wednesday", "type": "Pull (Back/Biceps)", "duration": "60 min", "exercises": [{"name": "exercise name", "sets": 3, "reps": "8-12", "rest": "90s"}]},
    {"day": "Thursday", "type": "Rest", "duration": "0 min", "exercises": []},
    {"day": "Friday", "type": "Legs & Core", "duration": "60 min", "exercises": [{"name": "exercise name", "sets": 3, "reps": "10-15", "rest": "90s"}]},
    {"day": "Saturday", "type": "Full Body / HIIT", "duration": "45 min", "exercises": [{"name": "exercise name", "sets": 3, "reps": "12-15", "rest": "60s"}]},
    {"day": "Sunday", "type": "Active Recovery", "duration": "30 min", "exercises": [{"name": "exercise name", "sets": 1, "reps": "20-30 min", "rest": ""}]}
  ],
  "weeklyTips": ["tip1", "tip2", "tip3", "tip4", "tip5"],
  "waterGoal": number,
  "sleepRecommendation": "7-9 hours"
}
All macros in grams. Percentages should add up to 100. Tailor EVERYTHING to the user's specific profile, goals, experience level, and preferences. Make workout exercises specific with proper sets/reps/rest.`;

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
      height: heightCm,
      goal: data.goal,
      activity: data.activityLevel,
      diet: data.diet,
      exerciseType: data.exerciseType,
    },
  };

  await Storage.set(KEYS.PLAN(userEmail), planData);
  return planData;
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
