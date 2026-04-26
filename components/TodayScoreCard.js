import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { computeTodayScore, computeRecentScores, streakFromScores } from '../utils/dailyScore';

function MiniRing({ pct, color, trackColor, size = 22, stroke = 3 }) {
  const deg = Math.round(Math.min(Math.max(pct, 0), 1) * 360);
  const ringStyle = Platform.OS === 'web' ? {
    background: `conic-gradient(${color} ${deg}deg, ${trackColor} ${deg}deg)`,
  } : { backgroundColor: trackColor };
  return (
    <View style={[{
      width: size, height: size, borderRadius: size / 2,
      alignItems: 'center', justifyContent: 'center',
    }, ringStyle]}>
      <View style={{ width: size - stroke * 2, height: size - stroke * 2, borderRadius: (size - stroke * 2) / 2, backgroundColor: 'transparent' }} />
    </View>
  );
}

export default function TodayScoreCard({ uid, healthUid, plan, foodLog, healthToday, onPress }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [today, setToday] = useState(null);
  const [recent, setRecent] = useState([]);

  const compute = useCallback(async () => {
    const [t, r] = await Promise.all([
      computeTodayScore(uid, plan, foodLog || [], healthToday),
      computeRecentScores(uid, plan, 7, healthUid || uid),
    ]);
    setToday(t);
    setRecent(r);
  }, [uid, healthUid, plan, foodLog, healthToday]);

  useEffect(() => { compute(); }, [compute]);

  if (!today) return null;
  const streak = streakFromScores(recent, 2);

  const pillarOrder = ['calories', 'protein', 'workout', 'steps'];
  const pillarIcons = { calories: '🔥', protein: '🥩', workout: '🏋️', steps: '👟' };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={s.card}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>TODAY</Text>
          <Text style={s.scoreText}>
            <Text style={s.scoreNum}>{today.hits}</Text>
            <Text style={s.scoreSlash}>/{today.total}</Text>
            <Text style={s.scoreLabel}>  goals hit</Text>
          </Text>
        </View>
        <View style={s.streakWrap}>
          <Text style={s.streakIcon}>🔥</Text>
          <View>
            <Text style={s.streakNum}>{streak}</Text>
            <Text style={s.streakLabel}>day streak</Text>
          </View>
        </View>
      </View>

      <View style={s.pillarsRow}>
        {pillarOrder.map(k => {
          const p = today.pillars[k];
          const pct = p.target ? Math.min(1, (typeof p.value === 'number' ? p.value : 0) / p.target) : (p.ok ? 1 : 0);
          return (
            <View key={k} style={[s.pillar, p.ok && s.pillarOk]}>
              <View style={s.pillarTop}>
                <Text style={s.pillarIcon}>{pillarIcons[k]}</Text>
                <MiniRing
                  pct={p.ok ? 1 : pct}
                  color={p.ok ? C.green : C.muted}
                  trackColor={C.border}
                />
              </View>
              <Text style={[s.pillarLabel, p.ok && s.pillarLabelOk]}>{p.label}</Text>
              <Text style={[s.pillarValue, p.ok && s.pillarValueOk]}>
                {typeof p.value === 'number' && p.target ? `${p.value}/${p.target}` : (p.value === 'Rest' ? 'Rest' : p.value === '✓' ? 'Done' : '—')}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={s.weekRow}>
        {recent.map((d, i) => (
          <View key={i} style={s.dayCol}>
            <View style={[
              s.dayDot,
              d.hits >= 4 && s.dayDot4,
              d.hits === 3 && s.dayDot3,
              d.hits === 2 && s.dayDot2,
              d.isToday && s.dayDotToday,
            ]}>
              <Text style={[s.dayDotText, d.hits >= 2 && s.dayDotTextOk]}>{d.hits}</Text>
            </View>
            <Text style={[s.dayLabel, d.isToday && s.dayLabelToday]}>{d.label}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginHorizontal: 16, marginTop: 12,
    borderWidth: 1, borderColor: C.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  label: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  scoreText: { marginTop: 4 },
  scoreNum: { color: C.green, fontSize: 32, fontWeight: '900' },
  scoreSlash: { color: C.muted, fontSize: 18, fontWeight: '800' },
  scoreLabel: { color: C.muted, fontSize: 12, fontWeight: '700' },
  streakWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  streakIcon: { fontSize: 22 },
  streakNum: { color: C.white, fontSize: 18, fontWeight: '900' },
  streakLabel: { color: C.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },

  pillarsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pillar: {
    flex: 1, backgroundColor: C.bg, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: C.border,
  },
  pillarOk: { borderColor: C.green, backgroundColor: C.green + '12' },
  pillarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pillarIcon: { fontSize: 16 },
  pillarLabel: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pillarLabelOk: { color: C.green },
  pillarValue: { color: C.white, fontSize: 12, fontWeight: '800', marginTop: 2 },
  pillarValueOk: { color: C.white },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', flex: 1 },
  dayDot: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  dayDot2: { backgroundColor: C.green + '40', borderColor: C.green + '70' },
  dayDot3: { backgroundColor: C.green + '80', borderColor: C.green },
  dayDot4: { backgroundColor: C.green, borderColor: C.green },
  dayDotToday: { borderWidth: 2 },
  dayDotText: { color: C.muted, fontSize: 10, fontWeight: '900' },
  dayDotTextOk: { color: C.bg },
  dayLabel: { color: C.muted, fontSize: 9, fontWeight: '700', marginTop: 4 },
  dayLabelToday: { color: C.white },
});
