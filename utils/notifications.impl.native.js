import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SCHEDULE_KEY = 'greengain_notification_ids';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    for (const id of ids) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
  } catch {}
  try { await AsyncStorage.removeItem(SCHEDULE_KEY); } catch {}
}

export async function scheduleAll(reminders /*, mealPlan */) {
  const ids = [];
  for (const r of reminders) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes?.DAILY ?? 'daily',
          hour: r.hour,
          minute: r.minute,
        },
      });
      ids.push(id);
    } catch (e) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, sound: 'default' },
          trigger: { hour: r.hour, minute: r.minute, repeats: true },
        });
        ids.push(id);
      } catch {}
    }
  }
  try { await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(ids)); } catch {}
  return { scheduled: ids.length };
}
