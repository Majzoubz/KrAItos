import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { C } from '../constants/theme';

const TABS = [
  { screen: 'home',    label: 'Home'    },
  { screen: 'scanner', label: 'Scanner' },
  { screen: 'plan',    label: 'My Plan' },
  { screen: 'coach',   label: 'Coach'   },
  { screen: 'profile', label: 'Profile' },
];

export default function BottomNav({ current, onNavigate }) {
  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.bar}>
        {TABS.map(tab => {
          const active = current === tab.screen;
          return (
            <TouchableOpacity key={tab.screen} style={s.tab} onPress={() => onNavigate(tab.screen)}>
              <View style={[s.dot, active && s.dotActive]} />
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
  bar: { flexDirection: 'row', paddingVertical: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 4 },
  dotActive: { backgroundColor: C.green },
  label: { color: C.muted, fontSize: 10, fontWeight: '600' },
  labelActive: { color: C.green, fontWeight: '800' },
});