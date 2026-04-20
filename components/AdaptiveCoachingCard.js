import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { adaptPlan } from '../utils/planGenerator';
import { buildWeeklyContext } from '../utils/planAdapter';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';

export default function AdaptiveCoachingCard({ user, plan, onPlanUpdate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const uid = user?.uid;
  const userKey = user?.email || user?.uid;
  const [ctx, setCtx] = useState(null);
  const [adapting, setAdapting] = useState(false);

  const loadCtx = useCallback(async () => {
    if (!plan || !uid) return;
    try { setCtx(await buildWeeklyContext(uid, plan)); } catch {}
  }, [plan, uid]);

  useEffect(() => { loadCtx(); }, [loadCtx]);

  if (!plan) return null;

  const adaptNow = async () => {
    try {
      setAdapting(true);
      const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
      const ob = raw ? JSON.parse(raw) : (plan.userProfile || {});
      const fresh = await buildWeeklyContext(uid, plan);
      const updated = await adaptPlan(plan, ob, fresh, userKey);
      if (updated) {
        onPlanUpdate && onPlanUpdate(updated);
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

  return (
    <View style={s.adaptCard}>
      <View style={s.adaptHeader}>
        <Text style={s.adaptTitle}>Adaptive Coaching</Text>
        {ctx?.workout?.adherencePct !== null && ctx?.workout?.adherencePct !== undefined && (
          <View style={s.adhPill}>
            <Text style={s.adhPillText}>{ctx.workout.adherencePct}% adherence</Text>
          </View>
        )}
      </View>
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statVal}>
            {ctx?.weight?.observedKgPerWeek !== undefined && ctx?.weight?.observedKgPerWeek !== null
              ? `${ctx.weight.observedKgPerWeek > 0 ? '+' : ''}${ctx.weight.observedKgPerWeek}kg`
              : '—'}
          </Text>
          <Text style={s.statLabel}>Weekly trend</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statVal}>{ctx?.nutrition?.avgCaloriesLast7d ?? '—'}</Text>
          <Text style={s.statLabel}>
            Avg kcal {ctx?.nutrition?.targetCalories ? `(target ${ctx.nutrition.targetCalories})` : ''}
          </Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statVal}>
            {ctx?.workout?.sessionsCompletedLast7d ?? 0}
            <Text style={s.statValDim}>/{ctx?.workout?.sessionsPlannedPerWeek ?? '—'}</Text>
          </Text>
          <Text style={s.statLabel}>Sessions done</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[s.adaptBtn, adapting && { opacity: 0.6 }]}
        onPress={adaptNow}
        disabled={adapting}
        activeOpacity={0.85}
      >
        {adapting
          ? <ActivityIndicator color={C.bg} />
          : <Text style={s.adaptBtnText}>⚡ Adapt Plan to This Week's Data</Text>}
      </TouchableOpacity>
      <Text style={s.adaptHint}>
        Uses your weight log, food log and session check-ins from the last 7 days.
      </Text>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  adaptCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  adaptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  adaptTitle: { color: C.white, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  adhPill: { backgroundColor: C.greenGlow2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  adhPillText: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 10, padding: 10, marginRight: 6, alignItems: 'center' },
  statVal: { color: C.green, fontSize: 18, fontWeight: '900' },
  statValDim: { color: C.muted, fontSize: 14, fontWeight: '700' },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 4, textAlign: 'center' },
  adaptBtn: { backgroundColor: C.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  adaptBtnText: { color: C.bg, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  adaptHint: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16 },
});
