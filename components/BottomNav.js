import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { C } from '../constants/theme';

const TABS = [
  { screen: 'home',    label: 'Home',      icon: '🏠' },
  { screen: 'plan',    label: 'Training',  icon: '🏋️' },
  { screen: 'scanner', label: 'AI Scan',   icon: '📷', center: true },
  { screen: 'foodlog', label: 'Nutrition', icon: '🍴' },
  { screen: 'profile', label: 'Profile',   icon: '👤' },
];

export default function BottomNav({ current, onNavigate }) {
  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.bar}>
        {TABS.map(tab => {
          const active = current === tab.screen;
          return (
            <TouchableOpacity
              key={tab.screen}
              style={s.tab}
              onPress={() => onNavigate(tab.screen)}
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

const s = StyleSheet.create({
  safeArea: { backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border },
  bar: { flexDirection: 'row', paddingTop: 8, paddingBottom: 6 },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  iconBox: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  iconBoxActive: { backgroundColor: C.greenGlow },
  iconText: { color: C.muted, fontSize: 18 },
  iconTextActive: { color: C.green },
  label: { color: C.muted, fontSize: 10, fontWeight: '600' },
  labelActive: { color: C.green, fontWeight: '800' },
});
