import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useT, useI18n } from '../i18n/I18nContext';
import { select as hSelect } from '../utils/haptics';
const TAB_DEFS = [
  { screen: 'home',    key: 'nav.home',      icon: '🏠' },
  { screen: 'plan',    key: 'nav.training',  icon: '🏋️' },
  { screen: 'scanner', key: 'nav.scan',      icon: '📷', center: true },
  { screen: 'foodlog', key: 'nav.nutrition', icon: '🍴' },
  { screen: 'profile', key: 'nav.profile',   icon: '👤' },
];

export default function BottomNav({ current, onNavigate }) {
  const { C } = useTheme();
  const t = useT();
  const { isRTL } = useI18n();
  const s = makeStyles(C, isRTL);
  const TABS = TAB_DEFS.map(td => ({ ...td, label: t(td.key) }));
  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.bar}>
        {TABS.map(tab => {
          const active = current === tab.screen;
          return (
            <TouchableOpacity
              key={tab.screen}
              style={s.tab}
              onPress={() => { if (current !== tab.screen) hSelect(); onNavigate(tab.screen); }}
              activeOpacity={0.7}
            >
              <View style={[s.iconBox, active && s.iconBoxActive]}>
                <Text style={[s.iconText, active && s.iconTextActive]}>{tab.icon}</Text>
              </View>
              <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (C, isRTL = false) => StyleSheet.create({
  safeArea: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  bar: { flexDirection: isRTL ? 'row-reverse' : 'row', paddingTop: 8, paddingBottom: 6 },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  iconBox: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  iconBoxActive: { backgroundColor: C.greenGlow },
  iconText: { color: C.muted, fontSize: 18 },
  iconTextActive: { color: C.green },
  label: { color: C.muted, fontSize: 10, fontWeight: '600' },
  labelActive: { color: C.green, fontWeight: '800' },
});
