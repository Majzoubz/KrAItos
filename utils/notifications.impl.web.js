const timers = [];

function clearTimers() {
  while (timers.length) {
    try { clearTimeout(timers.pop()); } catch {}
  }
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

export async function cancelAll() {
  clearTimers();
}

export async function scheduleAll(reminders, mealPlan) {
  clearTimers();
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  let count = 0;
  for (const r of reminders) {
    const when = new Date(now);
    when.setHours(r.hour, r.minute, 0, 0);
    const delay = when.getTime() - Date.now();
    if (delay > 0 && when <= endOfDay) {
      const id = setTimeout(() => {
        try {
          if (window.Notification.permission === 'granted') {
            new window.Notification(r.title, { body: r.body, tag: r.title + '|' + when.getTime() });
          }
        } catch {}
      }, delay);
      timers.push(id);
      count++;
    }
  }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  const reschedId = setTimeout(() => {
    import('./notifications').then(m => m.scheduleMealReminders(mealPlan).catch(() => {}));
  }, msUntilMidnight);
  timers.push(reschedId);
  return { scheduled: count };
}
