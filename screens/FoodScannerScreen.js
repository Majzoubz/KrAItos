import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
  Animated, Image, Dimensions, Easing,
} from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../theme/ThemeContext';
import { callAI, callAIWithImage, parseJSON } from '../utils/api';
import { Auth } from '../utils/auth';
import { Storage, KEYS } from '../utils/storage';

const { width } = Dimensions.get('window');

const NUTRITION_SYSTEM = 'You are a professional nutritionist. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure: {"meal":"name","calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodium":number,"servingSize":"description","healthScore":number,"tips":["tip1","tip2"]}. All macros in grams. healthScore is 1-10.';

const MEAL_TIMES = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

function ScoreRing({ score, color, bg, size = 64 }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(10, score || 0)) / 10;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size/2} cy={size/2} r={r} stroke={bg} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size/2} cy={size/2} r={r}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${c * pct} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
    </Svg>
  );
}

function MacroDonut({ p, c, f, size = 160, colors }) {
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const total = (p * 4) + (c * 4) + (f * 9);
  if (total <= 0) return null;
  const segs = [
    { v: (p * 4) / total, color: colors.protein },
    { v: (c * 4) / total, color: colors.carbs },
    { v: (f * 9) / total, color: colors.fat },
  ];
  let acc = 0;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
      {segs.map((s, i) => {
        const dash = circ * s.v;
        const offset = circ * acc;
        acc += s.v;
        return (
          <Circle
            key={i}
            cx={cx} cy={cy} r={r}
            stroke={s.color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
      })}
    </Svg>
  );
}

function Viewfinder({ C, size, scanning }) {
  const beam = useRef(new Animated.Value(0)).current;
  const corner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const beamLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(beam, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(beam, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const cornerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(corner, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(corner, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    beamLoop.start();
    cornerLoop.start();
    return () => { beamLoop.stop(); cornerLoop.stop(); };
  }, []);

  const beamY = beam.interpolate({ inputRange: [0, 1], outputRange: [12, size - 14] });
  const cornerOpacity = corner.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const beamOpacity = beam.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.95, 0.3] });

  const cornerSize = 26;
  const cornerStroke = 3;
  const corners = [
    { top: 0, left: 0,   borderTopWidth: cornerStroke, borderLeftWidth: cornerStroke, borderTopLeftRadius: 14 },
    { top: 0, right: 0,  borderTopWidth: cornerStroke, borderRightWidth: cornerStroke, borderTopRightRadius: 14 },
    { bottom: 0, left: 0,  borderBottomWidth: cornerStroke, borderLeftWidth: cornerStroke, borderBottomLeftRadius: 14 },
    { bottom: 0, right: 0, borderBottomWidth: cornerStroke, borderRightWidth: cornerStroke, borderBottomRightRadius: 14 },
  ];

  return (
    <View style={{ width: size, height: size, position: 'relative', alignSelf: 'center' }}>
      <View style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        backgroundColor: C.surface,
        borderRadius: 16,
        opacity: 0.35,
      }} />
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.green} stopOpacity="0.06" />
            <Stop offset="1" stopColor={C.green} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        <Path
          d={`M${size/2} ${size/2} m-${size/3} 0 a${size/3} ${size/3} 0 1 0 ${(size/3)*2} 0 a${size/3} ${size/3} 0 1 0 -${(size/3)*2} 0`}
          stroke={C.green}
          strokeOpacity="0.18"
          strokeWidth="1"
          fill="url(#grid)"
        />
      </Svg>

      {corners.map((c, i) => (
        <Animated.View key={i}
          style={[{
            position: 'absolute',
            width: cornerSize, height: cornerSize,
            borderColor: C.green,
            opacity: cornerOpacity,
          }, c]}
        />
      ))}

      <Animated.View style={{
        position: 'absolute',
        left: 8, right: 8,
        height: 2,
        backgroundColor: C.green,
        opacity: beamOpacity,
        transform: [{ translateY: beamY }],
        shadowColor: C.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8,
      }} />

      <View style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: C.green + '14',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path
              d="M12 7a5 5 0 105 5 5 5 0 00-5-5zm0 8a3 3 0 113-3 3 3 0 01-3 3z M20 4h-3.17l-1.84-2H8.99L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z"
              fill={C.green}
            />
          </Svg>
        </View>
        <Text style={{ color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginTop: 8 }}>
          {scanning ? 'ANALYZING…' : 'TAP TO SCAN'}
        </Text>
      </View>
    </View>
  );
}

export default function FoodScannerScreen({ user, onUserUpdate, onAddToLog }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [phase, setPhase]           = useState('idle');
  const [capturedImage, setCaptured] = useState(null);
  const [mimeType, setMimeType]     = useState('image/jpeg');
  const [description, setDesc]      = useState('');
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [history, setHistory]       = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mealTime, setMealTime]     = useState('Lunch');
  const [addedToLog, setAddedToLog] = useState(false);
  const [inputMode, setInputMode]   = useState('photo'); // 'photo' | 'describe'

  const shutterPulse = useRef(new Animated.Value(1)).current;
  const calorieAnim = useRef(new Animated.Value(0)).current;
  const resultFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Storage.get(KEYS.MEALS(user.uid)).then(h => setHistory(h || []));
  }, []);

  useEffect(() => {
    if (phase === 'idle' && inputMode === 'photo') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shutterPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(shutterPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase, inputMode]);

  useEffect(() => {
    if (phase === 'result' && result) {
      calorieAnim.setValue(0);
      resultFade.setValue(0);
      Animated.parallel([
        Animated.timing(calorieAnim, { toValue: result.calories || 0, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(resultFade, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]).start();
    }
  }, [phase, result]);

  const requestPermission = async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to scan meals. Please enable it in Settings.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required. Please enable it in Settings.');
        return false;
      }
    }
    return true;
  };

  const takePhoto = async () => {
    const ok = await requestPermission('camera');
    if (!ok) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], quality: 0.7, base64: false, allowsEditing: true, aspect: [4, 3],
    });
    if (!r.canceled && r.assets[0]) {
      setCaptured(r.assets[0].uri);
      setMimeType(r.assets[0].mimeType || 'image/jpeg');
      setPhase('preview');
    }
  };

  const pickFromLibrary = async () => {
    const ok = await requestPermission('library');
    if (!ok) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.7, base64: false, allowsEditing: true, aspect: [4, 3],
    });
    if (!r.canceled && r.assets[0]) {
      setCaptured(r.assets[0].uri);
      setMimeType(r.assets[0].mimeType || 'image/jpeg');
      setPhase('preview');
    }
  };

  const analyze = async () => {
    setLoading(true);
    try {
      let raw;
      if (capturedImage) {
        const base64 = await FileSystem.readAsStringAsync(capturedImage, { encoding: 'base64' });
        raw = await callAIWithImage(base64, mimeType, description.trim() || null);
      } else {
        if (!description.trim()) {
          Alert.alert('Add a description', 'Please take a photo or describe your meal.');
          setLoading(false); return;
        }
        raw = await callAI(NUTRITION_SYSTEM, 'Analyze this meal: ' + description.trim());
      }
      const parsed = parseJSON(raw, null);
      if (!parsed || typeof parsed.calories !== 'number') {
        Alert.alert('Could not analyze', 'The AI could not identify the meal. Try a clearer photo or add more description.');
        setLoading(false); return;
      }
      const entry = {
        ...parsed,
        imageUri: capturedImage || null,
        scannedAt: Date.now(),
        query: description.trim() || 'Photo scan',
      };
      const newHistory = [entry, ...history].slice(0, 30);
      await Storage.set(KEYS.MEALS(user.uid), newHistory);
      setHistory(newHistory);
      setResult(parsed);
      setPhase('result');

      const updated = await Auth.updateUser(user.uid, { mealsScanned: (user.mealsScanned || 0) + 1 });
      const withStreak = await Auth.logActivity(user.uid);
      if (withStreak && onUserUpdate) onUserUpdate(withStreak);
      else if (updated && onUserUpdate) onUserUpdate(updated);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not reach AI. Check your internet and API key.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPhase('idle');
    setCaptured(null);
    setDesc('');
    setResult(null);
    setAddedToLog(false);
  };

  const scoreColor = result
    ? result.healthScore >= 7 ? C.green : result.healthScore >= 5 ? C.orange : C.danger
    : C.green;

  /* HISTORY */
  if (showHistory) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}>
          <Text style={s.titleBarText}>Meal History</Text>
          <TouchableOpacity onPress={() => setShowHistory(false)}>
            <Text style={s.titleBarAction}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          {history.length === 0 && (
            <View style={s.emptyBox}><Text style={s.emptyText}>No meals scanned yet.</Text></View>
          )}
          {history.map((h, i) => (
            <View key={i} style={s.historyCard}>
              {h.imageUri && <Image source={{ uri: h.imageUri }} style={s.historyImage} />}
              <View style={s.historyBody}>
                <View style={s.historyTop}>
                  <Text style={s.historyMeal} numberOfLines={1}>{h.meal}</Text>
                  <Text style={s.historyCal}>{h.calories} kcal</Text>
                </View>
                <Text style={s.historyMacros}>P: {h.protein}g  C: {h.carbs}g  F: {h.fat}g</Text>
                <Text style={s.historyDate}>
                  {new Date(h.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* RESULT */
  if (phase === 'result' && result) {
    const totalGrams = (result.protein || 0) + (result.carbs || 0) + (result.fat || 0);
    const pPct = totalGrams ? Math.round(((result.protein || 0) / totalGrams) * 100) : 0;
    const cPct = totalGrams ? Math.round(((result.carbs   || 0) / totalGrams) * 100) : 0;
    const fPct = totalGrams ? Math.round(((result.fat     || 0) / totalGrams) * 100) : 0;

    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}>
          <TouchableOpacity onPress={reset}><Text style={s.titleBarAction}>‹ New scan</Text></TouchableOpacity>
          <Text style={s.titleBarText}>Results</Text>
          <View style={{ width: 70 }} />
        </View>
        <Animated.ScrollView style={{ opacity: resultFade }} contentContainerStyle={s.scroll}>
          {capturedImage && (
            <View style={s.heroWrap}>
              <Image source={{ uri: capturedImage }} style={s.resultImage} />
              <View style={s.heroOverlay}>
                <Text style={s.resultMeal}>{result.meal}</Text>
                {result.servingSize ? <Text style={s.resultServing}>{result.servingSize}</Text> : null}
              </View>
              <View style={s.scoreFloat}>
                <ScoreRing score={result.healthScore} color={scoreColor} bg={C.bg + 'AA'} size={58} />
                <View style={s.scoreFloatInner}>
                  <Text style={[s.scoreFloatNum, { color: scoreColor }]}>{result.healthScore}</Text>
                  <Text style={s.scoreFloatLbl}>/ 10</Text>
                </View>
              </View>
            </View>
          )}
          {!capturedImage && (
            <View style={s.resultHeaderText}>
              <Text style={s.resultMealNoImg}>{result.meal}</Text>
              {result.servingSize ? <Text style={s.resultServing}>{result.servingSize}</Text> : null}
            </View>
          )}

          {/* Donut + calories */}
          <View style={s.donutCard}>
            <View style={s.donutWrap}>
              <MacroDonut
                p={result.protein || 0} c={result.carbs || 0} f={result.fat || 0}
                size={170}
                colors={{ protein: C.blue, carbs: C.orange, fat: C.purple, track: C.surface }}
              />
              <View style={s.donutCenter}>
                <AnimatedCaloriesText anim={calorieAnim} style={s.calorieNum} />
                <Text style={s.calorieLabel}>kcal</Text>
              </View>
            </View>
            <View style={s.legendCol}>
              <LegendRow color={C.blue}   label="Protein" v={result.protein} pct={pPct} unit="g" />
              <LegendRow color={C.orange} label="Carbs"   v={result.carbs}   pct={cPct} unit="g" />
              <LegendRow color={C.purple} label="Fat"     v={result.fat}     pct={fPct} unit="g" />
            </View>
          </View>

          {/* Micros */}
          <View style={s.microRow}>
            <MicroPill label="Fiber"  v={result.fiber}  unit="g"  C={C} />
            <MicroPill label="Sugar"  v={result.sugar}  unit="g"  C={C} />
            <MicroPill label="Sodium" v={result.sodium} unit="mg" C={C} />
          </View>

          {/* Meal time selector */}
          <Text style={s.label}>Log as</Text>
          <View style={s.segment}>
            {MEAL_TIMES.map(m => (
              <TouchableOpacity key={m}
                style={[s.segmentBtn, mealTime === m && s.segmentBtnActive]}
                onPress={() => setMealTime(m)}
              >
                <Text style={[s.segmentText, mealTime === m && s.segmentTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {result.tips && result.tips.length > 0 && (
            <View style={s.tipsBox}>
              <Text style={s.boxTitle}>AI Tips</Text>
              {result.tips.map((tip, i) => (
                <View key={i} style={s.tipRow}>
                  <View style={s.tipDot} />
                  <Text style={s.tip}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          {!addedToLog ? (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={async () => {
                const TODAY = new Date().toDateString();
                const FOOD_KEY = KEYS.FOODLOG(user.uid, TODAY);
                const existing = await Storage.get(FOOD_KEY) || [];
                const entry = {
                  id: Date.now(),
                  name: result.meal,
                  mealTime,
                  calories: result.calories || 0,
                  protein:  result.protein  || 0,
                  carbs:    result.carbs    || 0,
                  fat:      result.fat      || 0,
                  addedAt: Date.now(),
                  source: 'scanner',
                };
                await Storage.set(FOOD_KEY, [...existing, entry]);
                setAddedToLog(true);
                if (onAddToLog) onAddToLog();
              }}
            >
              <Text style={s.primaryBtnText}>+ Add to {mealTime}</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.addedBadge}>
              <Text style={s.addedBadgeText}>✓ Added to today's log</Text>
            </View>
          )}
          <TouchableOpacity style={s.ghostBtn} onPress={reset}>
            <Text style={s.ghostBtnText}>Scan another meal</Text>
          </TouchableOpacity>
        </Animated.ScrollView>
      </SafeAreaView>
    );
  }

  /* PREVIEW */
  if (phase === 'preview') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}>
          <TouchableOpacity onPress={() => setPhase('idle')}><Text style={s.titleBarAction}>‹ Retake</Text></TouchableOpacity>
          <Text style={s.titleBarText}>Review</Text>
          <View style={{ width: 70 }} />
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.previewWrap}>
            <Image source={{ uri: capturedImage }} style={s.previewImage} />
            {loading && (
              <View style={s.previewOverlay}>
                <ScanRing C={C} />
                <Text style={s.previewOverlayText}>AI is identifying your meal…</Text>
                <Text style={s.previewOverlaySub}>Detecting ingredients & estimating macros</Text>
              </View>
            )}
          </View>

          <Text style={s.label}>Add context (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. large portion, extra cheese, home cooked…"
            placeholderTextColor={C.muted}
            value={description}
            onChangeText={setDesc}
            multiline
          />
          <Text style={s.inputHint}>The more detail, the more accurate the macros.</Text>

          <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.6 }]} onPress={analyze} disabled={loading}>
            {loading
              ? <Text style={s.primaryBtnText}>Analyzing…</Text>
              : <Text style={s.primaryBtnText}>Analyze meal</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* IDLE */
  const vfSize = Math.min(width - 40, 320);
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <View>
          <Text style={s.titleBarText}>AI Scanner</Text>
          <Text style={s.titleBarSub}>Snap → identify → log</Text>
        </View>
        <TouchableOpacity onPress={() => setShowHistory(true)} style={s.histBtn}>
          <Text style={s.histBtnText}>{history.length > 0 ? `History · ${history.length}` : 'History'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Mode toggle */}
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, inputMode === 'photo' && s.modeBtnActive]}
            onPress={() => setInputMode('photo')}
          >
            <Text style={[s.modeText, inputMode === 'photo' && s.modeTextActive]}>📷 Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, inputMode === 'describe' && s.modeBtnActive]}
            onPress={() => setInputMode('describe')}
          >
            <Text style={[s.modeText, inputMode === 'describe' && s.modeTextActive]}>✎ Describe</Text>
          </TouchableOpacity>
        </View>

        {inputMode === 'photo' ? (
          <>
            <Viewfinder C={C} size={vfSize} scanning={loading} />

            <Animated.View style={[s.shutterWrap, { transform: [{ scale: shutterPulse }] }]}>
              <TouchableOpacity activeOpacity={0.85} onPress={takePhoto} style={s.shutter}>
                <View style={s.shutterInner}>
                  <View style={s.shutterCore} />
                </View>
              </TouchableOpacity>
            </Animated.View>

            <View style={s.actionRow}>
              <TouchableOpacity style={s.sideBtn} onPress={pickFromLibrary}>
                <Text style={s.sideBtnIcon}>🖼</Text>
                <Text style={s.sideBtnText}>Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sideBtn} onPress={() => setInputMode('describe')}>
                <Text style={s.sideBtnIcon}>✎</Text>
                <Text style={s.sideBtnText}>Describe</Text>
              </TouchableOpacity>
            </View>

            <View style={s.tipBanner}>
              <View style={s.tipBadge}><Text style={s.tipBadgeText}>TIP</Text></View>
              <Text style={s.tipBannerText}>
                Top-down shot in good light. Capture the whole plate for the best macro estimate.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={s.label}>Describe your meal</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 200g grilled chicken, 1 cup brown rice, side salad with olive oil"
              placeholderTextColor={C.muted}
              value={description}
              onChangeText={setDesc}
              multiline
            />
            <Text style={s.inputHint}>Be specific with portions for the best accuracy.</Text>

            <TouchableOpacity
              style={[s.primaryBtn, (loading || !description.trim()) && { opacity: 0.4 }]}
              onPress={analyze}
              disabled={loading || !description.trim()}
            >
              {loading
                ? <><ActivityIndicator color={C.bg} /><Text style={[s.primaryBtnText, { marginLeft: 8 }]}>Analyzing…</Text></>
                : <Text style={s.primaryBtnText}>Analyze with AI</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={s.ghostBtn} onPress={() => setInputMode('photo')}>
              <Text style={s.ghostBtnText}>Switch to photo scan</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Recent strip */}
        {history.length > 0 && (
          <>
            <View style={s.recentHead}>
              <Text style={s.recentTitle}>Recent scans</Text>
              <TouchableOpacity onPress={() => setShowHistory(true)}>
                <Text style={s.recentLink}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {history.slice(0, 8).map((h, i) => (
                <TouchableOpacity key={i} style={s.recentCard} onPress={() => { setResult(h); setCaptured(h.imageUri); setPhase('result'); }}>
                  {h.imageUri ? (
                    <Image source={{ uri: h.imageUri }} style={s.recentImg} />
                  ) : (
                    <View style={[s.recentImg, { backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ fontSize: 22 }}>🍽</Text>
                    </View>
                  )}
                  <View style={s.recentBody}>
                    <Text style={s.recentMeal} numberOfLines={1}>{h.meal}</Text>
                    <Text style={s.recentCal}>{h.calories} kcal</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScanRing({ C }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{
      width: 56, height: 56, borderRadius: 28,
      borderWidth: 4, borderColor: C.green, borderTopColor: 'transparent',
      transform: [{ rotate: rot }],
    }} />
  );
}

function AnimatedCaloriesText({ anim, target, style }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value }) => setV(Math.round(value)));
    return () => anim.removeListener(id);
  }, [anim]);
  return <Text style={style}>{v}</Text>;
}

function LegendRow({ color, label, v, pct, unit }) {
  return (
    <View style={legendStyle.row}>
      <View style={[legendStyle.dot, { backgroundColor: color }]} />
      <Text style={[legendStyle.label, { color }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Text style={legendStyle.val}>{v ?? '--'}{unit}</Text>
      <Text style={legendStyle.pct}>{pct}%</Text>
    </View>
  );
}

function MicroPill({ label, v, unit, C }) {
  return (
    <View style={[microPill.box, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={[microPill.val, { color: C.white }]}>{v ?? '--'}<Text style={[microPill.unit, { color: C.muted }]}>{unit}</Text></Text>
      <Text style={[microPill.label, { color: C.muted }]}>{label}</Text>
    </View>
  );
}

const legendStyle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  label: { fontSize: 13, fontWeight: '700' },
  val: { color: '#fff', fontSize: 13, fontWeight: '800', marginRight: 8 },
  pct: { color: '#888', fontSize: 12, fontWeight: '600', minWidth: 32, textAlign: 'right' },
});

const microPill = StyleSheet.create({
  box: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, marginHorizontal: 4, alignItems: 'center' },
  val: { fontSize: 16, fontWeight: '900' },
  unit: { fontSize: 11, fontWeight: '500' },
  label: { fontSize: 11, marginTop: 2, letterSpacing: 1 },
});

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  titleBarSub: { color: C.muted, fontSize: 11, marginTop: 2, letterSpacing: 1 },
  titleBarAction: { color: C.green, fontSize: 14, fontWeight: '700' },
  histBtn: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  histBtnText: { color: C.green, fontWeight: '800', fontSize: 12 },
  scroll: { padding: 20, paddingBottom: 40 },

  modeToggle: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 4, marginBottom: 22 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: C.green },
  modeText: { color: C.muted, fontWeight: '800', fontSize: 13 },
  modeTextActive: { color: C.bg },

  shutterWrap: { alignSelf: 'center', marginTop: 24, marginBottom: 12 },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: C.green, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: C.green + '22', alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.green },

  actionRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, marginBottom: 18 },
  sideBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, marginHorizontal: 6 },
  sideBtnIcon: { fontSize: 14, marginRight: 6 },
  sideBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },

  tipBanner: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 14, marginTop: 8, alignItems: 'center' },
  tipBadge: { backgroundColor: C.green, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 10 },
  tipBadgeText: { color: C.bg, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  tipBannerText: { color: C.muted, fontSize: 12, lineHeight: 18, flex: 1 },

  label: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: C.surface, color: C.white, padding: 14, borderRadius: 12, fontSize: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, minHeight: 90, textAlignVertical: 'top' },
  inputHint: { color: C.muted, fontSize: 11, marginBottom: 16 },

  primaryBtn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 6 },
  primaryBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  ghostBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  ghostBtnText: { color: C.green, fontWeight: '700', fontSize: 14 },

  /* preview */
  previewWrap: { position: 'relative', marginBottom: 20 },
  previewImage: { width: '100%', height: 280, borderRadius: 18, backgroundColor: C.surface },
  previewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  previewOverlayText: { color: '#fff', fontWeight: '800', fontSize: 15, marginTop: 14 },
  previewOverlaySub: { color: '#bbb', fontSize: 12, marginTop: 4 },

  /* result */
  heroWrap: { position: 'relative', marginBottom: 16, borderRadius: 18, overflow: 'hidden' },
  resultImage: { width: '100%', height: 220, backgroundColor: C.surface },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: 'rgba(0,0,0,0.55)' },
  resultMeal: { color: '#fff', fontSize: 20, fontWeight: '900' },
  resultMealNoImg: { color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 4 },
  resultServing: { color: '#ddd', fontSize: 12, marginTop: 2 },
  resultHeaderText: { marginBottom: 14 },
  scoreFloat: { position: 'absolute', top: 12, right: 12, width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  scoreFloatInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  scoreFloatNum: { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  scoreFloatLbl: { color: '#bbb', fontSize: 9, fontWeight: '700' },

  donutCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  donutWrap: { width: 170, height: 170, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  calorieNum: { color: C.green, fontSize: 32, fontWeight: '900' },
  calorieLabel: { color: C.muted, fontSize: 11, letterSpacing: 2, marginTop: 2 },
  legendCol: { flex: 1, paddingLeft: 14 },

  microRow: { flexDirection: 'row', marginHorizontal: -4, marginBottom: 14 },

  segment: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 4, marginBottom: 14 },
  segmentBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: C.green },
  segmentText: { color: C.muted, fontWeight: '700', fontSize: 12 },
  segmentTextActive: { color: C.bg, fontWeight: '900' },

  tipsBox: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  boxTitle: { color: C.white, fontWeight: '800', marginBottom: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginRight: 8, marginTop: 7 },
  tip: { color: C.muted, fontSize: 13, lineHeight: 20, flex: 1 },

  addedBadge: { backgroundColor: C.green + '22', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  addedBadgeText: { color: C.green, fontWeight: '900', fontSize: 14 },

  /* recent strip */
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  recentTitle: { color: C.white, fontWeight: '800', fontSize: 14 },
  recentLink: { color: C.green, fontWeight: '700', fontSize: 12 },
  recentCard: { width: 140, backgroundColor: C.card, borderRadius: 14, marginRight: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  recentImg: { width: '100%', height: 90 },
  recentBody: { padding: 8 },
  recentMeal: { color: C.white, fontWeight: '800', fontSize: 12 },
  recentCal: { color: C.green, fontWeight: '700', fontSize: 11, marginTop: 2 },

  /* history view */
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { color: C.muted, fontSize: 15 },
  historyCard: { backgroundColor: C.card, borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  historyImage: { width: '100%', height: 140, backgroundColor: C.surface },
  historyBody: { padding: 12 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  historyMeal: { color: C.white, fontWeight: '800', fontSize: 14, flex: 1, marginRight: 8 },
  historyCal: { color: C.green, fontWeight: '700', fontSize: 13 },
  historyMacros: { color: C.muted, fontSize: 12, marginBottom: 3 },
  historyDate: { color: C.muted, fontSize: 11 },
});
