import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { Auth } from './utils/auth';
import { C } from './constants/theme';

import AuthScreen        from './screens/AuthScreen';
import HomeScreen        from './screens/HomeScreen';
import FoodScannerScreen from './screens/FoodScannerScreen';
import AICoachScreen     from './screens/AICoachScreen';
import MyPlanScreen      from './screens/MyPlanScreen';
import ARScreen          from './screens/ARScreen';
import ProfileScreen     from './screens/ProfileScreen';
import BottomNav         from './components/BottomNav';

const AUTHED = ['home', 'scanner', 'plan', 'coach', 'ar', 'profile'];

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
      .catch(() => {
        // Storage corrupted or unavailable - go to auth
        setScreen('auth');
      });
  }, []);

  const navigate     = (to) => setScreen(to);
  const handleLogin  = (u)  => { setUser(u); setScreen('home'); };
  const handleLogout = ()   => { setUser(null); setScreen('auth'); };

  const updateUser = async (u) => {
    try {
      const fresh = await Auth.getSession();
      setUser(fresh || u);
    } catch {
      setUser(u);
    }
  };

  // Error boundary fallback
  if (error) {
    return (
      <View style={s.errorScreen}>
        <Text style={s.errorTitle}>Something went wrong</Text>
        <Text style={s.errorText}>{error}</Text>
        <View style={s.errorBtn} onTouchEnd={() => { setError(null); setScreen('auth'); }}>
          <Text style={s.errorBtnText}>Restart App</Text>
        </View>
      </View>
    );
  }

  const renderScreen = () => {
    try {
      switch (screen) {
        case 'loading':
          return (
            <View style={s.loading}>
              <View style={s.splashLogo}>
                <Text style={s.splashLogoText}>FL</Text>
              </View>
              <Text style={s.splashName}>FitLife</Text>
              <Text style={s.splashTagline}>Nutrition - Training - AI Coaching</Text>
              <ActivityIndicator color={C.green} size="large" style={{ marginTop: 40 }} />
            </View>
          );
        case 'auth':    return <AuthScreen onLogin={handleLogin} />;
        case 'home':    return <HomeScreen user={user} onNavigate={navigate} onUserUpdate={updateUser} />;
        case 'scanner': return <FoodScannerScreen user={user} onUserUpdate={updateUser} />;
        case 'plan':    return <MyPlanScreen user={user} onNavigate={navigate} />;
        case 'coach':   return <AICoachScreen user={user} onUserUpdate={updateUser} onPlanSaved={() => navigate('plan')} />;
        case 'ar':      return <ARScreen />;
        case 'profile': return <ProfileScreen user={user} onLogout={handleLogout} />;
        default:        return null;
      }
    } catch (e) {
      setError(e.message || 'Unknown error');
      return null;
    }
  };

  return (
    <View style={s.root}>
      <View style={s.content}>{renderScreen()}</View>
      {AUTHED.includes(screen) && <BottomNav current={screen} onNavigate={navigate} />}
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