import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, StatusBar, ScrollView, Dimensions,
} from 'react-native';
import { C } from '../constants/theme';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: '🍽️', label: 'Food Scanner', desc: 'Scan any meal for instant nutrition', screen: 'scanner', color: C.green },
  { icon: '🤖', label: 'AI Coach',     desc: 'Body assessment & personalized plan', screen: 'coach',   color: C.blue },
  { icon: '🥽', label: 'AR Workout',   desc: 'Pair glasses for live exercise guide', screen: 'ar',      color: C.purple },
  { icon: '📊', label: 'Progress',     desc: 'Track your fitness journey',           screen: 'progress', color: C.orange },
];

export default function HomeScreen({ userName, onNavigate }) {
  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Good day,</Text>
            <Text style={s.userName}>{userName} 👋</Text>
          </View>
          <View style={s.streakBadge}>
            <Text style={s.streakText}>🔥 12-day streak</Text>
          </View>
        </View>

        <View style={s.summaryBar}>
          {[['1,840', 'kcal today'], ['142g', 'protein'], ['6,200', 'steps']].map(([val, lbl]) => (
            <View key={lbl} style={s.summaryItem}>
              <Text style={s.summaryVal}>{val}</Text>
              <Text style={s.summaryLbl}>{lbl}</Text>
            </View>
          ))}
        </View>

        <Text style={s.sectionTitle}>Features</Text>
        <View style={s.cardGrid}>
          {FEATURES.map(card => (
            <TouchableOpacity
              key={card.screen}
              style={[s.featureCard, { borderTopColor: card.color }]}
              onPress={() => onNavigate(card.screen)}
            >
              <Text style={s.cardIcon}>{card.icon}</Text>
              <Text style={s.cardLabel}>{card.label}</Text>
              <Text style={s.cardDesc}>{card.desc}</Text>
              <View style={[s.cardArrow, { backgroundColor: card.color + '22' }]}>
                <Text style={[s.cardArrowText, { color: card.color }]}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.tipCard}>
          <Text style={s.tipTitle}>💡 Today's Tip</Text>
          <Text style={s.tipText}>
            Eating 30g of protein within 30 minutes after your workout maximizes muscle protein synthesis.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 16,
  },
  greeting: { color: C.muted, fontSize: 14 },
  userName: { color: C.white, fontSize: 22, fontWeight: '800' },
  streakBadge: { backgroundColor: C.orange + '22', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  streakText: { color: C.orange, fontSize: 13, fontWeight: '700' },
  summaryBar: {
    flexDirection: 'row', marginHorizontal: 20, backgroundColor: C.surface,
    borderRadius: 16, padding: 16, marginBottom: 24, justifyContent: 'space-around',
  },
  summaryItem: { alignItems: 'center' },
  summaryVal: { color: C.green, fontSize: 18, fontWeight: '800' },
  summaryLbl: { color: C.muted, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800', marginHorizontal: 20, marginBottom: 12 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  featureCard: {
    width: (width - 48) / 2, backgroundColor: C.card,
    borderRadius: 16, padding: 16, borderTopWidth: 3,
  },
  cardIcon: { fontSize: 30, marginBottom: 10 },
  cardLabel: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  cardDesc: { color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  cardArrow: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  cardArrowText: { fontSize: 16, fontWeight: 'bold' },
  tipCard: {
    margin: 20, backgroundColor: C.card, borderRadius: 16,
    padding: 16, borderLeftWidth: 3, borderLeftColor: C.green,
  },
  tipTitle: { color: C.green, fontWeight: '800', marginBottom: 8 },
  tipText: { color: C.muted, fontSize: 13, lineHeight: 20 },
});