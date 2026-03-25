import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
  Animated, Image, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { C } from '../constants/theme';
import { callAI, callAIWithImage, parseJSON } from '../utils/api';
import { Auth } from '../utils/auth';
import { Storage, KEYS } from '../utils/storage';

const { width } = Dimensions.get('window');

const NUTRITION_SYSTEM = 'You are a professional nutritionist. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure: {"meal":"name","calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodium":number,"servingSize":"description","healthScore":number,"tips":["tip1","tip2"]}. All macros in grams. healthScore is 1-10.';

export default function FoodScannerScreen({ user, onUserUpdate, onAddToLog }) {
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
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef(null);

  useEffect(() => {
    Storage.get(KEYS.MEALS(user.uid)).then(h => setHistory(h || []));
  }, []);

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
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setCaptured(result.assets[0].uri);
      setMimeType(result.assets[0].mimeType || 'image/jpeg');
      setPhase('preview');
    }
  };

  const pickFromLibrary = async () => {
    const ok = await requestPermission('library');
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setCaptured(result.assets[0].uri);
      setMimeType(result.assets[0].mimeType || 'image/jpeg');
      setPhase('preview');
    }
  };

  const analyze = async () => {
    setLoading(true);
    startSpin();
    try {
      let raw;
      if (capturedImage) {
        // Convert image to base64
        const base64 = await FileSystem.readAsStringAsync(capturedImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
        raw = await callAIWithImage(base64, mimeType, description.trim() || null);
      } else {
        if (!description.trim()) {
          Alert.alert('Add a description', 'Please take a photo or describe your meal.');
          setLoading(false); stopSpin(); return;
        }
        raw = await callAI(NUTRITION_SYSTEM, 'Analyze this meal: ' + description.trim());
      }

      const parsed = parseJSON(raw, null);
      if (!parsed || typeof parsed.calories !== 'number') {
        Alert.alert('Could not analyze', 'The AI could not identify the meal. Try a clearer photo or add more description.');
        setLoading(false); stopSpin(); return;
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

      const updated = await Auth.updateUser(user.uid, {
        mealsScanned: (user.mealsScanned || 0) + 1,
      });
      const withStreak = await Auth.logActivity(user.uid);
      if (withStreak && onUserUpdate) onUserUpdate(withStreak);
      else if (updated && onUserUpdate) onUserUpdate(updated);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not reach AI. Check your internet and API key.');
    } finally {
      setLoading(false);
      stopSpin();
    }
  };

  const startSpin = () => {
    spinAnim.setValue(0);
    spinLoop.current = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
    );
    spinLoop.current.start();
  };

  const stopSpin = () => {
    spinLoop.current?.stop();
    spinAnim.setValue(0);
  };

  const reset = () => {
    setPhase('idle');
    setCaptured(null);
    setDesc('');
    setResult(null);
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scoreColor = result
    ? result.healthScore >= 7 ? C.green : result.healthScore >= 5 ? C.orange : C.danger
    : C.green;

  //  HISTORY VIEW 
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
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No meals scanned yet.</Text>
            </View>
          )}
          {history.map((h, i) => (
            <View key={i} style={s.historyCard}>
              {h.imageUri && (
                <Image source={{ uri: h.imageUri }} style={s.historyImage} />
              )}
              <View style={s.historyBody}>
                <View style={s.historyTop}>
                  <Text style={s.historyMeal} numberOfLines={1}>{h.meal}</Text>
                  <Text style={s.historyCal}>{h.calories} kcal</Text>
                </View>
                <Text style={s.historyMacros}>
                  P: {h.protein}g  C: {h.carbs}g  F: {h.fat}g
                </Text>
                <Text style={s.historyDate}>
                  {new Date(h.scannedAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  //  RESULT VIEW 
  if (phase === 'result' && result) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}>
          <Text style={s.titleBarText}>Nutrition Facts</Text>
          <TouchableOpacity onPress={reset}>
            <Text style={s.titleBarAction}>Scan Again</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          {capturedImage && (
            <Image source={{ uri: capturedImage }} style={s.resultImage} />
          )}
          <View style={s.resultHeader}>
            <Text style={s.resultMeal}>{result.meal}</Text>
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

          {result.ingredients && result.ingredients.length > 0 && (
            <View style={s.ingredientsBox}>
              <Text style={s.boxTitle}>Detected Ingredients</Text>
              <View style={s.ingredientsList}>
                {result.ingredients.map((ing, i) => (
                  <View key={i} style={s.ingredientChip}>
                    <Text style={s.ingredientText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {result.tips && result.tips.length > 0 && (
            <View style={s.tipsBox}>
              <Text style={s.boxTitle}>Nutritionist Tips</Text>
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
              style={s.addToLogBtn}
              onPress={async () => {
                const TODAY = new Date().toDateString();
                const FOOD_KEY = KEYS.FOODLOG(user.uid, TODAY);
                const existing = await Storage.get(FOOD_KEY) || [];
                const entry = {
                  id: Date.now(),
                  name: result.meal || mealName,
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
              <Text style={s.addToLogBtnText}>Add to Today's Food Log</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.addedBadge}>
              <Text style={s.addedBadgeText}>Added to today's log!</Text>
            </View>
          )}
          <TouchableOpacity style={s.btn} onPress={() => { reset(); setAddedToLog(false); }}>
            <Text style={s.btnText}>Scan Another Meal</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  //  PREVIEW VIEW 
  if (phase === 'preview') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}>
          <TouchableOpacity onPress={() => setPhase('idle')}>
            <Text style={s.titleBarAction}>Retake</Text>
          </TouchableOpacity>
          <Text style={s.titleBarText}>Review Photo</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          <Image source={{ uri: capturedImage }} style={s.previewImage} />

          <Text style={s.label}>Add description (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="e.g. large portion, added extra cheese, home cooked..."
            placeholderTextColor={C.muted}
            value={description}
            onChangeText={setDesc}
            multiline
          />
          <Text style={s.inputHint}>Adding context helps the AI give more accurate results</Text>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={analyze} disabled={loading}>
            {loading
              ? (
                <View style={s.loadingRow}>
                  <Animated.View style={[s.ring, { transform: [{ rotate: spin }] }]} />
                  <Text style={[s.btnText, { marginLeft: 12 }]}>Analyzing photo...</Text>
                </View>
              )
              : <Text style={s.btnText}>Analyze This Meal</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  //  IDLE / MAIN VIEW 
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Food Scanner</Text>
        <TouchableOpacity onPress={() => setShowHistory(true)}>
          <Text style={s.titleBarAction}>
            {history.length > 0 ? 'History (' + history.length + ')' : 'History'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Text style={s.sectionTitle}>Take or choose a photo</Text>
        <View style={s.photoOptions}>
          <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
            <View style={s.photoBtnIcon}>
              <Text style={s.photoBtnIconText}>CAM</Text>
            </View>
            <Text style={s.photoBtnLabel}>Take Photo</Text>
            <Text style={s.photoBtnDesc}>Use your camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.photoBtn} onPress={pickFromLibrary}>
            <View style={[s.photoBtnIcon, { backgroundColor: C.blue + '22' }]}>
              <Text style={[s.photoBtnIconText, { color: C.blue }]}>LIB</Text>
            </View>
            <Text style={s.photoBtnLabel}>From Library</Text>
            <Text style={s.photoBtnDesc}>Choose existing photo</Text>
          </TouchableOpacity>
        </View>

        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or describe it manually</Text>
          <View style={s.dividerLine} />
        </View>

        <Text style={s.label}>What did you eat?</Text>
        <TextInput
          style={s.input}
          placeholder="e.g. 200g grilled chicken with brown rice and salad"
          placeholderTextColor={C.muted}
          value={description}
          onChangeText={setDesc}
          multiline
        />
        <Text style={s.inputHint}>Be specific with portions for better accuracy</Text>

        <TouchableOpacity
          style={[s.btn, (loading || !description.trim()) && { opacity: 0.4 }]}
          onPress={analyze}
          disabled={loading || !description.trim()}
        >
          {loading
            ? <><ActivityIndicator color={C.bg} /><Text style={[s.btnText, { marginLeft: 8 }]}>Analyzing...</Text></>
            : <Text style={s.btnText}>Analyze by Text</Text>
          }
        </TouchableOpacity>

        <View style={s.tipBanner}>
          <Text style={s.tipBannerTitle}>For best results</Text>
          <Text style={s.tipBannerText}>Take a clear top-down photo of your full plate in good lighting. You can also add a short description for extra accuracy.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 20, fontWeight: '900' },
  titleBarAction: { color: C.green, fontSize: 14, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40 },
  sectionTitle: { color: C.white, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  photoOptions: { flexDirection: 'row', marginBottom: 20 },
  photoBtn: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 16, alignItems: 'center', marginRight: 10 },
  photoBtnIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.green + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  photoBtnIconText: { color: C.green, fontWeight: '900', fontSize: 11 },
  photoBtnLabel: { color: C.white, fontWeight: '800', fontSize: 14, marginBottom: 3 },
  photoBtnDesc: { color: C.muted, fontSize: 11 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { color: C.muted, fontSize: 12, marginHorizontal: 10 },
  label: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: C.surface, color: C.white, padding: 14, borderRadius: 12, fontSize: 14, marginBottom: 6, borderWidth: 1, borderColor: C.border, minHeight: 90, textAlignVertical: 'top' },
  inputHint: { color: C.muted, fontSize: 11, marginBottom: 16 },
  btn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  btnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },
  ring: { width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: C.bg, borderTopColor: 'transparent' },
  tipBanner: { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginTop: 20, borderLeftWidth: 3, borderLeftColor: C.green },
  tipBannerTitle: { color: C.green, fontWeight: '800', fontSize: 13, marginBottom: 4 },
  tipBannerText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  previewImage: { width: '100%', height: 260, borderRadius: 16, marginBottom: 20, backgroundColor: C.surface },
  resultImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16, backgroundColor: C.surface },
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
  ingredientsBox: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  boxTitle: { color: C.white, fontWeight: '800', marginBottom: 10 },
  ingredientsList: { flexDirection: 'row', flexWrap: 'wrap' },
  ingredientChip: { backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6 },
  ingredientText: { color: C.muted, fontSize: 12 },
  tipsBox: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.green, marginRight: 8, marginTop: 7 },
  tip: { color: C.muted, fontSize: 13, lineHeight: 20, flex: 1 },
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
  addToLogBtn: { backgroundColor: C.green, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  addToLogBtnText: { color: C.bg, fontSize: 15, fontWeight: '900' },
  addedBadge: { backgroundColor: C.green + '22', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  addedBadgeText: { color: C.green, fontWeight: '800', fontSize: 14 },
});