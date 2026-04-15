import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
  Alert, ActivityIndicator, Animated, Image,
} from 'react-native';
import { C } from '../constants/theme';
import { Auth } from '../utils/auth';

export default function AuthScreen({ onLogin, initialMode = 'signup' }) {
  const [mode, setMode]             = useState(initialMode);
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]       = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

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
    <View style={s.safe}>
      <View style={s.glowTop} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            <View style={s.topSection}>
              <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
              <Text style={s.heading}>
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </Text>
              <Text style={s.subheading}>
                {mode === 'signup' ? 'Join GreenGain to start your transformation' : 'Log in to continue your journey'}
              </Text>
            </View>

            {mode === 'signup' && (
              <View style={s.fieldGroup}>
                <Text style={s.label}>FULL NAME</Text>
                <TextInput style={s.input} placeholder="Your name" placeholderTextColor={C.muted}
                  value={fullName} onChangeText={setFullName} autoCapitalize="words" />
              </View>
            )}

            <View style={s.fieldGroup}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput style={s.input} placeholder="you@example.com" placeholderTextColor={C.muted}
                value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>PASSWORD</Text>
              <View style={s.passWrap}>
                <TextInput style={s.passInput} placeholder="Min. 6 characters" placeholderTextColor={C.muted}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                  <Text style={s.eyeText}>{showPass ? 'HIDE' : 'SHOW'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {mode === 'signup' && (
              <View style={s.fieldGroup}>
                <Text style={s.label}>CONFIRM PASSWORD</Text>
                <View style={s.passWrap}>
                  <TextInput style={s.passInput} placeholder="Repeat password" placeholderTextColor={C.muted}
                    value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm} />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={s.eyeBtn}>
                    <Text style={s.eyeText}>{showConfirm ? 'HIDE' : 'SHOW'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={handle} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={C.bg} />
                : <Text style={s.btnText}>{mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</Text>
              }
            </TouchableOpacity>

            <View style={s.switchRow}>
              <Text style={s.switchText}>
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </Text>
              <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setPassword(''); setConfirm(''); }}>
                <Text style={s.link}>{mode === 'login' ? ' Sign Up' : ' Log In'}</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  glowTop: {
    position: 'absolute', top: -180, left: '50%', marginLeft: -180,
    width: 360, height: 360, borderRadius: 180,
    backgroundColor: C.greenGlow2,
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : { opacity: 0.15 }),
  },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  topSection: { alignItems: 'center', marginBottom: 36 },
  logoImage: { width: 80, height: 80, marginBottom: 24 },
  heading: { fontSize: 28, fontWeight: '800', color: C.white, marginBottom: 8, letterSpacing: 0.5 },
  subheading: { fontSize: 15, color: C.muted, textAlign: 'center' },
  fieldGroup: { marginBottom: 18 },
  label: { color: C.mutedLight, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 1.5 },
  input: { backgroundColor: C.surface, color: C.white, padding: 16, borderRadius: 14, fontSize: 16, borderWidth: 1, borderColor: C.border },
  passWrap: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  passInput: { flex: 1, color: C.white, padding: 16, fontSize: 16 },
  eyeBtn: { paddingHorizontal: 16 },
  eyeText: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  btn: {
    backgroundColor: C.green, paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: C.bg, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  switchText: { color: C.muted, fontSize: 14 },
  link: { color: C.green, fontSize: 14, fontWeight: '700' },
});
