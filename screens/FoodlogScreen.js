import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';
import { callAI, parseJSON } from '../utils/api';

const { width } = Dimensions.get('window');
const TODAY = new Date().toDateString();

const MEAL_TIMES = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Snack'];

export default function FoodLogScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [log, setLog]               = useState([]);
  const [plan, setPlan]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [mealName, setMealName]     = useState('');
  const [calories, setCalories]     = useState('');
  const [protein, setProtein]       = useState('');
  const [carbs, setCarbs]           = useState('');
  const [fat, setFat]               = useState('');
  const [mealTime, setMealTime]     = useState('Breakfast');
  const [selectedDate, setSelectedDate] = useState(TODAY);

  const FOOD_KEY = KEYS.FOODLOG(user.uid, selectedDate);

  const load = useCallback(async () => {
    setLoading(true);
    const [logData, planData] = await Promise.all([
      Storage.get(KEYS.FOODLOG(user.uid, selectedDate)),
      Storage.get(KEYS.PLAN(user.email || user.uid)),
    ]);
    setLog(logData || []);
    setPlan(planData);
    setAiFeedback(null);
    setLoading(false);
  }, [selectedDate, user.uid, user.email]);

  useEffect(() => { load(); }, [load]);

  // Totals
  const totals = log.reduce((acc, item) => ({
    calories: acc.calories + (item.calories || 0),
    protein:  acc.protein  + (item.protein  || 0),
    carbs:    acc.carbs    + (item.carbs    || 0),
    fat:      acc.fat      + (item.fat      || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const target = {
    calories: plan?.dailyCalories || 2000,
    protein:  plan?.protein       || 150,
    carbs:    plan?.carbs         || 200,
    fat:      plan?.fat           || 65,
  };

  const pct = (val, max) => Math.min((val / max) * 100, 100);
  const remaining = target.calories - totals.calories;

  const addEntry = async () => {
    if (!mealName.trim()) { Alert.alert('Enter meal name'); return; }
    if (!calories || isNaN(parseInt(calories))) { Alert.alert('Enter valid calories'); return; }
    const entry = {
      id: Date.now(),
      name: mealName.trim(),
      mealTime,
      calories: parseInt(calories) || 0,
      protein:  parseFloat(protein)  || 0,
      carbs:    parseFloat(carbs)    || 0,
      fat:      parseFloat(fat)      || 0,
      addedAt: Date.now(),
      source: 'manual',
    };
    const updated = [...log, entry];
    await Storage.set(FOOD_KEY, updated);
    setLog(updated);
    setMealName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
    setShowAdd(false);
  };

  const deleteEntry = async (id) => {
    Alert.alert('Remove item', 'Remove this entry from your log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = log.filter(e => e.id !== id);
        await Storage.set(FOOD_KEY, updated);
        setLog(updated);
      }},
    ]);
  };

  const getAIFeedback = async () => {
    if (log.length === 0) { Alert.alert('No meals logged', 'Add some meals first.'); return; }
    setAiLoading(true);
    try {
      const summary = log.map(e =>
        e.name + ' (' + e.calories + ' kcal, P:' + e.protein + 'g C:' + e.carbs + 'g F:' + e.fat + 'g)'
      ).join(', ');
      const raw = await callAI(
        'You are a professional nutritionist. Analyze a user\'s daily food log and return ONLY valid JSON: {"score":number1to10,"title":"short verdict","summary":"2-3 sentence assessment","positives":["good thing 1","good thing 2"],"improvements":["suggestion 1","suggestion 2"],"tomorrowTip":"one actionable tip for tomorrow"}',
        'Daily log: ' + summary + '. Targets: ' + target.calories + ' kcal, ' + target.protein + 'g protein, ' + target.carbs + 'g carbs, ' + target.fat + 'g fat. Total eaten: ' + totals.calories + ' kcal, ' + totals.protein + 'g protein, ' + totals.carbs + 'g carbs, ' + totals.fat + 'g fat.'
      );
      const parsed = parseJSON(raw, null);
      if (parsed) setAiFeedback(parsed);
      else Alert.alert('Error', 'Could not get AI feedback. Try again.');
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not reach AI.');
    } finally {
      setAiLoading(false);
    }
  };

  // Date navigation
  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toDateString());
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    if (d <= new Date()) setSelectedDate(d.toDateString());
  };
  const isToday = selectedDate === TODAY;

  const scoreColor = aiFeedback
    ? aiFeedback.score >= 7 ? C.green : aiFeedback.score >= 5 ? C.orange : C.danger
    : C.green;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Nutrition</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(!showAdd)}>
          <Text style={s.addBtnText}>{showAdd ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      {/* Date nav */}
      <View style={s.dateNav}>
        <TouchableOpacity style={s.dateArrow} onPress={goToPrevDay}>
          <Text style={s.dateArrowText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.dateLabel}>
          {isToday ? 'Today' : new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>
        <TouchableOpacity style={[s.dateArrow, isToday && { opacity: 0.3 }]} onPress={goToNextDay} disabled={isToday}>
          <Text style={s.dateArrowText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {loading && <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />}

        {!loading && (
          <>
            {/* AI Meal Studio CTA */}
            <TouchableOpacity
              onPress={() => onNavigate('mealstudio')}
              activeOpacity={0.85}
              style={s.studioCard}
            >
              <View style={s.studioBadge}>
                <Text style={{ color: C.bg, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>NEW</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.studioTitle}>✨ AI Meal Studio</Text>
                <Text style={s.studioSub}>
                  Cook from your pantry · Plan a week from groceries · Scan your fridge
                </Text>
              </View>
              <Text style={s.studioArrow}>→</Text>
            </TouchableOpacity>

            {/* Quick Add Form */}
            {showAdd && (
              <View style={s.addForm}>
                <Text style={s.addFormTitle}>Add Meal Entry</Text>

                <Text style={s.label}>Meal Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mealTimeRow}>
                  {MEAL_TIMES.map(mt => (
                    <TouchableOpacity key={mt} style={[s.mealTimeChip, mealTime === mt && s.mealTimeChipActive]}
                      onPress={() => setMealTime(mt)}>
                      <Text style={[s.mealTimeText, mealTime === mt && s.mealTimeTextActive]}>{mt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={s.label}>What did you eat?</Text>
                <TextInput style={s.input} placeholder="e.g. Grilled chicken with rice"
                  placeholderTextColor={C.muted} value={mealName} onChangeText={setMealName} />

                <View style={s.macroRow}>
                  <View style={s.macroInput}>
                    <Text style={s.macroInputLabel}>Calories *</Text>
                    <TextInput style={s.input} placeholder="kcal" placeholderTextColor={C.muted}
                      value={calories} onChangeText={setCalories} keyboardType="numeric" />
                  </View>
                  <View style={s.macroInput}>
                    <Text style={s.macroInputLabel}>Protein (g)</Text>
                    <TextInput style={s.input} placeholder="0" placeholderTextColor={C.muted}
                      value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
                  </View>
                </View>
                <View style={s.macroRow}>
                  <View style={s.macroInput}>
                    <Text style={s.macroInputLabel}>Carbs (g)</Text>
                    <TextInput style={s.input} placeholder="0" placeholderTextColor={C.muted}
                      value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
                  </View>
                  <View style={s.macroInput}>
                    <Text style={s.macroInputLabel}>Fat (g)</Text>
                    <TextInput style={s.input} placeholder="0" placeholderTextColor={C.muted}
                      value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
                  </View>
                </View>

                <TouchableOpacity style={s.submitBtn} onPress={addEntry}>
                  <Text style={s.submitBtnText}>Add to Log</Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[s.scanBtn, { flex: 1 }]} onPress={() => { setShowAdd(false); onNavigate('scanner'); }}>
                    <Text style={s.scanBtnText}>📷 Photo scan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.scanBtn, { flex: 1 }]} onPress={() => { setShowAdd(false); onNavigate('barcode'); }}>
                    <Text style={s.scanBtnText}>📊 Barcode</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Summary Card */}
            <View style={s.summaryCard}>
              <View style={s.summaryTop}>
                <View style={s.calorieCircle}>
                  <Text style={s.calorieCircleNum}>{totals.calories}</Text>
                  <Text style={s.calorieCircleLabel}>eaten</Text>
                </View>
                <View style={s.calorieSide}>
                  <View style={s.calRow}>
                    <Text style={s.calRowLabel}>Target</Text>
                    <Text style={s.calRowVal}>{target.calories} kcal</Text>
                  </View>
                  <View style={s.calRow}>
                    <Text style={s.calRowLabel}>{remaining >= 0 ? 'Remaining' : 'Over by'}</Text>
                    <Text style={[s.calRowVal, { color: remaining >= 0 ? C.green : C.danger }]}>
                      {Math.abs(remaining)} kcal
                    </Text>
                  </View>
                  <View style={s.calRow}>
                    <Text style={s.calRowLabel}>Meals logged</Text>
                    <Text style={s.calRowVal}>{log.length}</Text>
                  </View>
                </View>
              </View>
              <View style={s.progressBg}>
                <View style={[s.progressFill, {
                  width: pct(totals.calories, target.calories) + '%',
                  backgroundColor: totals.calories > target.calories ? C.danger : C.green,
                }]} />
              </View>
              <Text style={s.progressLabel}>
                {Math.round(pct(totals.calories, target.calories))}% of daily target
              </Text>
            </View>

            {/* Macro breakdown */}
            <View style={s.macrosCard}>
              {[
                ['Protein', totals.protein, target.protein, 'g', C.blue],
                ['Carbs',   totals.carbs,   target.carbs,   'g', C.orange],
                ['Fat',     totals.fat,     target.fat,     'g', C.purple],
              ].map(([label, val, tgt, unit, color]) => (
                <View key={label} style={s.macroBarItem}>
                  <View style={s.macroBarHeader}>
                    <Text style={s.macroBarLabel}>{label}</Text>
                    <Text style={s.macroBarVal}>
                      <Text style={{ color }}>{Math.round(val)}</Text>
                      <Text style={s.macroBarTarget}> / {tgt}{unit}</Text>
                    </Text>
                  </View>
                  <View style={s.macroBarBg}>
                    <View style={[s.macroBarFill, {
                      width: pct(val, tgt) + '%',
                      backgroundColor: val > tgt ? C.danger : color,
                    }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* No plan warning */}
            {!plan && (
              <TouchableOpacity style={s.noPlanBanner} onPress={() => onNavigate('home')}>
                <Text style={s.noPlanText}>No plan yet - targets are estimates. Tap to generate your plan.</Text>
              </TouchableOpacity>
            )}

            {/* Nutrition Plan (from AI plan) */}
            {plan && Array.isArray(plan.mealPlan) && plan.mealPlan.length > 0 && (
              <View style={s.planSection}>
                <Text style={s.sectionTitle}>Your Nutrition Plan</Text>
                {plan.mealPlan.map((m, i) => (
                  <View key={i} style={s.planMealCard}>
                    <View style={s.planMealHeader}>
                      {m.time && (
                        <View style={s.planMealTimeBadge}>
                          <Text style={s.planMealTimeText}>{m.time}</Text>
                        </View>
                      )}
                      <Text style={s.planMealName}>{m.meal}</Text>
                      <Text style={s.planMealCal}>{m.calories} kcal</Text>
                    </View>
                    {(m.foods || []).map((f, j) => (
                      <View key={j} style={s.planFoodRow}>
                        <View style={s.planFoodDot} />
                        <Text style={s.planFoodText}>{f}</Text>
                      </View>
                    ))}
                    {(m.protein || m.carbs || m.fat) && (
                      <View style={s.planMealMacros}>
                        <Text style={s.planMealMacroText}>P: {m.protein || 0}g</Text>
                        <Text style={s.planMealMacroText}>C: {m.carbs || 0}g</Text>
                        <Text style={s.planMealMacroText}>F: {m.fat || 0}g</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Meals list */}
            {log.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>Nothing logged yet</Text>
                <Text style={s.emptyText}>
                  {isToday
                    ? 'Tap + Add to log a meal, or scan a plate from the Scanner tab.'
                    : 'No meals were logged on this day.'}
                </Text>
                {isToday && (
                  <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)}>
                    <Text style={s.emptyBtnText}>+ Log First Meal</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={s.sectionTitle}>
                  {isToday ? "Today's Meals" : 'Meals'}
                </Text>
                {MEAL_TIMES.map(mt => {
                  const items = log.filter(e => e.mealTime === mt);
                  if (items.length === 0) return null;
                  return (
                    <View key={mt}>
                      <Text style={s.mealTimeHeader}>{mt}</Text>
                      {items.map(item => (
                        <TouchableOpacity
                          key={item.id}
                          style={[s.logItem, item.source === 'scanner' && s.logItemScanned]}
                          onLongPress={() => deleteEntry(item.id)}
                        >
                          <View style={s.logItemLeft}>
                            <Text style={s.logItemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={s.logItemMacros}>
                              P:{Math.round(item.protein)}g  C:{Math.round(item.carbs)}g  F:{Math.round(item.fat)}g
                              {item.source === 'scanner' && '  (scanned)'}
                            </Text>
                          </View>
                          <Text style={s.logItemCal}>{item.calories} kcal</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })}
                <Text style={s.deleteHint}>Long press any meal to remove it</Text>
              </>
            )}

            {/* AI Feedback */}
            {isToday && log.length > 0 && (
              <View style={s.aiFeedbackSection}>
                {!aiFeedback ? (
                  <TouchableOpacity
                    style={[s.aiBtn, aiLoading && { opacity: 0.6 }]}
                    onPress={getAIFeedback}
                    disabled={aiLoading}
                  >
                    {aiLoading
                      ? <><ActivityIndicator color={C.bg} /><Text style={[s.aiBtnText, { marginLeft: 8 }]}>Analyzing your day...</Text></>
                      : <Text style={s.aiBtnText}>Get AI Nutrition Feedback</Text>
                    }
                  </TouchableOpacity>
                ) : (
                  <View style={s.feedbackCard}>
                    <View style={s.feedbackHeader}>
                      <View style={[s.scoreCircle, { borderColor: scoreColor }]}>
                        <Text style={[s.scoreNum, { color: scoreColor }]}>{aiFeedback.score}</Text>
                        <Text style={s.scoreDen}>/10</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={s.feedbackTitle}>{aiFeedback.title}</Text>
                        <Text style={s.feedbackSummary}>{aiFeedback.summary}</Text>
                      </View>
                    </View>

                    {aiFeedback.positives?.length > 0 && (
                      <View style={s.feedbackSection}>
                        <Text style={s.feedbackSectionTitle}>What you did well</Text>
                        {aiFeedback.positives.map((p, i) => (
                          <View key={i} style={s.feedbackRow}>
                            <View style={[s.feedbackDot, { backgroundColor: C.green }]} />
                            <Text style={s.feedbackText}>{p}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {aiFeedback.improvements?.length > 0 && (
                      <View style={s.feedbackSection}>
                        <Text style={s.feedbackSectionTitle}>What to improve</Text>
                        {aiFeedback.improvements.map((p, i) => (
                          <View key={i} style={s.feedbackRow}>
                            <View style={[s.feedbackDot, { backgroundColor: C.orange }]} />
                            <Text style={s.feedbackText}>{p}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {aiFeedback.tomorrowTip && (
                      <View style={s.tomorrowTip}>
                        <Text style={s.tomorrowTipTitle}>Tip for tomorrow</Text>
                        <Text style={s.tomorrowTipText}>{aiFeedback.tomorrowTip}</Text>
                      </View>
                    )}

                    <TouchableOpacity onPress={() => setAiFeedback(null)} style={s.refreshFeedback}>
                      <Text style={s.refreshFeedbackText}>Refresh feedback</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  addBtn: { backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  addBtnText: { color: C.bg, fontWeight: '900', fontSize: 13 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  dateArrow: { width: 32, height: 32, backgroundColor: C.surface, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dateArrowText: { color: C.white, fontWeight: '900', fontSize: 16 },
  dateLabel: { color: C.white, fontWeight: '800', fontSize: 15 },
  scroll: { padding: 16, paddingBottom: 40 },
  studioCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 14,
    borderWidth: 1.5, borderColor: C.green + '60',
    shadowColor: C.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.18, shadowRadius: 14,
  },
  studioBadge: {
    backgroundColor: C.green, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginRight: 12,
  },
  studioTitle: { color: C.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  studioSub:   { color: C.muted, fontSize: 11, marginTop: 3, lineHeight: 15 },
  studioArrow: { color: C.green, fontSize: 22, fontWeight: '900', marginLeft: 8 },
  addForm: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  addFormTitle: { color: C.white, fontWeight: '900', fontSize: 15, marginBottom: 14 },
  label: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  mealTimeRow: { marginBottom: 14 },
  mealTimeChip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.surface, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: C.border },
  mealTimeChipActive: { backgroundColor: C.green, borderColor: C.green },
  mealTimeText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  mealTimeTextActive: { color: C.bg },
  macroRow: { flexDirection: 'row' },
  macroInput: { flex: 1, marginRight: 8 },
  macroInputLabel: { color: C.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  submitBtn: { backgroundColor: C.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  submitBtnText: { color: C.bg, fontWeight: '900', fontSize: 15 },
  scanBtn: { paddingVertical: 12, alignItems: 'center' },
  scanBtnText: { color: C.green, fontSize: 13, fontWeight: '600' },
  summaryCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  calorieCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  calorieCircleNum: { color: C.green, fontSize: 22, fontWeight: '900' },
  calorieCircleLabel: { color: C.muted, fontSize: 11 },
  calorieSide: { flex: 1 },
  calRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calRowLabel: { color: C.muted, fontSize: 13 },
  calRowVal: { color: C.white, fontWeight: '700', fontSize: 13 },
  progressBg: { height: 8, backgroundColor: C.surface, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabel: { color: C.muted, fontSize: 11, textAlign: 'right' },
  macrosCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  macroBarItem: { marginBottom: 12 },
  macroBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  macroBarLabel: { color: C.muted, fontSize: 13 },
  macroBarVal: { fontSize: 13, fontWeight: '700', color: C.white },
  macroBarTarget: { color: C.muted, fontWeight: '400' },
  macroBarBg: { height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 3 },
  noPlanBanner: { backgroundColor: C.orange + '18', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: C.orange },
  noPlanText: { color: C.orange, fontSize: 12, lineHeight: 18 },
  planSection: { marginBottom: 16 },
  planMealCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  planMealHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  planMealTimeBadge: { backgroundColor: C.greenGlow2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 10 },
  planMealTimeText: { color: C.green, fontSize: 10, fontWeight: '700' },
  planMealName: { color: C.white, fontWeight: '800', fontSize: 15, flex: 1 },
  planMealCal: { color: C.green, fontWeight: '700', fontSize: 13 },
  planFoodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  planFoodDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.green, marginRight: 10 },
  planFoodText: { color: C.mutedLight, fontSize: 13, flex: 1 },
  planMealMacros: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border },
  planMealMacroText: { color: C.muted, fontSize: 11, fontWeight: '600', marginRight: 16 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: C.white, fontSize: 18, fontWeight: '900', marginBottom: 10 },
  emptyText: { color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  emptyBtn: { backgroundColor: C.green, paddingVertical: 13, paddingHorizontal: 28, borderRadius: 12 },
  emptyBtnText: { color: C.bg, fontWeight: '900', fontSize: 14 },
  sectionTitle: { color: C.white, fontSize: 14, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  mealTimeHeader: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
  logItem: { backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  logItemScanned: { borderLeftWidth: 3, borderLeftColor: C.green },
  logItemLeft: { flex: 1, marginRight: 10 },
  logItemName: { color: C.white, fontWeight: '700', fontSize: 14 },
  logItemMacros: { color: C.muted, fontSize: 11, marginTop: 3 },
  logItemCal: { color: C.green, fontWeight: '900', fontSize: 15 },
  deleteHint: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  aiFeedbackSection: { marginTop: 8 },
  aiBtn: { backgroundColor: C.purple, paddingVertical: 15, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  aiBtnText: { color: C.white, fontWeight: '900', fontSize: 15 },
  feedbackCard: { backgroundColor: C.card, borderRadius: 16, padding: 16 },
  feedbackHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  scoreCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 20, fontWeight: '900' },
  scoreDen: { color: C.muted, fontSize: 10 },
  feedbackTitle: { color: C.white, fontWeight: '900', fontSize: 16, marginBottom: 6 },
  feedbackSummary: { color: C.muted, fontSize: 13, lineHeight: 20 },
  feedbackSection: { marginBottom: 14 },
  feedbackSectionTitle: { color: C.white, fontWeight: '800', fontSize: 13, marginBottom: 8 },
  feedbackRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  feedbackDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8, marginTop: 6 },
  feedbackText: { color: C.muted, fontSize: 13, lineHeight: 20, flex: 1 },
  tomorrowTip: { backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 12 },
  tomorrowTipTitle: { color: C.green, fontWeight: '800', fontSize: 12, marginBottom: 4 },
  tomorrowTipText: { color: C.white, fontSize: 13, lineHeight: 20 },
  refreshFeedback: { alignItems: 'center', paddingTop: 8 },
  refreshFeedbackText: { color: C.muted, fontSize: 12 },
});