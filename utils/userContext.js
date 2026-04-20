import AsyncStorage from '@react-native-async-storage/async-storage';
import { Storage, KEYS } from './storage';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';

function fmtDate(d) { return new Date(d).toDateString(); }

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function pretty(v) {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

export async function buildUserContext(user) {
  if (!user) return 'No user data available.';
  const uid = user.uid;
  const planUid = user.email || user.uid;
  const today = new Date().toDateString();

  const [onbStorage, onbLocalRaw, plan, foodToday, waterToday, weights, adherence, measurements] = await Promise.all([
    Storage.get(KEYS.ONBOARDING(planUid)).catch(() => null),
    AsyncStorage.getItem(ONBOARDING_DATA_KEY).catch(() => null),
    Storage.get(KEYS.PLAN(planUid)).catch(() => null),
    Storage.get(KEYS.FOODLOG(uid, today)).catch(() => []),
    Storage.get(KEYS.WATER(uid, today)).catch(() => null),
    Storage.get(KEYS.WEIGHT(uid)).catch(() => []),
    Storage.get(KEYS.ADHERENCE(uid)).catch(() => []),
    Storage.get(KEYS.MEASUREMENTS(uid)).catch(() => []),
  ]);

  let onb = onbStorage;
  if (!onb && onbLocalRaw) {
    try { onb = JSON.parse(onbLocalRaw); } catch {}
  }

  const lines = [];
  lines.push('=== USER PROFILE ===');
  lines.push(`Name: ${pretty(user.fullName || user.name)}`);
  lines.push(`Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`);

  if (onb) {
    lines.push(`Goal: ${pretty(onb.goal)}`);
    lines.push(`Age: ${pretty(onb.age)}  Sex: ${pretty(onb.gender || onb.sex)}`);
    lines.push(`Height: ${pretty(onb.height)} ${onb.heightUnit || (onb.heightFt ? `${onb.heightFt}ft ${onb.heightIn || 0}in` : '')}`);
    lines.push(`Current weight: ${pretty(onb.weight)} ${onb.weightUnit || ''}`);
    lines.push(`Target weight: ${pretty(onb.targetWeight)} ${onb.weightUnit || ''}`);
    lines.push(`Activity level: ${pretty(onb.activityLevel || onb.activity)}`);
    lines.push(`Exercise type(s): ${pretty(onb.exerciseType)}`);
    lines.push(`Days/week training: ${pretty(onb.workoutDays || onb.daysPerWeek)}`);
    lines.push(`Diet: ${pretty(onb.dietType || onb.diet)}`);
    lines.push(`Allergies / restrictions: ${pretty(onb.allergies || onb.restrictions)}`);
    lines.push(`Meals per day: ${pretty(onb.mealsPerDay)}`);
    if (onb.experience) lines.push(`Training experience: ${pretty(onb.experience)}`);
    if (onb.sleep) lines.push(`Avg sleep: ${pretty(onb.sleep)}`);
    if (onb.targetDate) lines.push(`Target date: ${pretty(onb.targetDate)}`);
  } else {
    lines.push('Onboarding: not completed yet.');
  }

  if (plan) {
    lines.push('');
    lines.push('=== DAILY TARGETS (from generated plan) ===');
    lines.push(`Calories: ${pretty(plan.dailyCalories)} kcal`);
    if (plan.macros) {
      lines.push(`Protein: ${pretty(plan.macros.protein)}g · Carbs: ${pretty(plan.macros.carbs)}g · Fat: ${pretty(plan.macros.fat)}g`);
    }
    if (plan.bmi) lines.push(`BMI: ${pretty(plan.bmi)} (${pretty(plan.bmiCategory)})`);

    if (Array.isArray(plan.workoutPlan) && plan.workoutPlan.length) {
      lines.push('');
      lines.push('=== TRAINING SPLIT ===');
      plan.workoutPlan.forEach(w => {
        if (!w) return;
        const exCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
        lines.push(`${w.day || '—'}: ${w.type || '—'}${w.focus ? ' · ' + w.focus : ''}${exCount ? ' · ' + exCount + ' exercises' : ''}${w.duration ? ' · ' + w.duration : ''}`);
      });
    }

    if (Array.isArray(plan.mealPlan) && plan.mealPlan.length) {
      lines.push('');
      lines.push('=== PLANNED MEALS ===');
      plan.mealPlan.forEach(m => {
        if (!m) return;
        const foods = (m.foods || []).slice(0, 3).join(', ');
        lines.push(`${m.meal || 'Meal'}${m.time ? ' (' + m.time + ')' : ''}: ${foods}${(m.foods || []).length > 3 ? ' …' : ''} · ${m.calories || 0} kcal`);
      });
    }

    if (plan.trainingPhilosophy) {
      lines.push('');
      lines.push(`Training philosophy: ${plan.trainingPhilosophy}`);
    }
  }

  // Today's logged food
  if (Array.isArray(foodToday) && foodToday.length) {
    const totals = foodToday.reduce((a, f) => ({
      cal: a.cal + (f.calories || 0),
      p:   a.p   + (f.protein  || 0),
      c:   a.c   + (f.carbs    || 0),
      f:   a.f   + (f.fat      || 0),
    }), { cal: 0, p: 0, c: 0, f: 0 });
    lines.push('');
    lines.push('=== TODAY\'S FOOD LOG ===');
    lines.push(`Logged ${foodToday.length} items · ${Math.round(totals.cal)} kcal · P${Math.round(totals.p)} C${Math.round(totals.c)} F${Math.round(totals.f)}`);
    foodToday.slice(0, 8).forEach(f => {
      lines.push(`- ${f.mealName || f.name || 'food'}${f.mealTime ? ' (' + f.mealTime + ')' : ''}: ${f.calories || 0} kcal`);
    });
  } else {
    lines.push('');
    lines.push('Today\'s food log: nothing logged yet.');
  }

  // Water
  if (waterToday) {
    lines.push(`Water today: ${waterToday.cups || waterToday.count || 0} cups`);
  }

  // Weight history
  if (Array.isArray(weights) && weights.length) {
    const recent = weights.slice(-5);
    lines.push('');
    lines.push('=== RECENT WEIGHT (last 5) ===');
    recent.forEach(w => {
      lines.push(`${fmtDate(w.date || w.t || w.timestamp)}: ${w.weight || w.value} ${w.unit || ''}`);
    });
  }

  // Weekly adherence
  if (Array.isArray(adherence) && adherence.length) {
    const start = getStartOfWeek(new Date());
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const inWeek = adherence.filter(a => {
      const d = new Date(a.date);
      return d >= start && d < end;
    });
    const done = inWeek.filter(a => a.completed).length;
    const skip = inWeek.filter(a => !a.completed).length;
    const totalSched = (plan?.workoutPlan || []).filter(w => !/^rest$/i.test(w.type || '')).length;
    lines.push('');
    lines.push(`This week's training: ${done} done · ${skip} skipped · ${totalSched} scheduled`);
  }

  // Recent measurements
  if (Array.isArray(measurements) && measurements.length) {
    const last = measurements[measurements.length - 1];
    if (last) {
      lines.push('');
      lines.push('=== LATEST MEASUREMENTS ===');
      Object.entries(last).forEach(([k, v]) => {
        if (k !== 'date' && k !== 'timestamp' && v != null && v !== '') {
          lines.push(`${k}: ${v}`);
        }
      });
    }
  }

  return lines.join('\n');
}
