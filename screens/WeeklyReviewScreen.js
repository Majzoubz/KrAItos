import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { Storage, KEYS } from '../utils/storage';
import { getLatestReview, generateWeeklyReview, markReviewSeen } from '../utils/weeklyReview';
import { adaptPlan } from '../utils/planGenerator';
import { buildWeeklyContext } from '../utils/planAdapter';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';

export default function WeeklyReviewScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const { isRTL } = useI18n();
  const s = makeStyles(C);
  // FOODLOG/ADHERENCE writers use raw user.uid, so reads must match.
  const uid = user.uid;
  const planUid = user.email || user.uid;

  const [review, setReview] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adapting, setAdapting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, p] = await Promise.all([
      getLatestReview(uid),
      Storage.get(KEYS.PLAN(planUid)),
    ]);
    setReview(r);
    setPlan(p);
    if (r && !r.seen) {
      markReviewSeen(uid, r.weekStart).catch(() => {});
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!plan) {
      Alert.alert('No plan yet', 'Generate a training/nutrition plan first.');
      return;
    }
    setGenerating(true);
    try {
      const r = await generateWeeklyReview(uid, plan);
      setReview(r);
    } catch (e) {
      Alert.alert('Could not generate', e.message);
    } finally {
      setGenerating(false);
    }
  };

  const applyAdjustments = async () => {
    if (!plan || !review) return;
    setAdapting(true);
    try {
      const ctx = await buildWeeklyContext(uid, plan);
      let onboarding = plan.userProfile || {};
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
        if (raw) onboarding = { ...onboarding, ...JSON.parse(raw) };
      } catch {}
      const updated = await adaptPlan(plan, onboarding, ctx, planUid);
      if (updated) {
        Alert.alert('Plan updated', 'Your training and nutrition plan has been refreshed based on this week\'s data.', [
          { text: 'View Plan', onPress: () => onNavigate('plan') },
        ]);
      } else {
        Alert.alert('No changes needed', 'Your current plan is already a good fit for this week\'s data.');
      }
    } catch (e) {
      Alert.alert('Could not adapt plan', e.message);
    } finally {
      setAdapting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <Header s={s} C={C} onNavigate={onNavigate} isRTL={isRTL} />
        <View style={s.center}><ActivityIndicator color={C.green} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Header s={s} C={C} onNavigate={onNavigate} isRTL={isRTL} />
      <ScrollView contentContainerStyle={s.scroll}>
        {!review ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>🧠</Text>
            <Text style={s.emptyTitle}>No review yet</Text>
            <Text style={s.emptySub}>Get your first AI coaching review based on the last 7 days of nutrition, workouts, sleep and steps.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={generate} disabled={generating}>
              {generating
                ? <ActivityIndicator color={C.bg} />
                : <Text style={s.primaryBtnText}>GENERATE REVIEW</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={s.weekLabel}>WEEK OF {new Date(review.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            <Text style={s.title}>{review.title}</Text>
            <Text style={s.summary}>{review.summary}</Text>

            {review.context && <ContextStrip ctx={review.context} C={C} s={s} />}

            <Section title="Wins this week" items={review.wins} bullet="✓" color={C.green} s={s} C={C} />
            <Section title="What slipped" items={review.misses} bullet="!" color={C.orange || '#F2A641'} s={s} C={C} />
            <Section title="Adjustments for next week" items={review.adjustments} bullet={isRTL ? '←' : '→'} color={C.green} s={s} C={C} />

            {review.nextFocus && (
              <View style={s.focusCard}>
                <Text style={s.focusLabel}>NEXT WEEK'S #1 FOCUS</Text>
                <Text style={s.focusText}>{review.nextFocus}</Text>
              </View>
            )}

            <TouchableOpacity style={s.applyBtn} onPress={applyAdjustments} disabled={adapting}>
              {adapting
                ? <ActivityIndicator color={C.bg} />
                : <Text style={s.applyBtnText}>APPLY TO MY PLAN</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.regenBtn} onPress={generate} disabled={generating}>
              <Text style={s.regenBtnText}>{generating ? 'Generating...' : 'Regenerate review'}</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ s, C, onNavigate, isRTL }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={() => onNavigate('home')} style={s.backBtn}>
        <Text style={s.backBtnText}>{isRTL ? '›' : '‹'}</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle}>Weekly Coach Review</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function Section({ title, items, bullet, color, s, C }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {items.map((it, i) => (
        <View key={i} style={s.bulletRow}>
          <View style={[s.bulletDot, { backgroundColor: color }]}><Text style={s.bulletText}>{bullet}</Text></View>
          <Text style={s.bulletItem}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function ContextStrip({ ctx, C, s }) {
  const items = [
    { label: 'Adherence', value: ctx.workout?.adherencePct != null ? `${ctx.workout.adherencePct}%` : '—' },
    { label: 'Avg cal',   value: ctx.nutrition?.avgCaloriesLast7d != null ? `${ctx.nutrition.avgCaloriesLast7d}` : '—' },
    { label: 'Avg steps', value: ctx.health?.avgStepsLast7d != null ? `${(ctx.health.avgStepsLast7d).toLocaleString()}` : '—' },
    { label: 'Avg sleep', value: ctx.health?.avgSleepHrLast7d != null ? `${ctx.health.avgSleepHrLast7d}h` : '—' },
  ];
  return (
    <View style={s.contextRow}>
      {items.map((it, i) => (
        <View key={i} style={s.contextCell}>
          <Text style={s.contextValue}>{it.value}</Text>
          <Text style={s.contextLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: C.white, fontSize: 22, fontWeight: '700', marginTop: -2 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '800' },

  scroll: { padding: 16 },
  weekLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  title: { color: C.white, fontSize: 24, fontWeight: '900', marginBottom: 12 },
  summary: { color: C.white, fontSize: 14, lineHeight: 22, marginBottom: 16 },

  contextRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: C.border },
  contextCell: { flex: 1, alignItems: 'center' },
  contextValue: { color: C.green, fontSize: 18, fontWeight: '900' },
  contextLabel: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 3 },

  section: { marginBottom: 18 },
  sectionTitle: { color: C.white, fontSize: 14, fontWeight: '800', marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bulletDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  bulletText: { color: C.bg, fontSize: 12, fontWeight: '900' },
  bulletItem: { color: C.white, fontSize: 13, lineHeight: 20, flex: 1 },

  focusCard: { backgroundColor: C.green + '15', borderColor: C.green, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  focusLabel: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  focusText: { color: C.white, fontSize: 14, fontWeight: '700', lineHeight: 20 },

  applyBtn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  applyBtnText: { color: C.bg, fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
  regenBtn: { paddingVertical: 14, alignItems: 'center' },
  regenBtnText: { color: C.muted, fontSize: 12, textDecorationLine: 'underline' },

  emptyCard: { backgroundColor: C.card, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginTop: 24 },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: '900', marginBottom: 8 },
  emptySub: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 18 },
  primaryBtn: { backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12, minWidth: 200, alignItems: 'center' },
  primaryBtnText: { color: C.bg, fontWeight: '900', letterSpacing: 1.5 },
});
