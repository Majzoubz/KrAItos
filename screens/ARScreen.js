import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
const EXERCISES = [
  { name: 'Squat',    muscles: 'Quads - Glutes - Core',       difficulty: 'Beginner'     },
  { name: 'Push-Up',  muscles: 'Chest - Triceps - Shoulders', difficulty: 'Beginner'     },
  { name: 'Deadlift', muscles: 'Back - Hamstrings - Glutes',  difficulty: 'Intermediate' },
  { name: 'Pull-Up',  muscles: 'Lats - Biceps - Rear Delts',  difficulty: 'Intermediate' },
  { name: 'Plank',    muscles: 'Core - Shoulders',            difficulty: 'Beginner'     },
  { name: 'Burpee',   muscles: 'Full Body - Cardio',          difficulty: 'Advanced'     },
];


export default function ARScreen() {
  const { C } = useTheme();
  const s = makeStyles(C);
  const DIFF_COLORS = { Beginner: C.green, Intermediate: C.orange, Advanced: C.danger };
  const [selected, setSelected] = useState(null);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>AR Workout</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Honest future feature banner */}
        <View style={s.futureBanner}>
          <Text style={s.futureBannerTitle}>Coming Soon - AR Glasses Integration</Text>
          <Text style={s.futureBannerText}>
            This feature will connect to AR glasses via Bluetooth and display a 3D human figure performing exercises in your space. Currently in development.
          </Text>
        </View>

        <View style={s.howCard}>
          <Text style={s.howTitle}>How it will work</Text>
          {[
            '1. Pair your AR glasses via Bluetooth',
            '2. Choose any exercise from the library',
            '3. A 3D human figure appears in your gym',
            '4. Mirror the movements in real-time with form feedback',
          ].map((t, i) => <Text key={i} style={s.howStep}>{t}</Text>)}
        </View>

        <Text style={s.sectionTitle}>Exercise Library</Text>
        <Text style={s.sectionSub}>Browse exercises that will be available in AR mode</Text>

        {EXERCISES.map((ex, i) => {
          const color = DIFF_COLORS[ex.difficulty];
          return (
            <TouchableOpacity
              key={i}
              style={[s.exCard, selected === i && s.exCardOn]}
              onPress={() => setSelected(selected === i ? null : i)}
            >
              <View style={s.exInfo}>
                <Text style={s.exName}>{ex.name}</Text>
                <Text style={s.exMuscles}>{ex.muscles}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: color + '22' }]}>
                <Text style={[s.badgeText, { color }]}>{ex.difficulty}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {selected !== null && (
          <TouchableOpacity
            style={s.notifyBtn}
            onPress={() => Alert.alert(
              'Noted!',
              'We will notify you when AR Glasses support is launched for ' + EXERCISES[selected].name + '.'
            )}
          >
            <Text style={s.notifyBtnText}>Notify me when available</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  scroll: { padding: 20, paddingBottom: 40 },
  futureBanner: { backgroundColor: C.purple + '18', borderRadius: 14, padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.purple },
  futureBannerTitle: { color: C.purple, fontWeight: '800', fontSize: 14, marginBottom: 6 },
  futureBannerText: { color: C.white, fontSize: 13, lineHeight: 20 },
  howCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 20 },
  howTitle: { color: C.white, fontWeight: '800', marginBottom: 12, fontSize: 14 },
  howStep: { color: C.muted, fontSize: 13, lineHeight: 26 },
  sectionTitle: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  sectionSub: { color: C.muted, fontSize: 12, marginBottom: 12 },
  exCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  exCardOn: { borderWidth: 1.5, borderColor: C.purple },
  exInfo: { flex: 1 },
  exName: { color: C.white, fontWeight: '800', fontSize: 15 },
  exMuscles: { color: C.muted, fontSize: 12, marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  notifyBtn: { backgroundColor: C.purple, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  notifyBtnText: { color: C.white, fontSize: 15, fontWeight: '900' },
});