import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, ScrollView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import {
  setNotificationsEnabled, requestPermission,
  scheduleSmartReminders, getCategoryPrefs, setCategoryPref,
} from '../utils/notifications';
import { Storage, KEYS } from '../utils/storage';
import { Auth } from '../utils/auth';
import AppleSwitch from '../components/AppleSwitch';
const SETTINGS_KEY = 'greengain_settings';

const DEFAULTS = {
  language: 'en',
  notifications: true,
  units: 'metric',
  reminders: true,
};

export default function SettingsScreen({ onNavigate }) {
  const { C, mode, setMode } = useTheme();
  const { t, lang, units, isRTL, setLanguage, setUnitSystem, languages } = useI18n();
  const s = makeStyles(C, isRTL);
  const UNIT_SYSTEMS = [
    { code: 'metric',   label: t('settings.unitsMetric') },
    { code: 'imperial', label: t('settings.unitsImperial') },
  ];
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showUnits, setShowUnits] = useState(false);
  const [catPrefs, setCatPrefs] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {}
      try { setCatPrefs(await getCategoryPrefs()); } catch {}
      setLoaded(true);
    })();
  }, []);

  // Keep local mirror in sync with the global context
  useEffect(() => { setSettings(s => ({ ...s, language: lang, units })); }, [lang, units]);

  const reschedule = async () => {
    try {
      const u = await Auth.getCurrentUser();
      if (!u) return;
      const plan = await Storage.get(KEYS.PLAN(u.email || u.uid));
      if (plan) await scheduleSmartReminders(plan);
    } catch {}
  };

  const updateCat = async (cat, value) => {
    if (!catPrefs) return;
    const next = { ...catPrefs, [cat]: value };
    setCatPrefs(next);
    try { await setCategoryPref(cat, value); } catch {}
    if (settings.notifications && settings.reminders) reschedule();
  };

  const update = async (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
    if (key === 'language') await setLanguage(value);
    if (key === 'units') await setUnitSystem(value);
  };

  const langLabel  = languages.find(l => l.code === settings.language)?.label || 'English';
  const unitLabel  = UNIT_SYSTEMS.find(u => u.code === settings.units)?.label || UNIT_SYSTEMS[0].label;

  const onToggleDark = (val) => {
    setMode(val ? 'dark' : 'light');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={s.backBtn}>
          <Text style={s.backText}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <Text style={s.titleBarText}>{t('settings.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {!loaded ? null : (
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.sectionLabel}>{t('settings.appearance')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{t('settings.darkMode')}</Text>
                <Text style={s.rowSub}>{t('settings.darkModeSub')}</Text>
              </View>
              <AppleSwitch
                value={mode === 'dark'}
                onValueChange={onToggleDark}
              />
            </View>
          </View>

          <Text style={s.sectionLabel}>{t('settings.preferences')}</Text>
          <View style={s.card}>
            <TouchableOpacity style={s.row} onPress={() => { setShowLang(!showLang); setShowUnits(false); }}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{t('settings.language')}</Text>
                <Text style={s.rowSub}>{langLabel}</Text>
              </View>
              <Text style={s.chevron}>{showLang ? '⌃' : (isRTL ? '‹' : '›')}</Text>
            </TouchableOpacity>
            {showLang && (
              <View style={s.optionList}>
                {languages.map(l => (
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
                <Text style={s.rowTitle}>{t('settings.units')}</Text>
                <Text style={s.rowSub}>{unitLabel}</Text>
              </View>
              <Text style={s.chevron}>{showUnits ? '⌃' : (isRTL ? '‹' : '›')}</Text>
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

          <Text style={s.sectionLabel}>{t('settings.notifications')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{t('settings.push')}</Text>
                <Text style={s.rowSub}>{t('settings.pushSub')}</Text>
              </View>
              <AppleSwitch
                value={settings.notifications}
                onValueChange={(v) => update('notifications', v)}
              />
            </View>
            <View style={s.divider} />
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{t('settings.mealReminders')}</Text>
                <Text style={s.rowSub}>{t('settings.mealRemindersSub')}</Text>
              </View>
              <AppleSwitch
                value={settings.reminders}
                onValueChange={async (v) => {
                  if (v) {
                    const granted = await requestPermission();
                    if (!granted) {
                      update('reminders', false);
                      await setNotificationsEnabled(false);
                      Alert.alert('Permission needed', 'Enable notifications in your device or browser settings to receive meal reminders.');
                      return;
                    }
                    update('reminders', true);
                    await setNotificationsEnabled(true);
                    try {
                      const u = await Auth.getCurrentUser();
                      if (u) {
                        const plan = await Storage.get(KEYS.PLAN(u.email || u.uid));
                        if (plan) await scheduleSmartReminders(plan, { force: true });
                      }
                    } catch {}
                  } else {
                    update('reminders', false);
                    await setNotificationsEnabled(false);
                  }
                }}
                trackColor={{ false: C.surface, true: C.green }}
                thumbColor={C.white}
              />
            </View>
          </View>

          {catPrefs && settings.notifications && settings.reminders && (
            <>
              <Text style={s.sectionLabel}>{t('settings.remindAboutTitle')}</Text>
              <View style={s.card}>
                {[
                  { k: 'meals',       title: t('settings.remind.meals'),       sub: t('settings.remind.mealsSub') },
                  { k: 'water',       title: t('settings.remind.water'),       sub: t('settings.remind.waterSub') },
                  { k: 'dinnerCheck', title: t('settings.remind.dinnerCheck'), sub: t('settings.remind.dinnerCheckSub') },
                  { k: 'workout',     title: t('settings.remind.workout'),     sub: t('settings.remind.workoutSub') },
                  { k: 'weekly',      title: t('settings.remind.weekly'),      sub: t('settings.remind.weeklySub') },
                ].map((c, i, arr) => (
                  <React.Fragment key={c.k}>
                    <View style={s.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowTitle}>{c.title}</Text>
                        <Text style={s.rowSub}>{c.sub}</Text>
                      </View>
                      <AppleSwitch
                        value={!!catPrefs[c.k]}
                        onValueChange={(v) => updateCat(c.k, v)}
                      />
                    </View>
                    {i < arr.length - 1 && <View style={s.divider} />}
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          <Text style={s.sectionLabel}>{t('settings.about')}</Text>
          <View style={s.card}>
            <View style={s.row}>
              <Text style={s.rowTitle}>{t('settings.version')}</Text>
              <Text style={s.rowSub}>1.0.0</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (C, isRTL = false) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  titleBarText: { color: C.white, fontSize: 18, fontWeight: '900' },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { color: C.green, fontSize: 28, fontWeight: '900', marginTop: -4 },
  scroll: { padding: 16, paddingBottom: 100 },
  sectionLabel: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 8, marginTop: 12, marginLeft: 4, textAlign: isRTL ? 'right' : 'left' },
  card: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowTitle: { color: C.white, fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
  rowSub: { color: C.muted, fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
  chevron: { color: C.muted, fontSize: 20, fontWeight: '700' },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  optionList: { paddingHorizontal: 16, paddingBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, backgroundColor: C.surface },
  optionRowActive: { backgroundColor: C.greenGlow2 },
  optionText: { color: C.mutedLight, fontSize: 13, fontWeight: '600' },
  optionTextActive: { color: C.green, fontWeight: '800' },
  checkMark: { color: C.green, fontSize: 16, fontWeight: '900' },
});
