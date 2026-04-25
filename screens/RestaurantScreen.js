import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { Storage, KEYS } from '../utils/storage';
import { callAI, parseJSON } from '../utils/api';

const TODAY = new Date().toDateString();

const CHAINS = [
  { name: 'Chipotle',     icon: '🌯' },
  { name: 'Subway',       icon: '🥪' },
  { name: 'Starbucks',    icon: '☕' },
  { name: 'McDonald\'s',  icon: '🍟' },
  { name: 'Chick-fil-A',  icon: '🐔' },
  { name: 'Panera',       icon: '🥗' },
  { name: 'Sweetgreen',   icon: '🥬' },
  { name: 'Wendy\'s',     icon: '🍔' },
  { name: 'Taco Bell',    icon: '🌮' },
  { name: 'Domino\'s',    icon: '🍕' },
  { name: 'Five Guys',    icon: '🍔' },
  { name: 'Shake Shack',  icon: '🥤' },
];

export default function RestaurantScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const { isRTL } = useI18n();
  const s = makeStyles(C);
  const [plan, setPlan] = useState(null);
  const [foodLog, setFoodLog] = useState([]);
  const [chain, setChain] = useState(null);
  const [customChain, setCustomChain] = useState('');
  const [picks, setPicks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uid = user.email || user.uid;

  const loadCtx = useCallback(async () => {
    const [p, log] = await Promise.all([
      Storage.get(KEYS.PLAN(uid)),
      Storage.get(KEYS.FOODLOG(user.uid, TODAY)),
    ]);
    setPlan(p);
    setFoodLog(log || []);
  }, [uid, user.uid]);

  useEffect(() => { loadCtx(); }, [loadCtx]);

  const totals = foodLog.reduce((a, x) => ({
    cal: a.cal + (x.calories || 0),
    pro: a.pro + (x.protein || 0),
    car: a.car + (x.carbs || 0),
    fat: a.fat + (x.fat || 0),
  }), { cal: 0, pro: 0, car: 0, fat: 0 });

  const target = {
    cal: plan?.dailyCalories || 2000,
    pro: plan?.protein || 150,
    car: plan?.carbs || 200,
    fat: plan?.fat || 65,
  };

  const remaining = {
    cal: Math.max(0, target.cal - totals.cal),
    pro: Math.max(0, target.pro - totals.pro),
    car: Math.max(0, target.car - totals.car),
    fat: Math.max(0, target.fat - totals.fat),
  };

  const fetchPicks = async (chainName) => {
    setLoading(true);
    setError(null);
    setPicks(null);
    setChain(chainName);
    try {
      const sys = 'You are a nutrition expert who knows fast food and restaurant chain menus by heart. Given a chain and the user\'s remaining macros for the day, return the 4 best menu options that fit. Each option should be a real, orderable item. Include any modifications (e.g. "no mayo", "double protein"). Return ONLY valid JSON: {"picks":[{"name":"item name","mods":"optional modifications","calories":number,"protein":number,"carbs":number,"fat":number,"why":"1 sentence why this fits"}]}. No markdown.';
      const userMsg = `Chain: ${chainName}. My remaining macros for today: ${remaining.cal} kcal, ${remaining.pro}g protein, ${remaining.car}g carbs, ${remaining.fat}g fat. Goal: ${plan?.userProfile?.goal || 'general fitness'}.`;
      const raw = await callAI(sys, userMsg);
      const parsed = parseJSON(raw, null);
      if (!parsed?.picks?.length) throw new Error('No picks returned. Try another chain.');
      setPicks(parsed.picks);
    } catch (e) {
      setError(e.message || 'Could not get menu picks.');
    } finally {
      setLoading(false);
    }
  };

  const logPick = async (pick) => {
    const entry = {
      id: Date.now(),
      name: `${chain} · ${pick.name}` + (pick.mods ? ` (${pick.mods})` : ''),
      mealTime: 'Lunch',
      calories: pick.calories || 0,
      protein:  pick.protein  || 0,
      carbs:    pick.carbs    || 0,
      fat:      pick.fat      || 0,
      addedAt: Date.now(),
      source: 'restaurant',
    };
    const updated = [...foodLog, entry];
    setFoodLog(updated);
    try {
      await Storage.set(KEYS.FOODLOG(user.uid, TODAY), updated);
      Alert.alert('Logged', `${pick.name} added to today's log.`);
    } catch {
      Alert.alert('Error', 'Could not save to log.');
    }
  };

  const submitCustom = () => {
    const c = customChain.trim();
    if (!c) return;
    fetchPicks(c);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => onNavigate('foodlog')} style={s.backBtn}>
          <Text style={s.backText}>{isRTL ? '› Back' : '‹ Back'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titleBarText}>Restaurant mode</Text>
          <Text style={s.titleBarSub}>{remaining.cal} kcal · {remaining.pro}g P left today</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Pick a chain</Text>
        <View style={s.grid}>
          {CHAINS.map(c => (
            <TouchableOpacity
              key={c.name}
              style={[s.chip, chain === c.name && s.chipActive]}
              onPress={() => fetchPicks(c.name)}
              activeOpacity={0.85}
            >
              <Text style={s.chipIcon}>{c.icon}</Text>
              <Text style={[s.chipText, chain === c.name && s.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>Or type any restaurant</Text>
        <View style={{ flexDirection: 'row' }}>
          <TextInput
            style={s.input}
            placeholder="e.g. In-N-Out"
            placeholderTextColor={C.muted}
            value={customChain}
            onChangeText={setCustomChain}
            onSubmitEditing={submitCustom}
            returnKeyType="search"
          />
          <TouchableOpacity style={s.goBtn} onPress={submitCustom} activeOpacity={0.85}>
            <Text style={s.goBtnText}>Go</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={s.loadingBox}>
            <ActivityIndicator color={C.green} size="large" />
            <Text style={s.loadingText}>Finding the best macro fit at {chain}…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={[s.loadingBox, { backgroundColor: C.danger + '20' }]}>
            <Text style={[s.loadingText, { color: C.danger }]}>{error}</Text>
          </View>
        )}

        {picks && !loading && (
          <View style={{ marginTop: 18 }}>
            <Text style={s.picksLabel}>Best picks at {chain}</Text>
            {picks.map((p, i) => (
              <View key={i} style={s.pickCard}>
                <View style={s.pickHeader}>
                  <Text style={s.pickName} numberOfLines={2}>{p.name}</Text>
                  <Text style={s.pickCal}>{p.calories} kcal</Text>
                </View>
                {!!p.mods && <Text style={s.pickMods}>↳ {p.mods}</Text>}
                <View style={s.pickMacros}>
                  <Text style={s.pickMacro}>P {p.protein}g</Text>
                  <Text style={s.pickMacro}>C {p.carbs}g</Text>
                  <Text style={s.pickMacro}>F {p.fat}g</Text>
                </View>
                {!!p.why && <Text style={s.pickWhy}>{p.why}</Text>}
                <TouchableOpacity style={s.logBtn} onPress={() => logPick(p)} activeOpacity={0.85}>
                  <Text style={s.logBtnText}>+ Log it</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { paddingRight: 12 },
  backText: { color: C.green, fontSize: 16, fontWeight: '800' },
  titleBarText: { color: C.white, fontSize: 18, fontWeight: '900' },
  titleBarSub: { color: C.muted, fontSize: 11, marginTop: 1 },
  scroll: { padding: 16, paddingBottom: 60 },
  label: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1, borderColor: C.border,
    marginHorizontal: 4, marginBottom: 8,
  },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipIcon: { fontSize: 18, marginRight: 6 },
  chipText: { color: C.white, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: C.bg, fontWeight: '900' },

  input: {
    flex: 1, backgroundColor: C.card, borderRadius: 12,
    padding: 12, color: C.white, fontSize: 14,
    borderWidth: 1, borderColor: C.border, marginRight: 8,
  },
  goBtn: { backgroundColor: C.green, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12 },
  goBtnText: { color: C.bg, fontSize: 14, fontWeight: '900' },

  loadingBox: {
    backgroundColor: C.card, borderRadius: 16, padding: 24,
    alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: C.border,
  },
  loadingText: { color: C.muted, fontSize: 13, marginTop: 12, textAlign: 'center' },

  picksLabel: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },
  pickCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  pickHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pickName: { color: C.white, fontSize: 15, fontWeight: '800', flex: 1, marginRight: 8 },
  pickCal: { color: C.green, fontSize: 14, fontWeight: '900' },
  pickMods: { color: C.mutedLight, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  pickMacros: { flexDirection: 'row', marginTop: 8 },
  pickMacro: { color: C.muted, fontSize: 12, fontWeight: '700', marginRight: 14 },
  pickWhy: { color: C.mutedLight, fontSize: 12, marginTop: 8, lineHeight: 18 },
  logBtn: {
    backgroundColor: C.green, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', marginTop: 10,
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 10px rgba(127,255,0,0.2)' } : {}),
  },
  logBtnText: { color: C.bg, fontWeight: '900', fontSize: 13 },
});
