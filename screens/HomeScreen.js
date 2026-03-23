import React from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Dimensions,
} from 'react-native';
import { C } from '../constants/theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

const FEATURES = [
  { label: 'Food Scanner', desc: 'Analyze any meal with AI', screen: 'scanner', color: C.green },
  { label: 'AI Coach',     desc: 'Get your personalized plan', screen: 'coach',   color: C.blue },
  { label: 'AR Workout',   desc: 'Live exercise figure guide', screen: 'ar',      color: C.purple },
  { label: 'My Profile',   desc: 'Account & stats',            screen: 'profile', color: C.orange },
];

export default function HomeScreen({ user, onNavigate }) {
  const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const streak = user.streak || 0;
  const meals  = user.mealsScanned || 0;
  const workouts = user.workoutsLogged || 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.name}>{user.fullName}</Text>
            <Text style={s.since}>Member since {joinDate}</Text>
          </View>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{user.fullName[0].toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{streak}</Text>
            <Text style={s.statLbl}>{streak === 1 ? 'day streak' : 'day streak'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{meals}</Text>
            <Text style={s.statLbl}>meals scanned</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{workouts}</Text>
            <Text style={s.statLbl}>plans generated</Text>
          </View>
        </View>

        {streak === 0 && (
          <View style={s.callout}>
            <Text style={s.calloutText}>
              Scan your first meal or generate a workout plan to start your streak!
            </Text>
          </View>
        )}

        <Text style={s.sectionTitle}>What do you want to do?</Text>
        <View style={s.grid}>
          {FEATURES.map((card, i) => (
            <TouchableOpacity
              key={card.screen}
              style={[s.card, { borderTopColor: card.color }, i % 2 === 0 ? { marginRight: 12 } : {}]}
              onPress={() => onNavigate(card.screen)}
            >
              <Text style={[s.cardLabel, { color: card.color }]}>{card.label}</Text>
              <Text style={s.cardDesc}>{card.desc}</Text>
              <Text style={[s.cardArrow, { color: card.color }]}>-&gt;</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 20 },
  greeting: { color: C.muted, fontSize: 14 },
  name: { color: C.white, fontSize: 22, fontWeight: '900', marginTop: 2 },
  since: { color: C.muted, fontSize: 11, marginTop: 4 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.bg, fontSize: 22, fontWeight: '900' },
  statsBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 16, justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statVal: { color: C.green, fontSize: 22, fontWeight: '900' },
  statLbl: { color: C.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  divider: { width: 1, height: 36, backgroundColor: C.border },
  callout: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.green + '18', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: C.green },
  calloutText: { color: C.green, fontSize: 13, lineHeight: 20 },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800', marginHorizontal: 20, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20 },
  card: { width: CARD_W, backgroundColor: C.card, borderRadius: 16, padding: 16, borderTopWidth: 3, marginBottom: 12 },
  cardLabel: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  cardDesc: { color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  cardArrow: { fontSize: 16, fontWeight: 'bold' },
});