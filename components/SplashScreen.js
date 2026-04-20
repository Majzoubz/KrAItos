import React, { useEffect, useRef } from 'react';
import {
  View, Text, Image, Animated, Easing, StyleSheet, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const BRAND = 'KrAItos';

export default function SplashScreen() {
  const { C } = useTheme();
  const s = makeStyles(C);

  const fade        = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.4)).current;
  const logoLift    = useRef(new Animated.Value(20)).current;
  const ringSpin    = useRef(new Animated.Value(0)).current;
  const ringSpinRev = useRef(new Animated.Value(0)).current;
  const glowPulse   = useRef(new Animated.Value(0.5)).current;
  const haloPulse   = useRef(new Animated.Value(0)).current;
  const tagline     = useRef(new Animated.Value(0)).current;
  const barFill     = useRef(new Animated.Value(0)).current;
  const letters     = useRef(BRAND.split('').map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,      { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring (logoScale,{ toValue: 1, tension: 38, friction: 6, useNativeDriver: true }),
      Animated.spring (logoLift, { toValue: 0, tension: 38, friction: 7, useNativeDriver: true }),
    ]).start();

    Animated.stagger(70,
      letters.map(v => Animated.spring(v, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }))
    ).start();

    Animated.timing(tagline, { toValue: 1, duration: 600, delay: 700, useNativeDriver: true }).start();

    Animated.timing(barFill, {
      toValue: 1,
      duration: 1800,
      delay: 400,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
      useNativeDriver: false,
    }).start();

    Animated.loop(
      Animated.timing(ringSpin, {
        toValue: 1, duration: 8000,
        easing: Easing.linear, useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(ringSpinRev, {
        toValue: 1, duration: 12000,
        easing: Easing.linear, useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.5, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(haloPulse, {
        toValue: 1, duration: 2200,
        easing: Easing.out(Easing.quad), useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin    = ringSpin.interpolate({    inputRange: [0, 1], outputRange: ['0deg',  '360deg'] });
  const spinRev = ringSpinRev.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const haloScale  = haloPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] });
  const haloOpacity= haloPulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] });
  const barWidth = barFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Animated.View style={[s.root, { opacity: fade }]}>
      {/* radial background glows */}
      <View style={[s.bgGlow, s.bgGlowTL]} />
      <View style={[s.bgGlow, s.bgGlowBR]} />

      <View style={s.center}>
        {/* expanding halo rings */}
        <Animated.View style={[s.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />

        {/* core pulsing glow behind logo */}
        <Animated.View style={[s.coreGlow, { opacity: glowPulse, transform: [{ scale: glowPulse.interpolate({ inputRange: [0.5, 1], outputRange: [1, 1.15] }) }] }]} />

        {/* outer rotating dashed ring */}
        <Animated.View style={[s.ringOuter, { transform: [{ rotate: spin }] }]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={[s.tick, { transform: [{ rotate: `${i * 30}deg` }, { translateY: -110 }] }]} />
          ))}
        </Animated.View>

        {/* inner counter-rotating dotted ring */}
        <Animated.View style={[s.ringInner, { transform: [{ rotate: spinRev }] }]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[s.dot, { transform: [{ rotate: `${i * 60}deg` }, { translateY: -78 }] }]} />
          ))}
        </Animated.View>

        {/* logo */}
        <Animated.View style={{ transform: [{ scale: logoScale }, { translateY: logoLift }] }}>
          <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
        </Animated.View>
      </View>

      {/* brand letters */}
      <View style={s.brandRow}>
        {BRAND.split('').map((ch, i) => (
          <Animated.Text
            key={i}
            style={[
              s.brandLetter,
              {
                opacity: letters[i],
                transform: [
                  { translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
                  { scale:      letters[i].interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                ],
              },
              /[A-Z]/.test(ch) && i > 0 && i < BRAND.length - 1 ? s.brandLetterAccent : null,
            ]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>

      {/* tagline */}
      <Animated.Text
        style={[
          s.tagline,
          {
            opacity: tagline,
            transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          },
        ]}
      >
        YOUR  AI  FITNESS  COACH
      </Animated.Text>

      {/* progress bar */}
      <View style={s.barWrap}>
        <View style={s.barTrack}>
          <Animated.View style={[s.barFill, { width: barWidth }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  bgGlow: {
    position: 'absolute', width: 360, height: 360, borderRadius: 180,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(110px)' } : { opacity: 0.18 }),
  },
  bgGlowTL: { top: -120, left: -120 },
  bgGlowBR: { bottom: -120, right: -120 },

  center: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },

  halo: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    borderWidth: 2, borderColor: C.green,
  },

  coreGlow: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: C.greenGlow2,
    ...(Platform.OS === 'web' ? { filter: 'blur(40px)' } : {}),
  },

  ringOuter: {
    position: 'absolute', width: 240, height: 240, alignItems: 'center', justifyContent: 'center',
  },
  tick: {
    position: 'absolute', width: 2, height: 10, borderRadius: 1, backgroundColor: C.green,
  },

  ringInner: {
    position: 'absolute', width: 180, height: 180, alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    position: 'absolute', width: 5, height: 5, borderRadius: 3, backgroundColor: C.green,
    opacity: 0.6,
  },

  logo: { width: 110, height: 110 },

  brandRow: {
    flexDirection: 'row', marginTop: 28, alignItems: 'flex-end',
  },
  brandLetter: {
    color: C.white, fontSize: 38, fontWeight: '900', letterSpacing: 1,
  },
  brandLetterAccent: {
    color: C.green,
  },

  tagline: {
    color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 14, letterSpacing: 4,
  },

  barWrap: {
    position: 'absolute', bottom: 70, width: 180, alignItems: 'center',
  },
  barTrack: {
    width: '100%', height: 3, borderRadius: 2,
    backgroundColor: C.surface, overflow: 'hidden',
  },
  barFill: {
    height: '100%', backgroundColor: C.green, borderRadius: 2,
  },
});
