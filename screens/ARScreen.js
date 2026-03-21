import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import { C } from '../constants/theme';
import { ScreenHeader, SectionTitle } from '../components/UI';

const EXERCISES = [
  { name: 'Squat',    muscles: 'Quads · Glutes · Core',       difficulty: 'Beginner',     icon: '🏋️' },
  { name: 'Push-Up',  muscles: 'Chest · Triceps · Shoulders', difficulty: 'Beginner',     icon: '💪' },
  { name: 'Deadlift', muscles: 'Back · Hamstrings · Glutes',  difficulty: 'Intermediate', icon: '🔩' },
  { name: 'Pull-Up',  muscles: 'Lats · Biceps · Rear Delts',  difficulty: 'Intermediate', icon: '⬆️' },
  { name: 'Plank',    muscles: 'Core · Shoulders',            difficulty: 'Beginner',     icon: '🧱' },
  { name: 'Burpee',   muscles: 'Full Body · Cardio',          difficulty: 'Advanced',     icon: '🔥' },
];

const DIFF_COLORS = {
  Beginner:     C.green,
  Intermediate: C.orange,
  Advanced:     C.danger,
};

export default function ARScreen({ onBack }) {
  const [connected, setConnected] = useState(false);
  const [selectedEx, setSelectedEx] = useState(null);

  const launchAR = () => {
    if (!connected) {
      Alert.alert('Not Connected', 'Please connect your AR glasses first.'); return;
    }
    Alert.alert('🥽 Launching AR', `${EXERCISES[selectedEx].name} figure is loading in your glasses…`);
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <ScreenHeader title="AR Workout" icon="🥽" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Connection Card */}
        <View style={[s.connectCard, connected && s.connectCardActive]}>
          <Text style={s.connectIcon}>🥽</Text>
          <Text style={s.connectTitle}>
            {connected ? 'AR Glasses Connected' : 'Connect AR Glasses'}
          </Text>
          <Text style={s.connectSub}>
            {connected
              ? 'Your glasses are ready. Select an exercise to launch the human figure guide.'
              : 'Pair your AR glasses via Bluetooth to see a live human figure performing exercises in your space.'}
          </Text>
          <TouchableOpacity
            style={[s.connectBtn, connected && { backgroundColor: C.danger }]}
            onPress={() => setConnected(!connected)}
          >
            <Text style={s.connectBtnText}>
              {connected ? 'Disconnect' : 'Connect via Bluetooth'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* How It Works */}
        {!connected && (
          <View style={s.howCard}>
            <Text style={s.howTitle}>How AR Workout Works</Text>
            {[
              ['1', 'Pair your AR glasses via Bluetooth'],
              ['2', 'Choose an exercise from the list below'],
              ['3', 'A 3D human figure appears in your space'],
              ['4', "Mirror the figure's movements in real-time"],
            ].map(([n, t]) => (
              <View key={n} style={s.howStep}>
                <View style={s.howNum}><Text style={s.howNumText}>{n}</Text></View>
                <Text style={s.howText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <SectionTitle>Exercise Library</SectionTitle>
        {EXERCISES.map((ex, i) => {
          const diffColor = DIFF_COLORS[ex.difficulty];
          return (
            <TouchableOpacity
              key={i}
              style={[s.exCard, selectedEx === i && s.exCardSelected]}
              onPress={() => setSelectedEx(i)}
            >
              <Text style={s.exIcon}>{ex.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.exName}>{ex.name}</Text>
                <Text style={s.exMuscles}>{ex.muscles}</Text>
              </View>
              <View style={[s.diffBadge, { backgroundColor: diffColor + '22' }]}>
                <Text style={[s.diffText, { color: diffColor }]}>{ex.difficulty}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {selectedEx !== null && (
          <TouchableOpacity
            style={[s.launchBtn, !connected && { opacity: 0.4 }]}
            onPress={launchAR}
          >
            <Text style={s.launchBtnText}>Launch in AR Glasses →</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  connectCard: {
    backgroundColor: C.card, borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.border,
  },
  connectCardActive: { borderColor: C.green },
  connectIcon: { fontSize: 48, marginBottom: 12 },
  connectTitle: { color: C.white, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  connectSub: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  connectBtn: {
    backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 14, marginTop: 16,
  },
  connectBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
  howCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 20 },
  howTitle: { color: C.white, fontWeight: '800', marginBottom: 14, fontSize: 15 },
  howStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  howNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  howNumText: { color: C.bg, fontWeight: '900', fontSize: 13 },
  howText: { color: C.muted, fontSize: 14 },
  exCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    marginBottom: 10, flexDirection: 'row', alignItems: 'center',
  },
  exCardSelected: { borderWidth: 1.5, borderColor: C.green },
  exIcon: { fontSize: 28 },
  exName: { color: C.white, fontWeight: '800', fontSize: 15 },
  exMuscles: { color: C.muted, fontSize: 12, marginTop: 2 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  diffText: { fontSize: 11, fontWeight: '700' },
  launchBtn: {
    backgroundColor: C.green, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
  },
  launchBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
});