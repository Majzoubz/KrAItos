import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { generatePlanFromOnboarding } from '../utils/planGenerator';

const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';

const SINGLE_OPTIONS = {
  gender: ['Male', 'Female'],
  units: ['Metric', 'Imperial'],
  weightTrend: ['Gaining', 'Stable', 'Losing', 'Fluctuating'],
  bodyFat: ['5-9%', '10-14%', '15-19%', '20-24%', '25-29%', '30-34%', '35%+'],
  activityLevel: ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extremely Active'],
  trainingExp: ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Expert'],
  cardioExp: ['None', 'Beginner', 'Intermediate', 'Advanced', 'Athlete'],
  exerciseFreq: ['0', '1', '2', '3', '4', '5', '6', '7'],
  goal: ['Lose Fat', 'Build Muscle', 'Recomposition', 'Maintain', 'Performance'],
  diet: ['Balanced', 'Low-Carb', 'Keto', 'High Protein', 'Mediterranean'],
  calDistribution: ['Equal Daily', 'Training Split', 'Cheat Meal', 'Weekend Flex', 'Carb Cycling'],
  proteinIntake: ['1.6', '1.8', '2.0', '2.2', 'auto'],
};

const PROTEIN_LABEL = {
  '1.6': '1.6 g/kg', '1.8': '1.8 g/kg', '2.0': '2.0 g/kg', '2.2': '2.2 g/kg', 'auto': 'Let AI decide',
};

const MULTI_EXERCISE_TYPES = [
  'Weight Lifting', 'Cardio', 'Calisthenics', 'HIIT',
  'Yoga / Pilates', 'Sports', 'Swimming', 'CrossFit',
];

const FIELD_LABELS = {
  gender: 'Biological sex',
  birthday: 'Date of birth',
  units: 'Units',
  height: 'Height',
  weight: 'Current weight',
  maxWeight: 'Highest weight',
  weightTrend: 'Recent weight trend',
  bodyFat: 'Body fat estimate',
  activityLevel: 'Daily activity',
  trainingExp: 'Training experience',
  cardioExp: 'Cardio background',
  exerciseFreq: 'Workouts per week',
  goal: 'Main goal',
  targetWeight: 'Target weight',
  weeklyRate: 'Weekly rate of change',
  diet: 'Nutrition approach',
  exerciseType: 'Training preferences',
  calDistribution: 'Calorie distribution',
  proteinIntake: 'Protein target',
};

const SECTION_FIELDS = {
  Basics: ['gender', 'birthday', 'units', 'height', 'weight', 'maxWeight',
           'weightTrend', 'bodyFat', 'activityLevel', 'trainingExp', 'cardioExp', 'exerciseFreq'],
  Goal:   ['goal', 'targetWeight', 'weeklyRate'],
  Program: ['diet', 'exerciseType', 'calDistribution', 'proteinIntake'],
};

const DEFAULT_DATA = {
  gender: '', birthday: '', units: 'Metric',
  height: '', heightFt: '', heightIn: '', weight: '', maxWeight: '',
  weightTrend: '', bodyFat: '', activityLevel: '',
  trainingExp: '', cardioExp: '', exerciseFreq: '',
  goal: '', targetWeight: '', weeklyRate: '',
  diet: '', exerciseType: [], calDistribution: '', proteinIntake: '',
};

export default function MyInfoScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [data, setData] = useState(DEFAULT_DATA);
  const [original, setOriginal] = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...DEFAULT_DATA, ...parsed };
        if (!Array.isArray(merged.exerciseType)) merged.exerciseType = [];
        setData(merged);
        setOriginal(merged);
      }
    } catch (e) { console.warn('load info', e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (id, val) => setData(prev => ({ ...prev, [id]: val }));

  const toggleMulti = (id, val) => {
    setData(prev => {
      const cur = Array.isArray(prev[id]) ? prev[id] : [];
      const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
      return { ...prev, [id]: next };
    });
  };

  const dirty = JSON.stringify(data) !== JSON.stringify(original);

  const onSave = async () => {
    if (!dirty) {
      Alert.alert('No changes', 'You haven\'t edited anything.');
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data));
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000));
        await Promise.race([
          generatePlanFromOnboarding(data, user.email || user.uid),
          timeout,
        ]);
      } catch (e) {
        console.warn('Plan regen failed:', e.message);
        // Still save the info even if plan regen fails — Home will retry
      }
      setOriginal(data);
      const msg = 'Your info has been updated and your plan has been regenerated.';
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') window.alert(msg);
        onNavigate('home');
      } else {
        Alert.alert('Saved', msg, [{ text: 'OK', onPress: () => onNavigate('home') }]);
      }
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Could not save your info.');
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    const doReset = () => setData(original);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm && window.confirm('Discard your changes?')) doReset();
      else doReset();
      return;
    }
    Alert.alert('Discard changes', 'Reset all fields to last saved values?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: doReset },
    ]);
  };

  const renderChips = (id, options, labelMap = null) => (
    <View style={s.chipRow}>
      {options.map(opt => {
        const active = data[id] === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => updateField(id, opt)}
            activeOpacity={0.85}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>
              {labelMap ? labelMap[opt] : opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderMultiChips = (id, options) => (
    <View style={s.chipRow}>
      {options.map(opt => {
        const active = Array.isArray(data[id]) && data[id].includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && s.chipActive]}
            onPress={() => toggleMulti(id, opt)}
            activeOpacity={0.85}
          >
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderInput = (id, placeholder, keyboardType = 'default') => (
    <TextInput
      style={s.input}
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      value={String(data[id] || '')}
      onChangeText={(v) => updateField(id, v)}
      keyboardType={keyboardType}
    />
  );

  const renderField = (id) => {
    const label = FIELD_LABELS[id] || id;
    let body = null;

    if (id === 'birthday') {
      body = renderInput('birthday', 'DD/MM/YYYY');
    } else if (id === 'height') {
      if (data.units === 'Imperial') {
        body = (
          <View style={{ flexDirection: 'row' }}>
            <TextInput
              style={[s.input, { flex: 1, marginRight: 8 }]}
              placeholder="ft"
              placeholderTextColor={C.muted}
              value={String(data.heightFt || '')}
              onChangeText={(v) => {
                updateField('heightFt', v);
                const ft = parseFloat(v) || 0;
                const inch = parseFloat(data.heightIn) || 0;
                updateField('height', String(ft * 30.48 + inch * 2.54));
              }}
              keyboardType="numeric"
            />
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="in"
              placeholderTextColor={C.muted}
              value={String(data.heightIn || '')}
              onChangeText={(v) => {
                updateField('heightIn', v);
                const ft = parseFloat(data.heightFt) || 0;
                const inch = parseFloat(v) || 0;
                updateField('height', String(ft * 30.48 + inch * 2.54));
              }}
              keyboardType="numeric"
            />
          </View>
        );
      } else {
        body = renderInput('height', 'cm', 'numeric');
      }
    } else if (id === 'weight' || id === 'maxWeight' || id === 'targetWeight') {
      const unit = data.units === 'Metric' ? 'kg' : 'lbs';
      body = renderInput(id, unit, 'numeric');
    } else if (id === 'weeklyRate') {
      body = renderInput('weeklyRate', data.units === 'Metric' ? '0.5 kg/week' : '1 lb/week');
    } else if (id === 'exerciseType') {
      body = renderMultiChips('exerciseType', MULTI_EXERCISE_TYPES);
    } else if (id === 'proteinIntake') {
      body = renderChips('proteinIntake', SINGLE_OPTIONS.proteinIntake, PROTEIN_LABEL);
    } else if (SINGLE_OPTIONS[id]) {
      body = renderChips(id, SINGLE_OPTIONS[id]);
    } else {
      body = renderInput(id, '');
    }

    return (
      <View key={id} style={s.field}>
        <Text style={s.fieldLabel}>{label}</Text>
        {body}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titleBarText}>My Info</Text>
          <Text style={s.titleBarSub}>Edit your onboarding answers · plan adapts</Text>
        </View>
        {dirty && (
          <TouchableOpacity onPress={onReset} style={s.resetBtn}>
            <Text style={s.resetText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 50 }} size="large" />
      ) : (
        <>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {Object.entries(SECTION_FIELDS).map(([section, fields]) => (
              <View key={section} style={s.section}>
                <Text style={s.sectionTitle}>{section}</Text>
                {fields.map(renderField)}
              </View>
            ))}
            <View style={{ height: 80 }} />
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity
              style={[s.saveBtn, (!dirty || saving) && { opacity: 0.4 }]}
              onPress={onSave}
              disabled={!dirty || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={C.bg} />
                : <Text style={s.saveText}>{dirty ? 'Save & regenerate plan' : 'No changes to save'}</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
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
  resetBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.surface, borderRadius: 10 },
  resetText: { color: C.muted, fontSize: 12, fontWeight: '700' },

  scroll: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: C.green, fontSize: 11, fontWeight: '900',
    letterSpacing: 2, marginBottom: 12, paddingHorizontal: 4,
  },
  field: {
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.border,
  },
  fieldLabel: {
    color: C.white, fontSize: 13, fontWeight: '800', marginBottom: 10, letterSpacing: 0.2,
  },
  input: {
    backgroundColor: C.surface, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    color: C.white, fontSize: 14,
    borderWidth: 1, borderColor: C.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  chip: {
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: C.surface, borderRadius: 20,
    borderWidth: 1, borderColor: C.border,
    marginHorizontal: 3, marginBottom: 6,
  },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.white, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: C.bg, fontWeight: '900' },

  footer: {
    padding: 14, borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  saveBtn: {
    backgroundColor: C.green, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 14px rgba(127,255,0,0.35)' } : {}),
  },
  saveText: { color: C.bg, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
});
