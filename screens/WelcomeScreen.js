import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Animated, Platform, Dimensions,
} from 'react-native';
import { C } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

export default function WelcomeScreen({ onStart }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <View style={s.container}>
      <View style={s.glowCircle} />

      <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <Animated.View style={[s.logoWrap, { transform: [{ scale: pulseAnim }] }]}>
          <View style={s.logoOuter}>
            <View style={s.logoInner}>
              <Text style={s.logoText}>FL</Text>
            </View>
          </View>
        </Animated.View>

        <Text style={s.brandName}>FitLife</Text>
        <View style={s.taglineWrap}>
          <View style={s.taglineLine} />
          <Text style={s.tagline}>AI-POWERED FITNESS</Text>
          <View style={s.taglineLine} />
        </View>

        <View style={s.featureList}>
          {[
            { icon: '◎', text: 'AI Nutrition Coaching' },
            { icon: '◈', text: 'Smart Meal Scanner' },
            { icon: '◇', text: 'Personalized Training' },
            { icon: '○', text: 'Progress Tracking' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <Text style={s.motivationText}>
          Transform your body with science-backed plans tailored just for you.
        </Text>
      </Animated.View>

      <View style={s.footer}>
        <TouchableOpacity style={s.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={s.startBtnText}>Get Started</Text>
          <Text style={s.startArrow}>→</Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Join thousands achieving their fitness goals
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'space-between' },
  glowCircle: {
    position: 'absolute', top: -120, alignSelf: 'center',
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(80px)' } : { opacity: 0.3 }),
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: { marginBottom: 24 },
  logoOuter: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2, borderColor: C.green + '40',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.greenGlow2,
  },
  logoInner: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2.5, borderColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bg,
  },
  logoText: { color: C.green, fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  brandName: { color: C.white, fontSize: 48, fontWeight: '900', letterSpacing: 3 },
  taglineWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 40 },
  taglineLine: { width: 24, height: 1, backgroundColor: C.green + '60' },
  tagline: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 3, marginHorizontal: 12 },
  featureList: { width: '100%', maxWidth: 300, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIcon: { color: C.green, fontSize: 18, width: 36, textAlign: 'center' },
  featureText: { color: C.light, fontSize: 15, fontWeight: '600' },
  motivationText: { color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 24, maxWidth: 320 },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'web' ? 40 : 50, alignItems: 'center' },
  startBtn: {
    backgroundColor: C.green, width: '100%', maxWidth: 360,
    paddingVertical: 18, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12,
  },
  startBtnText: { color: C.bg, fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  startArrow: { color: C.bg, fontSize: 22, fontWeight: '700', marginLeft: 10 },
  disclaimer: { color: C.muted, fontSize: 13, marginTop: 16, textAlign: 'center' },
});
