import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, Animated, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { tick as hTick, select as hSelect, success as hSuccess } from '../utils/haptics';

const pad2 = (n) => String(n).padStart(2, '0');
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const parseDOB = (s) => {
  const m = (s || '').match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/);
  if (m) return { d: +m[1], mo: +m[2], y: +m[3] };
  return null;
};

const formatDOB = (d, mo, y) => `${pad2(d)}/${pad2(mo)}/${y}`;

const ageFrom = (d, mo, y) => {
  const t = new Date();
  let a = t.getFullYear() - y;
  const md = t.getMonth() + 1 - mo;
  if (md < 0 || (md === 0 && t.getDate() < d)) a -= 1;
  return a;
};

function WheelColumn({ items, value, onChange, width = 70, itemHeight = 44, formatItem }) {
  const { C } = useTheme();
  const ref = useRef(null);
  const initialIdx = Math.max(0, items.indexOf(value));
  const [scrollIdx, setScrollIdx] = useState(initialIdx);
  const lastIdxRef = useRef(initialIdx);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: initialIdx * itemHeight, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / itemHeight)));
    if (i !== lastIdxRef.current) {
      lastIdxRef.current = i;
      setScrollIdx(i);
      onChange(items[i]);
      hTick();
    }
  };

  return (
    <View style={{ width, height: itemHeight * 5 }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        contentContainerStyle={{ paddingVertical: itemHeight * 2 }}
      >
        {items.map((it, i) => {
          const dist = Math.abs(i - scrollIdx);
          const active = dist === 0;
          return (
            <View key={i} style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{
                color: active ? C.green : C.white,
                fontSize: active ? 22 : 18,
                fontWeight: active ? '900' : '600',
                opacity: active ? 1 : Math.max(0.18, 0.6 - dist * 0.18),
              }}>
                {formatItem ? formatItem(it) : it}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={{
        position: 'absolute', left: 0, right: 0, top: itemHeight * 2,
        height: itemHeight,
        borderTopWidth: 1, borderBottomWidth: 1,
        borderColor: C.green + '55',
      }} />
    </View>
  );
}

function DateOfBirthPicker({ value, onChange }) {
  const { C } = useTheme();
  const today = new Date();
  const maxYear = today.getFullYear() - 13;
  const minYear = 1925;
  const years = useRef(Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i)).current;
  const monthsNum = useRef([1,2,3,4,5,6,7,8,9,10,11,12]).current;

  const parsed = parseDOB(value);
  const initial = parsed || { d: 15, mo: 1, y: 2000 };
  const [d, setD] = useState(initial.d);
  const [mo, setMo] = useState(initial.mo);
  const [y, setY] = useState(initial.y);

  useEffect(() => {
    if (!parsed) onChange(formatDOB(initial.d, initial.mo, initial.y));
  }, []);

  const dim = new Date(y, mo, 0).getDate();
  const days = Array.from({ length: dim }, (_, i) => i + 1);
  const safeD = Math.min(d, dim);

  const commit = (nd, nm, ny) => {
    const lim = new Date(ny, nm, 0).getDate();
    const cd = Math.min(nd, lim);
    onChange(formatDOB(cd, nm, ny));
  };

  const age = ageFrom(safeD, mo, y);

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
        <WheelColumn
          items={days}
          value={safeD}
          onChange={(v) => { setD(v); commit(v, mo, y); }}
          width={64}
          formatItem={(n) => pad2(n)}
        />
        <WheelColumn
          items={monthsNum}
          value={mo}
          onChange={(v) => { setMo(v); commit(d, v, y); }}
          width={92}
          formatItem={(n) => MONTH_NAMES[n - 1]}
        />
        <WheelColumn
          items={years}
          value={y}
          onChange={(v) => { setY(v); commit(d, mo, v); }}
          width={86}
        />
      </View>
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <Text style={{ color: C.white, fontSize: 18, fontWeight: '800' }}>
          {MONTH_NAMES_FULL[mo - 1]} {safeD}, {y}
        </Text>
        <View style={{
          marginTop: 10, paddingHorizontal: 14, paddingVertical: 6,
          borderRadius: 999, backgroundColor: C.greenGlow2, borderWidth: 1, borderColor: C.green + '40',
        }}>
          <Text style={{ color: C.green, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
            {age} YEARS OLD
          </Text>
        </View>
      </View>
    </View>
  );
}

function RulerPicker({ min, max, step = 1, value, unit, decimals = 0, onChange, formatBig, defaultValue }) {
  const { C } = useTheme();
  const TICK_W = 12;
  const ref = useRef(null);
  const [containerW, setContainerW] = useState(0);

  const ticks = useMemo(() => {
    const arr = [];
    for (let i = min; i <= max + 1e-9; i += step) arr.push(+i.toFixed(decimals + 2));
    return arr;
  }, [min, max, step, decimals]);

  const v = parseFloat(value);
  const initial = !isNaN(v)
    ? Math.max(min, Math.min(max, v))
    : (defaultValue != null ? defaultValue : Math.round((min + max) / 2));
  const initialIdx = Math.max(0, Math.min(ticks.length - 1,
    Math.round((initial - min) / step)
  ));
  const [display, setDisplay] = useState(ticks[initialIdx]);
  const lastIdxRef = useRef(initialIdx);
  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current && containerW > 0) {
      didInit.current = true;
      ref.current?.scrollTo({ x: initialIdx * TICK_W, animated: false });
      if (isNaN(v)) onChange(String(ticks[initialIdx]));
    }
  }, [containerW]);

  const onScroll = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.max(0, Math.min(ticks.length - 1, Math.round(x / TICK_W)));
    if (i !== lastIdxRef.current) {
      lastIdxRef.current = i;
      setDisplay(ticks[i]);
      onChange(String(ticks[i]));
      hTick();
    }
  };

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={{ color: C.green, fontSize: 64, fontWeight: '900', lineHeight: 68, letterSpacing: -1 }}>
            {formatBig ? formatBig(display) : display}
          </Text>
          <Text style={{ color: C.muted, fontSize: 16, fontWeight: '800', marginLeft: 8, marginBottom: 12, letterSpacing: 1 }}>
            {unit}
          </Text>
        </View>
      </View>
      <View
        style={{ height: 80, position: 'relative', overflow: 'hidden' }}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      >
        {containerW > 0 && (
          <ScrollView
            ref={ref}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={TICK_W}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={onScroll}
            contentContainerStyle={{ paddingHorizontal: containerW / 2 - TICK_W / 2 }}
          >
            {ticks.map((t, i) => {
              const major = step < 1 ? Math.abs(t - Math.round(t)) < 1e-9 : (Math.round(t) % 10 === 0);
              const mid = step < 1 ? false : (Math.round(t) % 5 === 0);
              return (
                <View key={i} style={{ width: TICK_W, alignItems: 'center', justifyContent: 'flex-start' }}>
                  <View style={{
                    width: major ? 2 : 1.5,
                    height: major ? 36 : mid ? 24 : 14,
                    backgroundColor: C.white,
                    opacity: major ? 0.85 : mid ? 0.45 : 0.25,
                    borderRadius: 1,
                  }} />
                  {major && (
                    <Text style={{ color: C.muted, fontSize: 10, marginTop: 6, fontWeight: '700' }}>
                      {formatBig ? formatBig(t) : t}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
        <View pointerEvents="none" style={{
          position: 'absolute', top: 0, left: '50%', marginLeft: -1.5, width: 3, height: 44, backgroundColor: C.green, borderRadius: 2,
        }} />
        <View pointerEvents="none" style={{
          position: 'absolute', top: -8, left: '50%', marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: C.green,
        }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 6 }}>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700' }}>Min {formatBig ? formatBig(min) : min} {unit}</Text>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700' }}>Max {formatBig ? formatBig(max) : max} {unit}</Text>
      </View>
    </View>
  );
}
const SECTIONS = [
  { key: 'account', label: 'Account', icon: '●' },
  { key: 'basics', label: 'About You', icon: '◎' },
  { key: 'goal', label: 'Your Goal', icon: '◈' },
  { key: 'program', label: 'Program', icon: '◇' },
];

const STEPS = [
  { id: 'gender', section: 'basics', title: "What's your biological sex?", subtitle: 'Used for accurate metabolic calculations' },
  { id: 'birthday', section: 'basics', title: 'Date of birth', subtitle: 'Your age affects your metabolism and caloric needs' },
  { id: 'units', section: 'basics', title: 'Preferred units', subtitle: 'You can change this later in settings' },
  { id: 'height', section: 'basics', title: 'How tall are you?', subtitle: 'Used to calculate your BMR and TDEE' },
  { id: 'weight', section: 'basics', title: 'Current weight', subtitle: "We'll use this as your starting point" },
  { id: 'maxWeight', section: 'basics', title: 'Highest weight ever', subtitle: 'Helps us understand your body composition history' },
  { id: 'weightTrend', section: 'basics', title: 'Recent weight trend', subtitle: 'How has your weight changed in the past few weeks?' },
  { id: 'bodyFat', section: 'basics', title: 'Estimate your body fat', subtitle: 'Select the description that best matches your current physique' },
  { id: 'activityLevel', section: 'basics', title: 'Daily activity level', subtitle: 'How active are you outside of planned exercise?' },
  { id: 'trainingExp', section: 'basics', title: 'Training experience', subtitle: 'How long have you been training consistently?' },
  { id: 'cardioExp', section: 'basics', title: 'Cardio background', subtitle: 'How experienced are you with cardiovascular exercise?' },
  { id: 'exerciseFreq', section: 'basics', title: 'Weekly exercise frequency', subtitle: 'How many days per week do you currently train?' },
  { id: 'goal', section: 'goal', title: "What's your main goal?", subtitle: 'Everything will be optimized around this' },
  { id: 'targetWeight', section: 'goal', title: 'Target weight', subtitle: 'Where do you want to get to?' },
  { id: 'weeklyRate', section: 'goal', title: 'Weekly rate of change', subtitle: 'How aggressive do you want your approach to be?' },
  { id: 'diet', section: 'program', title: 'Nutrition approach', subtitle: 'Choose what fits your lifestyle best' },
  { id: 'exerciseType', section: 'program', title: 'Training preference', subtitle: 'Select all types you want in your program' },
  { id: 'calDistribution', section: 'program', title: 'Calorie strategy', subtitle: 'How should we distribute your calories across the week?' },
  { id: 'proteinIntake', section: 'program', title: 'Protein target', subtitle: 'Higher protein preserves muscle during fat loss' },
];

function SectionTransition({ section, onContinue }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const ts = makeTs(C);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const [dots, setDots] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
    const interval = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    const timer = setTimeout(onContinue, 2200);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, []);

  const sectionData = {
    basics: { title: 'Getting to know you', desc: 'Let\'s learn about your body and lifestyle', icon: '◎' },
    goal: { title: 'Analyzing your profile', desc: 'Setting up your personalized targets', icon: '◈' },
    program: { title: 'Designing your program', desc: 'Building your custom nutrition & training plan', icon: '◇' },
  };

  const info = sectionData[section] || sectionData.basics;

  return (
    <View style={ts.container}>
      <View style={ts.glow} />
      <Animated.View style={[ts.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <View style={ts.iconWrap}>
          <Text style={ts.icon}>{info.icon}</Text>
        </View>
        <Text style={ts.title}>{info.title}{dots}</Text>
        <Text style={ts.desc}>{info.desc}</Text>
        <View style={ts.loaderWrap}>
          <View style={ts.loaderTrack}>
            <Animated.View style={[ts.loaderFill, { opacity: fadeAnim }]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function BuildingScreen({ onDone, data, userEmail }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const bs = makeBs(C);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState(0);
  const [apiDone, setApiDone] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const phases = [
    'Analyzing your body metrics...',
    'Calculating metabolic rate...',
    'Optimizing macro targets...',
    'Building workout structure...',
    'Finalizing your program...',
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const interval = setInterval(() => {
      setPhase(p => {
        if (p >= phases.length - 1) return p;
        return p + 1;
      });
    }, 800);
    const timer = setTimeout(() => setAnimDone(true), 4500);

    let cancelled = false;
    const genPlan = async () => {
      try {
        const { generatePlanFromOnboarding } = require('../utils/planGenerator');
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000));
        await Promise.race([generatePlanFromOnboarding(data, userEmail), timeout]);
      } catch (e) {
        console.warn('Plan generation failed during onboarding:', e.message);
      }
      if (!cancelled) setApiDone(true);
    };
    genPlan();

    return () => { cancelled = true; clearInterval(interval); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (apiDone && animDone) { hSuccess(); onDone(); }
  }, [apiDone, animDone]);

  return (
    <View style={bs.container}>
      <View style={bs.glow} />
      <Animated.View style={[bs.content, { opacity: fadeAnim }]}>
        <View style={bs.logoWrap}>
          <Image source={require('../assets/logo.png')} style={bs.logoImage} resizeMode="contain" />
        </View>
        <Text style={bs.title}>Building Your Program</Text>
        <Text style={bs.subtitle}>This will just take a moment</Text>
        <View style={bs.phaseList}>
          {phases.map((p, i) => (
            <View key={i} style={bs.phaseRow}>
              <View style={[bs.phaseDot, i <= phase && bs.phaseDotActive]}>
                {i < phase && <Text style={bs.phaseCheck}>✓</Text>}
                {i === phase && <ActivityIndicator size="small" color={C.green} />}
              </View>
              <Text style={[bs.phaseText, i <= phase && bs.phaseTextActive]}>{p}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen({ onComplete, user }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [step, setStep] = useState(0);
  const [showTransition, setShowTransition] = useState(null);
  const [showBuilding, setShowBuilding] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [data, setData] = useState({
    gender: '', birthday: '', units: 'Metric',
    height: '', heightFt: '', heightIn: '', weight: '', maxWeight: '',
    weightTrend: '', bodyFat: '', activityLevel: '',
    trainingExp: '', cardioExp: '', exerciseFreq: '',
    goal: '', targetWeight: '', weeklyRate: '',
    diet: '', exerciseType: [], calDistribution: '', proteinIntake: '',
  });

  const currentStep = STEPS[step];
  const totalSteps = STEPS.length;
  const progress = (step + 1) / totalSteps;
  const currentSectionIdx = SECTIONS.findIndex(s => s.key === currentStep.section);

  const animateTo = (nextStep, direction = 1) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: direction * -30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
      slideAnim.setValue(direction * 30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const goNext = () => {
    hSelect();
    if (step < totalSteps - 1) {
      const nextSection = STEPS[step + 1].section;
      if (nextSection !== currentStep.section) {
        setShowTransition(nextSection);
        return;
      }
      animateTo(step + 1, 1);
    } else {
      setShowBuilding(true);
    }
  };

  const goBack = () => {
    if (step > 0) animateTo(step - 1, -1);
  };

  const updateField = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  const TAP_FIELDS = new Set(['gender','units','bodyFat','exerciseFreq','proteinIntake','weeklyRate','goal','diet','calDistribution','activityLevel','trainingExp','cardioExp','weightTrend']);
  const tapField = (key, value) => { hSelect(); updateField(key, value); };

  const toggleMulti = (key, value) => {
    hSelect();
    setData(prev => {
      const arr = prev[key] || [];
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const canProceed = () => {
    const val = data[currentStep.id];
    const id = currentStep.id;
    if (id === 'exerciseType') return data.exerciseType.length > 0;
    if (val === '' || val === undefined || val === null) return false;
    if (id === 'height') {
      const cm = parseFloat(val);
      return !isNaN(cm) && cm >= 100 && cm <= 230;
    }
    if (['weight', 'maxWeight', 'targetWeight'].includes(id)) {
      const isMetric = data.units === 'Metric';
      const num = parseFloat(val);
      const lo = isMetric ? 30 : 66;
      const hi = isMetric ? 250 : 550;
      return !isNaN(num) && num >= lo && num <= hi;
    }
    if (id === 'birthday') {
      const p = parseDOB(val);
      if (!p) return false;
      const a = ageFrom(p.d, p.mo, p.y);
      return a >= 13 && a <= 100;
    }
    return true;
  };

  if (showBuilding) {
    return <BuildingScreen onDone={() => onComplete(data)} data={data} userEmail={user?.email || user?.uid} />;
  }

  if (showTransition) {
    return (
      <SectionTransition
        section={showTransition}
        onContinue={() => {
          setShowTransition(null);
          animateTo(step + 1, 1);
        }}
      />
    );
  }

  const renderInput = () => {
    const id = currentStep.id;
    switch (id) {
      case 'gender':
        return (
          <View style={s.cardGrid}>
            {[
              { val: 'Male', icon: '♂', desc: 'Male physiology' },
              { val: 'Female', icon: '♀', desc: 'Female physiology' },
            ].map(g => (
              <TouchableOpacity
                key={g.val}
                style={[s.bigCard, data.gender === g.val && s.bigCardActive]}
                onPress={() => tapField('gender', g.val)}
              >
                <Text style={[s.bigCardIcon, data.gender === g.val && { color: C.green }]}>{g.icon}</Text>
                <Text style={[s.bigCardLabel, data.gender === g.val && s.bigCardLabelActive]}>{g.val}</Text>
                <Text style={s.bigCardDesc}>{g.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'units':
        return (
          <View style={s.cardGrid}>
            {[
              { val: 'Metric', desc: 'kg, cm' },
              { val: 'Imperial', desc: 'lbs, ft/in' },
            ].map(u => (
              <TouchableOpacity
                key={u.val}
                style={[s.bigCard, data.units === u.val && s.bigCardActive]}
                onPress={() => tapField('units', u.val)}
              >
                <Text style={[s.bigCardLabel, data.units === u.val && s.bigCardLabelActive]}>{u.val}</Text>
                <Text style={s.bigCardDesc}>{u.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'birthday':
        return (
          <DateOfBirthPicker
            key="dob"
            value={data.birthday}
            onChange={(v) => updateField('birthday', v)}
          />
        );

      case 'height':
        if (data.units === 'Imperial') {
          const totalIn = parseFloat(data.heightIn || '') >= 0 || parseFloat(data.heightFt || '') >= 0
            ? (parseFloat(data.heightFt || '0') * 12 + parseFloat(data.heightIn || '0'))
            : NaN;
          return (
            <RulerPicker
              key="height-imperial"
              min={48}
              max={86}
              step={1}
              value={isNaN(totalIn) ? '' : String(totalIn)}
              defaultValue={68}
              unit=""
              formatBig={(n) => `${Math.floor(n / 12)}'${n % 12}"`}
              onChange={(str) => {
                const inches = parseInt(str, 10);
                const ft = Math.floor(inches / 12);
                const inch = inches % 12;
                updateField('heightFt', String(ft));
                updateField('heightIn', String(inch));
                updateField('height', String((ft * 30.48) + (inch * 2.54)));
              }}
            />
          );
        }
        return (
          <RulerPicker
            key="height-metric"
            min={120}
            max={220}
            step={1}
            value={data.height}
            defaultValue={170}
            unit="cm"
            onChange={(v) => updateField('height', v)}
          />
        );

      case 'weight':
      case 'maxWeight':
      case 'targetWeight': {
        const isMetric = data.units === 'Metric';
        const min = isMetric ? 30 : 66;
        const max = isMetric ? 250 : 550;
        const def = id === 'weight'
          ? (isMetric ? 75 : 165)
          : id === 'maxWeight'
          ? (isMetric ? 80 : 175)
          : (isMetric ? 70 : 155);
        return (
          <RulerPicker
            key={`${id}-${isMetric ? 'm' : 'i'}`}
            min={min}
            max={max}
            step={1}
            value={data[id]}
            defaultValue={def}
            unit={isMetric ? 'kg' : 'lbs'}
            onChange={(v) => updateField(id, v)}
          />
        );
      }

      case 'weightTrend':
        return renderIconOptions([
          { val: 'Gaining', icon: '↗', desc: 'Weight has been going up' },
          { val: 'Stable', icon: '→', desc: 'Weight has stayed roughly the same' },
          { val: 'Losing', icon: '↘', desc: 'Weight has been going down' },
          { val: 'Fluctuating', icon: '↕', desc: 'Weight has been up and down' },
        ], 'weightTrend');

      case 'bodyFat':
        return (
          <View>
            {[
              { val: '5-9%', label: 'Very Lean', bar: 1 },
              { val: '10-14%', label: 'Lean', bar: 2 },
              { val: '15-19%', label: 'Athletic', bar: 3 },
              { val: '20-24%', label: 'Average', bar: 4 },
              { val: '25-29%', label: 'Above Average', bar: 5 },
              { val: '30-34%', label: 'High', bar: 6 },
              { val: '35%+', label: 'Very High', bar: 7 },
            ].map(bf => (
              <TouchableOpacity
                key={bf.val}
                style={[s.optionCard, data.bodyFat === bf.val && s.optionCardActive]}
                onPress={() => tapField('bodyFat', bf.val)}
              >
                <View style={s.bfBarWrap}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <View key={i} style={[s.bfBar, i < bf.bar && { backgroundColor: data.bodyFat === bf.val ? C.green : C.muted }]} />
                  ))}
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[s.optionText, data.bodyFat === bf.val && s.optionTextActive]}>{bf.val}</Text>
                  <Text style={s.optionDesc}>{bf.label}</Text>
                </View>
                {data.bodyFat === bf.val && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'activityLevel':
        return renderIconOptions([
          { val: 'Sedentary', icon: '◻', desc: 'Desk job, very little movement' },
          { val: 'Lightly Active', icon: '◧', desc: 'Some walking, light movement' },
          { val: 'Moderately Active', icon: '◨', desc: 'On your feet regularly' },
          { val: 'Very Active', icon: '◩', desc: 'Physical job or active lifestyle' },
          { val: 'Extremely Active', icon: '◼', desc: 'Heavy labor or athlete' },
        ], 'activityLevel');

      case 'trainingExp':
        return renderIconOptions([
          { val: 'Beginner', icon: '1', desc: 'Less than 6 months' },
          { val: 'Novice', icon: '2', desc: '6 months to 1 year' },
          { val: 'Intermediate', icon: '3', desc: '1 to 3 years' },
          { val: 'Advanced', icon: '4', desc: '3 to 5 years' },
          { val: 'Expert', icon: '5', desc: '5+ years consistent' },
        ], 'trainingExp');

      case 'cardioExp':
        return renderIconOptions([
          { val: 'None', icon: '○', desc: "I don't do cardio" },
          { val: 'Beginner', icon: '◔', desc: 'Occasional walks' },
          { val: 'Intermediate', icon: '◑', desc: 'Regular cardio 2-3x/week' },
          { val: 'Advanced', icon: '◕', desc: 'Structured cardio program' },
          { val: 'Athlete', icon: '●', desc: 'Competitive endurance' },
        ], 'cardioExp');

      case 'exerciseFreq':
        return (
          <View style={s.freqGrid}>
            {['0', '1', '2', '3', '4', '5', '6', '7'].map(n => (
              <TouchableOpacity
                key={n}
                style={[s.freqBtn, data.exerciseFreq === n && s.freqBtnActive]}
                onPress={() => tapField('exerciseFreq', n)}
              >
                <Text style={[s.freqNum, data.exerciseFreq === n && s.freqNumActive]}>{n}</Text>
                <Text style={[s.freqLabel, data.exerciseFreq === n && { color: C.green }]}>
                  {n === '0' ? 'rest' : n === '1' ? 'day' : 'days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'goal':
        return renderIconOptions([
          { val: 'Lose Fat', icon: '↓', desc: 'Burn fat and get leaner' },
          { val: 'Build Muscle', icon: '↑', desc: 'Gain lean mass and strength' },
          { val: 'Recomposition', icon: '⇄', desc: 'Lose fat & gain muscle' },
          { val: 'Maintain', icon: '=', desc: 'Stay where you are' },
          { val: 'Performance', icon: '⚡', desc: 'Optimize for athletics' },
        ], 'goal');

      case 'weeklyRate':
        return renderWeeklyRate();

      case 'diet':
        return renderIconOptions([
          { val: 'Balanced', icon: '⊕', desc: '40C / 30P / 30F — flexible and sustainable' },
          { val: 'Low-Carb', icon: '◫', desc: 'Reduced carbs, higher fat and protein' },
          { val: 'Keto', icon: '◬', desc: 'Very low carb, high fat' },
          { val: 'High Protein', icon: '◮', desc: 'Protein-focused for muscle preservation' },
          { val: 'Mediterranean', icon: '◭', desc: 'Whole foods, healthy fats, lean protein' },
        ], 'diet');

      case 'exerciseType':
        return (
          <View>
            {[
              { val: 'Weight Lifting', icon: '◈' },
              { val: 'Cardio', icon: '◎' },
              { val: 'Calisthenics', icon: '◇' },
              { val: 'HIIT', icon: '⚡' },
              { val: 'Yoga / Pilates', icon: '○' },
              { val: 'Sports', icon: '●' },
              { val: 'Swimming', icon: '◉' },
              { val: 'CrossFit', icon: '◈' },
            ].map(t => (
              <TouchableOpacity
                key={t.val}
                style={[s.optionCard, data.exerciseType.includes(t.val) && s.optionCardActive]}
                onPress={() => toggleMulti('exerciseType', t.val)}
              >
                <View style={s.optIconWrap}><Text style={[s.optIcon, data.exerciseType.includes(t.val) && { color: C.green }]}>{t.icon}</Text></View>
                <Text style={[s.optionText, data.exerciseType.includes(t.val) && s.optionTextActive, { marginLeft: 12 }]}>{t.val}</Text>
                {data.exerciseType.includes(t.val) && <View style={[s.checkMark, { marginLeft: 'auto' }]}><Text style={s.checkText}>✓</Text></View>}
              </TouchableOpacity>
            ))}
            <Text style={s.inputHint}>Select all that apply</Text>
          </View>
        );

      case 'calDistribution':
        return renderIconOptions([
          { val: 'Equal Daily', icon: '═', desc: 'Same calories every day' },
          { val: 'Training Split', icon: '⇅', desc: 'More on training days, less on rest' },
          { val: 'Cheat Meal', icon: '★', desc: 'One higher-calorie meal per week' },
          { val: 'Weekend Flex', icon: '◫', desc: 'Slightly higher on weekends' },
          { val: 'Carb Cycling', icon: '↕', desc: 'Alternate high and low carb days' },
        ], 'calDistribution');

      case 'proteinIntake':
        return (
          <View>
            {[
              { val: '1.6', label: '1.6 g/kg', desc: 'Standard — good for general fitness' },
              { val: '1.8', label: '1.8 g/kg', desc: 'Moderate — ideal for fat loss' },
              { val: '2.0', label: '2.0 g/kg', desc: 'High — best for building muscle' },
              { val: '2.2', label: '2.2 g/kg', desc: 'Maximum — experienced lifters in deficit' },
              { val: 'auto', label: 'Let AI decide', desc: 'We\'ll calculate the optimal amount' },
            ].map(p => (
              <TouchableOpacity
                key={p.val}
                style={[s.optionCard, data.proteinIntake === p.val && s.optionCardActive]}
                onPress={() => tapField('proteinIntake', p.val)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionText, data.proteinIntake === p.val && s.optionTextActive]}>{p.label}</Text>
                  <Text style={s.optionDesc}>{p.desc}</Text>
                </View>
                {data.proteinIntake === p.val && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
              </TouchableOpacity>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  const renderWeeklyRate = () => {
    const isMetric = data.units === 'Metric';
    const rateOptions = isMetric ? [
      { val: '0.25', label: '0.25 kg/week', desc: 'Slow & steady — easiest to maintain', tag: 'SUSTAINABLE' },
      { val: '0.5', label: '0.5 kg/week', desc: 'Best balance of speed and sustainability', tag: 'RECOMMENDED' },
      { val: '0.75', label: '0.75 kg/week', desc: 'Moderate — requires discipline', tag: '' },
      { val: '1.0', label: '1.0 kg/week', desc: 'Aggressive — significant calorie deficit', tag: 'AGGRESSIVE' },
    ] : [
      { val: '0.5', label: '0.5 lb/week', desc: 'Slow & steady — easiest to maintain', tag: 'SUSTAINABLE' },
      { val: '1.0', label: '1.0 lb/week', desc: 'Best balance of speed and sustainability', tag: 'RECOMMENDED' },
      { val: '1.5', label: '1.5 lb/week', desc: 'Moderate — requires discipline', tag: '' },
      { val: '2.0', label: '2.0 lb/week', desc: 'Aggressive — significant calorie deficit', tag: 'AGGRESSIVE' },
    ];
    return (
      <View>
        {rateOptions.map(r => (
          <TouchableOpacity
            key={r.val}
            style={[s.optionCard, data.weeklyRate === r.val && s.optionCardActive]}
            onPress={() => tapField('weeklyRate', r.val)}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[s.optionText, data.weeklyRate === r.val && s.optionTextActive]}>{r.label}</Text>
                {r.tag ? <View style={[s.tag, r.tag === 'RECOMMENDED' && s.tagGreen]}><Text style={[s.tagText, r.tag === 'RECOMMENDED' && { color: C.green }]}>{r.tag}</Text></View> : null}
              </View>
              <Text style={s.optionDesc}>{r.desc}</Text>
            </View>
            {data.weeklyRate === r.val && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderIconOptions = (options, field) => (
    <View>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.val}
          style={[s.optionCard, data[field] === opt.val && s.optionCardActive]}
          onPress={() => tapField(field, opt.val)}
        >
          <View style={s.optIconWrap}>
            <Text style={[s.optIcon, data[field] === opt.val && { color: C.green }]}>{opt.icon}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[s.optionText, data[field] === opt.val && s.optionTextActive]}>{opt.val}</Text>
            <Text style={s.optionDesc}>{opt.desc}</Text>
          </View>
          {data[field] === opt.val && <View style={s.checkMark}><Text style={s.checkText}>✓</Text></View>}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          {step > 0 ? (
            <TouchableOpacity style={s.backBtn} onPress={goBack}>
              <Text style={s.backIcon}>←</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 44 }} />}
          <View style={s.sectionNav}>
            {SECTIONS.filter(sec => sec.key !== 'account').map((sec, i) => (
              <View key={sec.key} style={[s.sectionDot, currentSectionIdx >= i + 1 && s.sectionDotActive, currentStep.section === sec.key && s.sectionDotCurrent]} />
            ))}
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
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          <Text style={s.title}>{currentStep.title}</Text>
          <Text style={s.subtitle}>{currentStep.subtitle}</Text>
          <View style={s.inputArea}>{renderInput()}</View>
        </Animated.View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.continueBtn, !canProceed() && s.continueBtnDisabled]}
          onPress={goNext}
          disabled={!canProceed()}
          activeOpacity={0.85}
        >
          <Text style={[s.continueBtnText, !canProceed() && s.continueBtnTextDisabled]}>
            {step === totalSteps - 1 ? 'BUILD MY PROGRAM' : 'CONTINUE'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeTs = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(100px)' } : { opacity: 0.2 }),
  },
  content: { alignItems: 'center', paddingHorizontal: 40 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.greenGlow, alignItems: 'center', justifyContent: 'center', marginBottom: 28, borderWidth: 2, borderColor: C.green + '40' },
  icon: { color: C.green, fontSize: 32 },
  title: { color: C.white, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  desc: { color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  loaderWrap: { marginTop: 36, width: 200 },
  loaderTrack: { height: 3, backgroundColor: C.surface, borderRadius: 2, overflow: 'hidden' },
  loaderFill: { height: '100%', width: '70%', backgroundColor: C.green, borderRadius: 2 },
});

const makeBs = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute', width: 400, height: 400, borderRadius: 200,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : { opacity: 0.15 }),
  },
  content: { alignItems: 'center', paddingHorizontal: 40 },
  logoWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.greenGlow2, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  logoImage: { width: 70, height: 70 },
  title: { color: C.white, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: C.muted, fontSize: 15, marginBottom: 36 },
  phaseList: { width: 280 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  phaseDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  phaseDotActive: { borderColor: C.green + '60' },
  phaseCheck: { color: C.green, fontSize: 14, fontWeight: '800' },
  phaseText: { color: C.muted, fontSize: 14, fontWeight: '500' },
  phaseTextActive: { color: C.light, fontWeight: '600' },
});

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingTop: Platform.OS === 'web' ? 50 : 60, paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backIcon: { color: C.white, fontSize: 20, fontWeight: '600' },
  sectionNav: { flexDirection: 'row', gap: 6 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  sectionDotActive: { backgroundColor: C.green + '60', borderColor: C.green + '40' },
  sectionDotCurrent: { backgroundColor: C.green, borderColor: C.green, width: 24 },
  stepCounter: { color: C.muted, fontSize: 14, fontWeight: '600', minWidth: 44, textAlign: 'right' },
  progressBarBg: { height: 2, backgroundColor: C.surface, borderRadius: 1, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: C.green, borderRadius: 1 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  title: { color: C.white, fontSize: 28, fontWeight: '800', lineHeight: 36, marginBottom: 8 },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 28 },
  inputArea: {},
  textInput: {
    backgroundColor: C.surface, color: C.white, fontSize: 20, fontWeight: '600',
    paddingHorizontal: 20, paddingVertical: 18, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
  },
  unitInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitBadge: { backgroundColor: C.green, paddingHorizontal: 18, paddingVertical: 18, borderRadius: 16 },
  unitText: { color: C.bg, fontSize: 16, fontWeight: '800' },
  inputHint: { color: C.muted, fontSize: 13, marginTop: 12, marginLeft: 4 },
  cardGrid: { flexDirection: 'row', gap: 12 },
  bigCard: {
    flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 2, borderColor: C.border,
  },
  bigCardActive: { borderColor: C.green, backgroundColor: C.greenGlow2 },
  bigCardIcon: { fontSize: 36, color: C.muted, marginBottom: 12 },
  bigCardLabel: { color: C.white, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  bigCardLabelActive: { color: C.green },
  bigCardDesc: { color: C.muted, fontSize: 12 },
  optionCard: {
    backgroundColor: C.surface, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
    marginBottom: 8, borderWidth: 1.5, borderColor: C.border,
    flexDirection: 'row', alignItems: 'center',
  },
  optionCardActive: { borderColor: C.green, backgroundColor: C.greenGlow2 },
  optionText: { color: C.light, fontSize: 16, fontWeight: '700' },
  optionTextActive: { color: C.green },
  optionDesc: { color: C.muted, fontSize: 13, marginTop: 2 },
  optIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  optIcon: { color: C.muted, fontSize: 18, fontWeight: '700' },
  checkMark: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  checkText: { color: C.bg, fontSize: 14, fontWeight: '800' },
  bfBarWrap: { width: 36, flexDirection: 'column', gap: 2, alignItems: 'center' },
  bfBar: { width: 28, height: 3, borderRadius: 1.5, backgroundColor: C.border },
  tag: { backgroundColor: C.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 8, borderWidth: 1, borderColor: C.border },
  tagGreen: { backgroundColor: C.greenGlow2, borderColor: C.green + '40' },
  tagText: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  freqGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  freqBtn: {
    width: 72, height: 72, borderRadius: 18, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  freqBtnActive: { borderColor: C.green, backgroundColor: C.greenGlow2 },
  freqNum: { color: C.light, fontSize: 22, fontWeight: '800' },
  freqNumActive: { color: C.green },
  freqLabel: { color: C.muted, fontSize: 10, marginTop: 2 },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'web' ? 30 : 40, paddingTop: 12, backgroundColor: C.bg },
  continueBtn: {
    backgroundColor: C.green, paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  continueBtnDisabled: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  continueBtnText: { color: C.bg, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  continueBtnTextDisabled: { color: C.muted },
});
