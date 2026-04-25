import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Animated, Platform, Image,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useT } from '../i18n/I18nContext';
import BrandName from '../components/BrandName';
export default function WelcomeScreen({ onStart }) {
  const { C } = useTheme();
  const t = useT();
  const s = makeStyles(C);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(60)).current;
  const btnSlide = useRef(new Animated.Value(40)).current;
  const btnFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoTranslateY = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0.6)).current;
  const exitingRef = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 1000, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(btnSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.6, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={s.container}>
      <View style={s.glowTop} />
      <View style={s.glowBottom} />
      <View style={s.glowCenter} />

      <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }], pointerEvents: 'box-none' }]}>
        <Animated.View style={[s.logoWrap, { transform: [{ translateY: logoTranslateY }, { scale: logoScale }] }]}>
          <Animated.View style={[s.logoGlow, { opacity: glowPulse }]} />
          <Image source={require('../assets/logo.png')} style={s.logoImage} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={{ opacity: bodyOpacity, alignItems: 'center', alignSelf: 'stretch' }}>
        <BrandName style={s.brand} />
        <Text style={s.tagline}>{t('welcome.tagline')}</Text>

        <View style={s.divider} />

        <Text style={s.heroText}>{t('welcome.hero')}</Text>

        <View style={s.featureGrid}>
          {[
            { icon: '⚡', label: t('welcome.feature.nutrition') },
            { icon: '🧠', label: t('welcome.feature.coaching') },
            { icon: '📸', label: t('welcome.feature.scanner') },
            { icon: '📊', label: t('welcome.feature.progress') },
          ].map((f, i) => (
            <View key={i} style={s.featureItem}>
              <View style={s.featureIconWrap}>
                <Text style={s.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={s.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[s.footer, { opacity: btnFade, transform: [{ translateY: btnSlide }] }]}>
        <TouchableOpacity
          style={s.startBtn}
          onPress={() => {
            if (exitingRef.current) return;
            exitingRef.current = true;
            Animated.parallel([
              Animated.timing(bodyOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
              Animated.timing(btnFade,    { toValue: 0, duration: 200, useNativeDriver: true }),
              Animated.timing(logoScale,  { toValue: 0.66, duration: 280, useNativeDriver: true }),
              Animated.timing(logoTranslateY, { toValue: -160, duration: 280, useNativeDriver: true }),
            ]).start(() => onStart && onStart());
          }}
          activeOpacity={0.85}
        >
          <Text style={s.startBtnText}>{t('welcome.start')}</Text>
        </TouchableOpacity>
        <Text style={s.footerNote}>{t('welcome.note')}</Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, justifyContent: 'space-between', overflow: 'hidden' },
  glowTop: {
    position: 'absolute', top: -220, left: '50%', marginLeft: -220,
    width: 440, height: 440, borderRadius: 220,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(140px)' } : { opacity: 0.15 }),
  },
  glowBottom: {
    position: 'absolute', bottom: -120, right: -120,
    width: 340, height: 340, borderRadius: 170,
    backgroundColor: 'rgba(127,255,0,0.05)',
    ...(Platform.OS === 'web' ? { filter: 'blur(100px)' } : { opacity: 0.12 }),
  },
  glowCenter: {
    position: 'absolute', top: '30%', left: '50%', marginLeft: -100,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(127,255,0,0.03)',
    ...(Platform.OS === 'web' ? { filter: 'blur(80px)' } : { opacity: 0.1 }),
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoWrap: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  logoGlow: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(30px)' } : {}),
  },
  logoImage: {
    width: 120, height: 120,
  },
  brand: { color: C.white, fontSize: 46, fontWeight: '900', letterSpacing: 3, marginBottom: 8 },
  tagline: { color: C.green, fontSize: 11, fontWeight: '700', letterSpacing: 5 },
  divider: { width: 48, height: 2, backgroundColor: C.green + '50', marginVertical: 32, borderRadius: 1 },
  heroText: { color: C.light, fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 34, marginBottom: 40, letterSpacing: 0.3 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 340 },
  featureItem: { width: '50%', alignItems: 'center', marginBottom: 24, paddingHorizontal: 8 },
  featureIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: C.greenGlow2,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1, borderColor: C.green + '20',
  },
  featureIcon: { fontSize: 20 },
  featureLabel: { color: C.mutedLight, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  footer: { paddingHorizontal: 28, paddingBottom: Platform.OS === 'web' ? 36 : 48, alignItems: 'center' },
  startBtn: {
    backgroundColor: C.green, width: '100%', maxWidth: 340,
    paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  startBtnText: { color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  footerNote: { color: C.muted, fontSize: 12, marginTop: 16, letterSpacing: 0.5 },
});
