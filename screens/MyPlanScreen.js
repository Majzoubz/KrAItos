import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';
import { generatePlanFromOnboarding, adaptPlan } from '../utils/planGenerator';
import { buildWeeklyContext, logSession } from '../utils/planAdapter';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';
const TODAY = new Date().toDateString();

export default function MyPlanScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [plan, setPlan]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [adherence, setAdherence] = useState([]);
  const [ctx, setCtx]           = useState(null);

  const uid = user.uid;
  const planKey = KEYS.PLAN(user.email || user.uid);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const p = await Storage.get(planKey);
    setPlan(p);
    const adh = (await Storage.get(KEYS.ADHERENCE(uid))) || [];
    setAdherence(adh);
    if (p) {
      try { setCtx(await buildWeeklyContext(uid, p)); } catch {}
    }
    setLoading(false);
  }, [planKey, uid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const regenerate = async () => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
      if (!raw) {
        Alert.alert('Onboarding required', 'Please complete onboarding first.', [
          { text: 'Go', onPress: () => onNavigate('onboarding') },
        ]);
        return;
      }
      setRegenerating(true);
      const data = JSON.parse(raw);
      const fresh = await generatePlanFromOnboarding(data, user.email || user.uid);
      if (fresh) setPlan(fresh);
      else Alert.alert('Could not generate plan', 'Please try again in a moment.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Plan generation failed.');
    } finally {
      setRegenerating(false);
    }
  };

  const adaptNow = async () => {
    if (!plan) return;
    try {
      setAdapting(true);
      const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
      const ob = raw ? JSON.parse(raw) : (plan.userProfile || {});
      const fresh = await buildWeeklyContext(uid, plan);
      const updated = await adaptPlan(plan, ob, fresh, user.email || user.uid);
      if (updated) {
        setPlan(updated);
        setCtx(await buildWeeklyContext(uid, updated));
      } else {
        Alert.alert('Adaptation failed', 'Please try again in a moment.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Adaptation failed.');
    } finally {
      setAdapting(false);
    }
  };

  const markSession = async (day, type, completed) => {
    const updated = await logSession(uid, { date: TODAY, day, type, completed });
    setAdherence(updated);
  };

  const sessionStatus = (day) => {
    const e = adherence.find(a => a.date === TODAY && a.day === day);
    if (!e) return null;
    return e.completed ? 'done' : 'skipped';
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}><Text style={s.titleBarText}>Training</Text></View>
        <View style={s.center}><ActivityIndicator color={C.green} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}><Text style={s.titleBarText}>Training</Text></View>
        <View style={s.center}>
          <View style={s.emptyIcon}><Text style={s.emptyIconText}>🏋️</Text></View>
          <Text style={s.emptyTitle}>No workout plan yet</Text>
          <Text style={s.emptyText}>
            Head back to the Home screen — your training split will generate automatically from your sign-up answers.
          </Text>
          <TouchableOpacity style={s.goBtn} onPress={() => onNavigate('home')}>
            <Text style={s.goBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const lastTouchTs = plan.adaptedAt || plan.generatedAt;
  const lastTouchDate = lastTouchTs
    ? new Date(lastTouchTs).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'recently';
  const daysSince = ctx?.daysSinceLastAdapt;
  const lastChange = Array.isArray(plan.adaptationLog) && plan.adaptationLog.length > 0
    ? plan.adaptationLog[0]
    : null;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Training</Text>
        <Text style={s.titleBarSub}>
          {plan.adaptedAt ? 'Last adapted' : 'Generated'} {lastTouchDate}
          {daysSince !== null && daysSince !== undefined ? ` · ${daysSince}d ago` : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {lastChange && (
          <View style={s.changeCard}>
            <Text style={s.changeLabel}>WHAT CHANGED LAST UPDATE</Text>
            {lastChange.summary ? (
              <Text style={s.changeSummary}>{lastChange.summary}</Text>
            ) : null}
            {Array.isArray(lastChange.adjustments) && lastChange.adjustments.map((a, i) => (
              <View key={i} style={s.adjRow}>
                <Text style={s.adjArea}>{a.area}</Text>
                <Text style={s.adjBeforeAfter}>
                  {a.before} <Text style={s.adjArrow}>→</Text> {a.after}
                </Text>
                {a.why ? <Text style={s.adjWhy}>{a.why}</Text> : null}
              </View>
            ))}
            {Array.isArray(lastChange.wins) && lastChange.wins.length > 0 && (
              <View style={s.changeSubBlock}>
                <Text style={s.changeSubLabel}>WINS</Text>
                {lastChange.wins.map((w, i) => (
                  <Text key={i} style={s.changeBullet}>✓ {w}</Text>
                ))}
              </View>
            )}
            {Array.isArray(lastChange.focusNextWeek) && lastChange.focusNextWeek.length > 0 && (
              <View style={s.changeSubBlock}>
                <Text style={s.changeSubLabel}>FOCUS NEXT WEEK</Text>
                {lastChange.focusNextWeek.map((f, i) => (
                  <Text key={i} style={s.changeBullet}>→ {f}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {plan.userProfile && (
          <View style={s.profileBadge}>
            <Text style={s.profileBadgeLabel}>YOUR PROFILE</Text>
            <Text style={s.profileBadgeText}>
              {plan.userProfile?.goal} · {plan.userProfile?.weight}kg · {plan.userProfile?.height}cm · {plan.userProfile?.activity}
            </Text>
            {Array.isArray(plan.userProfile?.exerciseType) && plan.userProfile.exerciseType.length > 0 && (
              <Text style={s.profileBadgeText}>
                Modality: {plan.userProfile.exerciseType.join(' · ')}
              </Text>
            )}
          </View>
        )}

        {plan.trainingPhilosophy && (
          <View style={s.philosophyCard}>
            <Text style={s.philosophyLabel}>TRAINING PHILOSOPHY</Text>
            <Text style={s.philosophyText}>{plan.trainingPhilosophy}</Text>
          </View>
        )}

        {plan.weeklyVolume && (
          <View style={s.volumeCard}>
            <Text style={s.volumeLabel}>WEEKLY VOLUME</Text>
            <Text style={s.volumeText}>{plan.weeklyVolume}</Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Your Workout Split</Text>

        {(plan.workoutPlan || []).length === 0 && (
          <Text style={s.emptyText}>No workout days in this plan.</Text>
        )}

        {(plan.workoutPlan || []).map((w, i) => {
          const isRest = /^rest$/i.test(w.type || '');
          const status = !isRest ? sessionStatus(w.day) : null;
          const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === w.day;
          return (
            <View key={i} style={[s.workoutCard, isRest && s.restCard, isToday && s.todayCard]}>
              <View style={s.workoutHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={s.workoutDay}>{w.day}</Text>
                  {isToday && <View style={s.todayBadge}><Text style={s.todayBadgeText}>TODAY</Text></View>}
                </View>
                <View style={[s.typeBadge, isRest && s.restBadge]}>
                  <Text style={[s.typeText, isRest && s.restText]}>{w.type}</Text>
                </View>
              </View>

              {!isRest && (
                <>
                  <TouchableOpacity
                    style={s.startBtn}
                    onPress={() => onNavigate('workoutsession', { day: w.day })}
                    activeOpacity={0.85}
                  >
                    <Text style={s.startBtnText}>▶  START WORKOUT</Text>
                  </TouchableOpacity>
                  <View style={s.checkRow}>
                    <TouchableOpacity
                      style={[s.checkBtn, status === 'done' && s.checkBtnDone]}
                      onPress={() => markSession(w.day, w.type, true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.checkBtnText, status === 'done' && s.checkBtnTextDone]}>
                        {status === 'done' ? '✓ Completed' : 'Mark Done'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.checkBtn, s.checkBtnSkip, status === 'skipped' && s.checkBtnSkippedActive]}
                      onPress={() => markSession(w.day, w.type, false)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.checkBtnText, status === 'skipped' && s.checkBtnSkippedText]}>
                        {status === 'skipped' ? '✗ Skipped' : 'Skip'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <View style={s.metaRow}>
                {w.focus  ? <Text style={s.metaChip}>● {w.focus}</Text> : null}
                {w.duration ? <Text style={s.metaChip}>⏱ {w.duration}</Text> : null}
              </View>

              {Array.isArray(w.warmup) && w.warmup.length > 0 && (
                <View style={s.subBlock}>
                  <Text style={s.subBlockTitle}>WARM-UP</Text>
                  {w.warmup.map((it, k) => (
                    <Text key={k} style={s.subBlockText}>• {it}</Text>
                  ))}
                </View>
              )}

              {Array.isArray(w.exercises) && w.exercises.length > 0 && (
                <View style={s.subBlock}>
                  <Text style={s.subBlockTitle}>WORKOUT</Text>
                  {w.exercises.map((e, j) => {
                    const exObj = typeof e === 'string' ? { name: e } : e;
                    return (
                      <View key={j} style={s.exCard}>
                        <View style={s.exHeader}>
                          <Text style={s.exName}>{exObj.name}</Text>
                          {(exObj.sets || exObj.reps) && (
                            <Text style={s.exSetsReps}>
                              {exObj.sets ? `${exObj.sets} ×` : ''} {exObj.reps || ''}
                            </Text>
                          )}
                        </View>
                        <View style={s.exMetaRow}>
                          {exObj.rest ? <Text style={s.exMeta}>Rest {exObj.rest}</Text> : null}
                          {exObj.rpe  ? <Text style={s.exMeta}>{exObj.rpe}</Text> : null}
                        </View>
                        {exObj.notes ? <Text style={s.exNotes}>↳ {exObj.notes}</Text> : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {Array.isArray(w.cooldown) && w.cooldown.length > 0 && (
                <View style={s.subBlock}>
                  <Text style={s.subBlockTitle}>COOL-DOWN</Text>
                  {w.cooldown.map((it, k) => (
                    <Text key={k} style={s.subBlockText}>• {it}</Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {Array.isArray(plan.progressionNotes) && plan.progressionNotes.length > 0 && (
          <>
            <Text style={s.sectionTitle}>How to Progress</Text>
            {plan.progressionNotes.map((p, i) => (
              <View key={i} style={s.progRow}>
                <View style={s.progNum}><Text style={s.progNumText}>{i + 1}</Text></View>
                <Text style={s.progText}>{p}</Text>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity
          style={s.updateBtn}
          onPress={regenerate}
          disabled={regenerating}
          activeOpacity={0.8}
        >
          {regenerating
            ? <ActivityIndicator color={C.green} />
            : <Text style={s.updateBtnText}>↻ Regenerate Program</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  titleBarSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.greenGlow2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyIconText: { fontSize: 32 },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptyText: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  goBtn: { backgroundColor: C.green, paddingVertical: 15, paddingHorizontal: 36, borderRadius: 14 },
  goBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, padding: 4, marginHorizontal: 16, marginVertical: 12, borderRadius: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: C.green },
  tabBtnText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  tabBtnTextActive: { color: C.bg },
  scroll: { padding: 16, paddingBottom: 100 },
  assessCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  assessLabel: { color: C.green, fontWeight: '700', fontSize: 10, marginBottom: 8, letterSpacing: 2 },
  assessText: { color: C.light, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  bmiRow: { flexDirection: 'row', alignItems: 'center' },
  bmiBox: { backgroundColor: C.bg, borderRadius: 12, padding: 12, alignItems: 'center', marginRight: 16 },
  bmiNum: { color: C.green, fontSize: 26, fontWeight: '900' },
  bmiSub: { color: C.muted, fontSize: 11 },
  bmiCat: { color: C.white, fontSize: 16, fontWeight: '700' },
  calorieBox: { backgroundColor: C.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  calorieNum: { color: C.green, fontSize: 52, fontWeight: '900' },
  calorieLabel: { color: C.muted, fontSize: 12, letterSpacing: 2 },
  macroRow: { flexDirection: 'row', marginBottom: 16 },
  macroItem: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: 'center', marginRight: 6, borderWidth: 1, borderColor: C.border },
  macroVal: { fontSize: 20, fontWeight: '800', color: C.green },
  macroUnit: { fontSize: 12 },
  macroPct: { color: C.greenDim, fontSize: 12, fontWeight: '700', marginTop: 2 },
  macroLabel: { color: C.muted, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: C.white, fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  mealCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  mealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  mealTimeBadge: { backgroundColor: C.greenGlow2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 10 },
  mealTimeText: { color: C.green, fontSize: 10, fontWeight: '700' },
  mealName: { color: C.white, fontWeight: '800', fontSize: 15, flex: 1 },
  mealCal: { color: C.green, fontWeight: '700', fontSize: 13 },
  foodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  foodDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.green, marginRight: 10 },
  foodText: { color: C.mutedLight, fontSize: 13, flex: 1 },
  mealMacros: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  mealMacroText: { color: C.muted, fontSize: 11, fontWeight: '600', marginRight: 16 },
  profileBadge: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  profileBadgeLabel: { color: C.green, fontWeight: '700', fontSize: 10, marginBottom: 4, letterSpacing: 2 },
  profileBadgeText: { color: C.mutedLight, fontSize: 13 },
  workoutCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  workoutDay: { color: C.white, fontWeight: '900', fontSize: 16 },
  typeBadge: { backgroundColor: C.greenGlow2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeText: { color: C.green, fontSize: 12, fontWeight: '700' },
  durationLabel: { color: C.muted, fontSize: 12, marginBottom: 10 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  exerciseDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginRight: 10 },
  exerciseText: { color: C.mutedLight, fontSize: 13, flex: 1 },
  exerciseDetail: { color: C.green, fontSize: 12, fontWeight: '700' },
  restCard: { opacity: 0.65 },
  restBadge: { backgroundColor: C.surface },
  restText: { color: C.muted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  metaChip: { color: C.muted, fontSize: 11, fontWeight: '700', marginRight: 12, letterSpacing: 0.5 },
  subBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  subBlockTitle: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  subBlockText: { color: C.mutedLight, fontSize: 12, lineHeight: 20 },
  exCard: { backgroundColor: C.surface, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exName: { color: C.white, fontSize: 13, fontWeight: '800', flex: 1, marginRight: 8 },
  exSetsReps: { color: C.green, fontSize: 12, fontWeight: '900' },
  exMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  exMeta: { color: C.muted, fontSize: 11, marginRight: 12, fontWeight: '600' },
  exNotes: { color: C.mutedLight, fontSize: 11, fontStyle: 'italic', marginTop: 6 },
  philosophyCard: { backgroundColor: C.greenGlow2, borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.green },
  philosophyLabel: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  philosophyText: { color: C.light, fontSize: 13, lineHeight: 20 },
  volumeCard: { backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  volumeLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  volumeText: { color: C.mutedLight, fontSize: 12, lineHeight: 18 },
  progRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  progNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  progNumText: { color: C.bg, fontWeight: '900', fontSize: 12 },
  progText: { color: C.mutedLight, fontSize: 13, lineHeight: 20, flex: 1 },
  tipCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: C.border },
  tipNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tipNumText: { color: C.bg, fontWeight: '900', fontSize: 13 },
  tipText: { color: C.light, fontSize: 14, lineHeight: 22, flex: 1 },
  updateBtn: { borderWidth: 1.5, borderColor: C.border, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  updateBtnText: { color: C.muted, fontSize: 14, fontWeight: '700' },

  adaptCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  adaptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  adaptTitle: { color: C.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  adhPill: { backgroundColor: C.greenGlow2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  adhPillText: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 10, padding: 10, marginRight: 6, alignItems: 'center' },
  statVal: { color: C.green, fontSize: 18, fontWeight: '900' },
  statValDim: { color: C.muted, fontSize: 14, fontWeight: '700' },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 3, textAlign: 'center', letterSpacing: 0.3 },
  adaptBtn: { backgroundColor: C.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  adaptBtnText: { color: C.bg, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  adaptHint: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16 },

  changeCard: { backgroundColor: C.greenGlow2, borderRadius: 14, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: C.green },
  changeLabel: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  changeSummary: { color: C.light, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  adjRow: { backgroundColor: C.card, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  adjArea: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  adjBeforeAfter: { color: C.white, fontSize: 13, fontWeight: '700' },
  adjArrow: { color: C.green, fontWeight: '900' },
  adjWhy: { color: C.mutedLight, fontSize: 11, fontStyle: 'italic', marginTop: 4, lineHeight: 16 },
  changeSubBlock: { marginTop: 8 },
  changeSubLabel: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  changeBullet: { color: C.mutedLight, fontSize: 12, lineHeight: 18, marginBottom: 3 },

  todayCard: { borderColor: C.green, borderWidth: 1.5 },
  todayBadge: { backgroundColor: C.green, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  todayBadgeText: { color: C.bg, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  startBtn: { backgroundColor: C.green, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 6, marginBottom: 8 },
  startBtnText: { color: C.bg, fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
  checkRow: { flexDirection: 'row', marginTop: 4, marginBottom: 4 },
  checkBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginRight: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  checkBtnDone: { backgroundColor: C.green, borderColor: C.green },
  checkBtnSkip: { marginRight: 0 },
  checkBtnSkippedActive: { backgroundColor: C.surface, borderColor: C.muted },
  checkBtnText: { color: C.muted, fontSize: 12, fontWeight: '800' },
  checkBtnTextDone: { color: C.bg },
  checkBtnSkippedText: { color: C.white },
});
