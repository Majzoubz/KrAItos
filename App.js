import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';

import { Auth } from './utils/auth';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { I18nProvider } from './i18n/I18nContext';
import { isWideWeb } from './utils/platform';
import { Storage, KEYS, initStorage } from './utils/storage';
import WelcomeScreen       from './screens/WelcomeScreen';
import OnboardingScreen    from './screens/OnboardingScreen';
import AuthScreen          from './screens/AuthScreen';
import HomeScreen          from './screens/HomeScreen';
import FoodScannerScreen   from './screens/FoodScannerScreen';
import FoodLogScreen       from './screens/FoodlogScreen';
import MyPlanScreen        from './screens/MyPlanScreen';
import TrackerScreen       from './screens/TrackerScreen';
import ProgressScreen      from './screens/ProgressScreen';
import HealthScreen        from './screens/HealthScreen';
import MealStudioScreen    from './screens/MealStudioScreen';
import ARScreen            from './screens/ARScreen';
import ProfileScreen       from './screens/ProfileScreen';
import SettingsScreen      from './screens/SettingsScreen';
import WorkoutSessionScreen from './screens/WorkoutSessionScreen';
import BarcodeScanScreen   from './screens/BarcodeScanScreen';
import WeeklyReviewScreen  from './screens/WeeklyReviewScreen';
import MeasurementsScreen  from './screens/MeasurementsScreen';
import CoachChatScreen     from './screens/CoachChatScreen';
import GroceryListScreen   from './screens/GroceryListScreen';
import RestaurantScreen    from './screens/RestaurantScreen';
import MyInfoScreen        from './screens/MyInfoScreen';
import BottomNav           from './components/BottomNav';
import WebLayout           from './components/WebLayout';
import SplashScreen        from './components/SplashScreen';
import ScreenTransition    from './components/ScreenTransition';
import FloatingChatbot     from './components/FloatingChatbot';

import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'greengain_onboarding_complete';
const ONBOARDING_DATA_KEY = 'greengain_onboarding_data';
const LEGACY_ONBOARDING_KEY = 'fitlife_onboarding_complete';
const AUTHED = ['home', 'scanner', 'foodlog', 'plan', 'tracker', 'ar', 'profile', 'settings', 'progress', 'health', 'mealstudio', 'workoutsession', 'barcode', 'weeklyreview', 'measurements', 'coach', 'grocery', 'restaurant', 'myinfo'];

function App() {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [screen, setScreen] = useState('loading');
  const [screenParams, setScreenParams] = useState(null);
  const [user, setUser]     = useState(null);
  const [error, setError]   = useState(null);

  useEffect(() => { initStorage(); }, []);

  useEffect(() => {
    const MIN_SPLASH_MS = 2200;
    const splashStart = Date.now();
    const advance = (target) => {
      const elapsed = Date.now() - splashStart;
      const wait = Math.max(0, MIN_SPLASH_MS - elapsed);
      setTimeout(() => setScreen(target), wait);
    };
    const init = async () => {
      let target = 'welcome';
      let nextUser = null;
      try {
        const legacySession = await AsyncStorage.getItem('fitlife_session_v2');
        if (legacySession) {
          await AsyncStorage.setItem('greengain_session_v2', legacySession);
          await AsyncStorage.removeItem('fitlife_session_v2');
        }
        const legacyOnboarding = await AsyncStorage.getItem(LEGACY_ONBOARDING_KEY);
        if (legacyOnboarding) {
          await AsyncStorage.setItem(ONBOARDING_KEY, legacyOnboarding);
          await AsyncStorage.removeItem(LEGACY_ONBOARDING_KEY);
        }
        const u = await Auth.getSession();
        if (u) {
          const uid = u?.email || u?.uid;
          let userOnboarding = null;
          if (uid) {
            try { userOnboarding = await Storage.get(KEYS.ONBOARDING(uid)); } catch {}
          }
          nextUser = u;
          target = userOnboarding ? 'home' : 'onboarding';
        }
      } catch {}
      if (nextUser) setUser(nextUser);
      advance(target);
    };
    init();
  }, []);

  const navigate     = (to, params) => { setScreenParams(params || null); setScreen(to); };
  const handleLogout = ()   => { setUser(null); setScreen('welcome'); };

  const handleLogin = async (u) => {
    setUser(u);
    const uid = u?.email || u?.uid;
    try {
      if (uid) {
        const userOnboarding = await Storage.get(KEYS.ONBOARDING(uid));
        if (userOnboarding) { setScreen('home'); return; }
      }
    } catch {}
    setScreen('onboarding');
  };

  const handleOnboardingComplete = async (data) => {
    try {
      const uid = user?.email || user?.uid;
      if (uid) {
        await Storage.set(KEYS.ONBOARDING(uid), {
          ...data,
          completedAt: Date.now(),
          email: user?.email,
          fullName: user?.fullName,
        });
      }
      await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save onboarding data:', e);
    }
    setScreen('home');
  };

  const updateUser = async (u) => {
    try {
      const fresh = await Auth.getUserData(u?.uid);
      setUser(fresh || u);
    } catch { setUser(u); }
  };

  if (error) {
    return (
      <View style={s.errorScreen}>
        <View style={s.errorIcon}><Text style={s.errorIconText}>!</Text></View>
        <Text style={s.errorTitle}>Something went wrong</Text>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.errorBtn} onPress={() => { setError(null); setScreen('welcome'); }}>
          <Text style={s.errorBtnText}>Restart</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'loading':
        return <SplashScreen />;
      case 'welcome':
        return <WelcomeScreen onStart={() => setScreen('auth')} />;
      case 'auth':
        return <AuthScreen onLogin={handleLogin} initialMode="signup" />;
      case 'onboarding':
        return <OnboardingScreen onComplete={handleOnboardingComplete} user={user} />;
      case 'home':    return <HomeScreen user={user} onNavigate={navigate} onUserUpdate={updateUser} />;
      case 'scanner': return <FoodScannerScreen user={user} onUserUpdate={updateUser} onAddToLog={() => navigate('foodlog')} />;
      case 'foodlog': return <FoodLogScreen user={user} onNavigate={navigate} />;
      case 'plan':    return <MyPlanScreen user={user} onNavigate={navigate} />;
      case 'tracker': return <TrackerScreen user={user} />;
      case 'progress': return <ProgressScreen user={user} onNavigate={navigate} />;
      case 'health':  return <HealthScreen user={user} onNavigate={navigate} />;
      case 'mealstudio': return <MealStudioScreen user={user} onNavigate={navigate} />;
      case 'ar':      return <ARScreen />;
      case 'profile': return <ProfileScreen user={user} onLogout={handleLogout} onNavigate={navigate} />;
      case 'settings': return <SettingsScreen onNavigate={navigate} />;
      case 'workoutsession': return <WorkoutSessionScreen user={user} params={screenParams} onNavigate={navigate} />;
      case 'barcode':     return <BarcodeScanScreen user={user} onNavigate={navigate} />;
      case 'weeklyreview': return <WeeklyReviewScreen user={user} onNavigate={navigate} />;
      case 'measurements': return <MeasurementsScreen user={user} onNavigate={navigate} />;
      case 'coach':       return <CoachChatScreen user={user} onNavigate={navigate} />;
      case 'grocery':     return <GroceryListScreen user={user} onNavigate={navigate} />;
      case 'restaurant':  return <RestaurantScreen user={user} onNavigate={navigate} />;
      case 'myinfo':      return <MyInfoScreen user={user} onNavigate={navigate} />;
      default:        return null;
    }
  };

  const isAuthed = AUTHED.includes(screen);

  if (isWideWeb && isAuthed) {
    return (
      <WebLayout current={screen} onNavigate={navigate} user={user}>
        <ScreenTransition screenKey={screen}>{renderScreen()}</ScreenTransition>
        {screen !== 'coach' && <FloatingChatbot user={user} onNavigate={navigate} />}
      </WebLayout>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.content}>
        <ScreenTransition screenKey={screen}>{renderScreen()}</ScreenTransition>
      </View>
      {isAuthed && <BottomNav current={screen} onNavigate={navigate} />}
      {isAuthed && screen !== 'coach' && <FloatingChatbot user={user} onNavigate={navigate} />}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1 },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  splashGlow: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: C.greenGlow2,
    ...(Platform.OS === 'web' ? { filter: 'blur(80px)' } : { opacity: 0.15 }),
  },
  splashLogo: { width: 100, height: 100 },
  splashName: { color: C.white, fontSize: 34, fontWeight: '900', marginTop: 20, letterSpacing: 3 },
  errorScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.danger + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  errorIconText: { color: C.danger, fontSize: 24, fontWeight: '900' },
  errorTitle: { color: C.white, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  errorText: { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  errorBtn: { backgroundColor: C.green, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16 },
  errorBtnText: { color: C.bg, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});

function Root() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  );
}

registerRootComponent(Root);
