import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from 'react-native';
import { C } from '../constants/theme';
import { Field } from '../components/UI';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handle = () => {
    if (mode === 'signup') {
      if (!fullName || !email || !password || !confirmPassword) {
        Alert.alert('Missing Fields', 'Please fill in all fields.'); return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match.'); return;
      }
      onLogin(fullName);
    } else {
      if (!email || !password) {
        Alert.alert('Missing Fields', 'Enter your email and password.'); return;
      }
      onLogin(email.split('@')[0]);
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.logoWrap}>
            <View style={s.logoRing}>
              <Text style={s.logoEmoji}>⚡</Text>
            </View>
            <Text style={s.appName}>FitLife</Text>
            <Text style={s.appTagline}>Nutrition · Training · AI Coaching</Text>
          </View>

          <View style={s.tabRow}>
            {['signup', 'login'].map(m => (
              <TouchableOpacity key={m} style={[s.tab, mode === m && s.tabActive]} onPress={() => setMode(m)}>
                <Text style={[s.tabText, mode === m && s.tabTextActive]}>
                  {m === 'signup' ? 'Sign Up' : 'Log In'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View>
            {mode === 'signup' && (
              <Field label="Full Name" placeholder="Alex Johnson" value={fullName} onChangeText={setFullName} />
            )}
            <Field label="Email" placeholder="alex@example.com" value={email}
              onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" placeholder="••••••••" value={password}
              onChangeText={setPassword} secureTextEntry />
            {mode === 'signup' && (
              <Field label="Confirm Password" placeholder="••••••••" value={confirmPassword}
                onChangeText={setConfirmPassword} secureTextEntry />
            )}

            <TouchableOpacity style={s.primaryBtn} onPress={handle}>
              <Text style={s.primaryBtnText}>
                {mode === 'signup' ? 'Create Account' : 'Log In'}
              </Text>
            </TouchableOpacity>

            <View style={s.switchRow}>
              <Text style={s.switchText}>
                {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
                <Text style={s.linkText}>{mode === 'signup' ? 'Log In' : 'Sign Up'}</Text>
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: C.green,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 36 },
  appName: { fontSize: 38, fontWeight: '900', color: C.green, letterSpacing: 1 },
  appTagline: { fontSize: 13, color: C.muted, marginTop: 4, letterSpacing: 0.5 },
  tabRow: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 12, padding: 4, marginBottom: 28,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: C.green },
  tabText: { color: C.muted, fontWeight: '600', fontSize: 15 },
  tabTextActive: { color: C.bg },
  primaryBtn: {
    backgroundColor: C.green, paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: C.bg, fontSize: 16, fontWeight: '900' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  switchText: { color: C.muted, fontSize: 14 },
  linkText: { color: C.green, fontSize: 14, fontWeight: 'bold' },
});
