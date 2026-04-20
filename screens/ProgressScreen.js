import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Line, Rect, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';
import { buildWeeklyContext } from '../utils/planAdapter';

const DAY_MS = 24 * 60 * 60 * 1000;
const W = Dimensions.get('window').width;

function dayKey(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toDateString();
}

function shortDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function LineChart({ points, width, height, color, fillColor, target, C, yLabel }) {
  if (!points || points.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 12 }}>No data yet</Text>
      </View>
    );
  }
  const padL = 36, padR = 12, padT = 12, padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const ys = points.map(p => p.y);
  let yMin = Math.min(...ys, target ?? Infinity);
  let yMax = Math.max(...ys, target ?? -Infinity);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.15;
  yMin -= yPad; yMax += yPad;

  const xs = points.map((_, i) => i);
  const xMin = 0, xMax = Math.max(1, xs.length - 1);

  const px = (i) => padL + (i / xMax) * innerW;
  const py = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  let pathD = '';
  let areaD = '';
  points.forEach((p, i) => {
    const x = px(i), y = py(p.y);
    if (i === 0) {
      pathD += `M ${x} ${y}`;
      areaD += `M ${x} ${padT + innerH} L ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
      areaD += ` L ${x} ${y}`;
    }
  });
  areaD += ` L ${px(points.length - 1)} ${padT + innerH} Z`;

  // y-axis ticks
  const ticks = 4;
  const tickVals = Array.from({ length: ticks }, (_, i) => yMin + (i / (ticks - 1)) * (yMax - yMin));

  // x-axis labels (first, mid, last)
  const xLabelIdx = points.length <= 3
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="lcg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={fillColor} stopOpacity="0.45" />
          <Stop offset="1" stopColor={fillColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {tickVals.map((v, i) => {
        const y = py(v);
        return (
          <React.Fragment key={i}>
            <Line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke={C.border} strokeWidth="1" />
            <SvgText x={padL - 6} y={y + 3} fontSize="9" fill={C.muted} textAnchor="end">
              {v.toFixed(yLabel === 'kg' ? 1 : 0)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {target !== undefined && target !== null && (
        <Line
          x1={padL} y1={py(target)} x2={padL + innerW} y2={py(target)}
          stroke={C.green} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.65"
        />
      )}

      <Path d={areaD} fill="url(#lcg)" />
      <Path d={pathD} stroke={color} strokeWidth="2.5" fill="none" />

      {points.map((p, i) => (
        <Circle key={i} cx={px(i)} cy={py(p.y)} r="3" fill={C.bg} stroke={color} strokeWidth="2" />
      ))}

      {xLabelIdx.map(i => (
        <SvgText
          key={i}
          x={px(i)}
          y={padT + innerH + 14}
          fontSize="9"
          fill={C.muted}
          textAnchor="middle"
        >
          {points[i].label}
        </SvgText>
      ))}
    </Svg>
  );
}

function BarChart({ data, width, height, color, target, C }) {
  if (!data || data.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 12 }}>No data yet</Text>
      </View>
    );
  }
  const padL = 32, padR = 8, padT = 12, padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yMax = Math.max(target || 0, ...data.map(d => d.value)) * 1.15 || 1;
  const barW = innerW / data.length;
  const barInner = Math.max(4, barW * 0.65);

  return (
    <Svg width={width} height={height}>
      <Line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke={C.border} strokeWidth="1" />
      {target !== undefined && target !== null && target > 0 && (
        <>
          <Line
            x1={padL}
            y1={padT + innerH - (target / yMax) * innerH}
            x2={padL + innerW}
            y2={padT + innerH - (target / yMax) * innerH}
            stroke={C.green} strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6"
          />
          <SvgText
            x={padL - 4}
            y={padT + innerH - (target / yMax) * innerH + 3}
            fontSize="9" fill={C.green} textAnchor="end" fontWeight="700"
          >{target}</SvgText>
        </>
      )}
      {data.map((d, i) => {
        const h = d.value > 0 ? (d.value / yMax) * innerH : 0;
        const x = padL + i * barW + (barW - barInner) / 2;
        const y = padT + innerH - h;
        const fill = d.value === 0 ? C.border : color;
        return (
          <React.Fragment key={i}>
            <Rect x={x} y={y} width={barInner} height={h} rx="3" fill={fill} opacity={d.value === 0 ? 0.5 : 1} />
            <SvgText
              x={x + barInner / 2}
              y={padT + innerH + 14}
              fontSize="8" fill={C.muted} textAnchor="middle"
            >{d.label}</SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function ProgressScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [weightLog, setWeightLog] = useState([]);
  const [foodSeries, setFoodSeries] = useState([]);
  const [ctx, setCtx] = useState(null);
  const [range, setRange] = useState(30); // days for weight chart

  const uid = user.uid;

  const load = useCallback(async () => {
    setLoading(true);
    const [p, wlog] = await Promise.all([
      Storage.get(KEYS.PLAN(user.email || user.uid)),
      Storage.get(KEYS.WEIGHT(uid)),
    ]);
    setPlan(p);
    setWeightLog(Array.isArray(wlog) ? wlog : []);

    // Pull last 14 days of food logs
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      const key = dayKey(d);
      const log = (await Storage.get(KEYS.FOODLOG(uid, key))) || [];
      const totals = log.reduce((acc, it) => ({
        calories: acc.calories + (it.calories || 0),
        protein:  acc.protein  + (it.protein  || 0),
        carbs:    acc.carbs    + (it.carbs    || 0),
        fat:      acc.fat      + (it.fat      || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      days.push({
        date: key,
        ts: d.getTime(),
        label: d.toLocaleDateString('en-US', { weekday: 'short' })[0],
        ...totals,
      });
    }
    setFoodSeries(days);

    if (p) {
      try { setCtx(await buildWeeklyContext(uid, p)); } catch {}
    }
    setLoading(false);
  }, [user.email, user.uid, uid]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.titleBar}><Text style={s.titleBarText}>Progress</Text></View>
        <View style={s.center}><ActivityIndicator color={C.green} size="large" /></View>
      </SafeAreaView>
    );
  }

  // Weight chart
  const cutoff = Date.now() - range * DAY_MS;
  const weightPoints = weightLog
    .filter(w => w.timestamp && w.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(w => ({ y: w.weight, label: shortDate(w.timestamp) }));

  // Goal calculation
  const startWeight = plan?.userProfile?.startWeight
    || plan?.userProfile?.weight
    || (weightLog.length > 0 ? weightLog[weightLog.length - 1].weight : null);
  const targetWeight = plan?.userProfile?.targetWeight || null;
  const currentWeight = weightPoints.length
    ? weightPoints[weightPoints.length - 1].y
    : (weightLog[0]?.weight || startWeight);

  // Cards
  const calsTarget = plan?.dailyCalories || null;
  const calBars = foodSeries.map(d => ({ value: d.calories, label: d.label }));
  const proteinBars = foodSeries.map(d => ({ value: d.protein, label: d.label }));

  const avg7 = (key) => {
    const last7 = foodSeries.slice(-7).filter(d => d[key] > 0);
    if (last7.length === 0) return 0;
    return Math.round(last7.reduce((a, b) => a + b[key], 0) / last7.length);
  };
  const avgCal7    = avg7('calories');
  const avgProt7   = avg7('protein');
  const avgCarbs7  = avg7('carbs');
  const avgFat7    = avg7('fat');
  const loggedDays = foodSeries.filter(d => d.calories > 0).length;

  const weightDelta = (() => {
    if (weightPoints.length < 2) return null;
    return +(weightPoints[weightPoints.length - 1].y - weightPoints[0].y).toFixed(1);
  })();

  const goalProgressPct = (() => {
    if (!startWeight || !targetWeight || !currentWeight || startWeight === targetWeight) return null;
    const total = Math.abs(targetWeight - startWeight);
    const done = Math.abs(currentWeight - startWeight);
    const direction = (targetWeight - startWeight) * (currentWeight - startWeight);
    if (direction < 0) return 0; // moving wrong way
    return Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  })();

  const chartW = Math.min(W, 560) - 32;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <Text style={s.titleBarText}>Progress</Text>
        <Text style={s.titleBarSub}>Your trends, at a glance</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* Goal progress */}
        <View style={s.goalCard}>
          <View style={s.goalHeader}>
            <Text style={s.goalLabel}>GOAL PROGRESS</Text>
            {weightDelta !== null && (
              <Text style={[s.goalDelta, weightDelta < 0 ? s.deltaDown : s.deltaUp]}>
                {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                <Text style={s.goalDeltaSub}> · {range}d</Text>
              </Text>
            )}
          </View>
          <View style={s.goalRow}>
            <View style={s.goalCol}>
              <Text style={s.goalNum}>{startWeight ? `${Math.round(startWeight)}` : '—'}</Text>
              <Text style={s.goalSub}>Start kg</Text>
            </View>
            <View style={s.goalArrow}><Text style={s.goalArrowText}>→</Text></View>
            <View style={s.goalCol}>
              <Text style={[s.goalNum, { color: C.green }]}>
                {currentWeight ? `${Math.round(currentWeight * 10) / 10}` : '—'}
              </Text>
              <Text style={s.goalSub}>Current kg</Text>
            </View>
            <View style={s.goalArrow}><Text style={s.goalArrowText}>→</Text></View>
            <View style={s.goalCol}>
              <Text style={s.goalNum}>{targetWeight ? `${Math.round(targetWeight)}` : '—'}</Text>
              <Text style={s.goalSub}>Target kg</Text>
            </View>
          </View>
          {goalProgressPct !== null && (
            <View style={s.goalBarOuter}>
              <View style={[s.goalBarInner, { width: `${goalProgressPct}%` }]} />
              <Text style={s.goalBarText}>{goalProgressPct}% to goal</Text>
            </View>
          )}
          {goalProgressPct === null && (
            <Text style={s.goalHint}>
              {!startWeight ? 'Log a weight to track progress.' : 'Re-run onboarding to set a target weight.'}
            </Text>
          )}
        </View>

        {/* Weight chart */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Weight</Text>
            <View style={s.rangeRow}>
              {[7, 30, 90].map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRange(r)}
                  style={[s.rangeBtn, range === r && s.rangeBtnActive]}
                >
                  <Text style={[s.rangeText, range === r && s.rangeTextActive]}>{r}d</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <LineChart
            points={weightPoints}
            width={chartW}
            height={180}
            color={C.green}
            fillColor={C.green}
            target={targetWeight || undefined}
            C={C}
            yLabel="kg"
          />
          <View style={s.chartFooter}>
            <Text style={s.chartFootText}>
              {weightPoints.length} entries · {weightDelta !== null ? `${weightDelta > 0 ? '+' : ''}${weightDelta} kg over period` : 'log more to see trend'}
            </Text>
          </View>
        </View>

        {/* Calories chart */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Daily Calories</Text>
            <Text style={s.chartHeaderSub}>Last 14 days</Text>
          </View>
          <BarChart
            data={calBars}
            width={chartW}
            height={170}
            color={C.green}
            target={calsTarget}
            C={C}
          />
          <View style={s.chartFooter}>
            <Text style={s.chartFootText}>
              7d avg: <Text style={{ color: C.green, fontWeight: '900' }}>{avgCal7 || '—'}</Text> kcal
              {calsTarget ? <Text>  · target {calsTarget}</Text> : null}
              {`  ·  ${loggedDays}/14 days logged`}
            </Text>
          </View>
        </View>

        {/* Macro averages */}
        <View style={s.macroGrid}>
          <View style={s.macroBox}>
            <Text style={s.macroIcon}>🥩</Text>
            <Text style={s.macroNum}>{avgProt7}<Text style={s.macroUnit}>g</Text></Text>
            <Text style={s.macroLabel}>Avg protein</Text>
            {plan?.protein ? <Text style={s.macroTarget}>target {plan.protein}g</Text> : null}
          </View>
          <View style={s.macroBox}>
            <Text style={s.macroIcon}>🍞</Text>
            <Text style={s.macroNum}>{avgCarbs7}<Text style={s.macroUnit}>g</Text></Text>
            <Text style={s.macroLabel}>Avg carbs</Text>
            {plan?.carbs ? <Text style={s.macroTarget}>target {plan.carbs}g</Text> : null}
          </View>
          <View style={s.macroBox}>
            <Text style={s.macroIcon}>🥑</Text>
            <Text style={s.macroNum}>{avgFat7}<Text style={s.macroUnit}>g</Text></Text>
            <Text style={s.macroLabel}>Avg fat</Text>
            {plan?.fat ? <Text style={s.macroTarget}>target {plan.fat}g</Text> : null}
          </View>
        </View>

        {/* Protein chart */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartTitle}>Daily Protein</Text>
            <Text style={s.chartHeaderSub}>Last 14 days</Text>
          </View>
          <BarChart
            data={proteinBars}
            width={chartW}
            height={140}
            color={C.green}
            target={plan?.protein || null}
            C={C}
          />
        </View>

        {/* Adherence */}
        {ctx && (
          <View style={s.adhCard}>
            <Text style={s.chartTitle}>Workout Adherence</Text>
            <View style={s.adhRow}>
              <View style={s.adhBig}>
                <Text style={s.adhPct}>
                  {ctx.workout.adherencePct !== null ? `${ctx.workout.adherencePct}%` : '—'}
                </Text>
                <Text style={s.adhPctLabel}>Last 7 days</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.adhStat}>
                  <View style={[s.adhDot, { backgroundColor: C.green }]} />
                  <Text style={s.adhStatLabel}>Completed</Text>
                  <Text style={s.adhStatVal}>{ctx.workout.sessionsCompletedLast7d}</Text>
                </View>
                <View style={s.adhStat}>
                  <View style={[s.adhDot, { backgroundColor: C.muted }]} />
                  <Text style={s.adhStatLabel}>Skipped</Text>
                  <Text style={s.adhStatVal}>{ctx.workout.sessionsSkippedLast7d}</Text>
                </View>
                <View style={s.adhStat}>
                  <View style={[s.adhDot, { backgroundColor: C.border }]} />
                  <Text style={s.adhStatLabel}>Planned</Text>
                  <Text style={s.adhStatVal}>{ctx.workout.sessionsPlannedPerWeek}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={s.backBtn} onPress={() => onNavigate('home')} activeOpacity={0.85}>
          <Text style={s.backBtnText}>← Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 22, fontWeight: '900' },
  titleBarSub: { color: C.muted, fontSize: 12, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 100 },

  goalCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  goalLabel: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  goalDelta: { fontSize: 13, fontWeight: '900' },
  deltaDown: { color: C.green },
  deltaUp: { color: C.warn || C.danger || C.muted },
  goalDeltaSub: { color: C.muted, fontWeight: '600', fontSize: 11 },
  goalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalCol: { flex: 1, alignItems: 'center' },
  goalNum: { color: C.white, fontSize: 22, fontWeight: '900' },
  goalSub: { color: C.muted, fontSize: 10, marginTop: 2, letterSpacing: 1 },
  goalArrow: { paddingHorizontal: 4 },
  goalArrowText: { color: C.muted, fontSize: 18, fontWeight: '700' },
  goalBarOuter: { backgroundColor: C.surface, borderRadius: 10, height: 20, overflow: 'hidden', justifyContent: 'center', position: 'relative' },
  goalBarInner: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: C.green, borderRadius: 10 },
  goalBarText: { color: C.white, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  goalHint: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },

  chartCard: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chartTitle: { color: C.white, fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  chartHeaderSub: { color: C.muted, fontSize: 11 },
  rangeRow: { flexDirection: 'row' },
  rangeBtn: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 4, borderRadius: 8, backgroundColor: C.surface },
  rangeBtnActive: { backgroundColor: C.green },
  rangeText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  rangeTextActive: { color: C.bg },
  chartFooter: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.border },
  chartFootText: { color: C.muted, fontSize: 11 },

  macroGrid: { flexDirection: 'row', marginBottom: 14 },
  macroBox: { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, marginRight: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  macroIcon: { fontSize: 18, marginBottom: 4 },
  macroNum: { color: C.green, fontSize: 20, fontWeight: '900' },
  macroUnit: { fontSize: 12, color: C.muted, fontWeight: '700' },
  macroLabel: { color: C.muted, fontSize: 10, marginTop: 2 },
  macroTarget: { color: C.muted, fontSize: 9, marginTop: 2 },

  adhCard: { backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  adhRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  adhBig: { width: 110, alignItems: 'center', paddingRight: 12, borderRightWidth: 1, borderRightColor: C.border },
  adhPct: { color: C.green, fontSize: 32, fontWeight: '900' },
  adhPctLabel: { color: C.muted, fontSize: 10 },
  adhStat: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingLeft: 14 },
  adhDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  adhStatLabel: { color: C.mutedLight, flex: 1, fontSize: 12 },
  adhStatVal: { color: C.white, fontWeight: '900', fontSize: 13 },

  backBtn: { borderWidth: 1.5, borderColor: C.border, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  backBtnText: { color: C.muted, fontSize: 13, fontWeight: '700' },
});
