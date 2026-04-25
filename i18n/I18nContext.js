import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { I18nManager, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS, SUPPORTED_LANGUAGES, tFor, setActiveLanguage } from './translations';

const SETTINGS_KEY = 'greengain_settings';
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [units, setUnits] = useState('metric');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.language && TRANSLATIONS[parsed.language]) setLang(parsed.language);
          if (parsed.units === 'metric' || parsed.units === 'imperial') setUnits(parsed.units);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    setActiveLanguage(lang);
    const meta = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    const isRtl = !!meta?.rtl;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    } else if (Platform.OS !== 'web') {
      try {
        if (I18nManager.isRTL !== isRtl) {
          I18nManager.allowRTL(isRtl);
          I18nManager.forceRTL(isRtl);
        }
      } catch {}
    }
  }, [lang]);

  const persist = async (next) => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      const cur = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...cur, ...next }));
    } catch {}
  };

  const setLanguage = useCallback(async (code) => {
    if (!TRANSLATIONS[code]) return;
    const wasRtl = !!SUPPORTED_LANGUAGES.find(l => l.code === lang)?.rtl;
    const willRtl = !!SUPPORTED_LANGUAGES.find(l => l.code === code)?.rtl;
    setLang(code);
    await persist({ language: code });
    if (Platform.OS !== 'web' && wasRtl !== willRtl) {
      try {
        Alert.alert(
          tFor(code, 'settings.rtlReloadTitle'),
          tFor(code, 'settings.rtlReloadMsg'),
        );
      } catch {}
    }
  }, [lang]);

  const setUnitSystem = useCallback(async (system) => {
    if (system !== 'metric' && system !== 'imperial') return;
    setUnits(system);
    await persist({ units: system });
  }, []);

  const t = useCallback((key, vars) => tFor(lang, key, vars), [lang]);

  const isRTL = !!SUPPORTED_LANGUAGES.find(l => l.code === lang)?.rtl;

  const value = useMemo(() => ({
    lang, units, isRTL, loaded,
    t, setLanguage, setUnitSystem,
    languages: SUPPORTED_LANGUAGES,
  }), [lang, units, isRTL, loaded, t, setLanguage, setUnitSystem]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      lang: 'en', units: 'metric', isRTL: false, loaded: true,
      t: (k, v) => tFor('en', k, v),
      setLanguage: () => {}, setUnitSystem: () => {},
      languages: SUPPORTED_LANGUAGES,
    };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
