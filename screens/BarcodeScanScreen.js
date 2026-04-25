import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, Platform, Animated, Easing,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { Storage, KEYS } from '../utils/storage';
import { lookupBarcode, macrosForGrams, macrosForServings } from '../utils/openFoodFacts';

let CameraView = null;
let useCameraPermissions = null;
try {
  const cam = require('expo-camera');
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {}

const TODAY = new Date().toDateString();
const MEAL_TIMES = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Snack'];
const MEAL_TIME_KEYS = {
  'Breakfast': 'barcode.mealTime.breakfast',
  'Morning Snack': 'barcode.mealTime.morningSnack',
  'Lunch': 'barcode.mealTime.lunch',
  'Afternoon Snack': 'barcode.mealTime.afternoonSnack',
  'Dinner': 'barcode.mealTime.dinner',
  'Late Snack': 'barcode.mealTime.lateSnack',
};

function pickMealTimeForNow() {
  const h = new Date().getHours();
  if (h < 10) return 'Breakfast';
  if (h < 12) return 'Morning Snack';
  if (h < 15) return 'Lunch';
  if (h < 18) return 'Afternoon Snack';
  if (h < 21) return 'Dinner';
  return 'Late Snack';
}

export default function BarcodeScanScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const { t, isRTL } = useI18n();
  const s = makeStyles(C);
  const uid = user.email || user.uid;

  const isWeb = Platform.OS === 'web';
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [{ granted: false }, async () => {}];

  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [unit, setUnit] = useState('servings'); // 'servings' | 'grams'
  const [amount, setAmount] = useState('1');
  const [mealTime, setMealTime] = useState(pickMealTimeForNow());
  const [editName, setEditName] = useState('');
  const [error, setError] = useState(null);
  const lastScannedRef = useRef({ code: null, ts: 0 });
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(lineAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(lineAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    if (!scanned) loop.start();
    return () => loop.stop();
  }, [scanned]);

  const doLookup = useCallback(async (code) => {
    setLoading(true);
    setError(null);
    setProduct(null);
    try {
      const p = await lookupBarcode(code);
      if (!p) {
        setError(t('barcode.notFound', { code }));
        setProduct({ barcode: code, name: '', brand: '', per100g: {}, perServing: null, servingQty: 0 });
      } else {
        setProduct(p);
        setEditName(p.name);
        setUnit(p.perServing ? 'servings' : 'grams');
        setAmount(p.perServing ? '1' : (p.servingQty ? String(p.servingQty) : '100'));
      }
    } catch (e) {
      setError(e.message || t('barcode.lookupFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScanned = ({ data, type }) => {
    if (!data) return;
    const now = Date.now();
    if (lastScannedRef.current.code === data && now - lastScannedRef.current.ts < 3000) return;
    lastScannedRef.current = { code: data, ts: now };
    setScanned(true);
    doLookup(data);
  };

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code) return;
    setScanned(true);
    doLookup(code);
  };

  const computedMacros = (() => {
    if (!product) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (unit === 'servings') return macrosForServings(product, amount);
    return macrosForGrams(product, amount);
  })();

  const addToLog = async () => {
    if (!product) return;
    const name = editName.trim() || product.name || 'Scanned product';
    const macros = computedMacros;
    if (!macros.calories && !macros.protein) {
      Alert.alert(t('barcode.alerts.needMacrosTitle'), t('barcode.alerts.needMacros'));
      return;
    }
    const FOOD_KEY = KEYS.FOODLOG(user.uid, TODAY);
    const existing = (await Storage.get(FOOD_KEY)) || [];
    const entry = {
      id: Date.now(),
      mealTime,
      name: product.brand ? `${product.brand} ${name}` : name,
      ...macros,
      addedAt: Date.now(),
      source: 'barcode',
      barcode: product.barcode,
    };
    await Storage.set(FOOD_KEY, [...existing, entry]);
    Alert.alert(
      t('barcode.alerts.loggedTitle'),
      t('barcode.alerts.loggedMsg', {
        name: entry.name,
        mealTime: t(MEAL_TIME_KEYS[mealTime] || 'barcode.mealTime.lunch'),
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      }),
      [
        { text: t('barcode.alerts.scanAnother'), onPress: () => resetForNext() },
        { text: t('barcode.alerts.done'), onPress: () => onNavigate('foodlog') },
      ]
    );
  };

  const resetForNext = () => {
    setScanned(false);
    setProduct(null);
    setError(null);
    setManualCode('');
  };

  if (!CameraView && !isWeb) {
    return (
      <SafeAreaView style={s.root}>
        <ScreenHeader C={C} s={s} onNavigate={onNavigate} t={t} isRTL={isRTL} />
        <View style={s.center}>
          <Text style={s.title}>{t('barcode.cameraUnavailableTitle')}</Text>
          <Text style={s.sub}>{t('barcode.cameraUnavailableSub')}</Text>
          <ManualEntry s={s} C={C} value={manualCode} onChange={setManualCode} onSubmit={submitManual} t={t} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader C={C} s={s} onNavigate={onNavigate} t={t} isRTL={isRTL} />

      {!scanned && !isWeb && permission?.granted && CameraView && (
        <View style={s.cameraWrap}>
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
            }}
            onBarcodeScanned={scanned ? undefined : handleScanned}
          />
          <View style={s.viewfinder}>
            <View style={[s.corner, s.cornerTL]} />
            <View style={[s.corner, s.cornerTR]} />
            <View style={[s.corner, s.cornerBL]} />
            <View style={[s.corner, s.cornerBR]} />
            <Animated.View style={[s.scanLine, {
              transform: [{ translateY: lineAnim.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] }) }],
            }]} />
          </View>
          <Text style={s.viewfinderHint}>{t('barcode.viewfinderHint')}</Text>
        </View>
      )}

      {!scanned && !isWeb && permission && !permission.granted && (
        <View style={s.center}>
          <Text style={s.title}>{t('barcode.permTitle')}</Text>
          <Text style={s.sub}>{t('barcode.permSub')}</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={requestPermission}>
            <Text style={s.primaryBtnText}>{t('barcode.grant')}</Text>
          </TouchableOpacity>
          <ManualEntry s={s} C={C} value={manualCode} onChange={setManualCode} onSubmit={submitManual} t={t} />
        </View>
      )}

      {!scanned && isWeb && (
        <View style={s.center}>
          <Text style={s.title}>{t('barcode.webTitle')}</Text>
          <Text style={s.sub}>{t('barcode.webSub')}</Text>
          <ManualEntry s={s} C={C} value={manualCode} onChange={setManualCode} onSubmit={submitManual} t={t} />
        </View>
      )}

      {scanned && (
        <ScrollView contentContainerStyle={s.resultScroll}>
          {loading && (
            <View style={s.center}>
              <ActivityIndicator color={C.green} size="large" />
              <Text style={s.sub}>{t('barcode.lookingUp')}</Text>
            </View>
          )}

          {error && (
            <View style={s.errorCard}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {product && !loading && (
            <>
              <View style={s.productCard}>
                <Text style={s.productBrand}>{product.brand || t('barcode.unknownBrand')}</Text>
                <TextInput
                  style={s.nameInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder={t('barcode.namePh')}
                  placeholderTextColor={C.muted}
                />
                <Text style={s.barcodeLabel}>{t('barcode.barcodeLabel', { code: product.barcode })}</Text>
                {product.nutriscore ? (
                  <View style={[s.nutriscorePill, nutriColor(product.nutriscore, C)]}>
                    <Text style={s.nutriscoreText}>{t('barcode.nutriscore', { grade: product.nutriscore })}</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.unitRow}>
                {product.perServing && (
                  <TouchableOpacity
                    style={[s.unitBtn, unit === 'servings' && s.unitBtnActive]}
                    onPress={() => { setUnit('servings'); setAmount('1'); }}
                  >
                    <Text style={[s.unitBtnText, unit === 'servings' && s.unitBtnTextActive]}>{t('barcode.unit.servings')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.unitBtn, unit === 'grams' && s.unitBtnActive]}
                  onPress={() => { setUnit('grams'); setAmount(product.servingQty ? String(product.servingQty) : '100'); }}
                >
                  <Text style={[s.unitBtnText, unit === 'grams' && s.unitBtnTextActive]}>{t('barcode.unit.grams')}</Text>
                </TouchableOpacity>
              </View>

              <View style={s.amountRow}>
                <TouchableOpacity style={s.stepBtn} onPress={() => setAmount(a => String(Math.max(0, (parseFloat(a) || 0) - (unit === 'grams' ? 10 : 0.5))))}>
                  <Text style={s.stepBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={s.amountInput}
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                />
                <Text style={s.amountUnit}>{unit === 'grams' ? t('barcode.unit.gShort') : t('barcode.unit.servShort')}</Text>
                <TouchableOpacity style={s.stepBtn} onPress={() => setAmount(a => String((parseFloat(a) || 0) + (unit === 'grams' ? 10 : 0.5)))}>
                  <Text style={s.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={s.macrosRow}>
                <Macro v={computedMacros.calories} label="kcal" C={C} />
                <Macro v={computedMacros.protein} label="P" C={C} />
                <Macro v={computedMacros.carbs}   label="C" C={C} />
                <Macro v={computedMacros.fat}     label="F" C={C} />
              </View>

              <Text style={s.sectionLabel}>{t('barcode.section.meal')}</Text>
              <View style={s.mealRow}>
                {MEAL_TIMES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.mealChip, mealTime === m && s.mealChipActive]}
                    onPress={() => setMealTime(m)}
                  >
                    <Text style={[s.mealChipText, mealTime === m && s.mealChipTextActive]}>{t(MEAL_TIME_KEYS[m])}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.addBtn} onPress={addToLog}>
                <Text style={s.addBtnText}>{t('barcode.addToLog')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.againBtn} onPress={resetForNext}>
                <Text style={s.againBtnText}>{t('barcode.scanAnother')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ScreenHeader({ C, s, onNavigate, t, isRTL }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={() => onNavigate('foodlog')} style={s.backBtn}>
        <Text style={s.backBtnText}>{isRTL ? '›' : '‹'}</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle}>{t('barcode.header')}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function ManualEntry({ s, C, value, onChange, onSubmit, t }) {
  return (
    <View style={s.manualWrap}>
      <Text style={s.manualLabel}>{t('barcode.manualLabel')}</Text>
      <View style={s.manualRow}>
        <TextInput
          style={s.manualInput}
          value={value}
          onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
          placeholder={t('barcode.manualPh')}
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
        />
        <TouchableOpacity style={s.manualBtn} onPress={onSubmit}>
          <Text style={s.manualBtnText}>{t('barcode.lookup')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Macro({ v, label, C }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: C.white, fontSize: 18, fontWeight: '900' }}>{v}</Text>
      <Text style={{ color: C.muted, fontSize: 10, marginTop: 2, fontWeight: '800', letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

function nutriColor(grade, C) {
  const map = { A: '#1B873E', B: '#7BB42A', C: '#F2C61F', D: '#F08423', E: '#D9342B' };
  return { backgroundColor: (map[grade] || C.card) + 'EE' };
}

const makeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: C.white, fontSize: 20, fontWeight: '900', marginBottom: 8 },
  sub: { color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 19 },
  primaryBtn: { backgroundColor: C.green, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 12, marginBottom: 24 },
  primaryBtnText: { color: C.bg, fontWeight: '900' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: C.white, fontSize: 22, fontWeight: '700', marginTop: -2 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '800' },

  cameraWrap: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  viewfinder: {
    position: 'absolute', top: '30%', left: '15%', right: '15%', height: 180,
    alignItems: 'center', justifyContent: 'center',
  },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: C.green },
  cornerTL: { top: 0, left: 0, borderLeftWidth: 4, borderTopWidth: 4 },
  cornerTR: { top: 0, right: 0, borderRightWidth: 4, borderTopWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderLeftWidth: 4, borderBottomWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderRightWidth: 4, borderBottomWidth: 4 },
  scanLine: { position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: C.green, opacity: 0.8 },
  viewfinderHint: {
    position: 'absolute', bottom: 30, alignSelf: 'center',
    color: C.white, fontSize: 13, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },

  manualWrap: { width: '100%', marginTop: 14 },
  manualLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1, backgroundColor: C.card, color: C.white, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: C.border,
  },
  manualBtn: { backgroundColor: C.green, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12 },
  manualBtnText: { color: C.bg, fontWeight: '900' },

  resultScroll: { padding: 16, paddingBottom: 40 },
  errorCard: { backgroundColor: C.card, padding: 14, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  errorText: { color: C.muted, fontSize: 13, lineHeight: 19 },

  productCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  productBrand: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  nameInput: { color: C.white, fontSize: 18, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 6 },
  barcodeLabel: { color: C.muted, fontSize: 11, marginTop: 8 },
  nutriscorePill: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  nutriscoreText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  unitBtn: { flex: 1, backgroundColor: C.card, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  unitBtnActive: { backgroundColor: C.green, borderColor: C.green },
  unitBtnText: { color: C.muted, fontWeight: '800' },
  unitBtnTextActive: { color: C.bg },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, justifyContent: 'center' },
  stepBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  stepBtnText: { color: C.white, fontSize: 22, fontWeight: '800' },
  amountInput: { backgroundColor: C.card, color: C.white, fontSize: 20, fontWeight: '900', textAlign: 'center', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border, minWidth: 80 },
  amountUnit: { color: C.muted, fontSize: 13, fontWeight: '800' },

  macrosRow: { flexDirection: 'row', backgroundColor: C.card, paddingVertical: 14, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  mealRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  mealChip: { backgroundColor: C.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  mealChipActive: { backgroundColor: C.green, borderColor: C.green },
  mealChipText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  mealChipTextActive: { color: C.bg, fontWeight: '900' },

  addBtn: { backgroundColor: C.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  addBtnText: { color: C.bg, fontWeight: '900', fontSize: 14, letterSpacing: 1.5 },
  againBtn: { paddingVertical: 14, alignItems: 'center' },
  againBtnText: { color: C.muted, fontSize: 12, textDecorationLine: 'underline' },
});
