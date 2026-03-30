import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { C } from '../constants/theme';

export default function WelcomeScreen({ onStart }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(60)).current;
  const btnSlide = useRef(new Animated.Value(40)).current;
  const btnFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(btnSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={s.container}>
      <View style={s.glowTop} />
      <View style={s.glowBottom} />

      <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <View style={s.logoBadge}>
          <View style={s.logoInner}>
            <Text style={s.logoText}>FL</Text>
          </View>
        </View>

        <Text style={s.brand}>FitLife</Text>
        <Text style={s.tagline}>YOUR AI FITNESS COACH</Text>

        <View style={s.divider} />

        <Text style={s.heroText}>
          The smartest way to{'\n'}transform your body
        </Text>

        <View style={s.featureGrid}>
          {[
            { icon: '◎', label: 'Smart Nutrition' },
            { icon: '◈', label: 'AI Coaching' },
            { icon: '◇', label: 'Meal Scanner' },
            { icon: '○', label: 'Progress Track' },
          ].map((f, i) => (
            <View key={i} style={s.featureItem}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={s.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[s.footer, { opacity: btnFade, transform: [{ translateY: btnSlide }] }]}>
        <TouchableOpacity style={s.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={s.startBtnText}>GET STARTED</Text>
        </TouchableOpacity>
        <Text style={s.footerNote}>Free to use. No credit card required.</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'space-between', overflow: 'hidden' },
  glowTop: {
    position: 'absolute', top: -200, left: '50%', marginLeft: -200,
    width: 400, height: 400, borderRadius: 200,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } : { opacity: 0.2 }),
  },
  glowBottom: {
    position: 'absolute', bottom: -100, right: -100,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(0,255,106,0.06)',
    ...(Platform.OS === 'web' ? { filter: 'blur(80px)' } : { opacity: 0.15 }),
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoBadge: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.greenGlow2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
  },
  logoInner: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2.5, borderColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg,
  },
  logoText: { color: C.green, fontSize: 28, fontWeight: '900', letterSpacing: 3 },
  brand: { color: C.white, fontSize: 44, fontWeight: '900', letterSpacing: 4, marginBottom: 6 },
  tagline: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 4 },
  divider: { width: 40, height: 2, backgroundColor: C.green + '40', marginVertical: 28 },
  heroText: { color: C.light, fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 32, marginBottom: 36 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 320 },
  featureItem: { width: '50%', alignItems: 'center', marginBottom: 20, paddingHorizontal: 8 },
  featureIcon: { color: C.green, fontSize: 24, marginBottom: 6 },
  featureLabel: { color: C.muted, fontSize: 13, fontWeight: '600' },
  footer: { paddingHorizontal: 28, paddingBottom: Platform.OS === 'web' ? 36 : 48, alignItems: 'center' },
  startBtn: {
    backgroundColor: C.green, width: '100%', maxWidth: 340,
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  startBtnText: { color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  footerNote: { color: C.muted, fontSize: 12, marginTop: 14 },
});
