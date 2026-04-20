import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, Modal, Switch, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import {
  getHealthProfile, saveHealthProfile, getHealthDay, saveHealthDay,
  getHealthHistory, getHealthSummary, dateKey,
  isStepCountingAvailable, requestPedometerPermission,
  syncTodaySteps, subscribeSteps, stepsToActivityLevel,
} from '../utils/health';
import {
  isAppleHealthAvailable, isHealthConnectAvailable,
  connectAppleHealth, connectHealthConnect,
  fetchTodayFromAppleHealth, fetchTodayFromHealthConnect,
} from '../utils/wearables';
import { tick as hTick, select as hSelect, success as hSuccess } from '../utils/haptics';
import { LoadingState } from '../components/UI';

const PROVIDERS = [
  { id: 'pedometer', name: 'Phone Pedometer', sub: 'iPhone / Android steps', icon: '👟', live: true },
  { id: 'apple',     name: 'Apple Health',    sub: 'HR · Sleep · Workouts',  icon: '', tint: '#FF3B6E', soon: true, devBuild: true },
  { id: 'google',    name: 'Google Fit',      sub: 'Android health data',    icon: '', tint: '#34A853', soon: true, devBuild: true },
  { id: 'garmin',    name: 'Garmin',          sub: 'Watch & cycling data',   icon: '⌚', tint: '#0073CF', soon: true },
  { id: 'fitbit',    name: 'Fitbit',          sub: 'Tracker & Premium',      icon: '◆',  tint: '#00B0B9', soon: true },
  { id: 'whoop',     name: 'Whoop',           sub: 'Recovery & strain',      icon: '◉',  tint: '#FFD600', soon: true },
];

function showAlert(title, msg) {
  if (Platform.OS === 'web') { try { window.alert(`${title}\n\n${msg}`); } catch {} return; }
  try { Alert.alert(title, msg); } catch {}
}

function StatCard({ label, value, unit, icon, tint, onPress }) {
  const { C } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{
      flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14,
      borderWidth: 1, borderColor: C.border, minHeight: 96,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: (tint || C.green) + '22', alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 14 }}>{icon}</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginLeft: 8 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={{ color: value == null ? C.muted : C.white, fontSize: 24, fontWeight: '900' }}>
          {value == null ? '—' : value}
        </Text>
        {value != null && unit ? (
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', marginLeft: 4, marginBottom: 4 }}>{unit}</Text>
        ) : null}
      </View>
      <Text style={{ color: C.muted + 'CC', fontSize: 10, marginTop: 4 }}>Tap to edit</Text>
    </TouchableOpacity>
  );
}

function ProviderCard({ p, connected, onPress }) {
  const { C } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        backgroundColor: C.card, borderRadius: 18, padding: 16,
        borderWidth: 1.5, borderColor: connected ? C.green : C.border,
        flexDirection: 'row', alignItems: 'center', marginBottom: 10,
      }}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: (p.tint || C.green) + '22',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 20 }}>{p.icon || '◎'}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.white, fontSize: 15, fontWeight: '800' }}>{p.name}</Text>
          {connected && (
            <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: C.green + '22', borderRadius: 6 }}>
              <Text style={{ color: C.green, fontSize: 9, fontWeight: '900' }}>CONNECTED</Text>
            </View>
          )}
        </View>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{p.sub}</Text>
        {p.soon && (
          <Text style={{ color: C.muted, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
            {p.devBuild ? 'Requires custom dev build' : 'Coming soon'}
          </Text>
        )}
      </View>
      <Text style={{ color: C.green, fontSize: 18, fontWeight: '900' }}>›</Text>
    </TouchableOpacity>
  );
}

function StepsBarChart({ days, color }) {
  const { C } = useTheme();
  const max = Math.max(1, ...days.map(d => d.steps || 0));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6 }}>
      {days.map((d, i) => {
        const v = d.steps || 0;
        const h = Math.max(2, (v / max) * 70);
        const dt = new Date(d.date);
        const lbl = ['S','M','T','W','T','F','S'][dt.getDay()];
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: '70%', height: h,
              backgroundColor: v ? color : C.border,
              borderRadius: 4,
            }} />
            <Text style={{ color: C.muted, fontSize: 9, marginTop: 4, fontWeight: '700' }}>{lbl}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ManualEditModal({ visible, onClose, today, onSave }) {
  const { C } = useTheme();
  const [steps, setSteps]       = useState('');
  const [restingHr, setRestHr]  = useState('');
  const [avgHr, setAvgHr]       = useState('');
  const [sleepHr, setSleepHr]   = useState('');
  const [activeMin, setActive]  = useState('');

  useEffect(() => {
    if (!visible) return;
    setSteps(today?.steps != null ? String(today.steps) : '');
    setRestHr(today?.restingHr != null ? String(today.restingHr) : '');
    setAvgHr(today?.avgHr != null ? String(today.avgHr) : '');
    setSleepHr(today?.sleepHr != null ? String(today.sleepHr) : '');
    setActive(today?.activeMin != null ? String(today.activeMin) : '');
  }, [visible, today]);

  const fields = [
    { k: 'steps',     label: 'Steps',          unit: 'steps', val: steps,     set: setSteps,   icon: '👟' },
    { k: 'restingHr', label: 'Resting HR',     unit: 'bpm',   val: restingHr, set: setRestHr,  icon: '🫀' },
    { k: 'avgHr',     label: 'Average HR',     unit: 'bpm',   val: avgHr,     set: setAvgHr,   icon: '❤️' },
    { k: 'sleepHr',   label: 'Sleep',          unit: 'hours', val: sleepHr,   set: setSleepHr, icon: '🛌' },
    { k: 'activeMin', label: 'Active minutes', unit: 'min',   val: activeMin, set: setActive,  icon: '🔥' },
  ];

  const save = () => {
    const payload = {};
    fields.forEach(f => {
      const n = parseFloat(f.val);
      if (!isNaN(n) && n >= 0) payload[f.k] = f.k === 'sleepHr' ? +n.toFixed(1) : Math.round(n);
    });
    payload.source = (today?.source && today.source !== 'manual') ? `${today.source}+manual` : 'manual';
    hSuccess();
    onSave(payload);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36 }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          <Text style={{ color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 4 }}>Today's Health</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 18 }}>Enter what you have. Leave blank to skip.</Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {fields.map(f => (
              <View key={f.k} style={{ marginBottom: 12 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 }}>
                  {f.icon}  {f.label.toUpperCase()}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    value={f.val}
                    onChangeText={f.set}
                    placeholder="—"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    style={{
                      flex: 1, backgroundColor: C.surface, color: C.white,
                      paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
                      fontSize: 17, fontWeight: '700', borderWidth: 1, borderColor: C.border,
                    }}
                  />
                  <Text style={{ color: C.muted, fontSize: 12, marginLeft: 10, fontWeight: '700', width: 50 }}>{f.unit}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity onPress={() => { hSelect(); onClose(); }} style={{ flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.muted, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={{ flex: 1.4, paddingVertical: 16, borderRadius: 14, backgroundColor: C.green, alignItems: 'center' }}>
              <Text style={{ color: C.bg, fontWeight: '900', letterSpacing: 1 }}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HealthScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const uid = user?.email || user?.uid;

  const [profile, setProfile]   = useState(null);
  const [today, setToday]       = useState(null);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [available, setAvail]   = useState(null);
  const [editVisible, setEdit]  = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [p, t, sum, av] = await Promise.all([
      getHealthProfile(uid),
      getHealthDay(uid),
      getHealthSummary(uid, 7),
      isStepCountingAvailable(),
    ]);
    setProfile(p); setToday(t); setSummary(sum); setAvail(av);
    setLoading(false);
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh]);

  // Live pedometer: watchStepCount fires deltas since subscription start, NOT a daily total.
  // We capture a baseline (today's true total via getStepCountAsync) once, then add the delta.
  useEffect(() => {
    if (!profile?.provider || profile.provider !== 'pedometer' || !profile.permissions?.pedometer) return;
    let baseline = null;
    let cancelled = false;
    (async () => {
      const startTotal = await syncTodaySteps(uid);
      if (cancelled) return;
      baseline = startTotal || 0;
      const refreshed = await getHealthDay(uid);
      if (!cancelled) setToday(refreshed);
    })();
    const off = subscribeSteps(async (delta) => {
      if (baseline == null) return;
      const total = baseline + (delta || 0);
      const m = await saveHealthDay(uid, new Date(), { steps: total, source: 'pedometer', syncedAt: Date.now() });
      setToday(m);
    });
    return () => { cancelled = true; off && off(); };
  }, [profile?.provider, profile?.permissions?.pedometer, uid]);

  const connectPedometer = async () => {
    hSelect();
    const ok = await isStepCountingAvailable();
    if (!ok) {
      showAlert('Not available', 'Step counting is not available on this device.');
      return;
    }
    const perm = await requestPedometerPermission();
    if (!perm.granted) {
      showAlert('Permission needed', perm.reason || 'Step access was denied. You can enable it in your device settings.');
      const np = await saveHealthProfile(uid, {
        provider: 'pedometer',
        permissions: { pedometer: false },
      });
      setProfile(np);
      return;
    }
    setSyncing(true);
    const steps = await syncTodaySteps(uid);
    setSyncing(false);
    const np = await saveHealthProfile(uid, {
      provider: 'pedometer',
      autoSync: true,
      connectedAt: Date.now(),
      permissions: { pedometer: true },
    });
    setProfile(np);
    if (steps != null) hSuccess();
    refresh();
  };

  const connectApple = async () => {
    hSelect();
    const avail = await isAppleHealthAvailable();
    if (!avail) {
      showAlert('Apple Health',
        "Reading live Apple Health data needs a custom Expo dev build with the react-native-health module. In Expo Go this isn't available. Run `eas build --profile development` after installing it, then come back and tap Connect.");
      return;
    }
    setSyncing(true);
    const r = await connectAppleHealth();
    if (!r.ok) { setSyncing(false); showAlert('Apple Health', `Couldn't connect: ${r.reason || 'permission denied'}`); return; }
    const data = await fetchTodayFromAppleHealth();
    if (data) await saveHealthDay(uid, new Date(), { ...data, source: 'apple', syncedAt: Date.now() });
    const np = await saveHealthProfile(uid, { provider: 'apple', autoSync: true, connectedAt: Date.now(), permissions: { apple: true } });
    setProfile(np); setSyncing(false); hSuccess(); refresh();
  };

  const connectGoogle = async () => {
    hSelect();
    const avail = await isHealthConnectAvailable();
    if (!avail) {
      showAlert('Health Connect',
        "Reading live Health Connect data needs a custom Expo dev build with the react-native-health-connect module. In Expo Go this isn't available. Run `eas build --profile development` after installing it, then come back and tap Connect.");
      return;
    }
    setSyncing(true);
    const r = await connectHealthConnect();
    if (!r.ok) { setSyncing(false); showAlert('Health Connect', `Couldn't connect: ${r.reason || 'permission denied'}`); return; }
    const data = await fetchTodayFromHealthConnect();
    if (data) await saveHealthDay(uid, new Date(), { ...data, source: 'google', syncedAt: Date.now() });
    const np = await saveHealthProfile(uid, { provider: 'google', autoSync: true, connectedAt: Date.now(), permissions: { google: true } });
    setProfile(np); setSyncing(false); hSuccess(); refresh();
  };

  const handleProvider = (p) => {
    if (p.id === 'pedometer') return connectPedometer();
    if (p.id === 'apple') return connectApple();
    if (p.id === 'google') return connectGoogle();
    if (p.soon) {
      hSelect();
      showAlert(
        `${p.name} integration`,
        `${p.name} integration is on the roadmap. For now, log values manually below — the AI uses them for plan adaptation.`
      );
      return;
    }
  };

  const manualSync = async () => {
    setEdit(true);
    hSelect();
  };

  const onSaveManual = async (payload) => {
    const merged = await saveHealthDay(uid, new Date(), payload);
    setToday(merged);
    setEdit(false);
    refresh();
  };

  const syncSteps = async () => {
    if (available === false) {
      showAlert('Not available', 'Live step sync is only available on iPhone or Android.');
      return;
    }
    setSyncing(true);
    hSelect();
    const perm = await requestPedometerPermission();
    if (!perm.granted) {
      setSyncing(false);
      showAlert('Permission denied', perm.reason || 'Enable motion access in your device settings.');
      return;
    }
    const steps = await syncTodaySteps(uid);
    setSyncing(false);
    if (steps != null) hSuccess();
    refresh();
  };

  const setAutoSync = async (v) => {
    hSelect();
    const np = await saveHealthProfile(uid, { autoSync: v });
    setProfile(np);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <LoadingState message="Loading your health data…" />
      </SafeAreaView>
    );
  }

  const inferred = stepsToActivityLevel(summary?.avgSteps);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => { hSelect(); onNavigate('profile'); }} style={s.backBtn}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Health & Activity</Text>
        <TouchableOpacity onPress={syncSteps} style={s.syncBtn} disabled={syncing}>
          {syncing ? <ActivityIndicator size="small" color={C.bg} /> : <Text style={s.syncTxt}>↻</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <View style={s.heroCard}>
          <Text style={s.heroLabel}>TODAY · STEPS</Text>
          <Text style={s.heroBig}>{today?.steps != null ? today.steps.toLocaleString() : '—'}</Text>
          <View style={s.heroBarBg}>
            <View style={[s.heroBarFill, { width: `${Math.min(100, ((today?.steps || 0) / 10000) * 100)}%` }]} />
          </View>
          <Text style={s.heroSub}>
            {today?.steps != null
              ? `${Math.max(0, 10000 - today.steps).toLocaleString()} to your 10,000 goal`
              : 'Connect a source or sync manually'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <StatCard label="Resting HR" value={today?.restingHr} unit="bpm" icon="🫀" tint="#FF3B6E" onPress={() => setEdit(true)} />
          <StatCard label="Sleep"      value={today?.sleepHr}   unit="hr"  icon="🛌" tint="#7B61FF" onPress={() => setEdit(true)} />
          <StatCard label="Active"     value={today?.activeMin} unit="min" icon="🔥" tint="#FF8A00" onPress={() => setEdit(true)} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>WEEKLY STEP TREND</Text>
          <View style={s.chartCard}>
            <StepsBarChart days={summary?.days || []} color={C.green} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
              <View>
                <Text style={s.metaLabel}>7-day avg</Text>
                <Text style={s.metaValue}>{summary?.avgSteps != null ? summary.avgSteps.toLocaleString() : '—'}</Text>
              </View>
              <View>
                <Text style={s.metaLabel}>Inferred level</Text>
                <Text style={[s.metaValue, { color: C.green }]}>{inferred || '—'}</Text>
              </View>
              <View>
                <Text style={s.metaLabel}>Sleep avg</Text>
                <Text style={s.metaValue}>{summary?.avgSleep != null ? summary.avgSleep + 'h' : '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>DATA SOURCES</Text>
          {PROVIDERS.map(p => (
            <ProviderCard
              key={p.id}
              p={p}
              connected={profile?.provider === p.id && (p.id !== 'pedometer' || profile?.permissions?.pedometer)}
              onPress={() => handleProvider(p)}
            />
          ))}
          <TouchableOpacity onPress={manualSync} style={[s.manualBtn]}>
            <Text style={s.manualBtnText}>✎  Manual Entry</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>PREFERENCES</Text>
          <View style={s.prefRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.prefLabel}>Auto-sync steps</Text>
              <Text style={s.prefSub}>Refresh in the background while using the app</Text>
            </View>
            <Switch
              value={!!profile?.autoSync}
              onValueChange={setAutoSync}
              trackColor={{ true: C.green, false: C.border }}
              thumbColor={profile?.autoSync ? C.bg : C.muted}
            />
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoTitle}>How this affects your plan</Text>
            <Text style={s.infoText}>
              Your average daily steps and sleep are sent to the AI coach during weekly check-ins. If you're consistently more (or less) active than the activity level you picked at signup, the calorie target adjusts automatically.
            </Text>
          </View>
        </View>
      </ScrollView>

      <ManualEditModal
        visible={editVisible}
        today={today}
        onClose={() => setEdit(false)}
        onSave={onSaveManual}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  title: { color: C.white, fontSize: 18, fontWeight: '900' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backTxt: { color: C.white, fontSize: 22, fontWeight: '700', marginTop: -2 },
  syncBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  syncTxt: { color: C.bg, fontSize: 18, fontWeight: '900' },
  heroCard: {
    backgroundColor: C.card, borderRadius: 22, padding: 22,
    borderWidth: 1, borderColor: C.border,
  },
  heroLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heroBig: { color: C.green, fontSize: 52, fontWeight: '900', letterSpacing: -1, marginVertical: 6 },
  heroBarBg: { height: 6, backgroundColor: C.surface, borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  heroBarFill: { height: '100%', backgroundColor: C.green, borderRadius: 3 },
  heroSub: { color: C.muted, fontSize: 12, marginTop: 8, fontWeight: '600' },
  section: { marginTop: 22 },
  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  chartCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border },
  metaLabel: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  metaValue: { color: C.white, fontSize: 16, fontWeight: '900' },
  manualBtn: { paddingVertical: 14, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', borderWidth: 1.5, borderColor: C.green + '60', marginTop: 4 },
  manualBtnText: { color: C.green, fontWeight: '900', letterSpacing: 0.5 },
  prefRow: { backgroundColor: C.card, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  prefLabel: { color: C.white, fontSize: 14, fontWeight: '800' },
  prefSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  infoCard: { backgroundColor: C.greenGlow2, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.green + '40' },
  infoTitle: { color: C.green, fontSize: 12, fontWeight: '900', marginBottom: 6, letterSpacing: 0.5 },
  infoText: { color: C.light, fontSize: 13, lineHeight: 18 },
});
