import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkC, lightC } from '../constants/theme';

const STORAGE_KEY = 'greengain_theme_mode';

const ThemeContext = createContext({
  mode: 'dark',
  C: darkC,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => Appearance.getColorScheme() === 'light' ? 'light' : 'dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
          setModeState(saved);
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const sub = Appearance.addChangeListener(async ({ colorScheme }) => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (!saved && (colorScheme === 'light' || colorScheme === 'dark')) {
          setModeState(colorScheme);
        }
      } catch {}
    });
    return () => sub?.remove?.();
  }, [hydrated]);

  const setMode = useCallback(async (next) => {
    setModeState(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo(() => ({
    mode,
    C: mode === 'light' ? lightC : darkC,
    setMode,
    toggle,
  }), [mode, setMode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
