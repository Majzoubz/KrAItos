import { Platform, Vibration } from 'react-native';

let audioCtx = null;
let enabled = true;

const getCtx = () => {
  if (Platform.OS !== 'web') return null;
  if (audioCtx) return audioCtx;
  try {
    if (typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  } catch {}
  return audioCtx;
};

const playTone = (freq = 1000, duration = 0.03, type = 'sine', gain = 0.04) => {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch {}
};

const webVibrate = (ms) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch {}
  }
};

export const tick = () => {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    playTone(1100, 0.018, 'square', 0.018);
    webVibrate(6);
  } else {
    try { Vibration.vibrate(6); } catch {}
  }
};

export const select = () => {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    playTone(820, 0.05, 'triangle', 0.05);
    webVibrate(15);
  } else {
    try { Vibration.vibrate(15); } catch {}
  }
};

export const success = () => {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    playTone(660, 0.08, 'sine', 0.05);
    setTimeout(() => playTone(990, 0.10, 'sine', 0.05), 80);
    webVibrate([15, 30, 25]);
  } else {
    try { Vibration.vibrate([0, 15, 30, 25]); } catch {}
  }
};

export const setHapticsEnabled = (v) => { enabled = !!v; };
export const isHapticsEnabled = () => enabled;
