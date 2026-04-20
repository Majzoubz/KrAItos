import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEDULE_KEY = 'greengain_notification_ids_v2';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function readIds() {
  try { const raw = await AsyncStorage.getItem(SCHEDULE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
async function writeIds(list) {
  try { await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(list)); } catch {}
}

export async function hasPermission() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function requestPermission() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function cancelAll() {
  const list = await readIds();
  for (const r of list) {
    try { await Notifications.cancelScheduledNotificationAsync(r.id); } catch {}
  }
  await writeIds([]);
}

export async function cancelByCategory(category) {
  const list = await readIds();
  const remain = [];
  for (const r of list) {
    if (r.category === category) {
      try { await Notifications.cancelScheduledNotificationAsync(r.id); } catch {}
    } else remain.push(r);
  }
  await writeIds(remain);
}

function buildTrigger(r) {
  const T = Notifications.SchedulableTriggerInputTypes;
  if (r.weekday) {
    return {
      type: T?.WEEKLY ?? 'weekly',
      weekday: r.weekday, // 1..7 (1 = Sunday)
      hour: r.hour, minute: r.minute,
    };
  }
  return {
    type: T?.DAILY ?? 'daily',
    hour: r.hour, minute: r.minute,
  };
}

export async function scheduleAll(reminders /*, mealPlan */) {
  const ids = await readIds();
  let count = 0;
  for (const r of reminders) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, sound: 'default' },
        trigger: buildTrigger(r),
      });
      ids.push({ id, category: r.category || 'meals' });
      count++;
    } catch {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, sound: 'default' },
          trigger: { hour: r.hour, minute: r.minute, repeats: true },
        });
        ids.push({ id, category: r.category || 'meals' });
        count++;
      } catch {}
    }
  }
  await writeIds(ids);
  return { scheduled: count };
}

export async function scheduleOneShot({ title, body, seconds = 5 }) {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: { seconds: Math.max(1, seconds) },
    });
    return { id };
  } catch { return null; }
}
