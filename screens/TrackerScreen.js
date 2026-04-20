import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, Alert, Dimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';

const { width } = Dimensions.get('window');
const TODAY = new Date().toDateString();

export default function TrackerScreen({ user }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [tab, setTab]               = useState('weight');
  const [weightInput, setWeightInput] = useState('');
  const [weightLog, setWeightLog]   = useState([]);
  const [calorieLog, setCalorieLog] = useState([]);
  const [mealInput, setMealInput]   = useState('');
  const [calInput, setCalInput]     = useState('');
  const [targetCal, setTargetCal]   = useState(2000);

  const WEIGHT_KEY  = KEYS.WEIGHT(user.uid);
  const CALORIE_KEY = KEYS.CALLOG(user.uid);
  const TARGET_KEY  = KEYS.CALTARGET(user.uid);

  useEffect(() => {
    Storage.get(WEIGHT_KEY).then(d  => setWeightLog(d || []));
    Storage.get(CALORIE_KEY).then(d => setCalorieLog(d || []));
    Storage.get(TARGET_KEY).then(d  => { if (d) setTargetCal(d); });
  }, []);

  //  Weight 
  const logWeight = async () => {
    const val = parseFloat(weightInput);
    if (!val || val < 20 || val > 400) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.'); return;
    }
    const entry = { weight: val, date: TODAY, timestamp: Date.now() };
    const updated = [entry, ...weightLog.filter(w => w.date !== TODAY)].slice(0, 90);
    await Storage.set(WEIGHT_KEY, updated);
    setWeightLog(updated);
    setWeightInput('');
    Alert.alert('Logged!', val + ' kg recorded for today.');
  };

  const todayWeight = weightLog.find(w => w.date === TODAY);
  const prevWeight  = weightLog.find(w => w.date !== TODAY);
  const weightDiff  = todayWeight && prevWeight ? (todayWeight.weight - prevWeight.weight).toFixed(1) : null;

  //  Calories 
  const todayLog    = calorieLog.filter(e => e.date === TODAY);
  const todayTotal  = todayLog.reduce((sum, e) => sum + e.calories, 0);
  const remaining   = targetCal - todayTotal;

  const logCalories = async () => {
    const cal = parseInt(calInput);
    if (!mealInput.trim()) { Alert.alert('Enter meal name', 'Please enter what you ate.'); return; }
    if (!cal || cal < 1 || cal > 5000) { Alert.alert('Invalid calories', 'Enter a valid calorie amount.'); return; }
    const entry = { meal: mealInput.trim(), calories: cal, date: TODAY, timestamp: Date.now() };
    const updated = [entry, ...calorieLog].slice(0, 200);
    await Storage.set(CALORIE_KEY, updated);
    setCalorieLog(updated);
    setMealInput('');
    setCalInput('');
  };

  const deleteCalEntry = async (timestamp) => {
    const updated = calorieLog.filter(e => e.timestamp !== timestamp);
    await Storage.set(CALORIE_KEY, updated);
    setCalorieLog(updated);
  };

  const saveTarget = async (val) => {
    const t = parseInt(val);
    if (t > 500 && t < 10000) {
      setTargetCal(t);
      await Storage.set(TARGET_KEY, t);
    }
  };

  const TABS = [
    { key: 'weight',   label: 'Weight'   },
    { key: 'calories', label: 'Calories' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Tracker</Text>
      </View>

      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {tab === 'weight' && (
          <>
            {/* Today entry */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Log Today's Weight</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginRight: 10, marginBottom: 0 }]}
                  placeholder="e.g. 75.4"
                  placeholderTextColor={C.muted}
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={s.logBtn} onPress={logWeight}>
                  <Text style={s.logBtnText}>Log</Text>
                </TouchableOpacity>
              </View>
              {todayWeight && (
                <View style={s.todayBadge}>
                  <Text style={s.todayBadgeText}>Today: {todayWeight.weight} kg</Text>
                  {weightDiff !== null && (
                    <Text style={[s.diffText, { color: parseFloat(weightDiff) < 0 ? C.green : C.danger }]}>
                      {parseFloat(weightDiff) > 0 ? '+' : ''}{weightDiff} kg from last entry
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Mini chart - last 7 entries as bars */}
            {weightLog.length > 1 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Last {Math.min(weightLog.length, 7)} Entries</Text>
                <View style={s.barChart}>
                  {weightLog.slice(0, 7).reverse().map((w, i) => {
                    const allVals = weightLog.slice(0, 7).map(x => x.weight);
                    const min = Math.min(...allVals);
                    const max = Math.max(...allVals);
                    const range = max - min || 1;
                    const heightPct = 0.3 + ((w.weight - min) / range) * 0.7;
                    return (
                      <View key={i} style={s.barWrap}>
                        <Text style={s.barLabel}>{w.weight}</Text>
                        <View style={[s.bar, { height: 80 * heightPct, backgroundColor: i === weightLog.slice(0,7).reverse().length - 1 ? C.green : C.surface }]} />
                        <Text style={s.barDate}>{new Date(w.timestamp).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Full log */}
            {weightLog.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>History</Text>
                {weightLog.map((w, i) => (
                  <View key={i} style={s.logRow}>
                    <Text style={s.logDate}>{new Date(w.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                    <Text style={s.logVal}>{w.weight} kg</Text>
                  </View>
                ))}
              </View>
            )}

            {weightLog.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No weight entries yet. Log your first one above.</Text>
              </View>
            )}
          </>
        )}

        {tab === 'calories' && (
          <>
            {/* Target */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Daily Calorie Target</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginRight: 10, marginBottom: 0 }]}
                  placeholder={String(targetCal)}
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  onEndEditing={e => saveTarget(e.nativeEvent.text)}
                  defaultValue={String(targetCal)}
                />
                <View style={[s.logBtn, { backgroundColor: C.surface }]}>
                  <Text style={[s.logBtnText, { color: C.muted }]}>kcal</Text>
                </View>
              </View>
            </View>

            {/* Today ring */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Today</Text>
              <View style={s.calSummary}>
                <View style={s.calCircle}>
                  <Text style={s.calCircleNum}>{todayTotal}</Text>
                  <Text style={s.calCircleLabel}>eaten</Text>
                </View>
                <View style={s.calStats}>
                  <View style={s.calStatRow}>
                    <Text style={s.calStatLabel}>Target</Text>
                    <Text style={s.calStatVal}>{targetCal} kcal</Text>
                  </View>
                  <View style={s.calStatRow}>
                    <Text style={s.calStatLabel}>Eaten</Text>
                    <Text style={[s.calStatVal, { color: C.green }]}>{todayTotal} kcal</Text>
                  </View>
                  <View style={s.calStatRow}>
                    <Text style={s.calStatLabel}>{remaining >= 0 ? 'Remaining' : 'Over by'}</Text>
                    <Text style={[s.calStatVal, { color: remaining >= 0 ? C.blue : C.danger }]}>
                      {Math.abs(remaining)} kcal
                    </Text>
                  </View>
                </View>
              </View>
              {/* Progress bar */}
              <View style={s.progressBg}>
                <View style={[s.progressFill, {
                  width: (Math.min(todayTotal / targetCal, 1) * 100) + '%',
                  backgroundColor: todayTotal > targetCal ? C.danger : C.green,
                }]} />
              </View>
            </View>

            {/* Add entry */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Add Meal</Text>
              <TextInput
                style={s.input}
                placeholder="Meal name (e.g. Lunch - Grilled Chicken)"
                placeholderTextColor={C.muted}
                value={mealInput}
                onChangeText={setMealInput}
              />
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginRight: 10, marginBottom: 0 }]}
                  placeholder="Calories"
                  placeholderTextColor={C.muted}
                  value={calInput}
                  onChangeText={setCalInput}
                  keyboardType="numeric"
                />
                <TouchableOpacity style={s.logBtn} onPress={logCalories}>
                  <Text style={s.logBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Today's meals */}
            {todayLog.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Today's Meals</Text>
                {todayLog.map((e, i) => (
                  <View key={i} style={s.logRow}>
                    <Text style={s.logDate} numberOfLines={1}>{e.meal}</Text>
                    <View style={s.logRowRight}>
                      <Text style={s.logVal}>{e.calories} kcal</Text>
                      <TouchableOpacity onPress={() => deleteCalEntry(e.timestamp)} style={s.deleteBtn}>
                        <Text style={s.deleteBtnText}>x</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {todayLog.length === 0 && (
              <View style={s.emptyBox}>
                <Text style={s.emptyText}>No meals logged today. Add your first one above.</Text>
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
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  tabRow: { flexDirection: 'row', backgroundColor: C.surface, padding: 4, margin: 16, borderRadius: 12 },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: C.green },
  tabText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: C.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { color: C.white, fontWeight: '800', fontSize: 14, marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: C.surface, color: C.white, padding: 13, borderRadius: 12, fontSize: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  logBtn: { backgroundColor: C.green, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 12 },
  logBtnText: { color: C.bg, fontWeight: '900', fontSize: 14 },
  todayBadge: { marginTop: 10, backgroundColor: C.surface, borderRadius: 10, padding: 12 },
  todayBadgeText: { color: C.white, fontWeight: '700', fontSize: 15 },
  diffText: { fontSize: 13, marginTop: 4 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, justifyContent: 'space-around' },
  barWrap: { alignItems: 'center', flex: 1 },
  bar: { width: '60%', borderRadius: 4, minHeight: 8 },
  barLabel: { color: C.muted, fontSize: 9, marginBottom: 4 },
  barDate: { color: C.muted, fontSize: 9, marginTop: 4 },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  logDate: { color: C.muted, fontSize: 13, flex: 1 },
  logVal: { color: C.white, fontWeight: '700', fontSize: 13 },
  logRowRight: { flexDirection: 'row', alignItems: 'center' },
  deleteBtn: { marginLeft: 12, backgroundColor: C.danger + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  deleteBtnText: { color: C.danger, fontWeight: '900', fontSize: 12 },
  calSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  calCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 20 },
  calCircleNum: { color: C.green, fontSize: 18, fontWeight: '900' },
  calCircleLabel: { color: C.muted, fontSize: 10 },
  calStats: { flex: 1 },
  calStatRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  calStatLabel: { color: C.muted, fontSize: 13 },
  calStatVal: { color: C.white, fontWeight: '700', fontSize: 13 },
  progressBg: { height: 8, backgroundColor: C.surface, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { color: C.muted, fontSize: 14, textAlign: 'center' },
});