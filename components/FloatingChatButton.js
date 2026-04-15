import React, { useRef, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Animated, Image, Platform } from 'react-native';
import { C } from '../constants/theme';

export default function FloatingChatButton({ onPress, currentScreen }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  if (currentScreen === 'coach') return null;

  return (
    <Animated.View style={[s.wrap, { transform: [{ scale: scaleAnim }] }]}>
      <Animated.View style={[s.glowRing, { transform: [{ scale: pulseAnim }] }]} />
      <TouchableOpacity style={s.btn} onPress={onPress} activeOpacity={0.8}>
        <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 90, right: 20, zIndex: 999,
    width: 58, height: 58, alignItems: 'center', justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute', width: 62, height: 62, borderRadius: 31,
    backgroundColor: C.greenGlow,
    ...(Platform.OS === 'web' ? { filter: 'blur(8px)' } : { opacity: 0.3 }),
  },
  btn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.card,
    borderWidth: 1.5, borderColor: C.green + '60',
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 20px rgba(127,255,0,0.2)',
    } : {}),
  },
  logo: { width: 34, height: 34 },
});
