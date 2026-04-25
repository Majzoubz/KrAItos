import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Animated, Easing, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { Storage, KEYS } from '../utils/storage';
import {
  buildInitialDraft, loadActive, saveActive, clearActive, saveSession,
  getLastForExercise, parseRestSeconds, totalVolume,
} from '../utils/workouts';
import { logSession } from '../utils/planAdapter';

const TODAY_NAME = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

export default function WorkoutSessionScreen({ user, params, onNavigate }) {
  const { C } = useTheme();
  const { t } = useI18n();
  const s = makeStyles(C);
  const uid = user.email || user.uid;

  const [plan, setPlan] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastByExercise, setLastByExercise] = useState({});
  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [collapsedEx, setCollapsedEx] = useState({});

  const restTimerRef = useRef(null);
  const ringAnim = useRef(new Animated.Value(0)).current;
  const [nowTick, setNowTick] = useState(Date.now());

  // 1s ticker for elapsed time display (only when not resting to avoid double-render)
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Load plan + draft
  useEffect(() => {
    (async () => {
      setLoading(true);
      const p = await Storage.get(KEYS.PLAN(uid));
      setPlan(p);
      const requestedDay = params?.day;
      const days = (p?.workoutPlan || []).filter(d => !/^rest$/i.test(d.type || ''));
      let chosen = null;
      if (requestedDay) chosen = days.find(d => d.day === requestedDay);
      if (!chosen) chosen = days.find(d => d.day === TODAY_NAME());
      if (!chosen) chosen = days[0];
      if (!chosen) {
        setLoading(false);
        return;
      }
      const existing = await loadActive(uid);
      let useDraft;
      if (existing && existing.day === chosen.day && existing.exercises?.length) {
        useDraft = existing;
      } else {
        useDraft = buildInitialDraft(chosen);
        await saveActive(uid, useDraft);
      }
      setDraft(useDraft);

      // Preload last-time data per exercise
      const map = {};
      await Promise.all(useDraft.exercises.map(async (ex) => {
        try {
          const last = await getLastForExercise(uid, ex.name);
          if (last) map[ex.name] = last;
        } catch {}
      }));
      setLastByExercise(map);
      setLoading(false);
    })();
    return () => { if (restTimerRef.current) clearInterval(restTimerRef.current); };
  }, [uid, params?.day]);

  const persist = useCallback((next) => {
    setDraft(next);
    saveActive(uid, next);
  }, [uid]);

  const updateSet = (exIdx, setIdx, field, value) => {
    if (!draft) return;
    const next = { ...draft, exercises: draft.exercises.map((ex, i) => {
      if (i !== exIdx) return ex;
      return { ...ex, sets: ex.sets.map((st, j) => j === setIdx ? { ...st, [field]: value } : st) };
    })};
    persist(next);
  };

  const startRestTicker = (totalForBar) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = setInterval(() => {
      setRestRemaining(prev => {
        if (prev <= 1) {
          clearInterval(restTimerRef.current);
          restTimerRef.current = null;
          if (Platform.OS !== 'web') {
            try { require('react-native').Vibration.vibrate(500); } catch {}
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const animateBarFrom = (currentRemaining, totalForBar) => {
    ringAnim.stopAnimation();
    const startFrac = totalForBar > 0 ? currentRemaining / totalForBar : 0;
    ringAnim.setValue(Math.max(0, Math.min(1, startFrac)));
    Animated.timing(ringAnim, { toValue: 0, duration: currentRemaining * 1000, easing: Easing.linear, useNativeDriver: false }).start();
  };

  const startRest = (seconds) => {
    setRestTotal(seconds);
    setRestRemaining(seconds);
    animateBarFrom(seconds, seconds);
    startRestTicker(seconds);
  };

  const skipRest = () => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    restTimerRef.current = null;
    setRestRemaining(0);
    ringAnim.stopAnimation();
    ringAnim.setValue(0);
  };

  const adjustRest = (delta) => {
    setRestRemaining(prev => {
      const next = Math.max(0, prev + delta);
      const newTotal = Math.max(restTotal, next);
      setRestTotal(newTotal);
      if (next === 0) {
        ringAnim.stopAnimation();
        ringAnim.setValue(0);
        if (restTimerRef.current) { clearInterval(restTimerRef.current); restTimerRef.current = null; }
      } else {
        animateBarFrom(next, newTotal);
        if (!restTimerRef.current) startRestTicker(newTotal);
      }
      return next;
    });
  };

  const completeSet = (exIdx, setIdx) => {
    if (!draft) return;
    const ex = draft.exercises[exIdx];
    const st = ex.sets[setIdx];
    const isUncomplete = st.completed;
    const next = { ...draft, exercises: draft.exercises.map((e, i) => {
      if (i !== exIdx) return e;
      return { ...e, sets: e.sets.map((s2, j) => j === setIdx ? { ...s2, completed: !isUncomplete } : s2) };
    })};
    persist(next);
    if (!isUncomplete) {
      // Auto-start rest timer
      const sec = parseRestSeconds(ex.rest);
      startRest(sec);
    }
  };

  const addSet = (exIdx) => {
    if (!draft) return;
    const next = { ...draft, exercises: draft.exercises.map((e, i) => {
      if (i !== exIdx) return e;
      const last = e.sets[e.sets.length - 1] || { weight: '', reps: '', rpe: '' };
      return { ...e, sets: [...e.sets, { weight: last.weight, reps: '', rpe: '', completed: false }] };
    })};
    persist(next);
  };

  const removeSet = (exIdx, setIdx) => {
    if (!draft) return;
    const next = { ...draft, exercises: draft.exercises.map((e, i) => {
      if (i !== exIdx) return e;
      if (e.sets.length <= 1) return e;
      return { ...e, sets: e.sets.filter((_, j) => j !== setIdx) };
    })};
    persist(next);
  };

  const finishWorkout = async () => {
    if (!draft) return;
    const stats = totalVolume(draft);
    if (stats.setsDone === 0) {
      Alert.alert(t('workout.alert.noSetsTitle'), t('workout.alert.noSetsMsg'));
      return;
    }
    const session = {
      ...draft,
      finishedAt: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      durationMs: Date.now() - draft.startedAt,
      totalVolume: stats.volume,
      setsDone: stats.setsDone,
    };
    await saveSession(uid, session);
    await clearActive(uid);
    try {
      await logSession(user.uid, {
        date: new Date().toDateString(),
        day: session.day,
        type: session.type,
        completed: true,
      });
    } catch {}
    Alert.alert(
      t('workout.alert.savedTitle'),
      t('workout.alert.savedMsg', {
        sets: stats.setsDone,
        volume: stats.volume.toLocaleString(),
        min: Math.round(session.durationMs / 60000),
      }),
      [{ text: t('workout.done'), onPress: () => onNavigate('plan') }]
    );
  };

  const quitWorkout = () => {
    Alert.alert(t('workout.alert.quitTitle'), t('workout.alert.quitMsg'), [
      { text: t('workout.alert.keepGoing'), style: 'cancel' },
      { text: t('workout.alert.quit'), style: 'destructive', onPress: async () => {
        await clearActive(uid);
        onNavigate('plan');
      }},
    ]);
  };

  const stats = useMemo(() => draft ? totalVolume(draft) : { volume: 0, setsDone: 0 }, [draft]);
  const elapsedMin = useMemo(() => draft ? Math.floor((nowTick - draft.startedAt) / 60000) : 0, [draft, nowTick]);

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}><ActivityIndicator color={C.green} /></View>
      </SafeAreaView>
    );
  }

  if (!draft) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text style={s.emptyTitle}>{t('workout.empty.title')}</Text>
          <Text style={s.emptySub}>{t('workout.empty.sub')}</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => onNavigate('plan')}>
            <Text style={s.primaryBtnText}>{t('workout.empty.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={quitWorkout} style={s.backBtn}>
          <Text style={s.backBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{draft.day}</Text>
          <Text style={s.headerSub}>{draft.type}{draft.focus ? ' · ' + draft.focus : ''}</Text>
        </View>
        <View style={s.statsPill}>
          <Text style={s.statsPillNum}>{t('workout.elapsedMin', { min: elapsedMin })}</Text>
          <Text style={s.statsPillLabel}>{t('workout.setsCount', { count: stats.setsDone })}</Text>
        </View>
      </View>

      {/* Rest timer strip */}
      {restRemaining > 0 && (
        <View style={s.restBar}>
          <View style={s.restBarLeft}>
            <Text style={s.restLabel}>{t('workout.resting')}</Text>
            <Text style={s.restTime}>{Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}</Text>
          </View>
          <View style={s.restBarTrack}>
            <Animated.View style={[s.restBarFill, {
              width: ringAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }]} />
          </View>
          <View style={s.restBarRight}>
            <TouchableOpacity style={s.restBtn} onPress={() => adjustRest(-15)}><Text style={s.restBtnText}>-15</Text></TouchableOpacity>
            <TouchableOpacity style={s.restBtn} onPress={() => adjustRest(15)}><Text style={s.restBtnText}>+15</Text></TouchableOpacity>
            <TouchableOpacity style={[s.restBtn, s.restBtnSkip]} onPress={skipRest}><Text style={s.restBtnText}>{t('workout.skip')}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll}>
        {draft.exercises.map((ex, exIdx) => {
          const last = lastByExercise[ex.name];
          const collapsed = !!collapsedEx[ex.name];
          const completedCount = ex.sets.filter(st => st.completed).length;
          return (
            <View key={exIdx} style={s.exCard}>
              <TouchableOpacity
                onPress={() => setCollapsedEx(c => ({ ...c, [ex.name]: !collapsed }))}
                style={s.exHeader}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.exName}>{ex.name}</Text>
                  <Text style={s.exTarget}>
                    {t('workout.target')} {ex.targetSets} × {ex.targetReps || '?'}
                    {ex.targetRpe ? ' @ ' + ex.targetRpe : ''}
                    {ex.rest ? ' · ' + t('workout.rest') + ' ' + ex.rest : ''}
                  </Text>
                  {last && (
                    <Text style={s.lastTime}>
                      {t('workout.lastTime', { date: last.date })}: {last.sets.map(st => `${st.weight || '-'}×${st.reps || '-'}`).join(', ')}
                    </Text>
                  )}
                </View>
                <View style={[s.exProgressPill, completedCount === ex.sets.length && s.exProgressPillDone]}>
                  <Text style={s.exProgressText}>{completedCount}/{ex.sets.length}</Text>
                </View>
              </TouchableOpacity>

              {ex.notes && !collapsed ? <Text style={s.exNotes}>↳ {ex.notes}</Text> : null}

              {!collapsed && (
                <View style={s.setsTable}>
                  <View style={s.setHeaderRow}>
                    <Text style={[s.setHeaderCell, { flex: 0.6 }]}>{t('workout.col.set')}</Text>
                    <Text style={[s.setHeaderCell, { flex: 1.2 }]}>{t('workout.col.prev')}</Text>
                    <Text style={[s.setHeaderCell, { flex: 1 }]}>{t('workout.col.kg')}</Text>
                    <Text style={[s.setHeaderCell, { flex: 1 }]}>{t('workout.col.reps')}</Text>
                    <Text style={[s.setHeaderCell, { flex: 0.9 }]}>{t('workout.col.rpe')}</Text>
                    <Text style={[s.setHeaderCell, { flex: 0.7, textAlign: 'right' }]}>✓</Text>
                  </View>
                  {ex.sets.map((st, setIdx) => {
                    const lastSet = last?.sets?.[setIdx];
                    const prevText = lastSet ? `${lastSet.weight || '-'}×${lastSet.reps || '-'}` : '–';
                    return (
                      <View key={setIdx} style={[s.setRow, st.completed && s.setRowDone]}>
                        <TouchableOpacity
                          onLongPress={() => removeSet(exIdx, setIdx)}
                          style={{ flex: 0.6 }}
                        >
                          <Text style={s.setNum}>{setIdx + 1}</Text>
                        </TouchableOpacity>
                        <Text style={[s.prevCell, { flex: 1.2 }]}>{prevText}</Text>
                        <TextInput
                          style={[s.setInput, { flex: 1 }]}
                          placeholder={lastSet?.weight ? String(lastSet.weight) : '0'}
                          placeholderTextColor={C.muted}
                          value={String(st.weight)}
                          onChangeText={(v) => updateSet(exIdx, setIdx, 'weight', v.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                          editable={!st.completed}
                        />
                        <TextInput
                          style={[s.setInput, { flex: 1 }]}
                          placeholder={lastSet?.reps ? String(lastSet.reps) : (ex.targetReps || '0')}
                          placeholderTextColor={C.muted}
                          value={String(st.reps)}
                          onChangeText={(v) => updateSet(exIdx, setIdx, 'reps', v.replace(/[^0-9]/g, ''))}
                          keyboardType="number-pad"
                          editable={!st.completed}
                        />
                        <TextInput
                          style={[s.setInput, { flex: 0.9 }]}
                          placeholder="-"
                          placeholderTextColor={C.muted}
                          value={String(st.rpe)}
                          onChangeText={(v) => updateSet(exIdx, setIdx, 'rpe', v.replace(/[^0-9.]/g, ''))}
                          keyboardType="decimal-pad"
                          editable={!st.completed}
                        />
                        <TouchableOpacity
                          style={[s.checkCell, { flex: 0.7 }, st.completed && s.checkCellDone]}
                          onPress={() => completeSet(exIdx, setIdx)}
                        >
                          <Text style={[s.checkCellText, st.completed && s.checkCellTextDone]}>✓</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity style={s.addSetBtn} onPress={() => addSet(exIdx)}>
                    <Text style={s.addSetBtnText}>{t('workout.addSet')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={s.finishBtn} onPress={finishWorkout} activeOpacity={0.85}>
          <Text style={s.finishBtnText}>{t('workout.finish')}</Text>
          <Text style={s.finishBtnSub}>{t('workout.finishSummary', { sets: stats.setsDone, volume: stats.volume.toLocaleString() })}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.quitLink} onPress={quitWorkout}>
          <Text style={s.quitLinkText}>{t('workout.quitLink')}</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptySub: { color: C.muted, fontSize: 14, marginBottom: 20 },
  primaryBtn: { backgroundColor: C.green, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 14 },
  primaryBtnText: { color: C.bg, fontWeight: '900' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  backBtnText: { color: C.white, fontSize: 18 },
  headerTitle: { color: C.white, fontSize: 20, fontWeight: '900' },
  headerSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  statsPill: { backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  statsPillNum: { color: C.green, fontWeight: '900', fontSize: 16 },
  statsPillLabel: { color: C.muted, fontSize: 10, marginTop: 1 },

  restBar: {
    backgroundColor: C.green + '15',
    borderBottomWidth: 1, borderBottomColor: C.green + '40',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  restBarLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  restLabel: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  restTime: { color: C.white, fontSize: 22, fontWeight: '900', marginLeft: 'auto' },
  restBarTrack: { height: 4, backgroundColor: C.card, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  restBarFill: { height: '100%', backgroundColor: C.green },
  restBarRight: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'flex-end' },
  restBtn: { backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  restBtnSkip: { backgroundColor: C.green },
  restBtnText: { color: C.white, fontWeight: '800', fontSize: 12 },

  scroll: { padding: 14, paddingBottom: 40 },

  exCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  exHeader: { flexDirection: 'row', alignItems: 'center' },
  exName: { color: C.white, fontSize: 16, fontWeight: '800' },
  exTarget: { color: C.muted, fontSize: 11, marginTop: 3 },
  lastTime: { color: C.green + 'CC', fontSize: 11, marginTop: 4 },
  exProgressPill: { backgroundColor: C.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  exProgressPillDone: { backgroundColor: C.green, borderColor: C.green },
  exProgressText: { color: C.white, fontWeight: '900', fontSize: 12 },
  exNotes: { color: C.muted, fontSize: 12, fontStyle: 'italic', marginTop: 8 },

  setsTable: { marginTop: 12 },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  setHeaderCell: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 6 },
  setRowDone: { backgroundColor: C.green + '12', borderRadius: 8 },
  setNum: { color: C.white, fontWeight: '800', fontSize: 14, textAlign: 'center' },
  prevCell: { color: C.muted, fontSize: 11, textAlign: 'center' },
  setInput: {
    backgroundColor: C.bg, color: C.white, paddingVertical: 8, paddingHorizontal: 6,
    borderRadius: 8, textAlign: 'center', fontSize: 14, fontWeight: '700',
    borderWidth: 1, borderColor: C.border,
  },
  checkCell: { backgroundColor: C.bg, paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  checkCellDone: { backgroundColor: C.green, borderColor: C.green },
  checkCellText: { color: C.muted, fontWeight: '900' },
  checkCellTextDone: { color: C.bg },
  addSetBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  addSetBtnText: { color: C.green, fontWeight: '800', fontSize: 13 },

  finishBtn: {
    backgroundColor: C.green, borderRadius: 16, paddingVertical: 18,
    alignItems: 'center', marginTop: 14,
  },
  finishBtnText: { color: C.bg, fontWeight: '900', fontSize: 16, letterSpacing: 1.5 },
  finishBtnSub: { color: C.bg, fontSize: 11, marginTop: 4, opacity: 0.7 },
  quitLink: { paddingVertical: 14, alignItems: 'center' },
  quitLinkText: { color: C.muted, fontSize: 12, textDecorationLine: 'underline' },
});
