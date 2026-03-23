import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { C } from '../constants/theme';
import { Storage, KEYS } from '../utils/storage';

export default function MyPlanScreen({ user, onNavigate }) {
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('nutrition');

  useEffect(() => {
    Storage.get(KEYS.PLAN(user.email)).then(p => {
      setPlan(p);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}>
          <Text style={s.titleBarText}>My Plan</Text>
        </View>
        <View style={s.center}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}>
          <Text style={s.titleBarText}>My Plan</Text>
        </View>
        <View style={s.center}>
          <Text style={s.emptyIcon}>?</Text>
          <Text style={s.emptyTitle}>No plan yet</Text>
          <Text style={s.emptyText}>
            Go to the Coach tab, fill in your details and generate your personalized plan. It will be saved here permanently.
          </Text>
          <TouchableOpacity style={s.goBtn} onPress={() => onNavigate('coach')}>
            <Text style={s.goBtnText}>Generate My Plan</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const generatedDate = new Date(plan.generatedAt).toLocaleDateString('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>My Plan</Text>
        <Text style={s.titleBarSub}>Generated on {generatedDate}</Text>
      </View>

      <View style={s.tabRow}>
        {[
          { key: 'nutrition', label: 'Nutrition' },
          { key: 'workout',   label: 'Workout'   },
          { key: 'tips',      label: 'Tips'       },
        ].map(t => (
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
            <View style={s.assessCard}>
              <Text style={s.assessTitle}>Your Assessment</Text>
              <Text style={s.assessText}>{plan.summary}</Text>
              <View style={s.bmiRow}>
                <View style={s.bmiBox}>
                  <Text style={s.bmiNum}>{plan.bmi}</Text>
                  <Text style={s.bmiSub}>BMI</Text>
                </View>
                <Text style={s.bmiCat}>{plan.bmiCategory}</Text>
              </View>
            </View>

            <View style={s.calorieBox}>
              <Text style={s.calorieNum}>{plan.dailyCalories}</Text>
              <Text style={s.calorieLabel}>CALORIES / DAY</Text>
            </View>

            <View style={s.macroRow}>
              {[
                ['Protein', plan.protein, 'g', C.blue],
                ['Carbs',   plan.carbs,   'g', C.orange],
                ['Fat',     plan.fat,     'g', C.purple],
              ].map(([l, v, u, c]) => (
                <View key={l} style={s.macroItem}>
                  <Text style={[s.macroVal, { color: c }]}>{v}<Text style={s.macroUnit}>{u}</Text></Text>
                  <Text style={s.macroLabel}>{l}</Text>
                </View>
              ))}
            </View>

            <Text style={s.sectionTitle}>Daily Meal Plan</Text>
            {plan.mealPlan?.map((m, i) => (
              <View key={i} style={s.mealCard}>
                <View style={s.mealHeader}>
                  <Text style={s.mealName}>{m.meal}</Text>
                  <Text style={s.mealCal}>{m.calories} kcal</Text>
                </View>
                {m.foods.map((f, j) => <Text key={j} style={s.mealFood}>- {f}</Text>)}
              </View>
            ))}
          </>
        )}

        {tab === 'workout' && (
          <>
            <View style={s.profileBadge}>
              <Text style={s.profileBadgeText}>
                Goal: {plan.userProfile?.goal}   |   {plan.userProfile?.weight}kg   |   {plan.userProfile?.height}cm
              </Text>
            </View>
            {plan.workoutPlan?.map((w, i) => (
              <View key={i} style={s.workoutCard}>
                <View style={s.workoutHeader}>
                  <Text style={s.workoutDay}>{w.day}</Text>
                  <View style={s.typeBadge}>
                    <Text style={s.typeText}>{w.type}</Text>
                  </View>
                </View>
                {w.exercises.map((e, j) => (
                  <View key={j} style={s.exerciseRow}>
                    <View style={s.exerciseDot} />
                    <Text style={s.exerciseText}>{e}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {tab === 'tips' && (
          <>
            {plan.weeklyTips?.map((t, i) => (
              <View key={i} style={s.tipCard}>
                <View style={s.tipNum}>
                  <Text style={s.tipNumText}>{i + 1}</Text>
                </View>
                <Text style={s.tipText}>{t}</Text>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity style={s.regenerateBtn} onPress={() => onNavigate('coach')}>
          <Text style={s.regenerateBtnText}>Update My Plan</Text>
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
  emptyIcon: { fontSize: 48, marginBottom: 16, color: C.muted },
  emptyTitle: { color: C.white, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  emptyText: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  goBtn: { backgroundColor: C.green, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14 },
  goBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, padding: 4, marginHorizontal: 16, marginVertical: 12, borderRadius: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: C.green },
  tabBtnText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  tabBtnTextActive: { color: C.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  assessCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  assessTitle: { color: C.green, fontWeight: '800', fontSize: 13, marginBottom: 8 },
  assessText: { color: C.white, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  bmiRow: { flexDirection: 'row', alignItems: 'center' },
  bmiBox: { backgroundColor: C.bg, borderRadius: 12, padding: 12, alignItems: 'center', marginRight: 16 },
  bmiNum: { color: C.green, fontSize: 26, fontWeight: '900' },
  bmiSub: { color: C.muted, fontSize: 11 },
  bmiCat: { color: C.white, fontSize: 16, fontWeight: '700' },
  calorieBox: { backgroundColor: C.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  calorieNum: { color: C.green, fontSize: 52, fontWeight: '900' },
  calorieLabel: { color: C.muted, fontSize: 12, letterSpacing: 2 },
  macroRow: { flexDirection: 'row', marginBottom: 16 },
  macroItem: { flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: 'center', marginRight: 6 },
  macroVal: { fontSize: 20, fontWeight: '800' },
  macroUnit: { fontSize: 12 },
  macroLabel: { color: C.muted, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: C.white, fontSize: 14, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  mealCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mealName: { color: C.white, fontWeight: '800', fontSize: 15 },
  mealCal: { color: C.green, fontWeight: '700', fontSize: 13 },
  mealFood: { color: C.muted, fontSize: 13, lineHeight: 22 },
  profileBadge: { backgroundColor: C.surface, borderRadius: 10, padding: 12, marginBottom: 16 },
  profileBadgeText: { color: C.muted, fontSize: 13, textAlign: 'center' },
  workoutCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  workoutDay: { color: C.white, fontWeight: '900', fontSize: 16 },
  typeBadge: { backgroundColor: C.blue + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeText: { color: C.blue, fontSize: 12, fontWeight: '700' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  exerciseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginRight: 10 },
  exerciseText: { color: C.muted, fontSize: 13, flex: 1 },
  tipCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start' },
  tipNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tipNumText: { color: C.bg, fontWeight: '900', fontSize: 13 },
  tipText: { color: C.white, fontSize: 14, lineHeight: 22, flex: 1 },
  regenerateBtn: { borderWidth: 1.5, borderColor: C.muted, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  regenerateBtnText: { color: C.muted, fontSize: 14, fontWeight: '700' },
});