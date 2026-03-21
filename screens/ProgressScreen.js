import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, Dimensions } from 'react-native';
import { C } from '../constants/theme';
import { ScreenHeader } from '../components/UI';

const { width } = Dimensions.get('window');

const STATS = [
  { label: 'Workouts',    value: '24',  unit: 'this month', color: C.green },
  { label: 'Meals Logged', value: '87', unit: 'total',      color: C.blue },
  { label: 'Streak',      value: '12',  unit: 'days',       color: C.orange },
  { label: 'Goal',        value: '68%', unit: 'complete',   color: C.purple },
];

export default function ProgressScreen({ onBack }) {
  return (
    <SafeAreaView style={s.safeArea}>
      <ScreenHeader title="Progress" icon="📊" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>

        <View style={s.statsGrid}>
          {STATS.map((st, i) => (
            <View key={i} style={[s.statCard, { borderLeftColor: st.color }]}>
              <Text style={[s.statVal, { color: st.color }]}>{st.value}</Text>
              <Text style={s.statLabel}>{st.label}</Text>
              <Text style={s.statUnit}>{st.unit}</Text>
            </View>
          ))}
        </View>

        <View style={s.comingSoon}>
          <Text style={s.comingSoonTitle}>📈 Coming Soon</Text>
          <Text style={s.comingSoonText}>
            Detailed weight tracking, calorie graphs, and full workout history dashboards are on the way.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  statCard: {
    width: (width - 52) / 2, backgroundColor: C.card,
    borderRadius: 14, padding: 16, borderLeftWidth: 4,
  },
  statVal: { fontSize: 32, fontWeight: '900' },
  statLabel: { color: C.white, fontWeight: '700', fontSize: 14, marginTop: 4 },
  statUnit: { color: C.muted, fontSize: 12, marginTop: 2 },
  comingSoon: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderLeftWidth: 3, borderLeftColor: C.green,
  },
  comingSoonTitle: { color: C.green, fontWeight: '800', marginBottom: 8 },
  comingSoonText: { color: C.muted, fontSize: 13, lineHeight: 20 },
});