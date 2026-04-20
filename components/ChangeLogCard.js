import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function hasMeaningfulChange(lastChange) {
  if (!lastChange) return false;
  const adj = Array.isArray(lastChange.adjustments) ? lastChange.adjustments : [];
  const wins = Array.isArray(lastChange.wins) ? lastChange.wins : [];
  if (adj.length > 0) return true;
  if (wins.length > 0) return true;
  return false;
}

export default function ChangeLogCard({ lastChange }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  if (!hasMeaningfulChange(lastChange)) return null;

  const adj = Array.isArray(lastChange.adjustments) ? lastChange.adjustments : [];
  const wins = Array.isArray(lastChange.wins) ? lastChange.wins : [];
  const focus = Array.isArray(lastChange.focusNextWeek) ? lastChange.focusNextWeek : [];

  return (
    <View style={s.changeCard}>
      <Text style={s.changeLabel}>WHAT CHANGED LAST UPDATE</Text>
      {lastChange.summary ? (
        <Text style={s.changeSummary}>{lastChange.summary}</Text>
      ) : null}
      {adj.map((a, i) => (
        <View key={i} style={s.adjRow}>
          <Text style={s.adjArea}>{a.area}</Text>
          <Text style={s.adjBeforeAfter}>
            {a.before} <Text style={s.adjArrow}>→</Text> {a.after}
          </Text>
          {a.why ? <Text style={s.adjWhy}>{a.why}</Text> : null}
        </View>
      ))}
      {wins.length > 0 && (
        <View style={s.changeSubBlock}>
          <Text style={s.changeSubLabel}>WINS</Text>
          {wins.map((w, i) => (
            <Text key={i} style={s.changeBullet}>✓ {w}</Text>
          ))}
        </View>
      )}
      {focus.length > 0 && (
        <View style={s.changeSubBlock}>
          <Text style={s.changeSubLabel}>FOCUS NEXT WEEK</Text>
          {focus.map((f, i) => (
            <Text key={i} style={s.changeBullet}>→ {f}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  changeCard: { backgroundColor: C.greenGlow2, borderRadius: 14, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: C.green },
  changeLabel: { color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  changeSummary: { color: C.light, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  adjRow: { marginBottom: 10 },
  adjArea: { color: C.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.3, marginBottom: 2 },
  adjBeforeAfter: { color: C.light, fontSize: 13, fontWeight: '700' },
  adjArrow: { color: C.green, fontWeight: '900' },
  adjWhy: { color: C.muted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  changeSubBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  changeSubLabel: { color: C.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  changeBullet: { color: C.mutedLight, fontSize: 12, lineHeight: 18, marginBottom: 3 },
});
