import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { C } from '../constants/theme';
import { Storage, KEYS } from '../utils/storage';

export default function MyPlanScreen({ user, onNavigate }) {
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('nutrition');

  const loadPlan = useCallback(async () => {
    setLoading(true);
    const p = await Storage.get(KEYS.PLAN(user.email));
    setPlan(p);
    setLoading(false);
  }, [user.email]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}><Text style={s.titleBarText}>My Plan</Text></View>
        <View style={s.center}><ActivityIndicator color={C.green} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}><Text style={s.titleBarText}>My Plan</Text></View>
        <View style={s.center}>
          <View style={s.emptyIcon}><Text style={s.emptyIconText}>⚡</Text></View>
          <Text style={s.emptyTitle}>No plan yet</Text>
          <Text style={s.emptyText}>
            Head to the AI Coach to generate your personalized nutrition and workout plan.
          </Text>
          <TouchableOpacity style={s.goBtn} onPress={() => onNavigate('coach')}>
            <Text style={s.goBtnText}>Go to AI Coach</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const generatedDate = new Date(plan.generatedAt).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const TABS = [
    { key: 'nutrition', label: 'Nutrition' },
    { key: 'workout',   label: 'Workout'   },
    { key: 'tips',      label: 'Tips'      },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>My Plan</Text>
        <Text style={s.titleBarSub}>Last updated {generatedDate}</Text>
      </View>

      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabBtnText, tab === t.key && s.tabBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {tab === 'nutrition' && (
          <>
            {plan.summary && (
              <View style={s.assessCard}>
                <Text style={s.assessLabel}>ASSESSMENT</Text>
                <Text style={s.assessText}>{plan.summary}</Text>
                <View style={s.bmiRow}>
                  <View style={s.bmiBox}>
                    <Text style={s.bmiNum}>{plan.bmi || '--'}</Text>
                    <Text style={s.bmiSub}>BMI</Text>
                  </View>
                  <Text style={s.bmiCat}>{plan.bmiCategory || ''}</Text>
                </View>
              </View>
            )}

            <View style={s.calorieBox}>
              <Text style={s.calorieNum}>{plan.dailyCalories || '--'}</Text>
              <Text style={s.calorieLabel}>CALORIES / DAY</Text>
            </View>

            <View style={s.macroRow}>
              {[
                ['Protein', plan.protein, plan.proteinPct],
                ['Carbs',   plan.carbs,   plan.carbsPct],
                ['Fat',     plan.fat,     plan.fatPct],
              ].map(([l, v, pct]) => (
                <View key={l} style={s.macroItem}>
                  <Text style={s.macroVal}>{v || '--'}<Text style={s.macroUnit}>g</Text></Text>
                  <Text style={s.macroPct}>{pct || '--'}%</Text>
                  <Text style={s.macroLabel}>{l}</Text>
                </View>
              ))}
            </View>

            <Text style={s.sectionTitle}>Daily Meal Plan</Text>
            {(plan.mealPlan || []).map((m, i) => (
              <View key={i} style={s.mealCard}>
                <View style={s.mealHeader}>
                  {m.time && (
                    <View style={s.mealTimeBadge}>
                      <Text style={s.mealTimeText}>{m.time}</Text>
                    </View>
                  )}
                  <Text style={s.mealName}>{m.meal}</Text>
                  <Text style={s.mealCal}>{m.calories} kcal</Text>
                </View>
                {(m.foods || []).map((f, j) => (
                  <View key={j} style={s.foodRow}>
                    <View style={s.foodDot} />
                    <Text style={s.foodText}>{f}</Text>
                  </View>
                ))}
                {(m.protein || m.carbs || m.fat) && (
                  <View style={s.mealMacros}>
                    <Text style={s.mealMacroText}>P: {m.protein || 0}g</Text>
                    <Text style={s.mealMacroText}>C: {m.carbs || 0}g</Text>
                    <Text style={s.mealMacroText}>F: {m.fat || 0}g</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {tab === 'workout' && (
          <>
            {plan.userProfile && (
              <View style={s.profileBadge}>
                <Text style={s.profileBadgeLabel}>YOUR PROFILE</Text>
                <Text style={s.profileBadgeText}>
                  {plan.userProfile?.goal} · {plan.userProfile?.weight}kg · {plan.userProfile?.height}cm · {plan.userProfile?.activity}
                </Text>
              </View>
            )}
            {(plan.workoutPlan || []).map((w, i) => (
              <View key={i} style={s.workoutCard}>
                <View style={s.workoutHeader}>
                  <Text style={s.workoutDay}>{w.day}</Text>
                  <View style={s.typeBadge}>
                    <Text style={s.typeText}>{w.type}</Text>
                  </View>
                </View>
                {w.duration && <Text style={s.durationLabel}>{w.duration}</Text>}
                {(w.exercises || []).map((e, j) => {
                  const exObj = typeof e === 'string' ? { name: e } : e;
                  return (
                    <View key={j} style={s.exerciseRow}>
                      <View style={s.exerciseDot} />
                      <Text style={s.exerciseText}>{exObj.name}</Text>
                      {exObj.sets && exObj.reps && (
                        <Text style={s.exerciseDetail}>{exObj.sets}×{exObj.reps}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}

        {tab === 'tips' && (
          <>
            {(plan.weeklyTips || []).length === 0 && (
              <Text style={s.emptyText}>No tips available in this plan.</Text>
            )}
            {(plan.weeklyTips || []).map((t, i) => (
              <View key={i} style={s.tipCard}>
                <View style={s.tipNum}>
                  <Text style={s.tipNumText}>{i + 1}</Text>
                </View>
                <Text style={s.tipText}>{t}</Text>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity style={s.updateBtn} onPress={() => onNavigate('coach')}>
          <Text style={s.updateBtnText}>Update My Plan</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
  tipCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: C.border },
  tipNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tipNumText: { color: C.bg, fontWeight: '900', fontSize: 13 },
  tipText: { color: C.light, fontSize: 14, lineHeight: 22, flex: 1 },
  updateBtn: { borderWidth: 1.5, borderColor: C.border, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  updateBtnText: { color: C.muted, fontSize: 14, fontWeight: '700' },
});
