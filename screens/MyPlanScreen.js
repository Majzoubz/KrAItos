import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Modal, ActivityIndicator,
  SafeAreaView, ScrollView, Platform, Alert,
} from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';
import { generatePlanFromOnboarding } from '../utils/planGenerator';
import { buildWeeklyContext, logSession } from '../utils/planAdapter';
import { callAI, parseJSON } from '../utils/api';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';
const TODAY = new Date().toDateString();
const TODAY_NAME = new Date().toLocaleDateString('en-US', { weekday: 'long' });
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
};

function getStartOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function AdherenceRing({ done, total, C }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <SvgCircle cx={size/2} cy={size/2} r={r} stroke={C.surface} strokeWidth={stroke} fill="none" />
        <SvgCircle
          cx={size/2} cy={size/2} r={r}
          stroke={C.green} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size/2}, ${size/2}`}
        />
      </Svg>
      <Text style={{ position: 'absolute', color: C.white, fontSize: 14, fontWeight: '900' }}>
        {done}/{total}
      </Text>
    </View>
  );
}

const REST_TIPS = [
  { icon: '🧘', title: 'Mobility flow', text: '10 min · hip openers, thoracic rotations, ankle drills' },
  { icon: '🚶', title: 'Easy walk',     text: '20–30 min · keeps blood flowing without taxing recovery' },
  { icon: '😴', title: 'Sleep target',  text: '7.5–9 hrs · biggest single recovery lever' },
];

export default function MyPlanScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [plan, setPlan]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [adherence, setAdherence] = useState([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [explainEx, setExplainEx] = useState(null); // { name, body, loading }
  const [swapEx, setSwapEx]       = useState(null); // { orig, dayIdx, exIdx, alts, loading }

  const scrollRef = useRef(null);
  const dayCardYs = useRef({});

  const uid = user.uid;
  const planKey = KEYS.PLAN(user.email || user.uid);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const p = await Storage.get(planKey);
    setPlan(p);
    const adh = (await Storage.get(KEYS.ADHERENCE(uid))) || [];
    setAdherence(adh);
    if (p) { try { await buildWeeklyContext(uid, p); } catch {} }
    setLoading(false);
  }, [planKey, uid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const regenerate = async () => {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
      if (!raw) {
        Alert.alert('Onboarding required', 'Please complete onboarding first.');
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

  const markSession = async (day, type, completed) => {
    const updated = await logSession(uid, { date: TODAY, day, type, completed });
    setAdherence(updated);
  };

  const sessionStatus = (day) => {
    const e = adherence.find(a => a.date === TODAY && a.day === day);
    if (!e) return null;
    return e.completed ? 'done' : 'skipped';
  };

  const isRestType = (t) => /^rest$/i.test(t || '');

  const weekStats = useMemo(() => {
    const start = getStartOfWeek(new Date());
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const inWeek = adherence.filter(a => {
      const d = new Date(a.date);
      return d >= start && d < end;
    });
    const done = inWeek.filter(a => a.completed).length;
    const skipped = inWeek.filter(a => !a.completed).length;
    const total = (plan?.workoutPlan || []).filter(w => !isRestType(w.type)).length;
    return { done, skipped, total };
  }, [adherence, plan]);

  const todayWorkout = useMemo(() =>
    (plan?.workoutPlan || []).find(w => w.day === TODAY_NAME),
  [plan]);

  const todayStatus = todayWorkout && !isRestType(todayWorkout.type)
    ? sessionStatus(TODAY_NAME)
    : null;

  const openExplain = async (exName) => {
    setExplainEx({ name: exName, body: '', loading: true });
    try {
      const sys = 'You are a strength & conditioning coach. Explain how to perform an exercise concisely. Use these plain-text section labels (one per line, no markdown stars): SETUP:, EXECUTION:, KEY CUES:, COMMON MISTAKES:, MUSCLES:. Each section should be 1-3 short lines. Total under 150 words.';
      const out = await callAI(sys, `Explain how to do: ${exName}`);
      setExplainEx({ name: exName, body: (out || '').trim(), loading: false });
    } catch (e) {
      setExplainEx({ name: exName, body: 'Could not load explanation. Check your connection.', loading: false });
    }
  };

  const openSwap = async (exObj, dayIdx, exIdx) => {
    setSwapEx({ orig: exObj, dayIdx, exIdx, alts: null, loading: true });
    try {
      const equip = (plan?.userProfile?.exerciseType || []).join(', ');
      const sys = 'You are a strength & conditioning coach. Suggest 3 alternative exercises that train the same primary muscles and preserve the same set/rep target. Return ONLY valid JSON: {"alts":[{"name":"exercise name","reason":"why this is a good swap (1 short sentence)"}]}. No markdown.';
      const userMsg = `Original: ${exObj.name} (${exObj.sets || ''}${exObj.reps ? ' x ' + exObj.reps : ''}). User context: ${equip || 'general gym access'}. Goal: ${plan?.userProfile?.goal || 'general fitness'}.`;
      const raw = await callAI(sys, userMsg);
      const parsed = parseJSON(raw, null);
      const alts = parsed?.alts || [];
      setSwapEx(prev => prev ? { ...prev, alts, loading: false } : null);
    } catch (e) {
      setSwapEx(prev => prev ? { ...prev, alts: [], loading: false } : null);
    }
  };

  const applySwap = async (alt) => {
    if (!swapEx || !plan) return;
    const next = JSON.parse(JSON.stringify(plan));
    const day = next.workoutPlan[swapEx.dayIdx];
    if (!day || !day.exercises) { setSwapEx(null); return; }
    const ex = day.exercises[swapEx.exIdx];
    const newEx = typeof ex === 'string'
      ? { name: alt.name, swappedFrom: ex }
      : { ...ex, name: alt.name, swappedFrom: ex.name };
    day.exercises[swapEx.exIdx] = newEx;
    setPlan(next);
    try { await Storage.set(planKey, next); } catch {}
    setSwapEx(null);
  };

  const jumpToDay = (day) => {
    const y = dayCardYs.current[day];
    if (y != null) {
      try { scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }); } catch {}
    }
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
          <Text style={s.emptyText}>Head back to Home — your training split will generate from your sign-up answers.</Text>
          <TouchableOpacity style={s.goBtn} onPress={() => onNavigate('home')}>
            <Text style={s.goBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const lastTouchTs = plan.adaptedAt || plan.generatedAt;
  const lastTouchDate = lastTouchTs
    ? new Date(lastTouchTs).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : null;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Training</Text>
        {lastTouchDate && (
          <Text style={s.titleBarSub}>{plan.adaptedAt ? 'Last adapted' : 'Generated'} {lastTouchDate}</Text>
        )}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll}>
        {/* TODAY HERO */}
        {todayWorkout && (
          isRestType(todayWorkout.type) ? (
            <View style={s.heroRest}>
              <Text style={s.heroTodayLabelMuted}>TODAY · {DAY_SHORT[TODAY_NAME] || TODAY_NAME}</Text>
              <Text style={s.heroTitleRest}>Rest day 🌿</Text>
              <Text style={s.heroSubRest}>Active recovery makes the gains stick. Try one of these:</Text>
              {REST_TIPS.map((t, i) => (
                <View key={i} style={s.restTip}>
                  <Text style={s.restTipIcon}>{t.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.restTipTitle}>{t.title}</Text>
                    <Text style={s.restTipText}>{t.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={s.hero}>
              <Text style={s.heroTodayLabel}>TODAY · {DAY_SHORT[TODAY_NAME] || TODAY_NAME}</Text>
              <Text style={s.heroTitle}>{todayWorkout.type}</Text>
              {(todayWorkout.focus || todayWorkout.duration) && (
                <Text style={s.heroSub}>
                  {todayWorkout.focus || ''}
                  {todayWorkout.focus && todayWorkout.duration ? ' · ' : ''}
                  {todayWorkout.duration ? '⏱ ' + todayWorkout.duration : ''}
                </Text>
              )}
              {(todayWorkout.exercises || []).length > 0 && (
                <Text style={s.heroExCount}>{todayWorkout.exercises.length} exercises</Text>
              )}
              <TouchableOpacity
                style={s.heroStartBtn}
                onPress={() => onNavigate('workoutsession', { day: todayWorkout.day })}
                activeOpacity={0.85}
              >
                <Text style={s.heroStartText}>▶  START WORKOUT</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity
                  style={[s.heroMini, todayStatus === 'done' && s.heroMiniDone]}
                  onPress={() => markSession(todayWorkout.day, todayWorkout.type, true)}
                >
                  <Text style={[s.heroMiniText, todayStatus === 'done' && s.heroMiniTextDone]}>
                    {todayStatus === 'done' ? '✓ Completed' : 'Mark done'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.heroMini, { marginRight: 0, marginLeft: 6 }, todayStatus === 'skipped' && s.heroMiniSkip]}
                  onPress={() => markSession(todayWorkout.day, todayWorkout.type, false)}
                >
                  <Text style={[s.heroMiniText, todayStatus === 'skipped' && { color: C.white }]}>
                    {todayStatus === 'skipped' ? '✗ Skipped' : 'Skip'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        )}

        {/* WEEKLY ADHERENCE */}
        {weekStats.total > 0 && (
          <View style={s.adhCard}>
            <AdherenceRing done={weekStats.done} total={weekStats.total} C={C} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.adhTitle}>This week</Text>
              <Text style={s.adhSub}>
                {weekStats.done >= weekStats.total
                  ? '🎯 Weekly target hit'
                  : `${weekStats.total - weekStats.done} workout${weekStats.total - weekStats.done === 1 ? '' : 's'} to go`}
                {weekStats.skipped > 0 ? ` · ${weekStats.skipped} skipped` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* DAY STRIP */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dayStrip}
        >
          {DAY_ORDER.map(day => {
            const inPlan = (plan.workoutPlan || []).find(w => w.day === day);
            if (!inPlan) return null;
            const status = !isRestType(inPlan.type) ? sessionStatus(day) : null;
            const isToday = day === TODAY_NAME;
            const rest = isRestType(inPlan.type);
            return (
              <TouchableOpacity
                key={day}
                style={[s.dayPill, isToday && s.dayPillToday, rest && !isToday && s.dayPillRest]}
                onPress={() => jumpToDay(day)}
                activeOpacity={0.8}
              >
                <Text style={[s.dayPillTop, isToday && s.dayPillTopToday]}>{DAY_SHORT[day]}</Text>
                <Text style={[s.dayPillBottom, isToday && s.dayPillBottomToday, rest && !isToday && { color: C.muted }]}>
                  {status === 'done' ? '✓' : status === 'skipped' ? '✗' : (rest ? '·' : '○')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.sectionTitle}>This week's split</Text>

        {(plan.workoutPlan || []).map((w, dayIdx) => {
          const isRest = isRestType(w.type);
          const status = !isRest ? sessionStatus(w.day) : null;
          const isToday = w.day === TODAY_NAME;
          return (
            <View
              key={dayIdx}
              style={[s.workoutCard, isRest && s.restCard, isToday && s.todayCard]}
              onLayout={(e) => { dayCardYs.current[w.day] = e.nativeEvent.layout.y; }}
            >
              <View style={s.workoutHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Text style={s.workoutDay}>{w.day}</Text>
                  {isToday && <View style={s.todayBadge}><Text style={s.todayBadgeText}>TODAY</Text></View>}
                  {status === 'done' && !isToday && <Text style={s.cardStatusDone}>✓ done</Text>}
                  {status === 'skipped' && !isToday && <Text style={s.cardStatusSkip}>✗ skipped</Text>}
                </View>
                <View style={[s.typeBadge, isRest && s.restBadge]}>
                  <Text style={[s.typeText, isRest && s.restText]}>{w.type}</Text>
                </View>
              </View>

              <View style={s.metaRow}>
                {w.focus  ? <Text style={s.metaChip}>● {w.focus}</Text> : null}
                {w.duration ? <Text style={s.metaChip}>⏱ {w.duration}</Text> : null}
              </View>

              {!isRest && !isToday && (
                <TouchableOpacity
                  style={s.startBtnSm}
                  onPress={() => onNavigate('workoutsession', { day: w.day })}
                >
                  <Text style={s.startBtnSmText}>▶ Start this workout</Text>
                </TouchableOpacity>
              )}

              {isRest && (
                <View style={s.subBlock}>
                  <Text style={s.subBlockTitle}>RECOVERY IDEAS</Text>
                  {REST_TIPS.map((t, i) => (
                    <Text key={i} style={s.subBlockText}>• {t.icon} {t.title} — {t.text}</Text>
                  ))}
                </View>
              )}

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
                          <TouchableOpacity onPress={() => openExplain(exObj.name)} style={{ flex: 1, marginRight: 8 }} activeOpacity={0.7}>
                            <Text style={s.exName}>
                              {exObj.name} <Text style={s.exInfoIcon}>ⓘ</Text>
                            </Text>
                            {exObj.swappedFrom && (
                              <Text style={s.exSwapped}>↻ swapped from {exObj.swappedFrom}</Text>
                            )}
                          </TouchableOpacity>
                          <View style={{ alignItems: 'flex-end' }}>
                            {(exObj.sets || exObj.reps) && (
                              <Text style={s.exSetsReps}>
                                {exObj.sets ? `${exObj.sets} ×` : ''} {exObj.reps || ''}
                              </Text>
                            )}
                            <TouchableOpacity
                              onPress={() => openSwap(exObj, dayIdx, j)}
                              style={s.swapBtn}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              activeOpacity={0.7}
                            >
                              <Text style={s.swapBtnText}>↻ Swap</Text>
                            </TouchableOpacity>
                          </View>
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
            <Text style={s.sectionTitle}>How to progress</Text>
            {plan.progressionNotes.map((p, i) => (
              <View key={i} style={s.progRow}>
                <View style={s.progNum}><Text style={s.progNumText}>{i + 1}</Text></View>
                <Text style={s.progText}>{p}</Text>
              </View>
            ))}
          </>
        )}

        {/* About this Program (collapsible) */}
        <TouchableOpacity
          style={s.aboutToggle}
          onPress={() => setAboutOpen(o => !o)}
          activeOpacity={0.8}
        >
          <Text style={s.aboutToggleText}>About this program</Text>
          <Text style={s.aboutToggleArrow}>{aboutOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {aboutOpen && (
          <View style={s.aboutBlock}>
            {plan.userProfile && (
              <View style={s.profileBadge}>
                <Text style={s.profileBadgeLabel}>YOUR PROFILE</Text>
                <Text style={s.profileBadgeText}>
                  {plan.userProfile?.goal} · {plan.userProfile?.weight}kg · {plan.userProfile?.height}cm · {plan.userProfile?.activity}
                </Text>
                {Array.isArray(plan.userProfile?.exerciseType) && plan.userProfile.exerciseType.length > 0 && (
                  <Text style={s.profileBadgeText}>Modality: {plan.userProfile.exerciseType.join(' · ')}</Text>
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
          </View>
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

      {/* Explain modal */}
      <Modal visible={!!explainEx} transparent animationType="fade" onRequestClose={() => setExplainEx(null)}>
        <TouchableOpacity activeOpacity={1} style={s.modalBg} onPress={() => setExplainEx(null)}>
          <TouchableOpacity activeOpacity={1} style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalLabel}>HOW TO DO IT</Text>
            <Text style={s.modalTitle}>{explainEx?.name}</Text>
            {explainEx?.loading ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator color={C.green} />
                <Text style={{ color: C.muted, marginTop: 10, fontSize: 12 }}>Coach is writing…</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380, marginTop: 6 }}>
                <Text style={s.modalBody}>{explainEx?.body}</Text>
              </ScrollView>
            )}
            <TouchableOpacity style={s.modalCloseBtn} onPress={() => setExplainEx(null)}>
              <Text style={s.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Swap modal */}
      <Modal visible={!!swapEx} transparent animationType="fade" onRequestClose={() => setSwapEx(null)}>
        <TouchableOpacity activeOpacity={1} style={s.modalBg} onPress={() => setSwapEx(null)}>
          <TouchableOpacity activeOpacity={1} style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalLabel}>SWAP EXERCISE</Text>
            <Text style={s.modalTitle}>{swapEx?.orig?.name}</Text>
            <Text style={s.modalBodySm}>Pick an alternative — same muscles, same set/rep target.</Text>
            {swapEx?.loading ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <ActivityIndicator color={C.green} />
                <Text style={{ color: C.muted, marginTop: 10, fontSize: 12 }}>Finding swaps…</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380, marginTop: 8 }}>
                {(swapEx?.alts || []).length === 0 && (
                  <Text style={[s.modalBody, { color: C.muted }]}>No swaps suggested. Try again.</Text>
                )}
                {(swapEx?.alts || []).map((alt, i) => (
                  <TouchableOpacity key={i} style={s.swapAlt} onPress={() => applySwap(alt)} activeOpacity={0.85}>
                    <Text style={s.swapAltName}>{alt.name}</Text>
                    {alt.reason && <Text style={s.swapAltReason}>{alt.reason}</Text>}
                    <Text style={s.swapAltCta}>Use this →</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={s.modalCloseBtn} onPress={() => setSwapEx(null)}>
              <Text style={s.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

  scroll: { padding: 16, paddingBottom: 100 },

  // HERO
  hero: {
    backgroundColor: C.green, borderRadius: 20, padding: 18, marginBottom: 14,
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(127,255,0,0.25)' } : {}),
  },
  heroTodayLabel: { color: C.bg, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 8, opacity: 0.7 },
  heroTodayLabelMuted: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  heroTitle: { color: C.bg, fontSize: 28, fontWeight: '900', letterSpacing: 0.3 },
  heroSub:   { color: C.bg, fontSize: 13, fontWeight: '700', marginTop: 4, opacity: 0.85 },
  heroExCount: { color: C.bg, fontSize: 11, fontWeight: '700', marginTop: 4, opacity: 0.65 },
  heroStartBtn: {
    backgroundColor: C.bg, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 14,
  },
  heroStartText: { color: C.green, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  heroMini: {
    flex: 1, marginRight: 6, paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center',
  },
  heroMiniDone: { backgroundColor: C.bg },
  heroMiniSkip: { backgroundColor: 'rgba(0,0,0,0.32)' },
  heroMiniText: { color: C.bg, fontSize: 12, fontWeight: '900' },
  heroMiniTextDone: { color: C.green },

  heroRest: {
    backgroundColor: C.card, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.border,
  },
  heroTitleRest: { color: C.white, fontSize: 24, fontWeight: '900' },
  heroSubRest: { color: C.muted, fontSize: 13, marginTop: 6, marginBottom: 14, lineHeight: 18 },
  restTip: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  restTipIcon: { fontSize: 22, marginRight: 12 },
  restTipTitle: { color: C.white, fontSize: 13, fontWeight: '900' },
  restTipText: { color: C.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },

  // ADHERENCE
  adhCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.border,
  },
  adhTitle: { color: C.white, fontSize: 14, fontWeight: '900' },
  adhSub:   { color: C.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },

  // DAY STRIP
  dayStrip: { paddingVertical: 4, paddingRight: 6 },
  dayPill: {
    width: 50, paddingVertical: 10, marginRight: 6,
    borderRadius: 12, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  dayPillToday: { backgroundColor: C.green, borderColor: C.green },
  dayPillRest: { opacity: 0.55 },
  dayPillTop: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  dayPillTopToday: { color: C.bg },
  dayPillBottom: { color: C.green, fontSize: 14, fontWeight: '900', marginTop: 4 },
  dayPillBottomToday: { color: C.bg },

  sectionTitle: { color: C.white, fontSize: 14, fontWeight: '800', marginTop: 12, marginBottom: 10 },

  workoutCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  workoutDay: { color: C.white, fontWeight: '900', fontSize: 16 },
  cardStatusDone: { color: C.green, fontSize: 11, fontWeight: '900', marginLeft: 8 },
  cardStatusSkip: { color: C.muted, fontSize: 11, fontWeight: '900', marginLeft: 8 },
  typeBadge: { backgroundColor: C.greenGlow2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeText: { color: C.green, fontSize: 12, fontWeight: '700' },
  restCard: { opacity: 0.85 },
  restBadge: { backgroundColor: C.surface },
  restText: { color: C.muted },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  metaChip: { color: C.muted, fontSize: 11, fontWeight: '700', marginRight: 12, letterSpacing: 0.5 },

  startBtnSm: {
    backgroundColor: C.surface, paddingVertical: 9, borderRadius: 10,
    alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: C.green + '40',
  },
  startBtnSmText: { color: C.green, fontSize: 12, fontWeight: '800' },

  subBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  subBlockTitle: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  subBlockText: { color: C.mutedLight, fontSize: 12, lineHeight: 20 },

  exCard: { backgroundColor: C.surface, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exName: { color: C.white, fontSize: 13, fontWeight: '800' },
  exInfoIcon: { color: C.muted, fontSize: 11 },
  exSwapped: { color: C.green, fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  exSetsReps: { color: C.green, fontSize: 12, fontWeight: '900' },
  exMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  exMeta: { color: C.muted, fontSize: 11, marginRight: 12, fontWeight: '600' },
  exNotes: { color: C.mutedLight, fontSize: 11, fontStyle: 'italic', marginTop: 6 },

  swapBtn: {
    paddingVertical: 4, paddingHorizontal: 8, backgroundColor: C.bg,
    borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: C.border,
  },
  swapBtnText: { color: C.muted, fontSize: 10, fontWeight: '800' },

  todayCard: { borderColor: C.green, borderWidth: 1.5 },
  todayBadge: { backgroundColor: C.green, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  todayBadgeText: { color: C.bg, fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  progRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  progNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  progNumText: { color: C.bg, fontWeight: '900', fontSize: 12 },
  progText: { color: C.mutedLight, fontSize: 13, lineHeight: 20, flex: 1 },

  // ABOUT collapsible
  aboutToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginTop: 16,
    borderWidth: 1, borderColor: C.border,
  },
  aboutToggleText: { color: C.white, fontSize: 13, fontWeight: '800' },
  aboutToggleArrow: { color: C.green, fontSize: 12, fontWeight: '900' },
  aboutBlock: { marginTop: 8 },
  profileBadge: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  profileBadgeLabel: { color: C.green, fontWeight: '700', fontSize: 10, marginBottom: 4, letterSpacing: 2 },
  profileBadgeText: { color: C.mutedLight, fontSize: 13 },
  philosophyCard: { backgroundColor: C.greenGlow2, borderRadius: 14, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: C.green },
  philosophyLabel: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  philosophyText: { color: C.light, fontSize: 13, lineHeight: 20 },
  volumeCard: { backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  volumeLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
  volumeText: { color: C.mutedLight, fontSize: 12, lineHeight: 18 },

  updateBtn: { borderWidth: 1.5, borderColor: C.border, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  updateBtnText: { color: C.muted, fontSize: 14, fontWeight: '700' },

  // MODALS
  modalBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: C.bg, borderRadius: 18, padding: 18,
    width: '100%', maxWidth: 420,
    borderWidth: 1, borderColor: C.border,
    ...(Platform.OS === 'web' ? { boxShadow: '0 12px 32px rgba(0,0,0,0.4)' } : {}),
  },
  modalLabel: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
  modalTitle: { color: C.white, fontSize: 18, fontWeight: '900', marginBottom: 6 },
  modalBody:   { color: C.light, fontSize: 13, lineHeight: 21 },
  modalBodySm: { color: C.muted, fontSize: 12, lineHeight: 17 },
  modalCloseBtn: {
    marginTop: 14, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  modalCloseBtnText: { color: C.muted, fontSize: 13, fontWeight: '800' },

  swapAlt: {
    backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  swapAltName: { color: C.white, fontSize: 14, fontWeight: '900' },
  swapAltReason: { color: C.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  swapAltCta: { color: C.green, fontSize: 11, fontWeight: '900', marginTop: 6, letterSpacing: 0.5 },
});
