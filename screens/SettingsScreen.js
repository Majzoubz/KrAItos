import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Switch,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
const SETTINGS_KEY = 'greengain_settings';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
];

const UNIT_SYSTEMS = [
  { code: 'metric',   label: 'Metric (kg, cm)' },
  { code: 'imperial', label: 'Imperial (lb, ft)' },
];

const DEFAULTS = {
  language: 'en',
  notifications: true,
  units: 'metric',
  reminders: true,
};

export default function SettingsScreen({ onNavigate }) {
  const { C, mode, setMode } = useTheme();
  const s = makeStyles(C);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showUnits, setShowUnits] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const update = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
  };

  const langLabel  = LANGUAGES.find(l => l.code === settings.language)?.label || 'English';
  const unitLabel  = UNIT_SYSTEMS.find(u => u.code === settings.units)?.label || 'Metric';

  const onToggleDark = (val) => {
    setMode(val ? 'dark' : 'light');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.titleBarText}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      {!loaded ? null : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.sectionLabel}>APPEARANCE</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Dark mode</Text>
                <Text style={s.rowSub}>Use dark theme across the app</Text>
              </View>
              <Switch
                value={mode === 'dark'}
                onValueChange={onToggleDark}
                trackColor={{ false: C.surface, true: C.green }}
                thumbColor={C.white}
              />
            </View>
          </View>

          <Text style={s.sectionLabel}>PREFERENCES</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.row} onPress={() => { setShowLang(!showLang); setShowUnits(false); }}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Language</Text>
                <Text style={s.rowSub}>{langLabel}</Text>
              </View>
              <Text style={s.chevron}>{showLang ? '⌃' : '›'}</Text>
            </TouchableOpacity>
            {showLang && (
              <View style={s.optionList}>
                {LANGUAGES.map(l => (
                  <TouchableOpacity
                    key={l.code}
                    style={[s.optionRow, settings.language === l.code && s.optionRowActive]}
                    onPress={() => { update('language', l.code); setShowLang(false); }}
                  >
                    <Text style={[s.optionText, settings.language === l.code && s.optionTextActive]}>
                      {l.label}
                    </Text>
                    {settings.language === l.code && <Text style={s.checkMark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={s.divider} />

            <TouchableOpacity style={s.row} onPress={() => { setShowUnits(!showUnits); setShowLang(false); }}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Units</Text>
                <Text style={s.rowSub}>{unitLabel}</Text>
              </View>
              <Text style={s.chevron}>{showUnits ? '⌃' : '›'}</Text>
            </TouchableOpacity>
            {showUnits && (
              <View style={s.optionList}>
                {UNIT_SYSTEMS.map(u => (
                  <TouchableOpacity
                    key={u.code}
                    style={[s.optionRow, settings.units === u.code && s.optionRowActive]}
                    onPress={() => { update('units', u.code); setShowUnits(false); }}
                  >
                    <Text style={[s.optionText, settings.units === u.code && s.optionTextActive]}>
                      {u.label}
                    </Text>
                    {settings.units === u.code && <Text style={s.checkMark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Text style={s.sectionLabel}>NOTIFICATIONS</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Push notifications</Text>
                <Text style={s.rowSub}>Daily progress and tips</Text>
              </View>
              <Switch
                value={settings.notifications}
                onValueChange={(v) => update('notifications', v)}
                trackColor={{ false: C.surface, true: C.green }}
                thumbColor={C.white}
              />
            </View>
            <View style={s.divider} />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>Meal reminders</Text>
                <Text style={s.rowSub}>Reminders to log meals</Text>
              </View>
              <Switch
                value={settings.reminders}
                onValueChange={(v) => update('reminders', v)}
                trackColor={{ false: C.surface, true: C.green }}
                thumbColor={C.white}
              />
            </View>
          </View>

          <Text style={s.sectionLabel}>ABOUT</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowTitle}>Version</Text>
              <Text style={s.rowSub}>1.0.0</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 18, fontWeight: '900' },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.green, fontSize: 28, fontWeight: '900', marginTop: -4 },
  scroll: { padding: 16, paddingBottom: 100 },
  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 8, marginTop: 12, marginLeft: 4 },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowTitle: { color: C.white, fontSize: 14, fontWeight: '700' },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  chevron: { color: C.muted, fontSize: 20, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  optionList: { paddingHorizontal: 16, paddingBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, backgroundColor: C.surface },
  optionRowActive: { backgroundColor: C.greenGlow2 },
  optionText: { color: C.mutedLight, fontSize: 13, fontWeight: '600' },
  optionTextActive: { color: C.green, fontWeight: '800' },
  checkMark: { color: C.green, fontSize: 16, fontWeight: '900' },
});
