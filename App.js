import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

import { Auth } from './utils/auth';
import { C } from './constants/theme';
import { isWideWeb } from './utils/platform';

import WelcomeScreen       from './screens/WelcomeScreen';
import OnboardingScreen    from './screens/OnboardingScreen';
import AuthScreen          from './screens/AuthScreen';
import HomeScreen          from './screens/HomeScreen';
import FoodScannerScreen   from './screens/FoodScannerScreen';
import FoodLogScreen       from './screens/FoodlogScreen';
import AICoachScreen       from './screens/AICoachScreen';
import MyPlanScreen        from './screens/MyPlanScreen';
import TrackerScreen       from './screens/TrackerScreen';
import ARScreen            from './screens/ARScreen';
import ProfileScreen       from './screens/ProfileScreen';
import BottomNav           from './components/BottomNav';
import WebLayout           from './components/WebLayout';

import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'fitlife_onboarding_complete';
const ONBOARDING_DATA_KEY = 'fitlife_onboarding_data';
const AUTHED = ['home', 'scanner', 'foodlog', 'plan', 'coach', 'tracker', 'ar', 'profile'];

function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser]     = useState(null);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const u = await Auth.getSession();
        if (u) { setUser(u); setScreen('home'); return; }
      } catch {}
      try {
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (!onboardingDone) { setScreen('welcome'); return; }
      } catch {}
      setScreen('auth');
    };
    init();
  }, []);

  const navigate     = (to) => setScreen(to);
  const handleLogin  = (u)  => { setUser(u); setScreen('home'); };
  const handleLogout = ()   => { setUser(null); setScreen('auth'); };

  const handleOnboardingComplete = async (data) => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data));
      setScreen('auth');
    } catch (e) {
      console.warn('Failed to save onboarding data:', e);
      setScreen('auth');
    }
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
        <TouchableOpacity style={s.errorBtn} onPress={() => { setError(null); setScreen('auth'); }}>
          <Text style={s.errorBtnText}>Restart App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderScreen = () => {
    switch (screen) {
      case 'loading':
        return (
          <View style={s.loading}>
            <View style={s.splashLogo}><Text style={s.splashLogoText}>FL</Text></View>
            <Text style={s.splashName}>FitLife</Text>
            <Text style={s.splashTagline}>AI-POWERED FITNESS</Text>
            <ActivityIndicator color={C.green} size="large" style={{ marginTop: 40 }} />
          </View>
        );
      case 'welcome':
        return <WelcomeScreen onStart={() => setScreen('onboarding')} />;
      case 'onboarding':
        return <OnboardingScreen onComplete={handleOnboardingComplete} />;
      case 'auth':    return <AuthScreen onLogin={handleLogin} />;
      case 'home':    return <HomeScreen user={user} onNavigate={navigate} onUserUpdate={updateUser} />;
      case 'scanner': return <FoodScannerScreen user={user} onUserUpdate={updateUser} onAddToLog={() => navigate('foodlog')} />;
      case 'foodlog': return <FoodLogScreen user={user} onNavigate={navigate} />;
      case 'plan':    return <MyPlanScreen user={user} onNavigate={navigate} />;
      case 'coach':   return <AICoachScreen user={user} onUserUpdate={updateUser} onPlanSaved={() => navigate('plan')} />;
      case 'tracker': return <TrackerScreen user={user} />;
      case 'ar':      return <ARScreen />;
      case 'profile': return <ProfileScreen user={user} onLogout={handleLogout} onNavigate={navigate} />;
      default:        return null;
    }
  };

  const isAuthed = AUTHED.includes(screen);

  if (isWideWeb && isAuthed) {
    return (
      <WebLayout current={screen} onNavigate={navigate} user={user}>
        {renderScreen()}
      </WebLayout>
    );
  }

  return (
    <View style={s.root}>
      <View style={s.content}>{renderScreen()}</View>
      {isAuthed && <BottomNav current={screen} onNavigate={navigate} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1 },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 90, height: 90, borderRadius: 45, borderWidth: 2.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  splashLogoText: { color: C.green, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  splashName: { color: C.white, fontSize: 36, fontWeight: '900', marginTop: 16, letterSpacing: 2 },
  splashTagline: { color: C.green, fontSize: 11, marginTop: 8, fontWeight: '700', letterSpacing: 3 },
  errorScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.danger + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  errorIconText: { color: C.danger, fontSize: 28, fontWeight: '900' },
  errorTitle: { color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 12 },
  errorText: { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  errorBtn: { backgroundColor: C.green, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 16, shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  errorBtnText: { color: C.bg, fontWeight: '900', fontSize: 16 },
});

registerRootComponent(App);
