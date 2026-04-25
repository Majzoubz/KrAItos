import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { Storage, KEYS } from '../utils/storage';
import { callAI, parseJSON } from '../utils/api';

const CACHE_KEY = (uid) => 'grocerylist_v1_' + (uid || 'anon');

const CATEGORY_ORDER = ['Produce', 'Protein', 'Dairy', 'Pantry', 'Grains', 'Frozen', 'Bakery', 'Other'];

export default function GroceryListScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const { isRTL } = useI18n();
  const s = makeStyles(C);
  const [plan, setPlan] = useState(null);
  const [list, setList] = useState(null); // { Produce: [{name, qty, checked}], ... }
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const uid = user.email || user.uid;

  const load = useCallback(async () => {
    setLoading(true);
    const [p, cached] = await Promise.all([
      Storage.get(KEYS.PLAN(uid)),
      Storage.get(CACHE_KEY(uid)),
    ]);
    setPlan(p);
    if (cached && cached.list && cached.planAdaptedAt === (p?.adaptedAt || p?.generatedAt)) {
      setList(cached.list);
    } else {
      setList(null);
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!plan?.mealPlan?.length) {
      Alert.alert('No meal plan', 'Generate a plan from the Home screen first.');
      return;
    }
    const allItems = plan.mealPlan.flatMap(m => (m.foods || []).map(f => `${m.meal}: ${f}`));
    if (allItems.length === 0) {
      setError('Your meal plan has meals but no foods listed. Try regenerating your plan from Home.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const sys = 'You are a meal planning assistant. Convert a list of meal foods (with portion strings like "2 eggs", "1 cup rice") into a consolidated weekly grocery list. Multiply portions by 7 days where appropriate. Group identical items. Categorize each item into one of: Produce, Protein, Dairy, Pantry, Grains, Frozen, Bakery, Other. Return ONLY valid JSON with this exact shape: {"categories":{"Produce":[{"name":"Spinach","qty":"2 bags"}],"Protein":[{"name":"Chicken breast","qty":"3 lbs"}]}}. No markdown, no commentary.';
      const raw = await callAI(sys, 'Build my weekly grocery list from these planned foods (assume 7 days):\n' + allItems.join('\n'));
      const parsed = parseJSON(raw, null);
      if (!parsed?.categories) {
        console.warn('[Grocery] AI response did not contain "categories":', raw?.slice(0, 400));
        throw new Error('AI returned an unexpected format. Tap Generate again — sometimes it needs a second try.');
      }
      // Normalize into our shape
      const normalized = {};
      for (const cat of Object.keys(parsed.categories)) {
        const items = parsed.categories[cat] || [];
        normalized[cat] = items.map(it => ({
          name: it.name || it.item || '?',
          qty:  it.qty  || it.quantity || '',
          checked: false,
        }));
      }
      setList(normalized);
      await Storage.set(CACHE_KEY(uid), {
        list: normalized,
        planAdaptedAt: plan.adaptedAt || plan.generatedAt,
        generatedAt: Date.now(),
      });
    } catch (e) {
      setError(e.message || 'Could not generate grocery list.');
    } finally {
      setGenerating(false);
    }
  };

  const toggle = async (cat, idx) => {
    const next = { ...list };
    next[cat] = next[cat].map((it, i) => i === idx ? { ...it, checked: !it.checked } : it);
    setList(next);
    try {
      await Storage.set(CACHE_KEY(uid), {
        list: next,
        planAdaptedAt: plan.adaptedAt || plan.generatedAt,
        generatedAt: Date.now(),
      });
    } catch {}
  };

  const totalItems = list ? Object.values(list).reduce((a, arr) => a + arr.length, 0) : 0;
  const checkedItems = list ? Object.values(list).reduce((a, arr) => a + arr.filter(x => x.checked).length, 0) : 0;

  const orderedCats = list
    ? [
        ...CATEGORY_ORDER.filter(c => list[c]),
        ...Object.keys(list).filter(c => !CATEGORY_ORDER.includes(c)),
      ]
    : [];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => onNavigate('foodlog')} style={s.backBtn}>
          <Text style={s.backText}>{isRTL ? '› Back' : '‹ Back'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titleBarText}>Grocery list</Text>
          <Text style={s.titleBarSub}>
            {list ? `${checkedItems}/${totalItems} checked off` : 'Generated from your meal plan'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loading && <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />}

        {!loading && !plan && (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No meal plan yet</Text>
            <Text style={s.emptyText}>Generate a plan from the Home screen first.</Text>
            <TouchableOpacity style={s.cta} onPress={() => onNavigate('home')}>
              <Text style={s.ctaText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && plan && !list && !generating && (() => {
          const mealCount = plan?.mealPlan?.length || 0;
          const foodCount = (plan?.mealPlan || []).reduce((a, m) => a + (m.foods?.length || 0), 0);
          const hasFoods = foodCount > 0;
          return (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>🛒</Text>
              <Text style={s.emptyTitle}>Build your grocery list</Text>
              <Text style={s.emptyText}>
                {hasFoods
                  ? `We'll consolidate ${foodCount} foods from ${mealCount} meals, multiply for 7 days, and group by aisle.`
                  : 'Your meal plan has no foods listed yet. Regenerate your plan from Home first.'}
              </Text>
              <TouchableOpacity
                style={[s.cta, !hasFoods && { opacity: 0.4 }]}
                onPress={generate}
                disabled={!hasFoods}
              >
                <Text style={s.ctaText}>Generate list</Text>
              </TouchableOpacity>
              {error && <Text style={s.error}>{error}</Text>}
            </View>
          );
        })()}

        {generating && (
          <View style={s.emptyBox}>
            <ActivityIndicator color={C.green} size="large" style={{ marginBottom: 16 }} />
            <Text style={s.emptyTitle}>Building your list…</Text>
            <Text style={s.emptyText}>Consolidating ingredients and grouping by category.</Text>
          </View>
        )}

        {list && orderedCats.map(cat => (
          <View key={cat} style={s.section}>
            <Text style={s.sectionTitle}>{cat}</Text>
            {list[cat].map((it, i) => (
              <TouchableOpacity
                key={i}
                style={s.row}
                onPress={() => toggle(cat, i)}
                activeOpacity={0.8}
              >
                <View style={[s.checkbox, it.checked && s.checkboxOn]}>
                  {it.checked && <Text style={s.checkmark}>✓</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemName, it.checked && s.itemNameChecked]}>{it.name}</Text>
                  {!!it.qty && <Text style={s.itemQty}>{it.qty}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {list && (
          <TouchableOpacity style={s.regenBtn} onPress={generate} disabled={generating}>
            <Text style={s.regenBtnText}>↻ Regenerate from latest plan</Text>
          </TouchableOpacity>
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
  emptyBox: {
    backgroundColor: C.card, borderRadius: 18, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: C.border, marginTop: 20,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { color: C.white, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  emptyText: { color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  cta: { backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  ctaText: { color: C.bg, fontWeight: '900', fontSize: 14 },
  error: { color: C.danger, fontSize: 12, marginTop: 12, textAlign: 'center' },
  section: { marginBottom: 18 },
  sectionTitle: {
    color: C.green, fontSize: 11, fontWeight: '900',
    letterSpacing: 2, marginBottom: 8, paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 6,
    borderWidth: 1, borderColor: C.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: C.muted,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  checkboxOn: { backgroundColor: C.green, borderColor: C.green },
  checkmark: { color: C.bg, fontSize: 13, fontWeight: '900' },
  itemName: { color: C.white, fontSize: 14, fontWeight: '700' },
  itemNameChecked: { color: C.muted, textDecorationLine: 'line-through' },
  itemQty: { color: C.muted, fontSize: 11, marginTop: 2 },
  regenBtn: {
    borderWidth: 1.5, borderColor: C.border,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 10,
  },
  regenBtnText: { color: C.muted, fontSize: 13, fontWeight: '700' },
});
