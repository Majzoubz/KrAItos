import { Pedometer } from 'expo-sensors';

export const isStepCountingAvailable = async () => {
  try { return await Pedometer.isAvailableAsync(); } catch { return false; }
};

export const requestPedometerPermission = async () => {
  try {
    const res = await Pedometer.requestPermissionsAsync();
    return { granted: res?.status === 'granted', status: res?.status };
  } catch (e) {
    return { granted: false, reason: e?.message || 'Permission request failed' };
  }
};

export const getStepsToday = async () => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    const result = await Pedometer.getStepCountAsync(start, end);
    return result?.steps ?? 0;
  } catch {
    return null;
  }
};

export const subscribeSteps = (cb) => {
  try {
    const sub = Pedometer.watchStepCount((res) => cb(res?.steps || 0));
    return () => sub?.remove?.();
  } catch {
    return () => {};
  }
};
