import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { Auth } from './utils/auth';
import { C } from './constants/theme';

import AuthScreen        from './screens/AuthScreen';
import HomeScreen        from './screens/HomeScreen';
import FoodScannerScreen from './screens/FoodScannerScreen';
import AICoachScreen     from './screens/AICoachScreen';
import ARScreen          from './screens/ARScreen';
import ProfileScreen     from './screens/ProfileScreen';
import BottomNav         from './components/BottomNav';

const AUTHED_SCREENS = ['home', 'scanner', 'coach', 'ar', 'profile'];

function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser]     = useState(null);

  useEffect(() => {
    Auth.getSession().then(u => {
      if (u) { setUser(u); setScreen('home'); }
      else setScreen('auth');
    });
  }, []);

  const navigate     = (to) => setScreen(to);
  const handleLogin  = (u)  => { setUser(u); setScreen('home'); };
  const handleLogout = ()   => { setUser(null); setScreen('auth'); };
  const updateUser   = (u)  => setUser(u);

  const showNav = AUTHED_SCREENS.includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case 'loading': return (
        <View style={s.loading}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      );
      case 'auth':    return <AuthScreen onLogin={handleLogin} />;
      case 'home':    return <HomeScreen user={user} onNavigate={navigate} />;
      case 'scanner': return <FoodScannerScreen user={user} onUserUpdate={updateUser} />;
      case 'coach':   return <AICoachScreen user={user} onUserUpdate={updateUser} />;
      case 'ar':      return <ARScreen />;
      case 'profile': return <ProfileScreen user={user} onLogout={handleLogout} />;
      default:        return null;
    }
  };

  return (
    <View style={s.root}>
      <View style={s.content}>{renderScreen()}</View>
      {showNav && <BottomNav current={screen} onNavigate={navigate} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1 },
  loading: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
});

registerRootComponent(App);