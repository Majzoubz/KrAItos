import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';
import { generatePlanFromOnboarding } from '../utils/planGenerator';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';

export default function MyPlanScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [plan, setPlan]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    const p = await Storage.get(KEYS.PLAN(user.email || user.uid));
    setPlan(p);
    setLoading(false);
  }, [user.email, user.uid]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

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

  const generatedDate = plan.generatedAt
    ? new Date(plan.generatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'recently';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Training</Text>
        <Text style={s.titleBarSub}>Last updated {generatedDate}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
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
          return (
            <View key={i} style={[s.workoutCard, isRest && s.restCard]}>
              <View style={s.workoutHeader}>
                <Text style={s.workoutDay}>{w.day}</Text>
                <View style={[s.typeBadge, isRest && s.restBadge]}>
                  <Text style={[s.typeText, isRest && s.restText]}>{w.type}</Text>
                </View>
              </View>

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
});
