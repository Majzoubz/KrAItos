import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { C } from '../constants/theme';
import { callClaude, parseJSON } from '../utils/api';
import {
  ScreenHeader, Field, SectionTitle,
  MacroGrid, CalorieHero, TipsBox,
  SecondaryButton, ChipSelector,
} from '../components/UI';

const GOALS = ['Lose Fat', 'Build Muscle', 'Improve Endurance', 'Stay Healthy'];
const ACTIVITY_LEVELS = ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'];

const SYSTEM_PROMPT = `You are an elite fitness coach and registered dietitian. Given user data, return ONLY a JSON object with this shape (no markdown):
{
  "summary": "2-sentence body assessment",
  "bmi": number,
  "bmiCategory": "string",
  "dailyCalories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "mealPlan": [
    { "meal": "Breakfast", "foods": ["food1", "food2"], "calories": number },
    { "meal": "Lunch",     "foods": ["food1", "food2"], "calories": number },
    { "meal": "Dinner",    "foods": ["food1", "food2"], "calories": number },
    { "meal": "Snack",     "foods": ["food1"],           "calories": number }
  ],
  "workoutPlan": [
    { "day": "Monday",    "type": "Strength", "exercises": ["Ex1 – 3×10"] },
    { "day": "Wednesday", "type": "Cardio",   "exercises": ["Ex1 – 20 min"] },
    { "day": "Friday",    "type": "Full Body", "exercises": ["Ex1 – 4×8"] }
  ],
  "arExercises": ["Push-up", "Squat", "Plank"],
  "weeklyTips": ["tip1", "tip2", "tip3"]
}`;

const FALLBACK_PLAN = {
  summary: 'Based on your profile, you have a good foundation to work with.',
  bmi: 24.1, bmiCategory: 'Normal weight', dailyCalories: 2200,
  protein: 165, carbs: 220, fat: 73,
  mealPlan: [
    { meal: 'Breakfast', foods: ['Oats with berries', 'Whey protein shake'], calories: 450 },
    { meal: 'Lunch',     foods: ['Grilled chicken breast', 'Brown rice', 'Salad'], calories: 620 },
    { meal: 'Dinner',    foods: ['Salmon fillet', 'Sweet potato', 'Broccoli'], calories: 580 },
    { meal: 'Snack',     foods: ['Greek yogurt with almonds'], calories: 200 },
  ],
  workoutPlan: [
    { day: 'Monday',    type: 'Strength', exercises: ['Bench Press – 4×8', 'Pull-Ups – 3×10', 'Shoulder Press – 3×12'] },
    { day: 'Wednesday', type: 'Cardio',   exercises: ['Treadmill Run – 25 min', 'Jump Rope – 10 min'] },
    { day: 'Friday',    type: 'Full Body', exercises: ['Deadlift – 4×6', 'Squat – 3×10', 'Plank – 3×60s'] },
  ],
  arExercises: ['Push-up', 'Squat', 'Deadlift', 'Plank', 'Lunge'],
  weeklyTips: ['Stay hydrated – drink 3L of water daily', 'Sleep 7-9 hours for recovery', 'Track your meals for best results'],
};

export default function AICoachScreen({ onBack }) {
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);

  const [age, setAge]         = useState('');
  const [gender, setGender]   = useState('Male');
  const [weight, setWeight]   = useState('');
  const [height, setHeight]   = useState('');
  const [goal, setGoal]       = useState('Lose Fat');
  const [activity, setActivity] = useState('Moderate');
  const [injuries, setInjuries] = useState('');

  const generatePlan = async () => {
    if (!age || !weight || !height) {
      Alert.alert('Missing info', 'Please fill in age, weight, and height.'); return;
    }
    setLoading(true);
    try {
      const raw = await callClaude(
        SYSTEM_PROMPT,
        `Age: ${age}, Gender: ${gender}, Weight: ${weight}kg, Height: ${height}cm, Goal: ${goal}, Activity: ${activity}, Injuries: ${injuries || 'None'}`
      );
      setPlan(parseJSON(raw, FALLBACK_PLAN));
      setStep('result');
    } catch {
      Alert.alert('Error', 'Could not generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <ScreenHeader title="AI Coach" icon="🤖" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>

        {step === 'form' && (
          <>
            <Text style={s.intro}>Tell me about your body and I'll build your perfect plan.</Text>

            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label="Age" placeholder="25" value={age} onChangeText={setAge} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={s.fieldLabel}>Gender</Text>
                <View style={s.toggleRow}>
                  {['Male', 'Female'].map(g => (
                    <TouchableOpacity
                      key={g}
                      style={[s.toggleBtn, gender === g && s.toggleActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[s.toggleText, gender === g && s.toggleTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label="Weight (kg)" placeholder="70" value={weight} onChangeText={setWeight} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Field label="Height (cm)" placeholder="175" value={height} onChangeText={setHeight} keyboardType="numeric" />
              </View>
            </View>

            <ChipSelector label="Goal" options={GOALS} selected={goal} onSelect={setGoal} />
            <ChipSelector label="Activity Level" options={ACTIVITY_LEVELS} selected={activity} onSelect={setActivity} />

            <Field
              label="Injuries / Limitations (optional)"
              placeholder="e.g. bad knees, lower back pain"
              value={injuries}
              onChangeText={setInjuries}
              multiline
            />

            <TouchableOpacity
              style={[s.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={generatePlan}
              disabled={loading}
            >
              {loading
                ? <><ActivityIndicator color={C.bg} /><Text style={[s.primaryBtnText, { marginLeft: 8 }]}>Building your plan…</Text></>
                : <Text style={s.primaryBtnText}>Generate My Plan ✨</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {step === 'result' && plan && (
          <>
            {/* Assessment */}
            <View style={s.assessCard}>
              <Text style={s.assessTitle}>Body Assessment</Text>
              <Text style={s.assessText}>{plan.summary}</Text>
              <View style={s.bmiRow}>
                <View style={s.bmiBox}>
                  <Text style={s.bmiNum}>{plan.bmi}</Text>
                  <Text style={s.bmiLabel}>BMI</Text>
                </View>
                <Text style={s.bmiCategory}>{plan.bmiCategory}</Text>
              </View>
            </View>

            <SectionTitle>Daily Nutrition Targets</SectionTitle>
            <CalorieHero calories={plan.dailyCalories} label="CALORIES / DAY" />
            <MacroGrid items={[
              ['Protein', plan.protein, 'g', C.blue],
              ['Carbs',   plan.carbs,   'g', C.orange],
              ['Fat',     plan.fat,     'g', C.purple],
            ]} />

            <SectionTitle>Meal Plan</SectionTitle>
            {plan.mealPlan?.map((m, i) => (
              <View key={i} style={s.mealCard}>
                <View style={s.mealHeader}>
                  <Text style={s.mealName}>{m.meal}</Text>
                  <Text style={s.mealCal}>{m.calories} kcal</Text>
                </View>
                {m.foods.map((f, j) => <Text key={j} style={s.mealFood}>• {f}</Text>)}
              </View>
            ))}

            <SectionTitle>Weekly Workout Plan</SectionTitle>
            {plan.workoutPlan?.map((w, i) => (
              <View key={i} style={s.workoutCard}>
                <View style={s.workoutHeader}>
                  <Text style={s.workoutDay}>{w.day}</Text>
                  <View style={s.workoutBadge}>
                    <Text style={s.workoutType}>{w.type}</Text>
                  </View>
                </View>
                {w.exercises.map((e, j) => <Text key={j} style={s.exerciseItem}>💪 {e}</Text>)}
              </View>
            ))}

            <SectionTitle>AR Glasses – Recommended Exercises</SectionTitle>
            <View style={s.arCard}>
              <Text style={s.arSub}>These exercises are optimized for your AR workout figure</Text>
              <View style={s.arExList}>
                {plan.arExercises?.map((e, i) => (
                  <View key={i} style={s.arChip}>
                    <Text style={s.arChipText}>🥽 {e}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TipsBox title="📌 Weekly Tips" tips={plan.weeklyTips} />

            <SecondaryButton label="Reassess Body" onPress={() => { setStep('form'); setPlan(null); }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  intro: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  row: { flexDirection: 'row' },
  fieldLabel: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  toggleRow: { flexDirection: 'row', marginBottom: 16, marginRight: 8 },
  toggleBtn: { flex: 1, paddingVertical: 12, backgroundColor: C.surface, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  toggleActive: { backgroundColor: C.green, borderColor: C.green },
  toggleText: { color: C.muted, fontWeight: '600' },
  toggleTextActive: { color: C.bg },
  primaryBtn: {
    backgroundColor: C.green, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center',
  },
  primaryBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  assessCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  assessTitle: { color: C.green, fontWeight: '800', fontSize: 15, marginBottom: 8 },
  assessText: { color: C.white, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  bmiRow: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  bmiBox: { backgroundColor: C.bg, borderRadius: 12, padding: 12, alignItems: 'center', minWidth: 70 },
  bmiNum: { color: C.green, fontSize: 28, fontWeight: '900' },
  bmiLabel: { color: C.muted, fontSize: 11 },
  bmiCategory: { color: C.white, fontSize: 16, fontWeight: '700' },
  mealCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  mealName: { color: C.white, fontWeight: '800', fontSize: 15 },
  mealCal: { color: C.green, fontWeight: '700', fontSize: 13 },
  mealFood: { color: C.muted, fontSize: 13, lineHeight: 22 },
  workoutCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  workoutHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  workoutDay: { color: C.white, fontWeight: '800', fontSize: 15 },
  workoutBadge: { backgroundColor: C.blue + '22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  workoutType: { color: C.blue, fontSize: 12, fontWeight: '700' },
  exerciseItem: { color: C.muted, fontSize: 13, lineHeight: 24 },
  arCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 16 },
  arSub: { color: C.muted, fontSize: 13, marginBottom: 12 },
  arExList: { flexDirection: 'row', flexWrap: 'wrap', marginRight: 8 },
  arChip: { backgroundColor: C.purple + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  arChipText: { color: C.purple, fontSize: 13, fontWeight: '600' },
});