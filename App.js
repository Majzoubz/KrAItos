import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

import { Auth } from './utils/auth';
import { C } from './constants/theme';
import { isWideWeb } from './utils/platform';

import AuthScreen        from './screens/AuthScreen';
import HomeScreen        from './screens/HomeScreen';
import FoodScannerScreen from './screens/FoodScannerScreen';
import FoodLogScreen     from './screens/FoodlogScreen';
import AICoachScreen     from './screens/AICoachScreen';
import MyPlanScreen      from './screens/MyPlanScreen';
import TrackerScreen     from './screens/TrackerScreen';
import ARScreen          from './screens/ARScreen';
import ProfileScreen     from './screens/ProfileScreen';
import BottomNav         from './components/BottomNav';
import WebLayout         from './components/WebLayout';

const AUTHED = ['home', 'scanner', 'foodlog', 'plan', 'coach', 'tracker', 'ar', 'profile'];

function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser]     = useState(null);
  const [error, setError]   = useState(null);

  useEffect(() => {
    Auth.getSession()
      .then(u => {
        if (u) { setUser(u); setScreen('home'); }
        else setScreen('auth');
      })
      .catch(() => setScreen('auth'));
  }, []);

  const navigate     = (to) => setScreen(to);
  const handleLogin  = (u)  => { setUser(u); setScreen('home'); };
  const handleLogout = ()   => { setUser(null); setScreen('auth'); };

  const updateUser = async (u) => {
    try {
      const fresh = await Auth.getUserData(u?.uid);
      setUser(fresh || u);
    } catch { setUser(u); }
  };

  if (error) {
    return (
      <View style={s.errorScreen}>
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
            <Text style={s.splashTagline}>Nutrition - Training - AI Coaching</Text>
            <ActivityIndicator color={C.green} size="large" style={{ marginTop: 40 }} />
          </View>
        );
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
  splashLogo: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: C.green, alignItems: 'center', justifyContent: 'center' },
  splashLogoText: { color: C.green, fontSize: 28, fontWeight: '900' },
  splashName: { color: C.white, fontSize: 32, fontWeight: '900', marginTop: 16 },
  splashTagline: { color: C.muted, fontSize: 13, marginTop: 6 },
  errorScreen: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorTitle: { color: C.danger, fontSize: 20, fontWeight: '900', marginBottom: 12 },
  errorText: { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 28 },
  errorBtn: { backgroundColor: C.green, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  errorBtnText: { color: C.bg, fontWeight: '900', fontSize: 15 },
});

registerRootComponent(App);