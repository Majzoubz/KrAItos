import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const TRACK_W = 51;
const TRACK_H = 31;
const THUMB = 27;
const PAD = 2;

export default function AppleSwitch({ value, onValueChange, disabled = false }) {
  const { C } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 90,
    }).start();
  }, [value]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, TRACK_W - THUMB - PAD],
  });

  const trackOnOpacity = anim;
  const trackOffOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const offBg = C.surface;
  const offBorder = C.border;

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      disabled={disabled}
      hitSlop={8}
      style={[
        styles.track,
        {
          backgroundColor: offBg,
          borderColor: offBorder,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.trackFill,
          { backgroundColor: C.green, opacity: trackOnOpacity, pointerEvents: 'none' },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.trackGloss,
          { opacity: trackOffOpacity, pointerEvents: 'none' },
        ]}
      />
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX }],
            backgroundColor: '#FFFFFF',
          },
        ]}
      >
        <View style={styles.thumbHighlight} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackFill: {
    borderRadius: TRACK_H / 2,
  },
  trackGloss: {
    borderRadius: TRACK_H / 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    ...Platform.select({
      web: {
        boxShadow:
          '0 3px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12), inset 0 -1px 0 rgba(0,0,0,0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
    }),
  },
  thumbHighlight: {
    position: 'absolute',
    top: 1,
    left: 3,
    right: 3,
    height: THUMB / 2 - 2,
    borderRadius: THUMB / 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    opacity: 0.6,
  },
});
