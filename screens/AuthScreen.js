import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { C } from '../constants/theme';
import { Auth } from '../utils/auth';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode]             = useState('login');
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);

  const handle = async () => {
    const trimEmail = email.trim().toLowerCase();
    const trimName  = fullName.trim();

    if (mode === 'signup') {
      if (!trimName || !trimEmail || !password || !confirm) {
        Alert.alert('Missing Fields', 'Please fill in all fields.'); return;
      }
      if (!/\S+@\S+\.\S+/.test(trimEmail)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.'); return;
      }
      if (password.length < 6) {
        Alert.alert('Weak Password', 'Password must be at least 6 characters.'); return;
      }
      if (password !== confirm) {
        Alert.alert('Passwords do not match', 'Please make sure both passwords are the same.'); return;
      }
      setLoading(true);
      const result = await Auth.signup(trimName, trimEmail, password);
      setLoading(false);
      if (result.error) { Alert.alert('Signup Failed', result.error); return; }
      onLogin(result.user);
    } else {
      if (!trimEmail || !password) {
        Alert.alert('Missing Fields', 'Enter your email and password.'); return;
      }
      setLoading(true);
      const result = await Auth.login(trimEmail, password);
      setLoading(false);
      if (result.error) { Alert.alert('Login Failed', result.error); return; }
      onLogin(result.user);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <View style={s.logoWrap}>
            <View style={s.logoRing}><Text style={s.logoText}>FL</Text></View>
            <Text style={s.appName}>FitLife</Text>
            <Text style={s.tagline}>AI-POWERED FITNESS</Text>
          </View>

          <View style={s.tabs}>
            {['login', 'signup'].map(m => (
              <TouchableOpacity key={m} style={[s.tab, mode === m && s.tabActive]}
                onPress={() => { setMode(m); setPassword(''); setConfirm(''); }}>
                <Text style={[s.tabText, mode === m && s.tabTextActive]}>
                  {m === 'login' ? 'Log In' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'signup' && (
            <>
              <Text style={s.label}>Full Name</Text>
              <TextInput style={s.input} placeholder="Alex Johnson" placeholderTextColor={C.muted}
                value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            </>
          )}

          <Text style={s.label}>Email</Text>
          <TextInput style={s.input} placeholder="alex@example.com" placeholderTextColor={C.muted}
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

          <Text style={s.label}>Password</Text>
          <View style={s.passWrap}>
            <TextInput style={s.passInput} placeholder="Min. 6 characters" placeholderTextColor={C.muted}
              value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
              <Text style={s.eyeText}>{showPass ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <>
              <Text style={s.label}>Confirm Password</Text>
              <View style={s.passWrap}>
                <TextInput style={s.passInput} placeholder="Repeat password" placeholderTextColor={C.muted}
                  value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm} />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={s.eyeBtn}>
                  <Text style={s.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={handle} disabled={loading}>
            {loading
              ? <ActivityIndicator color={C.bg} />
              : <Text style={s.btnText}>{mode === 'login' ? 'Log In' : 'Create Account'}</Text>
            }
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchText}>
              {mode === 'login' ? "Don't have an account?  " : 'Already have an account?  '}
            </Text>
            <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              <Text style={s.link}>{mode === 'login' ? 'Sign Up' : 'Log In'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: C.bg },
  logoText: { color: C.green, fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  appName: { fontSize: 36, fontWeight: '900', color: C.white, letterSpacing: 2 },
  tagline: { fontSize: 11, color: C.green, marginTop: 6, fontWeight: '700', letterSpacing: 3 },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, padding: 4, marginBottom: 28, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: C.green },
  tabText: { color: C.muted, fontWeight: '700', fontSize: 15 },
  tabTextActive: { color: C.bg },
  label: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 8, letterSpacing: 0.5 },
  input: { backgroundColor: C.surface, color: C.white, padding: 16, borderRadius: 14, fontSize: 15, marginBottom: 18, borderWidth: 1.5, borderColor: C.border },
  passWrap: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 18, alignItems: 'center' },
  passInput: { flex: 1, color: C.white, padding: 16, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 16 },
  eyeText: { color: C.green, fontSize: 13, fontWeight: '700' },
  btn: { backgroundColor: C.green, paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, shadowColor: C.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  btnText: { color: C.bg, fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText: { color: C.muted, fontSize: 14 },
  link: { color: C.green, fontSize: 14, fontWeight: '700' },
});
