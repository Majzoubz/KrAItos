import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { C } from '../constants/theme';

const EXERCISES = [
  { name: 'Squat',    muscles: 'Quads - Glutes - Core',       difficulty: 'Beginner'     },
  { name: 'Push-Up',  muscles: 'Chest - Triceps - Shoulders', difficulty: 'Beginner'     },
  { name: 'Deadlift', muscles: 'Back - Hamstrings - Glutes',  difficulty: 'Intermediate' },
  { name: 'Pull-Up',  muscles: 'Lats - Biceps - Rear Delts',  difficulty: 'Intermediate' },
  { name: 'Plank',    muscles: 'Core - Shoulders',            difficulty: 'Beginner'     },
  { name: 'Burpee',   muscles: 'Full Body - Cardio',          difficulty: 'Advanced'     },
];

const DIFF_COLORS = { Beginner: C.green, Intermediate: C.orange, Advanced: C.danger };

export default function ARScreen() {
  const [connected, setConnected] = useState(false);
  const [selected, setSelected]   = useState(null);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>AR Workout</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>

        <View style={[s.connectCard, connected && s.connectCardOn]}>
          <Text style={s.connectTitle}>{connected ? 'AR Glasses Connected' : 'Connect AR Glasses'}</Text>
          <Text style={s.connectSub}>
            {connected
              ? 'Select an exercise below to launch the 3D human figure guide on your glasses.'
              : 'Pair your AR glasses via Bluetooth to see a live human figure performing exercises in your gym.'}
          </Text>
          <TouchableOpacity
            style={[s.connectBtn, connected && { backgroundColor: C.danger }]}
            onPress={() => setConnected(!connected)}
          >
            <Text style={s.connectBtnText}>{connected ? 'Disconnect' : 'Connect via Bluetooth'}</Text>
          </TouchableOpacity>
        </View>

        {!connected && (
          <View style={s.howCard}>
            <Text style={s.howTitle}>How it works</Text>
            {[
              '1. Pair your AR glasses via Bluetooth',
              '2. Choose any exercise from the list',
              '3. A 3D human figure appears in your space',
              '4. Mirror the movements in real-time',
            ].map((t, i) => <Text key={i} style={s.howStep}>{t}</Text>)}
          </View>
        )}

        <Text style={s.sectionTitle}>Exercise Library</Text>
        {EXERCISES.map((ex, i) => {
          const color = DIFF_COLORS[ex.difficulty];
          return (
            <TouchableOpacity key={i} style={[s.exCard, selected === i && s.exCardOn]} onPress={() => setSelected(i)}>
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
            style={[s.launchBtn, !connected && { opacity: 0.35 }]}
            onPress={() => {
              if (!connected) { Alert.alert('Not Connected', 'Connect your AR glasses first.'); return; }
              Alert.alert('Launching AR', EXERCISES[selected].name + ' figure is loading on your glasses...');
            }}
          >
            <Text style={s.launchBtnText}>Launch on AR Glasses</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  scroll: { padding: 20, paddingBottom: 40 },
  connectCard: { backgroundColor: C.card, borderRadius: 18, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  connectCardOn: { borderColor: C.green },
  connectTitle: { color: C.white, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  connectSub: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  connectBtn: { backgroundColor: C.green, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  connectBtnText: { color: C.bg, fontWeight: '900', fontSize: 14 },
  howCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 20 },
  howTitle: { color: C.white, fontWeight: '800', marginBottom: 12 },
  howStep: { color: C.muted, fontSize: 14, lineHeight: 26 },
  sectionTitle: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  exCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  exCardOn: { borderWidth: 1.5, borderColor: C.green },
  exInfo: { flex: 1 },
  exName: { color: C.white, fontWeight: '800', fontSize: 15 },
  exMuscles: { color: C.muted, fontSize: 12, marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  launchBtn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  launchBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
});