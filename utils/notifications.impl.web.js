const timersByCategory = new Map(); // category -> [timeoutId]

function addTimer(cat, id) {
  const arr = timersByCategory.get(cat) || [];
  arr.push(id);
  timersByCategory.set(cat, arr);
}

function clearByCategory(cat) {
  const arr = timersByCategory.get(cat) || [];
  for (const id of arr) { try { clearTimeout(id); } catch {} }
  timersByCategory.set(cat, []);
}

function clearAllTimers() {
  for (const arr of timersByCategory.values()) {
    for (const id of arr) { try { clearTimeout(id); } catch {} }
  }
  timersByCategory.clear();
}

export async function hasPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return window.Notification.permission === 'granted';
}

export async function requestPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (window.Notification.permission === 'granted') return true;
  if (window.Notification.permission === 'denied') return false;
  try {
    const res = await window.Notification.requestPermission();
    return res === 'granted';
  } catch { return false; }
}

export async function cancelAll() { clearAllTimers(); }
export async function cancelByCategory(cat) { clearByCategory(cat); }

function fire(title, body, tag) {
  try {
    if (typeof window === 'undefined') return;
    if (window.Notification?.permission === 'granted') {
      new window.Notification(title, { body, tag });
    }
  } catch {}
}

function nextOccurrence(reminder, now) {
  // For weekday reminders (1=Sun..7=Sat): find next matching weekday at hour:minute.
  const target = new Date(now);
  if (reminder.weekday) {
    const targetDow = (reminder.weekday - 1) % 7; // 0..6
    const cur = target.getDay();
    let add = (targetDow - cur + 7) % 7;
    if (add === 0) {
      target.setHours(reminder.hour, reminder.minute, 0, 0);
      if (target.getTime() <= now.getTime()) add = 7;
    }
    target.setDate(target.getDate() + add);
    target.setHours(reminder.hour, reminder.minute, 0, 0);
    return target;
  }
  // Daily: today at h:m, else tomorrow.
  target.setHours(reminder.hour, reminder.minute, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

export async function scheduleAll(reminders, mealPlan) {
  clearAllTimers();
  const now = new Date();
  let count = 0;
  for (const r of reminders) {
    const when = nextOccurrence(r, now);
    const delay = when.getTime() - Date.now();
    // Only schedule events within next 24h to avoid setTimeout overflow / drift on web
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) continue;
    const cat = r.category || 'meal';
    const id = setTimeout(() => fire(r.title, r.body, `${cat}|${when.getTime()}`), delay);
    addTimer(cat, id);
    count++;
  }
  // Re-schedule shortly after midnight for the next day
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  const reschedId = setTimeout(() => {
    import('./notifications').then(m => m.scheduleSmartReminders({ mealPlan }).catch(() => {}));
  }, msUntilMidnight);
  addTimer('__resched', reschedId);
  return { scheduled: count };
}

export async function scheduleOneShot({ title, body, seconds = 5 }) {
  const id = setTimeout(() => fire(title, body, 'oneshot|' + Date.now()), Math.max(1000, seconds * 1000));
  addTimer('__oneshot', id);
  return { id };
}
