import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { C } from '../constants/theme';

const TABS = [
  { screen: 'home',    label: 'Home',    icon: 'H'  },
  { screen: 'scanner', label: 'Food',    icon: 'F'  },
  { screen: 'plan',    label: 'My Plan', icon: 'P'  },
  { screen: 'coach',   label: 'Coach',   icon: 'AI' },
  { screen: 'profile', label: 'Profile', icon: 'Me' },
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
  bar: { flexDirection: 'row', paddingTop: 8, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  iconBox: { width: 36, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  iconBoxActive: { backgroundColor: C.green + '22' },
  iconText: { color: C.muted, fontSize: 11, fontWeight: '800' },
  iconTextActive: { color: C.green },
  label: { color: C.muted, fontSize: 10, fontWeight: '600' },
  labelActive: { color: C.green, fontWeight: '800' },
});