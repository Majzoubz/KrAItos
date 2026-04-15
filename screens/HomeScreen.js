import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, Animated, Platform,
  ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { C } from '../constants/theme';
import { Storage, KEYS } from '../utils/storage';
import { Auth } from '../utils/auth';
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');
const RING_SIZE = 180;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function CalorieRing({ consumed, target }) {
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const offset = RING_CIRC * (1 - pct);
  const remaining = Math.max(target - consumed, 0);

  return (
    <View style={s.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={s.ringSvg}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          stroke={C.border} strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          stroke={C.green} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={RING_CIRC} strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90" origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={s.ringCenter}>
        <Text style={s.ringBig}>{remaining}</Text>
        <Text style={s.ringSub}>remaining</Text>
      </View>
    </View>
  );
}

function MacroBar({ label, current, target, color }) {
  const pct = target > 0 ? Math.min(current / target, 1) * 100 : 0;
  return (
    <View style={s.macroBarWrap}>
      <View style={s.macroBarTop}>
        <View style={[s.macroDot, { backgroundColor: color }]} />
        <Text style={s.macroBarLabel}>{label}</Text>
        <Text style={s.macroBarNums}>
          <Text style={{ color: C.white, fontWeight: '700' }}>{current}</Text>
          <Text style={{ color: C.muted }}> / {target}g</Text>
        </Text>
      </View>
      <View style={s.macroTrack}>
        <View style={[s.macroFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MealSection({ title, icon, meals, onAdd, onNavigate }) {
  const sectionMeals = meals.filter(m => {
    const name = (m.meal || '').toLowerCase();
    const t = title.toLowerCase();
    if (t === 'breakfast') return name.includes('breakfast');
    if (t === 'lunch') return name.includes('lunch');
    if (t === 'dinner') return name.includes('dinner');
    return name.includes('snack') || (!name.includes('breakfast') && !name.includes('lunch') && !name.includes('dinner'));
  });

  return (
    <View style={s.mealSection}>
      <View style={s.mealSectionHeader}>
        <Text style={s.mealSectionIcon}>{icon}</Text>
        <Text style={s.mealSectionTitle}>{title}</Text>
        <TouchableOpacity style={s.mealAddBtn} onPress={onAdd}>
          <Text style={s.mealAddText}>+</Text>
        </TouchableOpacity>
      </View>
      {sectionMeals.length > 0 ? (
        sectionMeals.map((m, i) => (
          <View key={i} style={s.mealItem}>
            <View style={{ flex: 1 }}>
              <Text style={s.mealItemName}>{m.meal}</Text>
              <View style={s.mealItemFoods}>
                {(m.foods || []).slice(0, 2).map((f, j) => (
                  <Text key={j} style={s.mealItemFood} numberOfLines={1}>{f}</Text>
                ))}
                {(m.foods || []).length > 2 && (
                  <Text style={s.mealItemMore}>+{m.foods.length - 2} more</Text>
                )}
              </View>
            </View>
            <View style={s.mealItemRight}>
              <Text style={s.mealItemCal}>{m.calories}</Text>
              <Text style={s.mealItemCalLabel}>kcal</Text>
            </View>
          </View>
        ))
      ) : (
        <TouchableOpacity style={s.mealEmpty} onPress={onAdd}>
          <Text style={s.mealEmptyText}>Tap + to add {title.toLowerCase()}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function HomeScreen({ user, onNavigate, onUserUpdate }) {
  const [water, setWater]             = useState(0);
  const [plan, setPlan]               = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [todayDate]                   = useState(new Date().toDateString());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    Storage.get(KEYS.WATER(user.uid, todayDate)).then(d => { if (d) setWater(d); });
    Storage.get(KEYS.PLAN(user.email || user.uid)).then(p => {
      setPlan(p);
      setLoadingPlan(false);
    });
  }, []);

  const addWater = async () => {
    if (water >= 8) return;
    const n = water + 1;
    setWater(n);
    await Storage.set(KEYS.WATER(user.uid, todayDate), n);
    if (n === 8) {
      const updated = await Auth.logActivity(user.uid);
      if (updated && onUserUpdate) onUserUpdate(updated);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const consumed = 0;
  const target = plan?.dailyCalories || 2000;
  const proteinTarget = plan?.protein || 150;
  const carbsTarget = plan?.carbs || 200;
  const fatTarget = plan?.fat || 65;

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={s.topBar}>
          <View>
            <Text style={s.dateText}>{todayFormatted}</Text>
            <Text style={s.hiText}>Hi, {user.fullName?.split(' ')[0]}</Text>
          </View>
          <TouchableOpacity style={s.profileBtn} onPress={() => onNavigate('profile')}>
            <Text style={s.profileLetter}>{user.fullName?.[0]?.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {loadingPlan ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={C.green} size="large" />
              <Text style={s.loadingLabel}>Loading your plan...</Text>
            </View>
          ) : plan ? (
            <>
              <View style={s.calorieArea}>
                <CalorieRing consumed={consumed} target={target} />
                <View style={s.calStats}>
                  <View style={s.calStatItem}>
                    <Text style={s.calStatNum}>{target}</Text>
                    <Text style={s.calStatSub}>Budget</Text>
                  </View>
                  <View style={s.calStatDivider} />
                  <View style={s.calStatItem}>
                    <Text style={s.calStatNum}>{consumed}</Text>
                    <Text style={s.calStatSub}>Consumed</Text>
                  </View>
                  <View style={s.calStatDivider} />
                  <View style={s.calStatItem}>
                    <Text style={[s.calStatNum, { color: C.green }]}>{target - consumed}</Text>
                    <Text style={s.calStatSub}>Remaining</Text>
                  </View>
                </View>
              </View>

              <View style={s.macrosSection}>
                <MacroBar label="Protein" current={0} target={proteinTarget} color="#FF6B6B" />
                <MacroBar label="Carbs" current={0} target={carbsTarget} color="#4ECDC4" />
                <MacroBar label="Fat" current={0} target={fatTarget} color="#FFD93D" />
              </View>

              <TouchableOpacity style={s.scanBtn} onPress={() => onNavigate('scanner')}>
                <Text style={s.scanIcon}>📸</Text>
                <Text style={s.scanText}>Scan Food</Text>
              </TouchableOpacity>

              <MealSection title="Breakfast" icon="🌅" meals={plan.mealPlan || []} onAdd={() => onNavigate('scanner')} onNavigate={onNavigate} />
              <MealSection title="Lunch" icon="☀️" meals={plan.mealPlan || []} onAdd={() => onNavigate('scanner')} onNavigate={onNavigate} />
              <MealSection title="Dinner" icon="🌙" meals={plan.mealPlan || []} onAdd={() => onNavigate('scanner')} onNavigate={onNavigate} />
              <MealSection title="Snacks" icon="🍎" meals={plan.mealPlan || []} onAdd={() => onNavigate('scanner')} onNavigate={onNavigate} />

              <View style={s.waterSection}>
                <View style={s.waterTop}>
                  <Text style={s.waterIcon}>💧</Text>
                  <Text style={s.waterLabel}>Water</Text>
                  <Text style={s.waterCount}>{water} / 8</Text>
                </View>
                <View style={s.waterDots}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.waterDot, i < water && s.waterDotFilled]}
                      onPress={i >= water ? addWater : undefined}
                    />
                  ))}
                </View>
              </View>

              <View style={s.quickRow}>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('plan')}>
                  <Text style={s.quickIcon}>📋</Text>
                  <Text style={s.quickLabel}>My Plan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('coach')}>
                  <Text style={s.quickIcon}>🤖</Text>
                  <Text style={s.quickLabel}>AI Coach</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('tracker')}>
                  <Text style={s.quickIcon}>📊</Text>
                  <Text style={s.quickLabel}>Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('foodlog')}>
                  <Text style={s.quickIcon}>📝</Text>
                  <Text style={s.quickLabel}>Food Log</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={s.emptyState}>
              <Image source={require('../assets/logo.png')} style={s.emptyLogo} resizeMode="contain" />
              <Text style={s.emptyTitle}>Get Your AI Plan</Text>
              <Text style={s.emptyDesc}>
                Generate a personalized nutrition and workout plan tailored to your goals.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => onNavigate('coach')}>
                <Text style={s.emptyBtnText}>Generate My Plan</Text>
              </TouchableOpacity>

              <View style={[s.waterSection, { marginTop: 30, width: '100%' }]}>
                <View style={s.waterTop}>
                  <Text style={s.waterIcon}>💧</Text>
                  <Text style={s.waterLabel}>Water</Text>
                  <Text style={s.waterCount}>{water} / 8</Text>
                </View>
                <View style={s.waterDots}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[s.waterDot, i < water && s.waterDotFilled]}
                      onPress={i >= water ? addWater : undefined}
                    />
                  ))}
                </View>
              </View>

              <View style={[s.quickRow, { marginTop: 16 }]}>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('scanner')}>
                  <Text style={s.quickIcon}>📸</Text>
                  <Text style={s.quickLabel}>Scanner</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('coach')}>
                  <Text style={s.quickIcon}>🤖</Text>
                  <Text style={s.quickLabel}>AI Coach</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('tracker')}>
                  <Text style={s.quickIcon}>📊</Text>
                  <Text style={s.quickLabel}>Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickCard} onPress={() => onNavigate('foodlog')}>
                  <Text style={s.quickIcon}>📝</Text>
                  <Text style={s.quickLabel}>Food Log</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 120 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dateText: { color: C.muted, fontSize: 12, fontWeight: '500' },
  hiText:   { color: C.white, fontSize: 20, fontWeight: '800', marginTop: 2 },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  profileLetter: { color: C.bg, fontSize: 16, fontWeight: '900' },

  loadingWrap: { alignItems: 'center', paddingVertical: 80 },
  loadingLabel: { color: C.muted, fontSize: 14, marginTop: 16 },

  calorieArea: { alignItems: 'center', paddingTop: 28, paddingBottom: 20 },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringSvg: { position: 'absolute' },
  ringCenter: { alignItems: 'center' },
  ringBig: { color: C.white, fontSize: 40, fontWeight: '900' },
  ringSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  calStats: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 20, paddingHorizontal: 20,
  },
  calStatItem: { flex: 1, alignItems: 'center' },
  calStatNum: { color: C.white, fontSize: 18, fontWeight: '800' },
  calStatSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  calStatDivider: { width: 1, height: 28, backgroundColor: C.border },

  macrosSection: { paddingHorizontal: 20, marginBottom: 16 },
  macroBarWrap: { marginBottom: 12 },
  macroBarTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  macroBarLabel: { color: C.white, fontSize: 13, fontWeight: '600', flex: 1 },
  macroBarNums: { fontSize: 13 },
  macroTrack: { height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden' },
  macroFill: { height: 6, borderRadius: 3 },

  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.green, marginHorizontal: 20, paddingVertical: 14,
    borderRadius: 14, marginBottom: 20,
  },
  scanIcon: { fontSize: 18, marginRight: 8 },
  scanText: { color: C.bg, fontSize: 16, fontWeight: '900' },

  mealSection: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  mealSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  mealSectionIcon: { fontSize: 18, marginRight: 10 },
  mealSectionTitle: { color: C.white, fontSize: 15, fontWeight: '700', flex: 1 },
  mealAddBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  mealAddText: { color: C.bg, fontSize: 18, fontWeight: '700', marginTop: -1 },
  mealItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  mealItemName: { color: C.white, fontSize: 14, fontWeight: '600' },
  mealItemFoods: { marginTop: 3 },
  mealItemFood: { color: C.muted, fontSize: 12, lineHeight: 18 },
  mealItemMore: { color: C.green, fontSize: 11, fontWeight: '600', marginTop: 2 },
  mealItemRight: { alignItems: 'flex-end', marginLeft: 12 },
  mealItemCal: { color: C.white, fontSize: 16, fontWeight: '800' },
  mealItemCalLabel: { color: C.muted, fontSize: 10 },
  mealEmpty: { paddingVertical: 16, alignItems: 'center' },
  mealEmptyText: { color: C.muted, fontSize: 13 },

  waterSection: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  waterTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  waterIcon: { fontSize: 16, marginRight: 8 },
  waterLabel: { color: C.white, fontSize: 14, fontWeight: '700', flex: 1 },
  waterCount: { color: C.muted, fontSize: 13 },
  waterDots: { flexDirection: 'row' },
  waterDot: {
    flex: 1, height: 24, borderRadius: 8, marginHorizontal: 2,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  waterDotFilled: { backgroundColor: '#4FC3F7', borderColor: '#4FC3F7' },

  quickRow: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 16,
  },
  quickCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16, marginHorizontal: 3,
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  quickIcon: { fontSize: 22, marginBottom: 6 },
  quickLabel: { color: C.muted, fontSize: 11, fontWeight: '600' },

  emptyState: {
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 40,
  },
  emptyLogo: { width: 60, height: 60, marginBottom: 20 },
  emptyTitle: { color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  emptyDesc: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 280 },
  emptyBtn: { backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14 },
  emptyBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
});
