/**
 * Optional wearable / Health data sources.
 *
 * Apple Health (iOS) and Health Connect (Android) require native modules that
 * are NOT available in Expo Go. To use real Garmin / Whoop / Apple data,
 * users must install one of:
 *   - react-native-health         (iOS HealthKit)
 *   - react-native-health-connect (Android Health Connect)
 * AND build a custom dev client with `eas build --profile development`.
 *
 * We dynamically import these so the app keeps working in Expo Go and on web —
 * if the package isn't present we report the source as unavailable.
 */
import { Platform } from 'react-native';

let _appleHealth = null;       // react-native-health
let _healthConnect = null;     // react-native-health-connect
let _initialized = false;

async function tryLoad() {
  if (_initialized) return;
  _initialized = true;
  if (Platform.OS === 'ios') {
    try { _appleHealth = (await import('react-native-health')).default || (await import('react-native-health')); }
    catch { _appleHealth = null; }
  } else if (Platform.OS === 'android') {
    try { _healthConnect = await import('react-native-health-connect'); }
    catch { _healthConnect = null; }
  }
}

export async function isAppleHealthAvailable() {
  await tryLoad();
  return Platform.OS === 'ios' && !!_appleHealth;
}
export async function isHealthConnectAvailable() {
  await tryLoad();
  return Platform.OS === 'android' && !!_healthConnect;
}

const APPLE_PERMS = {
  permissions: {
    read: ['Steps', 'StepCount', 'HeartRate', 'RestingHeartRate',
           'SleepAnalysis', 'ActiveEnergyBurned', 'Workout'],
    write: [],
  },
};

export async function connectAppleHealth() {
  await tryLoad();
  if (!_appleHealth) return { ok: false, reason: 'unavailable' };
  return await new Promise((resolve) => {
    try {
      _appleHealth.initHealthKit(APPLE_PERMS, (err) => {
        if (err) resolve({ ok: false, reason: err.message || 'denied' });
        else resolve({ ok: true });
      });
    } catch (e) {
      resolve({ ok: false, reason: e?.message || 'init failed' });
    }
  });
}

export async function connectHealthConnect() {
  await tryLoad();
  if (!_healthConnect) return { ok: false, reason: 'unavailable' };
  try {
    const init = await _healthConnect.initialize();
    if (!init) return { ok: false, reason: 'not initialized' };
    const granted = await _healthConnect.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'SleepSession' },
      { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    ]);
    return { ok: !!granted?.length };
  } catch (e) {
    return { ok: false, reason: e?.message || 'permission failed' };
  }
}

function startEndOfToday() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function fetchTodayFromAppleHealth() {
  await tryLoad();
  if (!_appleHealth) return null;
  const { start, end } = startEndOfToday();
  const opts = { startDate: start.toISOString(), endDate: end.toISOString() };
  const res = {};
  await Promise.all([
    new Promise(r => _appleHealth.getStepCount(opts, (e, v) => { if (!e && v?.value != null) res.steps = Math.round(v.value); r(); })),
    new Promise(r => _appleHealth.getRestingHeartRate(opts, (e, v) => { if (!e && v?.value != null) res.restingHr = Math.round(v.value); r(); })),
    new Promise(r => _appleHealth.getActiveEnergyBurned(opts, (e, v) => { if (!e && v?.[0]?.value != null) res.activeMin = Math.round((v[0].value || 0) / 5); r(); })),
    new Promise(r => _appleHealth.getSleepSamples(opts, (e, v) => {
      if (!e && Array.isArray(v) && v.length) {
        const totalMs = v.reduce((acc, s) => {
          const a = new Date(s.startDate).getTime();
          const b = new Date(s.endDate).getTime();
          return acc + Math.max(0, b - a);
        }, 0);
        res.sleepHr = +(totalMs / 3_600_000).toFixed(1);
      }
      r();
    })),
  ]);
  return res;
}

export async function fetchTodayFromHealthConnect() {
  await tryLoad();
  if (!_healthConnect) return null;
  const { start, end } = startEndOfToday();
  const range = { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() };
  const res = {};
  try {
    const steps = await _healthConnect.readRecords('Steps', { timeRangeFilter: range });
    res.steps = (steps?.records || []).reduce((s, r) => s + (r.count || 0), 0);
  } catch {}
  try {
    const hr = await _healthConnect.readRecords('HeartRate', { timeRangeFilter: range });
    const samples = (hr?.records || []).flatMap(r => r.samples || []);
    const bpms = samples.map(s => s.beatsPerMinute).filter(n => typeof n === 'number');
    if (bpms.length) res.avgHr = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  } catch {}
  try {
    const cals = await _healthConnect.readRecords('ActiveCaloriesBurned', { timeRangeFilter: range });
    const totalCal = (cals?.records || []).reduce((s, r) => s + (r.energy?.inKilocalories || 0), 0);
    if (totalCal) res.activeMin = Math.round(totalCal / 5);
  } catch {}
  try {
    const sleep = await _healthConnect.readRecords('SleepSession', { timeRangeFilter: range });
    const totalMs = (sleep?.records || []).reduce((acc, r) => {
      const a = new Date(r.startTime).getTime();
      const b = new Date(r.endTime).getTime();
      return acc + Math.max(0, b - a);
    }, 0);
    if (totalMs) res.sleepHr = +(totalMs / 3_600_000).toFixed(1);
  } catch {}
  return res;
}
