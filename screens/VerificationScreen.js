import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Auth } from '../utils/auth';

const OTP_LENGTH     = 6;
const EXPIRY_SECONDS = 600;

export default function VerificationScreen({ uid, email, fullName, onVerified, onBack }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const [digits, setDigits]       = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [timeLeft, setTimeLeft]   = useState(EXPIRY_SECONDS);
  const inputRefs = useRef([]);

  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(n => n - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const handleDigit = (value, index) => {
    if (value.length > 1) {
      const paste = value.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
      const next  = Array(OTP_LENGTH).fill('');
      paste.split('').forEach((ch, i) => { next[i] = ch; });
      setDigits(next);
      inputRefs.current[Math.min(paste.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const d    = value.replace(/[^0-9]/g, '');
    const next = [...digits];
    next[index] = d;
    setDigits(next);
    if (d && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verify = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert('Incomplete Code', 'Please enter all 6 digits.'); return;
    }
    setLoading(true);
    const result = await Auth.verifyOTP(uid, code);
    setLoading(false);
    if (result.error) {
      Alert.alert('Verification Failed', result.error);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      return;
    }
    Alert.alert(
      'Email Verified ✓',
      'Your account is now verified. Please log in to continue.',
      [{ text: 'Go to Login', onPress: onVerified }]
    );
  };

  const resend = async () => {
    setResending(true);
    const result = await Auth.resendOTP(uid, email, fullName);
    setResending(false);
    if (result.error) { Alert.alert('Error', result.error); return; }
    setTimeLeft(EXPIRY_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
    Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  return (
    <View style={s.safe}>
      <View style={s.glowTop} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.container}>
          <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.envelope}>✉️</Text>
          <Text style={s.title}>Check your email</Text>
          <Text style={s.sub}>We sent a 6-digit code to</Text>
          <Text style={s.email}>{email}</Text>

          <View style={s.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={r => { inputRefs.current[i] = r; }}
                style={[s.otpBox, d ? s.otpBoxFilled : null]}
                value={d}
                onChangeText={v => handleDigit(v, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH}
                selectTextOnFocus
                caretHidden
                editable={!loading}
              />
            ))}
          </View>

          <Text style={[s.timer, timeLeft === 0 && s.timerExpired]}>
            {timeLeft > 0 ? `Code expires in ${mm}:${ss}` : 'Code expired'}
          </Text>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.6 }]}
            onPress={verify}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={C.bg} /> : <Text style={s.btnText}>VERIFY EMAIL</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.resendBtn, (resending || timeLeft > 0) && { opacity: 0.4 }]}
            onPress={resend}
            disabled={resending || timeLeft > 0}
          >
            {resending
              ? <ActivityIndicator color={C.green} size="small" />
              : <Text style={s.resendText}>
                  {timeLeft > 0 ? `Resend available in ${mm}:${ss}` : 'Resend code'}
                </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={onBack} style={s.backBtn}>
            <Text style={s.backText}>← Back to sign up</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, overflow: 'hidden' },
  glowTop: {
    position: 'absolute', top: -180, left: '50%', marginLeft: -180,
    width: 360, height: 360, borderRadius: 180,
    backgroundColor: C.greenGlow2,
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : { opacity: 0.15 }),
  },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo: { width: 60, height: 60, marginBottom: 10 },
  envelope: { fontSize: 46, marginBottom: 14 },
  title: { color: C.white, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  sub: { color: C.muted, fontSize: 14, marginBottom: 4 },
  email: { color: C.green, fontSize: 14, fontWeight: '700', marginBottom: 28 },

  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  otpBox: {
    width: 46, height: 58, borderRadius: 14,
    backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border,
    textAlign: 'center', color: C.white, fontSize: 24, fontWeight: '900',
  },
  otpBoxFilled: { borderColor: C.green, backgroundColor: C.green + '15' },

  timer: { color: C.muted, fontSize: 13, marginBottom: 22 },
  timerExpired: { color: '#ff4444' },

  btn: {
    width: '100%', backgroundColor: C.green,
    paddingVertical: 18, borderRadius: 16, alignItems: 'center', marginBottom: 12,
  },
  btnText: { color: C.bg, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },

  resendBtn: { paddingVertical: 10, marginBottom: 20 },
  resendText: { color: C.green, fontSize: 14, fontWeight: '700' },

  backBtn: { paddingVertical: 8 },
  backText: { color: C.muted, fontSize: 13 },
});
