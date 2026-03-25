import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Dimensions, Alert,
} from 'react-native';
import { C } from '../constants/theme';
import { Storage, KEYS } from '../utils/storage';
import { Auth } from '../utils/auth';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2;

const FEATURES = [
  { label: 'Food Analysis', desc: 'Analyze any meal with AI',     screen: 'scanner', color: C.green  },
  { label: 'My Plan',       desc: 'View your fitness plan',       screen: 'plan',    color: C.blue   },
  { label: 'AI Coach',      desc: 'Generate a personalized plan', screen: 'coach',   color: C.purple },
  { label: 'AR Workout',    desc: 'Exercise figure guide',        screen: 'ar',      color: C.orange },
];

const WATER_GOAL = 8; // glasses

export default function HomeScreen({ user, onNavigate, onUserUpdate }) {
  const [water, setWater]       = useState(0);
  const [hasPlan, setHasPlan]   = useState(false);
  const [todayDate]             = useState(new Date().toDateString());

  useEffect(() => {
    // Load water intake for today
    Storage.get(KEYS.WATER(user.uid, todayDate)).then(data => {
      if (data) setWater(data);
      else setWater(0);
    });
    // Check if plan exists
    Storage.get(KEYS.PLAN(user.uid)).then(p => setHasPlan(!!p));
  }, []);

  const addWater = async () => {
    if (water >= WATER_GOAL) {
      Alert.alert('Goal reached!', 'You have hit your daily water goal. Great job!'); return;
    }
    const newVal = water + 1;
    setWater(newVal);
    await Storage.set(KEYS.WATER(user.uid, todayDate), newVal);
    if (newVal === WATER_GOAL) {
      // log activity for water goal
      const updated = await Auth.logActivity(user.uid);
      if (updated && onUserUpdate) onUserUpdate(updated);
      Alert.alert('Water goal reached!', 'You drank ' + WATER_GOAL + ' glasses today. Excellent!');
    }
  };

  const streak   = user.streak || 0;
  const meals    = user.mealsScanned || 0;
  const plans    = user.workoutsLogged || 0;
  const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isNew    = meals === 0 && plans === 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>

        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>Welcome back,</Text>
            <Text style={s.name}>{user.fullName}</Text>
            <Text style={s.since}>Member since {joinDate}</Text>
          </View>
          <TouchableOpacity style={s.avatar} onPress={() => onNavigate('profile')}>
            <Text style={s.avatarText}>{user.fullName[0].toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{streak}</Text>
            <Text style={s.statLbl}>{streak === 1 ? 'day streak' : 'day streak'}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{meals}</Text>
            <Text style={s.statLbl}>meals logged</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{plans}</Text>
            <Text style={s.statLbl}>plans made</Text>
          </View>
        </View>

        {/* Onboarding for new users */}
        {isNew && (
          <View style={s.onboardCard}>
            <Text style={s.onboardTitle}>Get started with FitLife</Text>
            <TouchableOpacity style={s.onboardStep} onPress={() => onNavigate('coach')}>
              <View style={s.onboardNum}><Text style={s.onboardNumText}>1</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.onboardStepTitle}>Generate your plan</Text>
                <Text style={s.onboardStepDesc}>Tell the AI Coach about your body and goals</Text>
              </View>
              <Text style={s.onboardArrow}>-&gt;</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.onboardStep} onPress={() => onNavigate('scanner')}>
              <View style={[s.onboardNum, { backgroundColor: C.blue }]}><Text style={s.onboardNumText}>2</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.onboardStepTitle}>Log your first meal</Text>
                <Text style={s.onboardStepDesc}>Describe what you ate for instant nutrition info</Text>
              </View>
              <Text style={[s.onboardArrow, { color: C.blue }]}>-&gt;</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan reminder if no plan */}
        {!isNew && !hasPlan && (
          <TouchableOpacity style={s.planBanner} onPress={() => onNavigate('coach')}>
            <Text style={s.planBannerText}>You don't have a plan yet. Tap to generate one -&gt;</Text>
          </TouchableOpacity>
        )}

        {/* Water tracker */}
        <View style={s.waterCard}>
          <View style={s.waterHeader}>
            <Text style={s.waterTitle}>Daily Water Intake</Text>
            <Text style={s.waterCount}>{water} / {WATER_GOAL} glasses</Text>
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

        {/* Streak message */}
        {streak === 0 && (
          <View style={s.streakBanner}>
            <Text style={s.streakBannerText}>Start your streak today! Log a meal or generate a plan.</Text>
          </View>
        )}
        {streak > 0 && (
          <View style={[s.streakBanner, { borderLeftColor: C.orange, backgroundColor: C.orange + '12' }]}>
            <Text style={[s.streakBannerText, { color: C.orange }]}>{streak}-day streak! Keep it going.</Text>
          </View>
        )}

        {/* Feature cards */}
        <Text style={s.sectionTitle}>Features</Text>
        <View style={s.grid}>
          {FEATURES.map((card, i) => (
            <TouchableOpacity
              key={card.screen}
              style={[s.card, { borderTopColor: card.color }, i % 2 === 0 ? { marginRight: 12 } : {}]}
              onPress={() => onNavigate(card.screen)}
              activeOpacity={0.8}
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
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.bg, fontSize: 22, fontWeight: '900' },
  statsBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 16, justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statVal: { color: C.green, fontSize: 22, fontWeight: '900' },
  statLbl: { color: C.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },
  divider: { width: 1, height: 36, backgroundColor: C.border },
  onboardCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 16 },
  onboardTitle: { color: C.white, fontWeight: '900', fontSize: 15, marginBottom: 14 },
  onboardStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  onboardNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  onboardNumText: { color: C.bg, fontWeight: '900', fontSize: 13 },
  onboardStepTitle: { color: C.white, fontWeight: '700', fontSize: 14 },
  onboardStepDesc: { color: C.muted, fontSize: 12, marginTop: 2 },
  onboardArrow: { color: C.green, fontSize: 16, fontWeight: '900', marginLeft: 8 },
  planBanner: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.blue + '18', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: C.blue },
  planBannerText: { color: C.blue, fontSize: 13, fontWeight: '600' },
  waterCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.card, borderRadius: 16, padding: 16 },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  waterTitle: { color: C.white, fontWeight: '800', fontSize: 14 },
  waterCount: { color: C.blue, fontWeight: '700', fontSize: 13 },
  waterGlasses: { flexDirection: 'row', marginBottom: 12 },
  glass: { flex: 1, height: 24, borderRadius: 6, backgroundColor: C.surface, marginRight: 4, borderWidth: 1, borderColor: C.border },
  glassFilled: { backgroundColor: C.blue, borderColor: C.blue },
  waterBtn: { backgroundColor: C.blue + '22', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  waterBtnText: { color: C.blue, fontWeight: '800', fontSize: 13 },
  streakBanner: { marginHorizontal: 20, marginBottom: 16, backgroundColor: C.green + '12', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: C.green },
  streakBannerText: { color: C.green, fontSize: 13, fontWeight: '600' },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800', marginHorizontal: 20, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20 },
  card: { width: CARD_W, backgroundColor: C.card, borderRadius: 16, padding: 16, borderTopWidth: 3, marginBottom: 12 },
  cardLabel: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  cardDesc: { color: C.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 },
  cardArrow: { fontSize: 16, fontWeight: 'bold' },
});