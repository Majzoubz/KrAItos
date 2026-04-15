import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, Animated, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { C } from '../constants/theme';
import { Storage, KEYS } from '../utils/storage';
import { Auth } from '../utils/auth';

const WATER_GOAL = 8;

function CalorieRing({ calories }) {
  return (
    <View style={s.ringOuter}>
      <View style={s.ringGlow} />
      <View style={s.ringInner}>
        <Text style={s.ringNum}>{calories}</Text>
        <Text style={s.ringLabel}>kcal / day</Text>
      </View>
    </View>
  );
}

function MacroCard({ label, grams, pct, icon }) {
  return (
    <View style={s.macroCard}>
      <Text style={s.macroIcon}>{icon}</Text>
      <Text style={s.macroGrams}>{grams}g</Text>
      <View style={s.macroTrack}>
        <View style={[s.macroFill, { width: `${Math.min(pct || 0, 100)}%` }]} />
      </View>
      <View style={s.macroBottom}>
        <Text style={s.macroLabel}>{label}</Text>
        <Text style={s.macroPct}>{pct}%</Text>
      </View>
    </View>
  );
}

export default function HomeScreen({ user, onNavigate, onUserUpdate }) {
  const [water, setWater]             = useState(0);
  const [plan, setPlan]               = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [todayDate]                   = useState(new Date().toDateString());
  const [expandedDay, setExpandedDay] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Storage.get(KEYS.WATER(user.uid, todayDate)).then(d => { if (d) setWater(d); });
    Storage.get(KEYS.PLAN(user.email || user.uid)).then(p => {
      setPlan(p);
      setLoadingPlan(false);
    });
  }, []);

  const addWater = async () => {
    if (water >= WATER_GOAL) return;
    const n = water + 1;
    setWater(n);
    await Storage.set(KEYS.WATER(user.uid, todayDate), n);
    if (n === WATER_GOAL) {
      const updated = await Auth.logActivity(user.uid);
      if (updated && onUserUpdate) onUserUpdate(updated);
    }
  };

  const todayName   = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const greeting    = getGreeting();
  const streak      = user.streak || 0;
  const mealsCount  = user.mealsScanned || 0;

  return (
    <SafeAreaView style={s.safe}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.greetText}>{greeting}</Text>
              <Text style={s.nameText}>{user.fullName}</Text>
            </View>
            <TouchableOpacity style={s.avatarBtn} onPress={() => onNavigate('profile')}>
              <Text style={s.avatarLetter}>{user.fullName[0].toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.statsStrip}>
            <StatBadge value={streak} label="Day Streak" icon="🔥" />
            <View style={s.statDivider} />
            <StatBadge value={mealsCount} label="Scanned" icon="📷" />
            <View style={s.statDivider} />
            <StatBadge value={`${water}/${WATER_GOAL}`} label="Water" icon="💧" />
          </View>

          {loadingPlan ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={C.green} size="large" />
              <Text style={s.loadingLabel}>Loading your plan...</Text>
            </View>
          ) : plan ? (
            <>
              <View style={s.calorieSection}>
                <CalorieRing calories={plan.dailyCalories || 0} />
              </View>

              <View style={s.macroRow}>
                <MacroCard label="Protein" grams={plan.protein || 0} pct={plan.proteinPct || 0} icon="🥩" />
                <MacroCard label="Carbs"   grams={plan.carbs || 0}   pct={plan.carbsPct || 0}   icon="🍞" />
                <MacroCard label="Fat"     grams={plan.fat || 0}     pct={plan.fatPct || 0}     icon="🥑" />
              </View>

              {plan.summary ? (
                <View style={s.assessCard}>
                  <Text style={s.assessBadge}>AI ASSESSMENT</Text>
                  <Text style={s.assessText}>{plan.summary}</Text>
                  {plan.bmi != null && (
                    <View style={s.bmiRow}>
                      <View style={s.bmiChip}><Text style={s.bmiChipText}>BMI {plan.bmi}</Text></View>
                      <Text style={s.bmiCatText}>{plan.bmiCategory || ''}</Text>
                    </View>
                  )}
                </View>
              ) : null}

              <SectionHead title="Today's Meals" action="Full Plan" onAction={() => onNavigate('plan')} />
              {(plan.mealPlan || []).map((m, i) => (
                <View key={i} style={s.mealCard}>
                  <View style={s.mealRow}>
                    <View style={s.mealTimePill}><Text style={s.mealTimePillText}>{m.time || ''}</Text></View>
                    <Text style={s.mealTitle}>{m.meal}</Text>
                    <Text style={s.mealKcal}>{m.calories} kcal</Text>
                  </View>
                  {(m.foods || []).map((f, j) => (
                    <View key={j} style={s.foodItem}>
                      <View style={s.foodBullet} />
                      <Text style={s.foodName}>{f}</Text>
                    </View>
                  ))}
                  <View style={s.mealMacroStrip}>
                    <Text style={s.mmText}>P {m.protein || 0}g</Text>
                    <Text style={s.mmDot}>·</Text>
                    <Text style={s.mmText}>C {m.carbs || 0}g</Text>
                    <Text style={s.mmDot}>·</Text>
                    <Text style={s.mmText}>F {m.fat || 0}g</Text>
                  </View>
                </View>
              ))}

              <SectionHead title="Weekly Workout" action="Full Schedule" onAction={() => onNavigate('plan')} />
              {(plan.workoutPlan || []).map((w, i) => {
                const isToday    = w.day === todayName;
                const isOpen     = expandedDay === i;
                const hasEx      = w.exercises && w.exercises.length > 0;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.workoutCard, isToday && s.workoutCardToday]}
                    onPress={() => hasEx && setExpandedDay(isOpen ? null : i)}
                    activeOpacity={hasEx ? 0.7 : 1}
                  >
                    <View style={s.wkHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={s.wkDayRow}>
                          <Text style={[s.wkDay, isToday && { color: C.green }]}>{w.day}</Text>
                          {isToday && <View style={s.todayIndicator} />}
                        </View>
                        <Text style={s.wkType}>{w.type}</Text>
                      </View>
                      {w.duration ? (
                        <View style={s.durBadge}><Text style={s.durText}>{w.duration}</Text></View>
                      ) : null}
                    </View>
                    {isOpen && hasEx && (
                      <View style={s.exList}>
                        {w.exercises.map((ex, j) => {
                          const o = typeof ex === 'string' ? { name: ex } : ex;
                          return (
                            <View key={j} style={s.exRow}>
                              <Text style={s.exNum}>{j + 1}</Text>
                              <Text style={s.exName}>{o.name}</Text>
                              {o.sets && o.reps ? (
                                <Text style={s.exDetail}>{o.sets}×{o.reps}</Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          ) : (
            <View style={s.emptyHero}>
              <Image source={require('../assets/logo.png')} style={s.emptyLogo} resizeMode="contain" />
              <Text style={s.emptyTitle}>Ready to transform?</Text>
              <Text style={s.emptyDesc}>
                Generate your personalized AI fitness and nutrition plan to get started.
              </Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => onNavigate('coach')}>
                <Text style={s.emptyBtnText}>Generate My Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.waterSection}>
            <View style={s.waterHeader}>
              <Text style={s.waterLabel}>💧  Hydration</Text>
              <Text style={s.waterProgress}>{water} of {WATER_GOAL} glasses</Text>
            </View>
            <View style={s.waterBar}>
              <View style={[s.waterBarFill, { width: `${(water / WATER_GOAL) * 100}%` }]} />
            </View>
            <View style={s.waterDots}>
              {Array.from({ length: WATER_GOAL }).map((_, i) => (
                <View key={i} style={[s.waterDot, i < water && s.waterDotFilled]} />
              ))}
            </View>
            <TouchableOpacity
              style={[s.waterAddBtn, water >= WATER_GOAL && s.waterAddDone]}
              onPress={addWater}
              disabled={water >= WATER_GOAL}
            >
              <Text style={[s.waterAddText, water >= WATER_GOAL && { color: C.muted }]}>
                {water >= WATER_GOAL ? '✓  Goal Complete' : '+  Add Glass'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={s.actionsRow}>
            <ActionCard icon="📸" label="Scan Meal"  onPress={() => onNavigate('scanner')} />
            <ActionCard icon="🤖" label="AI Coach"   onPress={() => onNavigate('coach')} />
            <ActionCard icon="📊" label="Tracker"    onPress={() => onNavigate('tracker')} />
          </View>

        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function StatBadge({ value, label, icon }) {
  return (
    <View style={s.statBadge}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHead({ title, action, onAction }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={s.sectionAction}>{action} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function ActionCard({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={s.actionCard} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.actionCardIcon}>{icon}</Text>
      <Text style={s.actionCardLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6,
  },
  greetText: { color: C.muted, fontSize: 14, fontWeight: '500' },
  nameText:  { color: C.white, fontSize: 22, fontWeight: '900', marginTop: 1 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: C.bg, fontSize: 18, fontWeight: '900' },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, marginHorizontal: 20, marginTop: 14,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 4,
    borderWidth: 1, borderColor: C.border,
  },
  statBadge: { flex: 1, alignItems: 'center' },
  statIcon:  { fontSize: 16, marginBottom: 4 },
  statValue: { color: C.white, fontSize: 18, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: C.border },

  loadingWrap: { alignItems: 'center', paddingVertical: 60 },
  loadingLabel: { color: C.muted, fontSize: 14, marginTop: 16 },

  calorieSection: { alignItems: 'center', marginTop: 24, marginBottom: 8 },
  ringOuter: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
  ringGlow: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    borderWidth: 4, borderColor: C.green + '30',
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 40px rgba(127,255,0,0.15), inset 0 0 40px rgba(127,255,0,0.05)' } : {}),
  },
  ringInner: { alignItems: 'center' },
  ringNum:   { color: C.green, fontSize: 48, fontWeight: '900', letterSpacing: 1 },
  ringLabel: { color: C.muted, fontSize: 12, marginTop: 2, letterSpacing: 1 },

  macroRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, marginBottom: 16 },
  macroCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14,
    marginHorizontal: 4, borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  macroIcon:   { fontSize: 18, marginBottom: 6 },
  macroGrams:  { color: C.white, fontSize: 22, fontWeight: '900' },
  macroTrack:  { width: '100%', height: 4, backgroundColor: C.surface, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  macroFill:   { height: 4, backgroundColor: C.green, borderRadius: 2 },
  macroBottom: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 6 },
  macroLabel:  { color: C.muted, fontSize: 11 },
  macroPct:    { color: C.green, fontSize: 11, fontWeight: '700' },

  assessCard: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: C.card, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: C.border,
  },
  assessBadge:   { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  assessText:    { color: C.light, fontSize: 14, lineHeight: 22 },
  bmiRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  bmiChip:       { backgroundColor: C.greenGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  bmiChipText:   { color: C.green, fontSize: 12, fontWeight: '800' },
  bmiCatText:    { color: C.mutedLight, fontSize: 13, marginLeft: 8 },

  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 10, marginTop: 12,
  },
  sectionTitle:  { color: C.white, fontSize: 16, fontWeight: '800' },
  sectionAction: { color: C.green, fontSize: 13, fontWeight: '700' },

  mealCard: {
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  mealRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  mealTimePill: { backgroundColor: C.greenGlow2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 10 },
  mealTimePillText: { color: C.green, fontSize: 10, fontWeight: '700' },
  mealTitle: { color: C.white, fontWeight: '800', fontSize: 14, flex: 1 },
  mealKcal:  { color: C.green, fontWeight: '700', fontSize: 13 },
  foodItem:  { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: 2 },
  foodBullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.green + '60', marginRight: 10 },
  foodName:  { color: C.mutedLight, fontSize: 13, flex: 1 },
  mealMacroStrip: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  mmText:    { color: C.muted, fontSize: 11, fontWeight: '600' },
  mmDot:     { color: C.border, fontSize: 11, marginHorizontal: 6 },

  workoutCard: {
    marginHorizontal: 20, marginBottom: 6,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  workoutCardToday: { borderColor: C.green + '35' },
  wkHeader:  { flexDirection: 'row', alignItems: 'center' },
  wkDayRow:  { flexDirection: 'row', alignItems: 'center' },
  wkDay:     { color: C.white, fontSize: 14, fontWeight: '800' },
  todayIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginLeft: 8 },
  wkType:    { color: C.muted, fontSize: 12, marginTop: 1 },
  durBadge:  { backgroundColor: C.greenGlow2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  durText:   { color: C.green, fontSize: 11, fontWeight: '700' },
  exList:    { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  exRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  exNum:     { color: C.green, fontSize: 11, fontWeight: '800', width: 20 },
  exName:    { color: C.light, fontSize: 13, flex: 1 },
  exDetail:  { color: C.green, fontSize: 12, fontWeight: '700' },

  emptyHero: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20,
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  emptyLogo:  { width: 64, height: 64, marginBottom: 20 },
  emptyTitle: { color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 10 },
  emptyDesc:  { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 280 },
  emptyBtn:   { backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 36, borderRadius: 14 },
  emptyBtnText: { color: C.bg, fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

  waterSection: {
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: C.card, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: C.border,
  },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  waterLabel: { color: C.white, fontWeight: '800', fontSize: 14 },
  waterProgress: { color: C.muted, fontSize: 12 },
  waterBar: { height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  waterBarFill: { height: 6, backgroundColor: C.green, borderRadius: 3 },
  waterDots: { flexDirection: 'row', marginBottom: 12 },
  waterDot: {
    flex: 1, height: 6, borderRadius: 3, marginHorizontal: 2,
    backgroundColor: C.surface,
  },
  waterDotFilled: { backgroundColor: C.green },
  waterAddBtn: {
    backgroundColor: C.greenGlow2, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  waterAddDone: { backgroundColor: C.surface },
  waterAddText: { color: C.green, fontWeight: '800', fontSize: 13 },

  actionsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16 },
  actionCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, paddingVertical: 20,
    alignItems: 'center', marginHorizontal: 4,
    borderWidth: 1, borderColor: C.border,
  },
  actionCardIcon:  { fontSize: 24, marginBottom: 6 },
  actionCardLabel: { color: C.mutedLight, fontSize: 12, fontWeight: '700' },
});
