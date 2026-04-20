import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { computeWeeklyBadges } from '../utils/streaks';

export default function StreakBadgesCard({ uid, plan }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [badges, setBadges] = useState({ logDays: 0, proteinDays: 0, calorieDays: 0 });

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const b = await computeWeeklyBadges(uid, plan);
        if (on) setBadges(b);
      } catch {}
    })();
    return () => { on = false; };
  }, [uid, plan]);

  const items = [
    { icon: '📓', label: 'Logged', val: badges.logDays },
    { icon: '🥩', label: 'Protein hit', val: badges.proteinDays },
    { icon: '🎯', label: 'Calorie target', val: badges.calorieDays },
  ];

  return (
    <View style={s.card}>
      <Text style={s.title}>This week</Text>
      <View style={s.row}>
        {items.map((it, i) => (
          <View key={i} style={s.badge}>
            <Text style={s.badgeIcon}>{it.icon}</Text>
            <Text style={s.badgeNum}>{it.val}<Text style={s.badgeNumSm}>/7</Text></Text>
            <Text style={s.badgeLabel}>{it.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  title: { color: C.white, fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  badge: {
    flex: 1, alignItems: 'center', padding: 10, marginHorizontal: 3,
    backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border,
  },
  badgeIcon: { fontSize: 22, marginBottom: 4 },
  badgeNum: { color: C.green, fontSize: 18, fontWeight: '900' },
  badgeNumSm: { color: C.muted, fontSize: 11, fontWeight: '700' },
  badgeLabel: { color: C.muted, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'center' },
});
