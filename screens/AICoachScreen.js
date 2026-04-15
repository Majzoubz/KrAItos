import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { C } from '../constants/theme';
import { callAI, parseJSON } from '../utils/api';
import { Auth } from '../utils/auth';
import { Storage, KEYS } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOALS    = ['Lose Fat', 'Build Muscle', 'Recomposition', 'Maintain', 'Performance'];
const ACTIVITY = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extremely Active'];
const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';

export default function AICoachScreen({ user, onUserUpdate, onPlanSaved }) {
  const [loading, setLoading]     = useState(false);
  const [existingPlan, setExisting] = useState(false);
  const [age, setAge]             = useState('');
  const [gender, setGender]       = useState('Male');
  const [weight, setWeight]       = useState('');
  const [height, setHeight]       = useState('');
  const [goal, setGoal]           = useState('Lose Fat');
  const [activity, setActivity]   = useState('Moderately Active');
  const [injuries, setInjuries]   = useState('');

  useEffect(() => {
    const loadData = async () => {
      const p = await Storage.get(KEYS.PLAN(user.email || user.uid));
      if (p) {
        setExisting(true);
        if (p.userProfile) {
          setAge(String(p.userProfile.age || ''));
          setGender(p.userProfile.gender || 'Male');
          setWeight(String(p.userProfile.weight || ''));
          setHeight(String(p.userProfile.height || ''));
          setGoal(p.userProfile.goal || 'Lose Fat');
          const actLegacy = { 'Light': 'Lightly Active', 'Moderate': 'Moderately Active', 'Active': 'Very Active', 'Very Active': 'Very Active' };
          const rawAct = p.userProfile.activity || 'Moderately Active';
          setActivity(actLegacy[rawAct] || rawAct);
        }
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.gender) setGender(d.gender);
          if (d.weight) setWeight(String(d.weight));
          if (d.height) setHeight(String(d.height));
          if (d.goal) {
            const goalMap = { 'Lose weight': 'Lose Fat', 'Build muscle': 'Build Muscle', 'Get healthier': 'Maintain', 'Improve endurance': 'Performance', 'Stay Healthy': 'Maintain', 'Endurance': 'Performance' };
            setGoal(goalMap[d.goal] || d.goal);
          }
          if (d.activityLevel) {
            const legacyAct = { 'Mostly sitting': 'Sedentary', 'Light': 'Lightly Active', 'Moderate': 'Moderately Active', 'Active': 'Very Active', 'Lightly active': 'Lightly Active', 'Moderately active': 'Moderately Active', 'Very active': 'Very Active', 'Extremely active': 'Extremely Active' };
            setActivity(legacyAct[d.activityLevel] || d.activityLevel);
          }
          if (d.birthday) {
            const parts = d.birthday.match(/(\d+)/g);
            if (parts && parts.length >= 3) {
              let year = parseInt(parts[0].length === 4 ? parts[0] : parts[2]);
              if (year < 100) year += 2000;
              const a = new Date().getFullYear() - year;
              if (a > 0 && a < 120) setAge(String(a));
            }
          }
        }
      } catch {}
    };
    loadData();
  }, []);

  const generate = async () => {
    if (!age || !weight || !height) {
      Alert.alert('Missing info', 'Please fill in age, weight and height.'); return;
    }
    if (parseInt(age) < 10 || parseInt(age) > 100) {
      Alert.alert('Invalid age', 'Please enter a valid age between 10 and 100.'); return;
    }
    if (parseFloat(weight) < 30 || parseFloat(weight) > 300) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.'); return;
    }
    if (parseInt(height) < 100 || parseInt(height) > 250) {
      Alert.alert('Invalid height', 'Please enter a valid height in cm.'); return;
    }

    const confirmMsg = existingPlan
      ? 'This will replace your existing plan. Continue?'
      : 'Generate your personalized plan now?';

    Alert.alert('Generate Plan', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Generate', onPress: doGenerate },
    ]);
  };

  const doGenerate = async () => {
    setLoading(true);
    try {
      const raw = await callAI(
        'You are an elite fitness coach and registered dietitian. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure: {"summary":"2-3 sentence assessment","bmi":number,"bmiCategory":"string","dailyCalories":number,"protein":number,"proteinPct":number,"carbs":number,"carbsPct":number,"fat":number,"fatPct":number,"mealPlan":[{"meal":"Breakfast","time":"7:00 AM","foods":["food1","food2"],"calories":number,"protein":number,"carbs":number,"fat":number},{"meal":"Lunch","time":"12:30 PM","foods":["food1","food2"],"calories":number,"protein":number,"carbs":number,"fat":number},{"meal":"Dinner","time":"7:00 PM","foods":["food1","food2"],"calories":number,"protein":number,"carbs":number,"fat":number},{"meal":"Snack","time":"3:30 PM","foods":["food1"],"calories":number,"protein":number,"carbs":number,"fat":number}],"workoutPlan":[{"day":"Monday","type":"Strength","duration":"60 min","exercises":[{"name":"exercise","sets":3,"reps":"8-12","rest":"90s"}]},{"day":"Wednesday","type":"Cardio","duration":"30 min","exercises":[{"name":"exercise","sets":1,"reps":"30 min","rest":""}]},{"day":"Friday","type":"Full Body","duration":"60 min","exercises":[{"name":"exercise","sets":3,"reps":"8-12","rest":"90s"}]}],"weeklyTips":["tip1","tip2","tip3"]}',
        'Age: ' + age + ', Gender: ' + gender + ', Weight: ' + weight + 'kg, Height: ' + height + 'cm, Goal: ' + goal + ', Activity: ' + activity + ', Injuries: ' + (injuries.trim() || 'None')
      );
      const parsed = parseJSON(raw, null);
      if (!parsed || !parsed.dailyCalories) {
        Alert.alert('Error', 'AI returned an unexpected response. Please try again.'); return;
      }
      const planData = {
        ...parsed,
        generatedAt: Date.now(),
        userProfile: { age, gender, weight, height, goal, activity },
      };
      await Storage.set(KEYS.PLAN(user.email || user.uid), planData);
      const updated = await Auth.updateUser(user.uid, {
        workoutsLogged: (user.workoutsLogged || 0) + 1,
      });
      const withStreak = await Auth.logActivity(user.uid);
      if (withStreak && onUserUpdate) onUserUpdate(withStreak);
      else if (updated && onUserUpdate) onUserUpdate(updated);

      setExisting(true);
      Alert.alert(
        'Plan Saved!',
        'Your personalized plan is ready.',
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
        <Text style={s.titleBarSub}>
          {existingPlan ? 'Update your existing plan' : 'Fill in your details to get started'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {existingPlan && (
          <View style={s.existingBanner}>
            <Text style={s.existingBannerText}>You have an active plan. Update it below or view it in My Plan.</Text>
          </View>
        )}

        <View style={s.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={s.label}>Age</Text>
            <TextInput style={s.input} placeholder="25" placeholderTextColor={C.muted}
              value={age} onChangeText={setAge} keyboardType="numeric" maxLength={3} />
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
              value={weight} onChangeText={setWeight} keyboardType="decimal-pad" maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Height (cm)</Text>
            <TextInput style={s.input} placeholder="175" placeholderTextColor={C.muted}
              value={height} onChangeText={setHeight} keyboardType="numeric" maxLength={3} />
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
        <TextInput
          style={[s.input, { height: 70, textAlignVertical: 'top' }]}
          placeholder="e.g. bad knees, lower back pain"
          placeholderTextColor={C.muted}
          value={injuries}
          onChangeText={setInjuries}
          multiline
        />

        <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={generate} disabled={loading}>
          {loading
            ? <><ActivityIndicator color={C.bg} /><Text style={[s.btnText, { marginLeft: 10 }]}>Generating plan...</Text></>
            : <Text style={s.btnText}>{existingPlan ? 'Regenerate My Plan' : 'Generate My Plan'}</Text>
          }
        </TouchableOpacity>

        {existingPlan && (
          <TouchableOpacity style={s.viewPlanBtn} onPress={() => onPlanSaved()}>
            <Text style={s.viewPlanBtnText}>View Current Plan</Text>
          </TouchableOpacity>
        )}

        <Text style={s.note}>Your plan will be saved and accessible anytime from the My Plan tab.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  titleBarSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  scroll: { padding: 20, paddingBottom: 100 },
  existingBanner: { backgroundColor: C.greenGlow2, borderRadius: 12, padding: 12, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: C.green },
  existingBannerText: { color: C.green, fontSize: 13, lineHeight: 20 },
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
  viewPlanBtn: { borderWidth: 1.5, borderColor: C.green, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  viewPlanBtnText: { color: C.green, fontSize: 15, fontWeight: '700' },
  note: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
