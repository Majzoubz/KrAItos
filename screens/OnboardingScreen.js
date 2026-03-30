import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Animated, Dimensions, Platform,
} from 'react-native';
import { C } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const BODY_FAT_LEVELS = [
  { range: '5-9%', label: 'Very Lean', desc: 'Visible abs, veins, striations' },
  { range: '10-14%', label: 'Lean', desc: 'Defined abs, some vascularity' },
  { range: '15-19%', label: 'Fit', desc: 'Some definition, minimal fat' },
  { range: '20-24%', label: 'Average', desc: 'Soft midsection, no visible abs' },
  { range: '25-29%', label: 'Above Avg', desc: 'Noticeable belly, wider waist' },
  { range: '30-34%', label: 'Overweight', desc: 'Round midsection, excess fat' },
  { range: '35%+', label: 'Obese', desc: 'Significant excess body fat' },
];

const SECTIONS = {
  BASICS: 'Basic Info',
  GOAL: 'Your Goal',
  PROGRAM: 'Program Design',
};

const STEPS = [
  { id: 'birthday', section: SECTIONS.BASICS, title: 'When were you born?', subtitle: 'This helps us calculate your metabolic rate' },
  { id: 'height', section: SECTIONS.BASICS, title: "What's your height?", subtitle: 'Used to calculate your BMI and caloric needs' },
  { id: 'weight', section: SECTIONS.BASICS, title: "What's your current weight?", subtitle: 'We use this as your starting point' },
  { id: 'maxWeight', section: SECTIONS.BASICS, title: "What's the max weight you've ever reached?", subtitle: 'Helps us understand your body history' },
  { id: 'weightTrend', section: SECTIONS.BASICS, title: "What's your weight trend in the past few weeks?", subtitle: 'This helps calibrate your plan' },
  { id: 'bodyFat', section: SECTIONS.BASICS, title: 'Estimate your body fat level', subtitle: 'Select the range that best matches your current physique' },
  { id: 'exerciseFreq', section: SECTIONS.BASICS, title: 'How often do you exercise?', subtitle: 'Times per week on average' },
  { id: 'activityLevel', section: SECTIONS.BASICS, title: "What's your daily activity level?", subtitle: 'Outside of intentional exercise' },
  { id: 'trainingExp', section: SECTIONS.BASICS, title: 'Training experience level', subtitle: 'How experienced are you with resistance training?' },
  { id: 'cardioExp', section: SECTIONS.BASICS, title: 'Cardio experience', subtitle: 'How experienced are you with cardiovascular training?' },
  { id: 'goal', section: SECTIONS.GOAL, title: "What's your primary goal?", subtitle: 'We will tailor everything around this' },
  { id: 'targetWeight', section: SECTIONS.GOAL, title: 'What is your target weight?', subtitle: 'The weight you want to reach' },
  { id: 'weeklyLoss', section: SECTIONS.GOAL, title: 'How much do you want to lose per week?', subtitle: 'Recommended: 0.5 - 1 kg per week for sustainable results' },
  { id: 'diet', section: SECTIONS.PROGRAM, title: 'Preferred diet style', subtitle: 'Choose the approach that fits your lifestyle' },
  { id: 'needExercise', section: SECTIONS.PROGRAM, title: 'Do you want to include exercise?', subtitle: 'Exercise accelerates results and improves health' },
  { id: 'exerciseType', section: SECTIONS.PROGRAM, title: 'What type of exercise?', subtitle: 'Select all that interest you' },
  { id: 'calDistribution', section: SECTIONS.PROGRAM, title: 'Calorie distribution', subtitle: 'How do you want to spread your calories across the week?' },
  { id: 'proteinIntake', section: SECTIONS.PROGRAM, title: 'Protein intake preference', subtitle: 'Higher protein helps preserve muscle during fat loss' },
];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [data, setData] = useState({
    birthday: '',
    height: '',
    weight: '',
    maxWeight: '',
    weightTrend: '',
    bodyFat: '',
    exerciseFreq: '',
    activityLevel: '',
    trainingExp: '',
    cardioExp: '',
    goal: '',
    targetWeight: '',
    weeklyLoss: '',
    diet: '',
    needExercise: '',
    exerciseType: [],
    calDistribution: '',
    proteinIntake: '',
  });

  const currentStep = STEPS[step];
  const currentSection = currentStep.section;
  const totalSteps = STEPS.length;
  const progress = (step + 1) / totalSteps;

  const sectionSteps = STEPS.filter(s => s.section === currentSection);
  const sectionIndex = sectionSteps.findIndex(s => s.id === currentStep.id);

  const animateTo = (nextStep) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const goNext = () => {
    if (step < totalSteps - 1) animateTo(step + 1);
    else onComplete(data);
  };

  const goBack = () => {
    if (step > 0) animateTo(step - 1);
  };

  const updateField = (key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const toggleExerciseType = (type) => {
    setData(prev => {
      const arr = prev.exerciseType || [];
      return { ...prev, exerciseType: arr.includes(type) ? arr.filter(t => t !== type) : [...arr, type] };
    });
  };

  const canProceed = () => {
    const val = data[currentStep.id];
    const id = currentStep.id;
    if (id === 'exerciseType') return data.exerciseType.length > 0;
    if (id === 'needExercise' && data.needExercise === 'No') return true;
    if (val === '' || val === undefined || val === null) return false;
    if (['height', 'weight', 'maxWeight', 'targetWeight'].includes(id)) {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num < 500;
    }
    if (id === 'birthday') {
      return val.length >= 8;
    }
    return true;
  };

  const shouldSkipExerciseType = () => {
    return currentStep.id === 'exerciseType' && data.needExercise === 'No';
  };

  const renderInput = () => {
    const id = currentStep.id;

    switch (id) {
      case 'birthday':
        return (
          <View>
            <TextInput
              style={s.textInput}
              placeholder="DD / MM / YYYY"
              placeholderTextColor={C.muted}
              value={data.birthday}
              onChangeText={v => updateField('birthday', v)}
              keyboardType="numeric"
              maxLength={14}
            />
            <Text style={s.inputHint}>Enter your date of birth</Text>
          </View>
        );

      case 'height':
        return (
          <View>
            <View style={s.unitInputRow}>
              <TextInput
                style={[s.textInput, { flex: 1 }]}
                placeholder="175"
                placeholderTextColor={C.muted}
                value={data.height}
                onChangeText={v => updateField('height', v)}
                keyboardType="numeric"
              />
              <View style={s.unitBadge}><Text style={s.unitText}>cm</Text></View>
            </View>
          </View>
        );

      case 'weight':
      case 'maxWeight':
      case 'targetWeight':
        return (
          <View>
            <View style={s.unitInputRow}>
              <TextInput
                style={[s.textInput, { flex: 1 }]}
                placeholder={id === 'weight' ? '80' : id === 'maxWeight' ? '95' : '70'}
                placeholderTextColor={C.muted}
                value={data[id]}
                onChangeText={v => updateField(id, v)}
                keyboardType="numeric"
              />
              <View style={s.unitBadge}><Text style={s.unitText}>kg</Text></View>
            </View>
          </View>
        );

      case 'weeklyLoss':
        return (
          <View>
            {['0.25 kg', '0.5 kg', '0.75 kg', '1 kg', '1.25 kg', '1.5 kg'].map(opt => (
              <TouchableOpacity
                key={opt}
                style={[s.optionCard, data.weeklyLoss === opt && s.optionCardActive]}
                onPress={() => updateField('weeklyLoss', opt)}
              >
                <Text style={[s.optionText, data.weeklyLoss === opt && s.optionTextActive]}>{opt}</Text>
                <Text style={s.optionDesc}>
                  {opt === '0.25 kg' ? 'Very slow & sustainable' :
                   opt === '0.5 kg' ? 'Recommended for most' :
                   opt === '0.75 kg' ? 'Moderate pace' :
                   opt === '1 kg' ? 'Aggressive but doable' :
                   opt === '1.25 kg' ? 'Very aggressive' : 'Maximum recommended'}
                </Text>
                {data.weeklyLoss === opt && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'weightTrend':
        return renderOptions(['Going up', 'Stable', 'Going down', 'Fluctuating'], 'weightTrend');

      case 'bodyFat':
        return (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
            {BODY_FAT_LEVELS.map(bf => (
              <TouchableOpacity
                key={bf.range}
                style={[s.bodyFatCard, data.bodyFat === bf.range && s.optionCardActive]}
                onPress={() => updateField('bodyFat', bf.range)}
              >
                <View style={s.bodyFatHeader}>
                  <View style={s.bodyFatIcon}>
                    <Text style={s.bodyFatIconText}>
                      {bf.range === '5-9%' ? '◇' : bf.range === '10-14%' ? '◈' : bf.range === '15-19%' ? '○' :
                       bf.range === '20-24%' ? '●' : bf.range === '25-29%' ? '◉' : bf.range === '30-34%' ? '◎' : '⬤'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.optionText, data.bodyFat === bf.range && s.optionTextActive]}>
                      {bf.range} — {bf.label}
                    </Text>
                    <Text style={s.optionDesc}>{bf.desc}</Text>
                  </View>
                  {data.bodyFat === bf.range && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        );

      case 'exerciseFreq':
        return renderOptions(['0 days', '1-2 days', '3-4 days', '5-6 days', 'Every day'], 'exerciseFreq');

      case 'activityLevel':
        return renderOptionsWithDesc([
          { label: 'Sedentary', desc: 'Desk job, minimal movement' },
          { label: 'Lightly Active', desc: 'Light walking, some standing' },
          { label: 'Moderately Active', desc: 'On your feet most of the day' },
          { label: 'Very Active', desc: 'Physical job or very active lifestyle' },
          { label: 'Extremely Active', desc: 'Intense physical labor or athlete' },
        ], 'activityLevel');

      case 'trainingExp':
        return renderOptionsWithDesc([
          { label: 'Beginner', desc: 'Less than 6 months' },
          { label: 'Novice', desc: '6 months to 1 year' },
          { label: 'Intermediate', desc: '1 to 3 years' },
          { label: 'Advanced', desc: '3 to 5 years' },
          { label: 'Expert', desc: '5+ years consistent training' },
        ], 'trainingExp');

      case 'cardioExp':
        return renderOptionsWithDesc([
          { label: 'None', desc: "I don't do cardio" },
          { label: 'Beginner', desc: 'Occasional walks or light cardio' },
          { label: 'Intermediate', desc: 'Regular cardio 2-3x/week' },
          { label: 'Advanced', desc: 'Structured cardio program' },
          { label: 'Athlete', desc: 'Competitive endurance level' },
        ], 'cardioExp');

      case 'goal':
        return renderOptionsWithDesc([
          { label: 'Lose Weight', desc: 'Burn fat and get leaner' },
          { label: 'Build Muscle', desc: 'Gain lean mass and strength' },
          { label: 'Body Recomposition', desc: 'Lose fat and gain muscle simultaneously' },
          { label: 'Maintain Weight', desc: 'Keep current weight, improve composition' },
          { label: 'Improve Health', desc: 'Focus on overall wellness and energy' },
          { label: 'Athletic Performance', desc: 'Optimize for sport or competition' },
        ], 'goal');

      case 'diet':
        return renderOptionsWithDesc([
          { label: 'Balanced', desc: '40% carbs, 30% protein, 30% fat' },
          { label: 'Low-Fat', desc: 'Higher carb, lower fat approach' },
          { label: 'Low-Carb', desc: 'Reduced carbs, higher fat and protein' },
          { label: 'Keto', desc: 'Very low carb, high fat' },
          { label: 'High Protein', desc: 'Protein-focused for muscle preservation' },
          { label: 'Mediterranean', desc: 'Whole foods, healthy fats, lean protein' },
        ], 'diet');

      case 'needExercise':
        return renderOptions(['Yes', 'No'], 'needExercise');

      case 'exerciseType':
        if (data.needExercise === 'No') {
          return (
            <View style={s.skipNotice}>
              <Text style={s.skipNoticeText}>You chose not to include exercise. Press Continue to proceed.</Text>
            </View>
          );
        }
        return (
          <View>
            {['Cardio', 'Weight Lifting', 'Calisthenics', 'HIIT', 'Yoga / Pilates', 'Sports', 'Swimming', 'CrossFit'].map(type => (
              <TouchableOpacity
                key={type}
                style={[s.optionCard, data.exerciseType.includes(type) && s.optionCardActive]}
                onPress={() => toggleExerciseType(type)}
              >
                <Text style={[s.optionText, data.exerciseType.includes(type) && s.optionTextActive]}>{type}</Text>
                {data.exerciseType.includes(type) && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
              </TouchableOpacity>
            ))}
            <Text style={s.inputHint}>Select all that apply</Text>
          </View>
        );

      case 'calDistribution':
        return renderOptionsWithDesc([
          { label: 'Equal Every Day', desc: 'Same calories each day for simplicity' },
          { label: 'Higher on Training Days', desc: 'More calories when you work out' },
          { label: 'Weekly Cheat Meal', desc: 'One higher-calorie day per week' },
          { label: 'Weekend Flexibility', desc: 'Slightly higher on weekends' },
          { label: 'Carb Cycling', desc: 'Alternate high and low carb days' },
        ], 'calDistribution');

      case 'proteinIntake':
        return renderOptionsWithDesc([
          { label: 'Standard (1.6g/kg)', desc: 'Good for general fitness' },
          { label: 'Moderate (1.8g/kg)', desc: 'Ideal for fat loss with muscle retention' },
          { label: 'High (2.0g/kg)', desc: 'Best for building muscle' },
          { label: 'Very High (2.2g/kg)', desc: 'For experienced lifters in a deficit' },
          { label: 'Let AI Decide', desc: 'We will calculate the optimal amount for you' },
        ], 'proteinIntake');

      default:
        return null;
    }
  };

  const renderOptions = (options, field) => (
    <View>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[s.optionCard, data[field] === opt && s.optionCardActive]}
          onPress={() => updateField(field, opt)}
        >
          <Text style={[s.optionText, data[field] === opt && s.optionTextActive]}>{opt}</Text>
          {data[field] === opt && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOptionsWithDesc = (options, field) => (
    <View>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.label}
          style={[s.optionCard, data[field] === opt.label && s.optionCardActive]}
          onPress={() => updateField(field, opt.label)}
        >
          <View style={{ flex: 1 }}>
            <Text style={[s.optionText, data[field] === opt.label && s.optionTextActive]}>{opt.label}</Text>
            <Text style={s.optionDesc}>{opt.desc}</Text>
          </View>
          {data[field] === opt.label && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
        </TouchableOpacity>
      ))}
    </View>
  );

  const skipIfNeeded = () => {
    if (shouldSkipExerciseType()) {
      if (step < totalSteps - 1) animateTo(step + 1);
      else onComplete(data);
      return;
    }
    goNext();
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          {step > 0 ? (
            <TouchableOpacity style={s.backBtn} onPress={goBack}>
              <Text style={s.backIcon}>←</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 44 }} />}
          <View style={s.sectionBadge}>
            <Text style={s.sectionBadgeText}>{currentSection}</Text>
          </View>
          <Text style={s.stepCounter}>{step + 1}/{totalSteps}</Text>
        </View>
        <View style={s.progressBarBg}>
          <View style={[s.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        style={s.body}
        contentContainerStyle={s.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={s.title}>{currentStep.title}</Text>
          <Text style={s.subtitle}>{currentStep.subtitle}</Text>
          <View style={s.inputArea}>
            {renderInput()}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.continueBtn, !canProceed() && !shouldSkipExerciseType() && s.continueBtnDisabled]}
          onPress={skipIfNeeded}
          disabled={!canProceed() && !shouldSkipExerciseType()}
        >
          <Text style={[s.continueBtnText, !canProceed() && !shouldSkipExerciseType() && s.continueBtnTextDisabled]}>
            {step === totalSteps - 1 ? 'Complete Setup' : 'Continue'}
          </Text>
          <Text style={[s.continueArrow, !canProceed() && !shouldSkipExerciseType() && s.continueBtnTextDisabled]}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: Platform.OS === 'web' ? 50 : 60, paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backIcon: { color: C.white, fontSize: 20, fontWeight: '600' },
  sectionBadge: { backgroundColor: C.greenGlow, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.green + '30' },
  sectionBadgeText: { color: C.green, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  stepCounter: { color: C.muted, fontSize: 14, fontWeight: '600' },
  progressBarBg: { height: 3, backgroundColor: C.surface, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: C.green, borderRadius: 2 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  title: { color: C.white, fontSize: 26, fontWeight: '800', lineHeight: 34, marginBottom: 8 },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 32 },
  inputArea: {},
  textInput: {
    backgroundColor: C.surface, color: C.white, fontSize: 18, fontWeight: '600',
    paddingHorizontal: 20, paddingVertical: 18, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
  },
  unitInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitBadge: { backgroundColor: C.green, paddingHorizontal: 16, paddingVertical: 18, borderRadius: 16 },
  unitText: { color: C.bg, fontSize: 16, fontWeight: '800' },
  inputHint: { color: C.muted, fontSize: 13, marginTop: 12, marginLeft: 4 },
  optionCard: {
    backgroundColor: C.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20,
    marginBottom: 10, borderWidth: 1.5, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center',
  },
  optionCardActive: { borderColor: C.green, backgroundColor: C.greenGlow2 },
  optionText: { color: C.light, fontSize: 16, fontWeight: '700' },
  optionTextActive: { color: C.green },
  optionDesc: { color: C.muted, fontSize: 13, marginTop: 3 },
  checkMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  checkText: { color: C.bg, fontSize: 16, fontWeight: '800' },
  bodyFatCard: {
    backgroundColor: C.surface, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10, borderWidth: 1.5, borderColor: C.border,
  },
  bodyFatHeader: { flexDirection: 'row', alignItems: 'center' },
  bodyFatIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  bodyFatIconText: { color: C.green, fontSize: 18 },
  skipNotice: { backgroundColor: C.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  skipNoticeText: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'web' ? 30 : 40, paddingTop: 12, backgroundColor: C.bg },
  continueBtn: {
    backgroundColor: C.green, paddingVertical: 18, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  continueBtnDisabled: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  continueBtnText: { color: C.bg, fontSize: 17, fontWeight: '800' },
  continueBtnTextDisabled: { color: C.muted },
  continueArrow: { color: C.bg, fontSize: 20, fontWeight: '700', marginLeft: 8 },
});
