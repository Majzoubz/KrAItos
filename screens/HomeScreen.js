import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Dimensions, Alert, Animated, Platform,
} from 'react-native';
import { C } from '../constants/theme';
import { Storage, KEYS } from '../utils/storage';
import { Auth } from '../utils/auth';

const { width } = Dimensions.get('window');

const WATER_GOAL = 8;

export default function HomeScreen({ user, onNavigate, onUserUpdate }) {
  const [water, setWater]       = useState(0);
  const [plan, setPlan]         = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [todayDate]             = useState(new Date().toDateString());
  const [expandedDay, setExpandedDay] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Storage.get(KEYS.WATER(user.uid, todayDate)).then(data => {
      if (data) setWater(data);
    });
    Storage.get(KEYS.PLAN(user.email || user.uid)).then(p => {
      setPlan(p);
      setLoadingPlan(false);
    });
  }, []);

  const addWater = async () => {
    if (water >= WATER_GOAL) {
      Alert.alert('Goal reached!', 'You hit your daily water goal!'); return;
    }
    const newVal = water + 1;
    setWater(newVal);
    await Storage.set(KEYS.WATER(user.uid, todayDate), newVal);
    if (newVal === WATER_GOAL) {
      const updated = await Auth.logActivity(user.uid);
      if (updated && onUserUpdate) onUserUpdate(updated);
    }
  };

  const streak = user.streak || 0;
  const meals  = user.mealsScanned || 0;

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayWorkout = plan?.workoutPlan?.find(w => w.day === todayName);

  const renderMacroBar = (label, grams, pct, total) => {
    const ratio = total > 0 ? grams / (total * 0.01 * pct > 0 ? grams : 1) : 0;
    return (
      <View style={s.macroBarItem} key={label}>
        <View style={s.macroBarHeader}>
          <Text style={s.macroBarLabel}>{label}</Text>
          <Text style={s.macroBarGrams}>{grams || 0}g</Text>
        </View>
        <View style={s.macroTrack}>
          <View style={[s.macroFill, { width: `${Math.min(pct || 0, 100)}%` }]} />
        </View>
        <Text style={s.macroPct}>{pct || 0}%</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.greeting}>Welcome back,</Text>
              <Text style={s.name}>{user.fullName}</Text>
            </View>
            <TouchableOpacity style={s.avatar} onPress={() => onNavigate('profile')}>
              <Text style={s.avatarText}>{user.fullName[0].toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.statsRow}>
            <View style={s.statPill}>
              <Text style={s.statNum}>{streak}</Text>
              <Text style={s.statLbl}>streak</Text>
            </View>
            <View style={s.statPill}>
              <Text style={s.statNum}>{meals}</Text>
              <Text style={s.statLbl}>meals</Text>
            </View>
            <View style={s.statPill}>
              <Text style={s.statNum}>{water}/{WATER_GOAL}</Text>
              <Text style={s.statLbl}>water</Text>
            </View>
          </View>

          {plan ? (
            <>
              <View style={s.calorieCard}>
                <View style={s.calorieGlow} />
                <Text style={s.calorieLabel}>DAILY TARGET</Text>
                <Text style={s.calorieNum}>{plan.dailyCalories || '--'}</Text>
                <Text style={s.calorieUnit}>CALORIES</Text>

                <View style={s.macroRow}>
                  {renderMacroBar('Protein', plan.protein, plan.proteinPct, plan.dailyCalories)}
                  {renderMacroBar('Carbs', plan.carbs, plan.carbsPct, plan.dailyCalories)}
                  {renderMacroBar('Fat', plan.fat, plan.fatPct, plan.dailyCalories)}
                </View>
              </View>

              {plan.summary && (
                <View style={s.summaryCard}>
                  <Text style={s.summaryLabel}>YOUR ASSESSMENT</Text>
                  <Text style={s.summaryText}>{plan.summary}</Text>
                  {plan.bmi && (
                    <View style={s.bmiPill}>
                      <Text style={s.bmiVal}>BMI {plan.bmi}</Text>
                      <Text style={s.bmiCat}> · {plan.bmiCategory}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Today's Meals</Text>
                <TouchableOpacity onPress={() => onNavigate('plan')}>
                  <Text style={s.seeAll}>See Full Plan</Text>
                </TouchableOpacity>
              </View>

              {(plan.mealPlan || []).map((meal, i) => (
                <View key={i} style={s.mealCard}>
                  <View style={s.mealTop}>
                    <View style={s.mealTimeBadge}>
                      <Text style={s.mealTimeText}>{meal.time || ''}</Text>
                    </View>
                    <Text style={s.mealName}>{meal.meal}</Text>
                    <Text style={s.mealCal}>{meal.calories} kcal</Text>
                  </View>
                  {(meal.foods || []).map((f, j) => (
                    <View key={j} style={s.foodRow}>
                      <View style={s.foodDot} />
                      <Text style={s.foodText}>{f}</Text>
                    </View>
                  ))}
                  {(meal.protein || meal.carbs || meal.fat) && (
                    <View style={s.mealMacros}>
                      <Text style={s.mealMacroItem}>P: {meal.protein || 0}g</Text>
                      <Text style={s.mealMacroItem}>C: {meal.carbs || 0}g</Text>
                      <Text style={s.mealMacroItem}>F: {meal.fat || 0}g</Text>
                    </View>
                  )}
                </View>
              ))}

              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Weekly Workout</Text>
                <TouchableOpacity onPress={() => onNavigate('plan')}>
                  <Text style={s.seeAll}>Full Schedule</Text>
                </TouchableOpacity>
              </View>

              {(plan.workoutPlan || []).map((w, i) => {
                const isToday = w.day === todayName;
                const isExpanded = expandedDay === i;
                const hasExercises = w.exercises && w.exercises.length > 0;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.workoutDay, isToday && s.workoutDayToday]}
                    onPress={() => hasExercises && setExpandedDay(isExpanded ? null : i)}
                    activeOpacity={hasExercises ? 0.7 : 1}
                  >
                    <View style={s.workoutDayHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={s.workoutDayRow}>
                          <Text style={[s.workoutDayName, isToday && s.workoutDayNameToday]}>{w.day}</Text>
                          {isToday && <View style={s.todayDot} />}
                        </View>
                        <Text style={s.workoutType}>{w.type}</Text>
                      </View>
                      <View style={s.durationBadge}>
                        <Text style={s.durationText}>{w.duration || ''}</Text>
                      </View>
                    </View>
                    {isExpanded && hasExercises && (
                      <View style={s.exerciseList}>
                        {w.exercises.map((ex, j) => {
                          const exObj = typeof ex === 'string' ? { name: ex } : ex;
                          return (
                            <View key={j} style={s.exerciseRow}>
                              <View style={s.exerciseDot} />
                              <Text style={s.exerciseName}>{exObj.name}</Text>
                              {exObj.sets && exObj.reps && (
                                <Text style={s.exerciseDetail}>{exObj.sets}×{exObj.reps}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <View style={s.waterCard}>
                <View style={s.waterTop}>
                  <Text style={s.waterTitle}>Water Intake</Text>
                  <Text style={s.waterCount}>{water} / {WATER_GOAL}</Text>
                </View>
                <View style={s.waterGlasses}>
                  {Array.from({ length: WATER_GOAL }).map((_, i) => (
                    <View key={i} style={[s.glass, i < water && s.glassFilled]} />
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.waterBtn, water >= WATER_GOAL && { opacity: 0.4 }]}
                  onPress={addWater}
                >
                  <Text style={s.waterBtnText}>+ Add Glass</Text>
                </TouchableOpacity>
              </View>

              <View style={s.quickActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => onNavigate('scanner')}>
                  <Text style={s.actionIcon}>📸</Text>
                  <Text style={s.actionLabel}>Scan Meal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => onNavigate('coach')}>
                  <Text style={s.actionIcon}>🤖</Text>
                  <Text style={s.actionLabel}>AI Coach</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => onNavigate('tracker')}>
                  <Text style={s.actionIcon}>📊</Text>
                  <Text style={s.actionLabel}>Tracker</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : loadingPlan ? (
            <View style={s.loadingPlan}>
              <Text style={s.loadingText}>Loading your plan...</Text>
            </View>
          ) : (
            <View style={s.noPlan}>
              <View style={s.noPlanIcon}>
                <Text style={s.noPlanIconText}>⚡</Text>
              </View>
              <Text style={s.noPlanTitle}>Your Plan is Being Prepared</Text>
              <Text style={s.noPlanDesc}>
                Head to the AI Coach to generate your personalized fitness and nutrition plan.
              </Text>
              <TouchableOpacity style={s.noPlanBtn} onPress={() => onNavigate('coach')}>
                <Text style={s.noPlanBtnText}>Generate My Plan</Text>
              </TouchableOpacity>

              <View style={s.waterCard}>
                <View style={s.waterTop}>
                  <Text style={s.waterTitle}>Water Intake</Text>
                  <Text style={s.waterCount}>{water} / {WATER_GOAL}</Text>
                </View>
                <View style={s.waterGlasses}>
                  {Array.from({ length: WATER_GOAL }).map((_, i) => (
                    <View key={i} style={[s.glass, i < water && s.glassFilled]} />
                  ))}
                </View>
                <TouchableOpacity style={[s.waterBtn, water >= WATER_GOAL && { opacity: 0.4 }]} onPress={addWater}>
                  <Text style={s.waterBtnText}>+ Add Glass</Text>
                </TouchableOpacity>
              </View>

              <View style={s.quickActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => onNavigate('scanner')}>
                  <Text style={s.actionIcon}>📸</Text>
                  <Text style={s.actionLabel}>Scan Meal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => onNavigate('coach')}>
                  <Text style={s.actionIcon}>🤖</Text>
                  <Text style={s.actionLabel}>AI Coach</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn} onPress={() => onNavigate('tracker')}>
                  <Text style={s.actionIcon}>📊</Text>
                  <Text style={s.actionLabel}>Tracker</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 16 },
  greeting: { color: C.muted, fontSize: 14 },
  name: { color: C.white, fontSize: 24, fontWeight: '900', marginTop: 2, letterSpacing: 0.5 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.bg, fontSize: 20, fontWeight: '900' },

  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20 },
  statPill: { flex: 1, backgroundColor: C.surface, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: C.border },
  statNum: { color: C.green, fontSize: 20, fontWeight: '900' },
  statLbl: { color: C.muted, fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },

  calorieCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: C.card,
    borderRadius: 20, padding: 24, alignItems: 'center',
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  calorieGlow: {
    position: 'absolute', top: -60, width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.greenGlow2,
    ...(Platform.OS === 'web' ? { filter: 'blur(60px)' } : { opacity: 0.15 }),
  },
  calorieLabel: { color: C.muted, fontSize: 11, letterSpacing: 3, fontWeight: '700', marginBottom: 8 },
  calorieNum: { color: C.green, fontSize: 56, fontWeight: '900', letterSpacing: 2 },
  calorieUnit: { color: C.muted, fontSize: 12, letterSpacing: 3, fontWeight: '600', marginBottom: 24 },

  macroRow: { flexDirection: 'row', width: '100%' },
  macroBarItem: { flex: 1, marginHorizontal: 4 },
  macroBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  macroBarLabel: { color: C.mutedLight, fontSize: 11, fontWeight: '600' },
  macroBarGrams: { color: C.white, fontSize: 12, fontWeight: '800' },
  macroTrack: { height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden' },
  macroFill: { height: 6, backgroundColor: C.green, borderRadius: 3 },
  macroPct: { color: C.green, fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'right' },

  summaryCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  summaryLabel: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  summaryText: { color: C.light, fontSize: 14, lineHeight: 22 },
  bmiPill: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: C.greenGlow2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start' },
  bmiVal: { color: C.green, fontSize: 13, fontWeight: '800' },
  bmiCat: { color: C.mutedLight, fontSize: 13 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  seeAll: { color: C.green, fontSize: 13, fontWeight: '700' },

  mealCard: { marginHorizontal: 20, marginBottom: 10, backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  mealTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  mealTimeBadge: { backgroundColor: C.greenGlow2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 10 },
  mealTimeText: { color: C.green, fontSize: 10, fontWeight: '700' },
  mealName: { color: C.white, fontWeight: '800', fontSize: 15, flex: 1 },
  mealCal: { color: C.green, fontWeight: '700', fontSize: 13 },
  foodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  foodDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.green, marginRight: 10 },
  foodText: { color: C.mutedLight, fontSize: 13, flex: 1 },
  mealMacros: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  mealMacroItem: { color: C.muted, fontSize: 11, fontWeight: '600', marginRight: 16 },

  workoutDay: { marginHorizontal: 20, marginBottom: 8, backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border },
  workoutDayToday: { borderColor: C.green + '40' },
  workoutDayHeader: { flexDirection: 'row', alignItems: 'center' },
  workoutDayRow: { flexDirection: 'row', alignItems: 'center' },
  workoutDayName: { color: C.white, fontSize: 15, fontWeight: '800' },
  workoutDayNameToday: { color: C.green },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginLeft: 8 },
  workoutType: { color: C.muted, fontSize: 12, marginTop: 2 },
  durationBadge: { backgroundColor: C.greenGlow2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  durationText: { color: C.green, fontSize: 11, fontWeight: '700' },
  exerciseList: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  exerciseDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginRight: 10 },
  exerciseName: { color: C.light, fontSize: 13, flex: 1 },
  exerciseDetail: { color: C.green, fontSize: 12, fontWeight: '700' },

  waterCard: { marginHorizontal: 20, marginBottom: 16, marginTop: 8, backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  waterTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  waterTitle: { color: C.white, fontWeight: '800', fontSize: 14 },
  waterCount: { color: C.green, fontWeight: '700', fontSize: 13 },
  waterGlasses: { flexDirection: 'row', marginBottom: 12 },
  glass: { flex: 1, height: 22, borderRadius: 6, backgroundColor: C.surface, marginRight: 3, borderWidth: 1, borderColor: C.border },
  glassFilled: { backgroundColor: C.green, borderColor: C.green },
  waterBtn: { backgroundColor: C.greenGlow2, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  waterBtnText: { color: C.green, fontWeight: '800', fontSize: 13 },

  quickActions: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20 },
  actionBtn: { flex: 1, backgroundColor: C.card, borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: C.border },
  actionIcon: { fontSize: 22, marginBottom: 6 },
  actionLabel: { color: C.mutedLight, fontSize: 12, fontWeight: '700' },

  loadingPlan: { padding: 40, alignItems: 'center' },
  loadingText: { color: C.muted, fontSize: 15 },

  noPlan: { alignItems: 'center', paddingHorizontal: 20 },
  noPlanIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.greenGlow2, alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 20 },
  noPlanIconText: { fontSize: 32 },
  noPlanTitle: { color: C.white, fontSize: 20, fontWeight: '900', marginBottom: 10 },
  noPlanDesc: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 300 },
  noPlanBtn: { backgroundColor: C.green, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, marginBottom: 24 },
  noPlanBtnText: { color: C.bg, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});
