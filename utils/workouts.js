import { Storage, KEYS } from './storage';

export const parseSetsCount = (v) => {
  if (typeof v === 'number') return Math.max(1, Math.min(10, Math.round(v)));
  if (!v) return 3;
  const m = String(v).match(/(\d+)/);
  return m ? Math.max(1, Math.min(10, parseInt(m[1], 10))) : 3;
};

export const parseRestSeconds = (rest) => {
  if (!rest) return 90;
  const s = String(rest).toLowerCase();
  const min = s.match(/(\d+(?:\.\d+)?)\s*(?:min|m)\b/);
  const sec = s.match(/(\d+)\s*s\b/);
  let total = 0;
  if (min) total += parseFloat(min[1]) * 60;
  if (sec) total += parseInt(sec[1], 10);
  if (!total) {
    // try ranges like "2-3 min"
    const range = s.match(/(\d+)\s*-\s*(\d+)\s*(min|m)?/);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      total = ((lo + hi) / 2) * (range[3] ? 60 : 1);
    }
  }
  if (!total) {
    const just = s.match(/^(\d+)$/);
    if (just) total = parseInt(just[1], 10);
  }
  return Math.max(15, Math.min(600, Math.round(total) || 90));
};

const exKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function loadHistory(uid) {
  const h = await Storage.get(KEYS.WORKOUT_HISTORY(uid));
  return Array.isArray(h) ? h : [];
}

export async function getLastForExercise(uid, exerciseName) {
  const hist = await loadHistory(uid);
  const key = exKey(exerciseName);
  for (let i = hist.length - 1; i >= 0; i--) {
    const session = hist[i];
    const ex = (session.exercises || []).find(e => exKey(e.name) === key);
    if (ex && Array.isArray(ex.sets) && ex.sets.some(s => s.completed)) {
      return { session, sets: ex.sets.filter(s => s.completed), date: session.date };
    }
  }
  return null;
}

export async function saveSession(uid, session) {
  const hist = await loadHistory(uid);
  const next = [...hist, session].slice(-200);
  return Storage.set(KEYS.WORKOUT_HISTORY(uid), next);
}

export async function loadActive(uid) {
  return Storage.get(KEYS.ACTIVE_WORKOUT(uid));
}

export async function saveActive(uid, draft) {
  return Storage.set(KEYS.ACTIVE_WORKOUT(uid), draft);
}

export async function clearActive(uid) {
  return Storage.set(KEYS.ACTIVE_WORKOUT(uid), null);
}

export function buildInitialDraft(workoutDay) {
  return {
    day: workoutDay.day,
    type: workoutDay.type,
    focus: workoutDay.focus,
    startedAt: Date.now(),
    warmupDone: {},
    cooldownDone: {},
    exercises: (workoutDay.exercises || []).map((e) => {
      const exObj = typeof e === 'string' ? { name: e } : e;
      const setCount = parseSetsCount(exObj.sets);
      return {
        name: exObj.name || 'Exercise',
        targetSets: setCount,
        targetReps: exObj.reps || '',
        targetRpe:  exObj.rpe  || '',
        rest: exObj.rest || '',
        notes: exObj.notes || '',
        sets: Array.from({ length: setCount }, () => ({ weight: '', reps: '', rpe: '', completed: false })),
      };
    }),
  };
}

export function totalVolume(draft) {
  let vol = 0;
  let setsDone = 0;
  (draft.exercises || []).forEach(ex =>
    (ex.sets || []).forEach(s => {
      if (!s.completed) return;
      setsDone += 1;
      const w = parseFloat(s.weight) || 0;
      const r = parseFloat(s.reps) || 0;
      vol += w * r;
    })
  );
  return { volume: Math.round(vol), setsDone };
}
