import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { C } from '../constants/theme';
import { callAI, parseJSON } from '../utils/api';
import { Auth } from '../utils/auth';
import { Storage, KEYS } from '../utils/storage';

const GOALS    = ['Lose Fat', 'Build Muscle', 'Endurance', 'Stay Healthy'];
const ACTIVITY = ['Sedentary', 'Light', 'Moderate', 'Active', 'Very Active'];

export default function AICoachScreen({ user, onUserUpdate, onPlanSaved }) {
  const [loading, setLoading]   = useState(false);
  const [age, setAge]           = useState('');
  const [gender, setGender]     = useState('Male');
  const [weight, setWeight]     = useState('');
  const [height, setHeight]     = useState('');
  const [goal, setGoal]         = useState('Lose Fat');
  const [activity, setActivity] = useState('Moderate');
  const [injuries, setInjuries] = useState('');

  const generate = async () => {
    if (!age || !weight || !height) {
      Alert.alert('Missing info', 'Please fill in age, weight and height.'); return;
    }
    setLoading(true);
    try {
      const raw = await callAI(
        'You are an elite fitness coach and registered dietitian. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure: {"summary":"2 sentence assessment","bmi":number,"bmiCategory":"string","dailyCalories":number,"protein":number,"carbs":number,"fat":number,"mealPlan":[{"meal":"Breakfast","foods":["food1","food2"],"calories":number},{"meal":"Lunch","foods":["food1","food2"],"calories":number},{"meal":"Dinner","foods":["food1","food2"],"calories":number},{"meal":"Snack","foods":["food1"],"calories":number}],"workoutPlan":[{"day":"Monday","type":"Strength","exercises":["exercise - sets x reps"]},{"day":"Wednesday","type":"Cardio","exercises":["exercise - duration"]},{"day":"Friday","type":"Full Body","exercises":["exercise - sets x reps"]}],"weeklyTips":["tip1","tip2","tip3"]}',
        'Age: ' + age + ', Gender: ' + gender + ', Weight: ' + weight + 'kg, Height: ' + height + 'cm, Goal: ' + goal + ', Activity: ' + activity + ', Injuries: ' + (injuries || 'None')
      );
      const parsed = parseJSON(raw, null);
      if (!parsed || !parsed.dailyCalories) {
        Alert.alert('Error', 'AI returned an unexpected response. Please try again.'); return;
      }

      // Save plan with metadata
      const planData = {
        ...parsed,
        generatedAt: Date.now(),
        userProfile: { age, gender, weight, height, goal, activity },
      };
      await Storage.set(KEYS.PLAN(user.email), planData);

      const updated = await Auth.updateUser(user.email, {
        workoutsLogged: (user.workoutsLogged || 0) + 1,
      });
      await Auth.logActivity(user.email);
      if (updated) onUserUpdate(updated);

      Alert.alert(
        'Plan Saved!',
        'Your personalized plan has been saved. You can view it anytime from the Plan tab.',
        [{ text: 'View My Plan', onPress: () => onPlanSaved() }]
      );
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not reach AI. Check your internet and API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>AI Coach</Text>
        <Text style={s.titleBarSub}>Fill in your details to generate your plan</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>

        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={s.label}>Age</Text>
            <TextInput style={s.input} placeholder="25" placeholderTextColor={C.muted}
              value={age} onChangeText={setAge} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Gender</Text>
            <View style={s.toggleRow}>
              {['Male', 'Female'].map(g => (
                <TouchableOpacity key={g} style={[s.toggleBtn, gender === g && s.toggleActive]} onPress={() => setGender(g)}>
                  <Text style={[s.toggleText, gender === g && s.toggleTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={s.label}>Weight (kg)</Text>
            <TextInput style={s.input} placeholder="70" placeholderTextColor={C.muted}
              value={weight} onChangeText={setWeight} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Height (cm)</Text>
            <TextInput style={s.input} placeholder="175" placeholderTextColor={C.muted}
              value={height} onChangeText={setHeight} keyboardType="numeric" />
          </View>
        </View>

        <Text style={s.label}>Goal</Text>
        <View style={s.chipRow}>
          {GOALS.map(g => (
            <TouchableOpacity key={g} style={[s.chip, goal === g && s.chipActive]} onPress={() => setGoal(g)}>
              <Text style={[s.chipText, goal === g && s.chipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Activity Level</Text>
        <View style={s.chipRow}>
          {ACTIVITY.map(a => (
            <TouchableOpacity key={a} style={[s.chip, activity === a && s.chipActive]} onPress={() => setActivity(a)}>
              <Text style={[s.chipText, activity === a && s.chipTextActive]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Injuries / Limitations (optional)</Text>
        <TextInput style={[s.input, { height: 70, textAlignVertical: 'top' }]}
          placeholder="e.g. bad knees, lower back pain" placeholderTextColor={C.muted}
          value={injuries} onChangeText={setInjuries} multiline />

        <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={generate} disabled={loading}>
          {loading
            ? <><ActivityIndicator color={C.bg} /><Text style={[s.btnText, { marginLeft: 8 }]}>Generating & saving plan...</Text></>
            : <Text style={s.btnText}>Generate & Save My Plan</Text>
          }
        </TouchableOpacity>

        <Text style={s.note}>Your plan will be saved and accessible anytime from the Plan tab.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  titleBarSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  scroll: { padding: 20, paddingBottom: 40 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: C.surface, color: C.white, padding: 14, borderRadius: 12, fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  toggleRow: { flexDirection: 'row', marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 12, backgroundColor: C.surface, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginRight: 6 },
  toggleActive: { backgroundColor: C.green, borderColor: C.green },
  toggleText: { color: C.muted, fontWeight: '700' },
  toggleTextActive: { color: C.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.bg },
  btn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center' },
  btnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  note: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});