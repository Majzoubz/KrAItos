import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';

const TODAY = new Date().toDateString();
const GLASS_OZ = 8;
const DEFAULT_GOAL = 8;

export default function WaterCard({ uid, goalGlasses = DEFAULT_GOAL }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [glasses, setGlasses] = useState(0);

  const key = KEYS.WATER(uid, TODAY);

  const load = useCallback(async () => {
    try {
      const v = await Storage.get(key);
      const n = typeof v === 'number' ? v : (v?.glasses ?? 0);
      setGlasses(n || 0);
    } catch {}
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const save = async (n) => {
    setGlasses(n);
    try { await Storage.set(key, n); } catch {}
  };

  const add = () => save(Math.min(20, glasses + 1));
  const sub = () => save(Math.max(0, glasses - 1));

  const pct = Math.min(1, glasses / goalGlasses);
  const oz = glasses * GLASS_OZ;

  return (
    <View style={s.card}>
      <View style={s.left}>
        <View style={s.iconWrap}><Text style={s.icon}>💧</Text></View>
        <View>
          <Text style={s.title}>{glasses} <Text style={s.titleSm}>/ {goalGlasses} glasses</Text></Text>
          <Text style={s.sub}>{oz} oz today</Text>
        </View>
      </View>
      <View style={s.right}>
        <TouchableOpacity style={s.minus} onPress={sub} activeOpacity={0.7}>
          <Text style={s.minusText}>−</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.plus} onPress={add} activeOpacity={0.7}>
          <Text style={s.plusText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={s.barBg}>
        <View style={[s.barFill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#1E90FF22', alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 22 },
  title: { color: C.white, fontSize: 18, fontWeight: '900' },
  titleSm: { color: C.muted, fontSize: 12, fontWeight: '600' },
  sub: { color: C.muted, fontSize: 11, marginTop: 2 },
  right: { flexDirection: 'row', position: 'absolute', right: 12, top: 14 },
  minus: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, marginRight: 8,
  },
  minusText: { color: C.white, fontSize: 20, fontWeight: '900', marginTop: -2 },
  plus: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(127,255,0,0.3)' } : {}),
  },
  plusText: { color: C.bg, fontSize: 20, fontWeight: '900', marginTop: -2 },
  barBg: {
    marginTop: 14, height: 6, backgroundColor: C.surface, borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#1E90FF', borderRadius: 3 },
});
