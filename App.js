import React, { useState } from 'react';

import AuthScreen       from './screens/AuthScreen';
import HomeScreen       from './screens/HomeScreen';
import FoodScannerScreen from './screens/FoodScannerScreen';
import AICoachScreen    from './screens/AICoachScreen';
import ARScreen         from './screens/ARScreen';
import ProgressScreen   from './screens/ProgressScreen';

export default function App() {
  const [screen, setScreen] = useState('auth');
  const [userName, setUserName] = useState('');

  const navigate = (to) => setScreen(to);

  switch (screen) {
    case 'auth':     return <AuthScreen onLogin={name => { setUserName(name); navigate('home'); }} />;
    case 'home':     return <HomeScreen userName={userName} onNavigate={navigate} />;
    case 'scanner':  return <FoodScannerScreen onBack={() => navigate('home')} />;
    case 'coach':    return <AICoachScreen onBack={() => navigate('home')} />;
    case 'ar':       return <ARScreen onBack={() => navigate('home')} />;
    case 'progress': return <ProgressScreen onBack={() => navigate('home')} />;
    default:         return null;
  }
}
