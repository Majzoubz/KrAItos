import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { C } from '../constants/theme';
import { callClaude, parseJSON } from '../utils/api';
import {
  ScreenHeader, Field, SectionTitle,
  MacroGrid, CalorieHero, TipsBox, SecondaryButton,
} from '../components/UI';

const FALLBACK_RESULT = {
  meal: 'Unknown Meal', calories: 520, protein: 38, carbs: 45, fat: 14,
  fiber: 5, sugar: 4, sodium: 680, servingSize: '1 plate (~400g)',
  healthScore: 7, tips: ['Good protein source', 'Consider reducing sodium'],
};

const SYSTEM_PROMPT = `You are a professional nutritionist AI. When given a food description, return ONLY a JSON object (no markdown, no explanation) with this exact shape:
{
  "meal": "meal name",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "fiber": number,
  "sugar": number,
  "sodium": number,
  "servingSize": "e.g. 1 plate (~450g)",
  "healthScore": number between 1-10,
  "tips": ["tip1", "tip2"]
}
All macros in grams. Be realistic and accurate.`;

export default function FoodScannerScreen({ onBack }) {
  const [phase, setPhase] = useState('idle');
  const [mealName, setMealName] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(null);

  const startScan = async () => {
    if (!mealName.trim()) {
      Alert.alert('Describe your meal', 'Type what you see on the plate.'); return;
    }
    setLoading(true);
    setPhase('scanning');

    spinLoop.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
    );
    spinLoop.current.start();

    try {
      const raw = await callClaude(SYSTEM_PROMPT, `Analyze this meal: ${mealName}`);
      setResult(parseJSON(raw, FALLBACK_RESULT));
      setPhase('result');
    } catch {
      Alert.alert('Error', 'Could not analyze the meal. Please try again.');
      setPhase('idle');
    } finally {
      setLoading(false);
      spinLoop.current?.stop();
    }
  };

  const reset = () => { setPhase('idle'); setMealName(''); setResult(null); };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={s.safeArea}>
      <ScreenHeader title="Food Scanner" icon="🍽️" onBack={onBack} />
      <ScrollView contentContainerStyle={s.scroll}>

        {phase !== 'result' && (
          <>
            <View style={s.cameraBox}>
              {loading
                ? <Animated.View style={[s.scanRing, { transform: [{ rotate: spin }] }]} />
                : <Text style={s.cameraPlaceholder}>📸{'\n'}Camera Preview{'\n'}(describe meal below)</Text>
              }
              <View style={s.corner_tl} /><View style={s.corner_tr} />
              <View style={s.corner_bl} /><View style={s.corner_br} />
            </View>

            <Field
              label="Describe what's on the plate"
              placeholder="e.g. grilled salmon with quinoa and roasted vegetables"
              value={mealName}
              onChangeText={setMealName}
              multiline
            />

            <TouchableOpacity
              style={[s.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={startScan}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={C.bg} />
                : <Text style={s.primaryBtnText}>🔍 Analyze Meal</Text>
              }
            </TouchableOpacity>
          </>
        )}

        {phase === 'result' && result && (
          <>
            <View style={s.resultHeader}>
              <Text style={s.resultMeal}>{result.meal}</Text>
              <Text style={s.resultServing}>{result.servingSize}</Text>
              <View style={[s.scoreChip, {
                backgroundColor: result.healthScore >= 7 ? C.green + '22' : C.orange + '22'
              }]}>
                <Text style={[s.scoreText, {
                  color: result.healthScore >= 7 ? C.green : C.orange
                }]}>
                  Health Score: {result.healthScore}/10
                </Text>
              </View>
            </View>

            <CalorieHero calories={result.calories} />

            <MacroGrid items={[
              ['Protein', result.protein, 'g', C.blue],
              ['Carbs',   result.carbs,   'g', C.orange],
              ['Fat',     result.fat,     'g', C.purple],
              ['Fiber',   result.fiber,   'g', C.green],
              ['Sugar',   result.sugar,   'g', C.danger],
              ['Sodium',  result.sodium,  'mg', C.muted],
            ]} />

            <TipsBox title="💬 Nutritionist Tips" tips={result.tips} />

            <SecondaryButton label="Scan Another Meal" onPress={reset} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  cameraBox: {
    height: 220, backgroundColor: C.surface, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', position: 'relative',
  },
  cameraPlaceholder: { color: C.muted, textAlign: 'center', fontSize: 15, lineHeight: 26 },
  scanRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: C.green, borderTopColor: 'transparent',
  },
  corner_tl: { position: 'absolute', top: 16, left: 16, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: C.green, borderRadius: 4 },
  corner_tr: { position: 'absolute', top: 16, right: 16, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: C.green, borderRadius: 4 },
  corner_bl: { position: 'absolute', bottom: 16, left: 16, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: C.green, borderRadius: 4 },
  corner_br: { position: 'absolute', bottom: 16, right: 16, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: C.green, borderRadius: 4 },
  primaryBtn: {
    backgroundColor: C.green, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  resultHeader: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  resultMeal: { color: C.white, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  resultServing: { color: C.muted, fontSize: 13, marginBottom: 12 },
  scoreChip: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  scoreText: { fontSize: 13, fontWeight: '700' },
});
