import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Animated, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path as SvgPath, Circle as SvgCircle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS, subscribeSyncStatus } from '../utils/storage';
import { OfflineBanner } from './../components/UI';
import { Auth } from '../utils/auth';
import { generatePlanFromOnboarding, adaptPlan } from '../utils/planGenerator';
import { scheduleMealReminders } from '../utils/notifications';
import { buildWeeklyContext, shouldAutoAdapt } from '../utils/planAdapter';
import { getHealthDay, syncTodaySteps, isStepCountingAvailable } from '../utils/health';
import TodayScoreCard from '../components/TodayScoreCard';
import QuickLogSheet from '../components/QuickLogSheet';
import { getLatestReview, isReviewDue } from '../utils/weeklyReview';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';

function Ring({ size, stroke, pct, color, children, trackColor }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const deg = Math.round(Math.min(Math.max(pct, 0), 1) * 360);
  const ringStyle = Platform.OS === 'web' ? {
    background: `conic-gradient(${color} ${deg}deg, ${trackColor || C.border} ${deg}deg)`,
  } : { backgroundColor: trackColor || C.border };

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[{
        width: size, height: size, borderRadius: size / 2,
        alignItems: 'center', justifyContent: 'center',
      }, ringStyle]}>
        <View style={{
          width: size - stroke * 2, height: size - stroke * 2,
          borderRadius: (size - stroke * 2) / 2,
          backgroundColor: C.card,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {children}
        </View>
      </View>
    </View>
  );
}

function DateStrip({ selectedIdx, onSelect, today }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={s.dateStrip}>
      {days.map((d, i) => {
        const active = i === selectedIdx;
        return (
          <TouchableOpacity key={i} style={s.dateCell} onPress={() => onSelect(i)} activeOpacity={0.7}>
            <Text style={[s.dateDay, active && s.dateDayActive]}>{dayLetters[d.getDay()]}</Text>
            <View style={[s.dateNumWrap, active && s.dateNumWrapActive]}>
              <Text style={[s.dateNum, active && s.dateNumActive]}>{d.getDate()}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function HomeScreen({ user, onNavigate, onUserUpdate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [plan, setPlan]               = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [syncQueued, setSyncQueued] = useState(0);
  useEffect(() => subscribeSyncStatus(({ queued }) => setSyncQueued(queued)), []);
  const [generating, setGenerating]   = useState(false);
  const [genError, setGenError]       = useState(null);
  const [foodLog, setFoodLog]         = useState([]);
  const [healthToday, setHealthToday] = useState(null);
  const [streak, setStreak]           = useState(user.streak || 0);
  const [latestReview, setLatestReview] = useState(null);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const today                         = new Date();
  const [todayDate]                   = useState(today.toDateString());
  const fadeAnim                      = useRef(new Animated.Value(0)).current;

  const tryAutoGenerate = useCallback(async () => {
    setGenError(null);
    let onboarding = null;
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
      if (raw) onboarding = JSON.parse(raw);
    } catch {}
    if (!onboarding) {
      try {
        onboarding = await Storage.get(KEYS.ONBOARDING(user.email || user.uid));
      } catch {}
    }
    if (!onboarding) {
      setGenError('missing');
      return null;
    }
    setGenerating(true);
    try {
      const generated = await generatePlanFromOnboarding(
        onboarding,
        user.email || user.uid,
      );
      if (generated) {
        setPlan(generated);
        return generated;
      }
      setGenError('failed');
    } catch {
      setGenError('failed');
    } finally {
      setGenerating(false);
    }
    return null;
  }, [user.uid, user.email]);

  const autoAdaptAttempted = useRef(false);
  const tryAutoAdapt = useCallback(async (currentPlan) => {
    if (autoAdaptAttempted.current) return;
    try {
      const ctx = await buildWeeklyContext(user.email || user.uid, currentPlan);
      if (!shouldAutoAdapt(currentPlan, ctx)) return;
      autoAdaptAttempted.current = true;
      let onboarding = currentPlan.userProfile || {};
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
        if (raw) onboarding = JSON.parse(raw);
      } catch {}
      const updated = await adaptPlan(currentPlan, onboarding, ctx, user.email || user.uid);
      if (updated) setPlan(updated);
    } catch {}
  }, [user.uid, user.email]);

  const loadData = useCallback(async () => {
    const [p, log, hd, hAvail, rev] = await Promise.all([
      Storage.get(KEYS.PLAN(user.email || user.uid)),
      Storage.get(KEYS.FOODLOG(user.uid, todayDate)),
      getHealthDay(user.email || user.uid),
      isStepCountingAvailable(),
      getLatestReview(user.email || user.uid),
    ]);
    setFoodLog(Array.isArray(log) ? log : []);
    setHealthToday(hd);
    setLatestReview(rev);
    if (hAvail) {
      syncTodaySteps(user.email || user.uid)
        .then((steps) => { if (steps != null) getHealthDay(user.email || user.uid).then(setHealthToday); });
    }
    if (p) {
      setPlan(p);
      setLoadingPlan(false);
      tryAutoAdapt(p);
      if (Array.isArray(p.mealPlan)) scheduleMealReminders(p.mealPlan).catch(() => {});
    } else {
      setLoadingPlan(false);
      tryAutoGenerate();
    }
  }, [user.uid, user.email, todayDate, tryAutoGenerate, tryAutoAdapt]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    loadData();
  }, [loadData]);

  const totals = foodLog.reduce((acc, item) => ({
    calories: acc.calories + (item.calories || 0),
    protein:  acc.protein  + (item.protein  || 0),
    carbs:    acc.carbs    + (item.carbs    || 0),
    fat:      acc.fat      + (item.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const target          = plan?.dailyCalories || 2000;
  const proteinTarget   = plan?.protein || 150;
  const carbsTarget     = plan?.carbs   || 200;
  const fatTarget       = plan?.fat     || 65;

  const consumed        = Math.round(totals.calories);
  const proteinConsumed = Math.round(totals.protein);
  const carbsConsumed   = Math.round(totals.carbs);
  const fatConsumed     = Math.round(totals.fat);

  const remaining       = Math.max(target - consumed, 0);
  const calPct          = target > 0 ? consumed / target : 0;
  const proteinLeft     = Math.max(proteinTarget - proteinConsumed, 0);
  const carbsLeft       = Math.max(carbsTarget   - carbsConsumed,   0);
  const fatLeft         = Math.max(fatTarget     - fatConsumed,     0);

  const todayFormatted = today.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const recent = [...foodLog].slice(-5).reverse();

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        <View style={s.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={s.brandName}>KrAItos</Text>
            <Text style={s.dateText}>{todayFormatted}</Text>
          </View>
          <View style={s.streakBadge}>
            <Text style={s.streakIcon}>🔥</Text>
            <Text style={s.streakNum}>{streak}</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} onPress={() => onNavigate('profile')}>
            <Text style={s.profileLetter}>{user.fullName?.[0]?.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <DateStrip selectedIdx={6} onSelect={() => {}} today={today} />

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {syncQueued > 0 && <OfflineBanner queued={syncQueued} />}

          {/* Today's Score + 7-day streak ring */}
          {plan && (
            <View style={{ marginHorizontal: -16 }}>
              <TodayScoreCard
                uid={user.uid}
                healthUid={user.email || user.uid}
                plan={plan}
                foodLog={foodLog}
                healthToday={healthToday}
                onPress={() => onNavigate('progress')}
              />
            </View>
          )}

          {/* Weekly review banner */}
          {plan && (latestReview || isReviewDue(latestReview)) && (
            <TouchableOpacity
              style={s.reviewBanner}
              onPress={() => onNavigate('weeklyreview')}
              activeOpacity={0.85}
            >
              <View style={s.reviewIconWrap}><Text style={s.reviewIcon}>🧠</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.reviewTitle}>
                  {latestReview && !latestReview.seen ? 'New weekly coach review' : (latestReview ? 'Weekly coach review' : 'Your week is ready to review')}
                </Text>
                <Text style={s.reviewSub} numberOfLines={1}>
                  {latestReview?.title || 'Get a personalized recap and adjustments for next week'}
                </Text>
              </View>
              <Text style={s.reviewArrow}>→</Text>
            </TouchableOpacity>
          )}

          {loadingPlan ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={C.green} size="large" />
              <Text style={s.loadingLabel}>Loading your plan...</Text>
            </View>
          ) : !plan ? (
            <View style={s.emptyState}>
              <Image source={require('../assets/logo.png')} style={s.emptyLogo} resizeMode="contain" />
              {generating ? (
                <>
                  <ActivityIndicator color={C.green} size="large" style={{ marginBottom: 18 }} />
                  <Text style={s.emptyTitle}>Building your plan</Text>
                  <Text style={s.emptyDesc}>
                    We're crafting your personalized nutrition and workout plan from your sign-up details. This takes about 20 seconds.
                  </Text>
                </>
              ) : genError === 'missing' ? (
                <>
                  <Text style={s.emptyTitle}>Tell us about you</Text>
                  <Text style={s.emptyDesc}>
                    We need a few details to build your personalized plan. It only takes a minute.
                  </Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={() => onNavigate('onboarding')}>
                    <Text style={s.emptyBtnText}>Get Started</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={s.emptyTitle}>Plan generation failed</Text>
                  <Text style={s.emptyDesc}>
                    We couldn't reach the AI right now. Check your connection and try again.
                  </Text>
                  <TouchableOpacity style={s.emptyBtn} onPress={tryAutoGenerate}>
                    <Text style={s.emptyBtnText}>Try Again</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <>
              {/* Hero calories card */}
              <View style={s.heroCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.heroNum}>{remaining}</Text>
                  <Text style={s.heroLabel}>Calories left</Text>
                  <View style={s.heroSubRow}>
                    <Text style={s.heroSubText}>
                      <Text style={{ color: C.white, fontWeight: '700' }}>{consumed}</Text>
                      <Text style={{ color: C.muted }}> eaten · </Text>
                      <Text style={{ color: C.white, fontWeight: '700' }}>{target}</Text>
                      <Text style={{ color: C.muted }}> goal</Text>
                    </Text>
                  </View>
                </View>
                <Ring size={100} stroke={10} pct={calPct} color={C.green}>
                  <Text style={s.ringIcon}>🔥</Text>
                </Ring>
              </View>

              {/* Macro cards row */}
              <View style={s.macroRow}>
                <View style={s.macroCard}>
                  <Text style={s.macroNum}>{proteinLeft}g</Text>
                  <Text style={s.macroLabel}>Protein left</Text>
                  <Ring size={48} stroke={5} pct={proteinTarget > 0 ? proteinConsumed / proteinTarget : 0} color={C.green}>
                    <Text style={s.macroIcon}>🥩</Text>
                  </Ring>
                </View>
                <View style={s.macroCard}>
                  <Text style={s.macroNum}>{carbsLeft}g</Text>
                  <Text style={s.macroLabel}>Carbs left</Text>
                  <Ring size={48} stroke={5} pct={carbsTarget > 0 ? carbsConsumed / carbsTarget : 0} color={C.green}>
                    <Text style={s.macroIcon}>🍞</Text>
                  </Ring>
                </View>
                <View style={s.macroCard}>
                  <Text style={s.macroNum}>{fatLeft}g</Text>
                  <Text style={s.macroLabel}>Fats left</Text>
                  <Ring size={48} stroke={5} pct={fatTarget > 0 ? fatConsumed / fatTarget : 0} color={C.green}>
                    <Text style={s.macroIcon}>🥑</Text>
                  </Ring>
                </View>
              </View>

              {/* Health quick-link */}
              <TouchableOpacity
                style={s.healthCard}
                onPress={() => onNavigate('health')}
                activeOpacity={0.85}
              >
                <View style={s.healthIconWrap}>
                  <Text style={{ fontSize: 22 }}>👟</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.healthTitle}>
                    {healthToday?.steps != null ? healthToday.steps.toLocaleString() : '—'} steps
                  </Text>
                  <Text style={s.healthSub}>
                    {healthToday?.restingHr ? `${healthToday.restingHr} bpm resting · ` : ''}
                    {healthToday?.sleepHr ? `${healthToday.sleepHr}h sleep · ` : ''}
                    Tap to sync watch & health
                  </Text>
                </View>
                <Text style={s.progressArrow}>→</Text>
              </TouchableOpacity>

              {/* Progress quick-link */}
              <TouchableOpacity
                style={s.progressCard}
                onPress={() => onNavigate('progress')}
                activeOpacity={0.85}
              >
                <View style={s.progressIconWrap}>
                  <Svg width={28} height={28} viewBox="0 0 28 28">
                    <SvgPath
                      d="M3 22 L9 15 L14 19 L19 11 L25 16"
                      stroke={C.bg}
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <SvgCircle cx="9" cy="15" r="1.8" fill={C.bg} />
                    <SvgCircle cx="14" cy="19" r="1.8" fill={C.bg} />
                    <SvgCircle cx="19" cy="11" r="1.8" fill={C.bg} />
                    <SvgCircle cx="25" cy="16" r="1.8" fill={C.bg} />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.progressTitle}>View Progress</Text>
                  <Text style={s.progressSub}>
                    Weight trend, calories, macros & adherence
                  </Text>
                </View>
                <Text style={s.progressArrow}>→</Text>
              </TouchableOpacity>

              {/* Recently logged */}
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Recently logged</Text>
                <TouchableOpacity onPress={() => onNavigate('foodlog')}>
                  <Text style={s.sectionLink}>See all</Text>
                </TouchableOpacity>
              </View>

              {recent.length === 0 ? (
                <View style={s.emptyLog}>
                  <Text style={s.emptyLogIcon}>🍽️</Text>
                  <Text style={s.emptyLogTitle}>Nothing logged yet</Text>
                  <Text style={s.emptyLogText}>Snap a photo or add food to get started.</Text>
                </View>
              ) : (
                recent.map((item, i) => (
                  <View key={item.id || i} style={s.foodCard}>
                    <View style={s.foodIconWrap}>
                      <Text style={s.foodIcon}>{item.source === 'scanner' ? '📸' : '🍴'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.foodName} numberOfLines={1}>{item.name}</Text>
                      <Text style={s.foodMacros}>
                        P {Math.round(item.protein || 0)}g · C {Math.round(item.carbs || 0)}g · F {Math.round(item.fat || 0)}g
                      </Text>
                    </View>
                    <View style={s.foodRight}>
                      <Text style={s.foodCal}>{Math.round(item.calories || 0)}</Text>
                      <Text style={s.foodCalLabel}>kcal</Text>
                    </View>
                  </View>
                ))
              )}

              <View style={s.addRow}>
                <TouchableOpacity style={[s.addBtn, { flex: 1 }]} onPress={() => onNavigate('scanner')} activeOpacity={0.85}>
                  <Text style={s.addBtnIcon}>+</Text>
                  <Text style={s.addBtnText}>Add food</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn} onPress={() => setQuickLogOpen(true)} activeOpacity={0.85}>
                  <Text style={s.quickBtnIcon}>⚡</Text>
                  <Text style={s.quickBtnText}>Quick Log</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>

        <QuickLogSheet
          visible={quickLogOpen}
          onClose={() => setQuickLogOpen(false)}
          uid={user.uid}
          onLogged={loadData}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 130, paddingHorizontal: 16, paddingTop: 12 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
  },
  brandName: { color: C.white, fontSize: 22, fontWeight: '900', letterSpacing: 0.3 },
  dateText:  { color: C.muted, fontSize: 12, fontWeight: '500', marginTop: 1 },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border, marginRight: 10,
  },
  streakIcon: { fontSize: 14, marginRight: 4 },
  streakNum:  { color: C.white, fontSize: 14, fontWeight: '800' },
  profileBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  profileLetter: { color: C.bg, fontSize: 15, fontWeight: '900' },

  dateStrip: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    justifyContent: 'space-between',
  },
  dateCell: { alignItems: 'center', flex: 1 },
  dateDay: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  dateDayActive: { color: C.green },
  dateNumWrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  dateNumWrapActive: { backgroundColor: C.green },
  dateNum: { color: C.mutedLight, fontSize: 14, fontWeight: '700' },
  dateNumActive: { color: C.bg, fontWeight: '900' },

  loadingWrap: { alignItems: 'center', paddingVertical: 80 },
  loadingLabel: { color: C.muted, fontSize: 14, marginTop: 16 },

  heroCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 24,
    padding: 20, marginTop: 8, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  heroNum:   { color: C.white, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  heroLabel: { color: C.muted, fontSize: 14, fontWeight: '600', marginTop: 2 },
  heroSubRow: { marginTop: 10 },
  heroSubText: { fontSize: 12 },
  ringIcon: { fontSize: 28 },

  macroRow: { flexDirection: 'row', marginBottom: 16 },
  macroCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 20,
    padding: 14, marginHorizontal: 4,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'flex-start',
  },
  macroNum:   { color: C.white, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  macroLabel: { color: C.muted, fontSize: 11, fontWeight: '600', marginTop: 2, marginBottom: 12 },
  macroIcon:  { fontSize: 18 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6, marginBottom: 10, paddingHorizontal: 4,
  },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800' },
  sectionLink:  { color: C.green, fontSize: 13, fontWeight: '700' },
  progressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green, borderRadius: 16, padding: 14, marginBottom: 16 },
  progressIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.bg + '22', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  progressTitle: { color: C.bg, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  progressSub:   { color: C.bg, fontSize: 11, opacity: 0.7, marginTop: 2 },
  progressArrow: { color: C.bg, fontSize: 22, fontWeight: '900', marginLeft: 8 },
  healthCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: C.green + '40',
  },
  healthIconWrap: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: C.green + '22',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  healthTitle: { color: C.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  healthSub:   { color: C.muted, fontSize: 11, marginTop: 2 },

  emptyLog: {
    backgroundColor: C.card, borderRadius: 20, padding: 28,
    alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 12,
  },
  emptyLogIcon: { fontSize: 36, marginBottom: 8 },
  emptyLogTitle: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  emptyLogText: { color: C.muted, fontSize: 13, textAlign: 'center' },

  foodCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 18,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  foodIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: C.greenGlow,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  foodIcon: { fontSize: 20 },
  foodName: { color: C.white, fontSize: 14, fontWeight: '700' },
  foodMacros: { color: C.muted, fontSize: 11, marginTop: 3 },
  foodRight: { alignItems: 'flex-end', marginLeft: 8 },
  foodCal: { color: C.white, fontSize: 17, fontWeight: '900' },
  foodCalLabel: { color: C.muted, fontSize: 10 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.green, paddingVertical: 16, borderRadius: 18,
    marginTop: 14,
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 24px rgba(127,255,0,0.25)' } : {}),
  },
  addBtnIcon: { color: C.bg, fontSize: 22, fontWeight: '900', marginRight: 6, marginTop: -2 },
  addBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },

  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 50 },
  emptyLogo: { width: 72, height: 72, marginBottom: 20 },
  emptyTitle: { color: C.white, fontSize: 24, fontWeight: '900', marginBottom: 10 },
  emptyDesc: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 300 },
  emptyBtn: { backgroundColor: C.green, paddingVertical: 16, paddingHorizontal: 44, borderRadius: 16 },
  emptyBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },

  reviewBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16, padding: 12,
    marginTop: 12, marginBottom: 4,
    borderWidth: 1, borderColor: C.green + '50',
  },
  reviewIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.green + '22', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  reviewIcon: { fontSize: 20 },
  reviewTitle: { color: C.white, fontSize: 13, fontWeight: '900' },
  reviewSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  reviewArrow: { color: C.green, fontSize: 22, fontWeight: '900', marginLeft: 6 },

  addRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 18, borderRadius: 18,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.green,
  },
  quickBtnIcon: { fontSize: 16, marginRight: 6 },
  quickBtnText: { color: C.green, fontSize: 14, fontWeight: '900' },
});
