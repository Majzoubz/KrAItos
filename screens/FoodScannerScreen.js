import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { C } from '../constants/theme';
import { callAI, parseJSON } from '../utils/api';
import { Auth } from '../utils/auth';
import { Storage, KEYS } from '../utils/storage';

export default function FoodScannerScreen({ user, onUserUpdate }) {
  const [phase, setPhase]       = useState('idle');
  const [mealName, setMealName] = useState('');
  const [result, setResult]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [history, setHistory]   = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(null);

  useEffect(() => {
    Storage.get(KEYS.MEALS(user.email)).then(h => setHistory(h || []));
  }, []);

  const startScan = async () => {
    if (!mealName.trim()) {
      Alert.alert('Describe your meal', 'Type what you see on the plate first.'); return;
    }
    setLoading(true);
    setPhase('scanning');
    spinLoop.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
    );
    spinLoop.current.start();

    try {
      const raw = await callAI(
        'You are a professional nutritionist. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure: {"meal":"name","calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodium":number,"servingSize":"description","healthScore":number,"tips":["tip1","tip2"]}. All macros in grams. healthScore is 1-10.',
        'Analyze this meal: ' + mealName.trim()
      );
      const parsed = parseJSON(raw, null);
      if (!parsed || typeof parsed.calories !== 'number') {
        Alert.alert('Could not analyze', 'The AI could not read your meal. Try being more specific, e.g. "200g grilled chicken with 150g white rice".');
        setPhase('idle'); return;
      }

      // Save to history
      const entry = { ...parsed, scannedAt: Date.now(), query: mealName.trim() };
      const newHistory = [entry, ...history].slice(0, 20); // keep last 20
      await Storage.set(KEYS.MEALS(user.email), newHistory);
      setHistory(newHistory);
      setResult(parsed);
      setPhase('result');

      const updated = await Auth.updateUser(user.email, {
        mealsScanned: (user.mealsScanned || 0) + 1,
      });
      await Auth.logActivity(user.email);
      if (updated) onUserUpdate(updated);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not reach AI. Check your internet connection and API key.');
      setPhase('idle');
    } finally {
      setLoading(false);
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
  };

  const reset = () => { setPhase('idle'); setMealName(''); setResult(null); };
  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const scoreColor = result && result.healthScore >= 7 ? C.green : result && result.healthScore >= 5 ? C.orange : C.danger;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Food Scanner</Text>
        {history.length > 0 && phase === 'idle' && (
          <TouchableOpacity onPress={() => setShowHistory(!showHistory)}>
            <Text style={s.historyToggle}>{showHistory ? 'Hide History' : 'History (' + history.length + ')'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {phase !== 'result' && !showHistory && (
          <>
            <View style={s.cameraBox}>
              {loading
                ? <Animated.View style={[s.ring, { transform: [{ rotate: spin }] }]} />
                : <Text style={s.cameraHint}>Type your meal below{'\n'}for instant AI nutrition analysis</Text>
              }
              <View style={s.corner_tl} /><View style={s.corner_tr} />
              <View style={s.corner_bl} /><View style={s.corner_br} />
            </View>

            <Text style={s.label}>What did you eat?</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 200g grilled chicken breast with 150g brown rice and salad"
              placeholderTextColor={C.muted}
              value={mealName}
              onChangeText={setMealName}
              multiline
            />
            <Text style={s.inputHint}>Be specific with portions for better accuracy</Text>

            <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={startScan} disabled={loading}>
              {loading
                ? <><ActivityIndicator color={C.bg} /><Text style={[s.btnText, { marginLeft: 8 }]}>Analyzing...</Text></>
                : <Text style={s.btnText}>Analyze Meal</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {showHistory && phase === 'idle' && (
          <>
            <Text style={s.sectionTitle}>Recent Meals</Text>
            {history.map((h, i) => (
              <View key={i} style={s.historyCard}>
                <View style={s.historyTop}>
                  <Text style={s.historyMeal}>{h.meal}</Text>
                  <Text style={s.historyCal}>{h.calories} kcal</Text>
                </View>
                <Text style={s.historyQuery}>{h.query}</Text>
                <Text style={s.historyDate}>
                  {new Date(h.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
            <TouchableOpacity style={s.secondaryBtn} onPress={() => setShowHistory(false)}>
              <Text style={s.secondaryBtnText}>Scan New Meal</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'result' && result && (
          <>
            <View style={s.resultHeader}>
              <Text style={s.resultMeal}>{result.meal || mealName}</Text>
              {result.servingSize ? <Text style={s.resultServing}>{result.servingSize}</Text> : null}
              <View style={[s.scoreBadge, { backgroundColor: scoreColor + '22' }]}>
                <Text style={[s.scoreText, { color: scoreColor }]}>
                  Health Score: {result.healthScore} / 10
                </Text>
              </View>
            </View>

            <View style={s.calorieBox}>
              <Text style={s.calorieNum}>{result.calories}</Text>
              <Text style={s.calorieLabel}>CALORIES</Text>
            </View>

            <View style={s.macroGrid}>
              {[
                ['Protein', result.protein,  'g',  C.blue],
                ['Carbs',   result.carbs,    'g',  C.orange],
                ['Fat',     result.fat,      'g',  C.purple],
                ['Fiber',   result.fiber,    'g',  C.green],
                ['Sugar',   result.sugar,    'g',  C.danger],
                ['Sodium',  result.sodium,   'mg', C.muted],
              ].map(([label, val, unit, color]) => (
                <View key={label} style={s.macroItem}>
                  <Text style={[s.macroVal, { color }]}>
                    {val ?? '--'}<Text style={s.macroUnit}>{unit}</Text>
                  </Text>
                  <Text style={s.macroLabel}>{label}</Text>
                </View>
              ))}
            </View>

            {result.tips && result.tips.length > 0 && (
              <View style={s.tipsBox}>
                <Text style={s.tipsTitle}>Nutritionist Tips</Text>
                {result.tips.map((tip, i) => (
                  <View key={i} style={s.tipRow}>
                    <View style={s.tipDot} />
                    <Text style={s.tip}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={s.btn} onPress={reset}>
              <Text style={s.btnText}>Scan Another Meal</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  historyToggle: { color: C.green, fontSize: 13, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40 },
  cameraBox: { height: 160, backgroundColor: C.surface, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.border, position: 'relative' },
  cameraHint: { color: C.muted, textAlign: 'center', fontSize: 14, lineHeight: 22 },
  ring: { width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: C.green, borderTopColor: 'transparent' },
  corner_tl: { position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: C.green, borderRadius: 3 },
  corner_tr: { position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: C.green, borderRadius: 3 },
  corner_bl: { position: 'absolute', bottom: 12, left: 12, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: C.green, borderRadius: 3 },
  corner_br: { position: 'absolute', bottom: 12, right: 12, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: C.green, borderRadius: 3 },
  label: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: C.surface, color: C.white, padding: 14, borderRadius: 12, fontSize: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, minHeight: 90, textAlignVertical: 'top' },
  inputHint: { color: C.muted, fontSize: 11, marginBottom: 16 },
  btn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  btnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  secondaryBtn: { borderWidth: 1.5, borderColor: C.green, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  secondaryBtnText: { color: C.green, fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  historyCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyMeal: { color: C.white, fontWeight: '800', fontSize: 14, flex: 1, marginRight: 8 },
  historyCal: { color: C.green, fontWeight: '700', fontSize: 13 },
  historyQuery: { color: C.muted, fontSize: 12, marginBottom: 4 },
  historyDate: { color: C.muted, fontSize: 11 },
  resultHeader: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  resultMeal: { color: C.white, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  resultServing: { color: C.muted, fontSize: 13, marginBottom: 12 },
  scoreBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  scoreText: { fontSize: 13, fontWeight: '700' },
  calorieBox: { backgroundColor: C.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  calorieNum: { color: C.green, fontSize: 56, fontWeight: '900' },
  calorieLabel: { color: C.muted, fontSize: 12, letterSpacing: 2, marginTop: -4 },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  macroItem: { width: '30%', backgroundColor: C.card, borderRadius: 12, padding: 12, alignItems: 'center', marginRight: 6, marginBottom: 6 },
  macroVal: { fontSize: 20, fontWeight: '800' },
  macroUnit: { fontSize: 12, fontWeight: '400' },
  macroLabel: { color: C.muted, fontSize: 11, marginTop: 2 },
  tipsBox: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  tipsTitle: { color: C.white, fontWeight: '800', marginBottom: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginRight: 8, marginTop: 7 },
  tip: { color: C.muted, fontSize: 13, lineHeight: 20, flex: 1 },
});