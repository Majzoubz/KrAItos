import { Platform } from 'react-native';

let Native = null;
if (Platform.OS !== 'web') {
  try {
    Native = require('expo-speech-recognition');
  } catch {
    Native = null;
  }
}

export function isVoiceAvailable() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return false;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  return !!Native?.ExpoSpeechRecognitionModule;
}

async function startNative({ onResult, onError, onEnd, lang }) {
  const Mod = Native.ExpoSpeechRecognitionModule;
  try {
    const perm = await Mod.requestPermissionsAsync();
    if (!perm.granted) {
      onError?.(new Error('Microphone / speech permission denied'));
      return null;
    }
  } catch (e) {
    onError?.(e);
    return null;
  }

  const subs = [];
  subs.push(Native.addSpeechRecognitionListener('result', (ev) => {
    if (ev?.isFinal && ev?.results?.[0]?.transcript) {
      onResult?.(ev.results[0].transcript);
    }
  }));
  subs.push(Native.addSpeechRecognitionListener('error', (ev) => {
    onError?.(new Error(ev?.error || 'Speech error'));
  }));
  subs.push(Native.addSpeechRecognitionListener('end', () => {
    subs.forEach(s => { try { s.remove(); } catch {} });
    onEnd?.();
  }));

  try {
    Mod.start({
      lang,
      interimResults: false,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: true,
    });
  } catch (e) {
    subs.forEach(s => { try { s.remove(); } catch {} });
    onError?.(e);
    return null;
  }
  return () => { try { Mod.stop(); } catch {} };
}

function startWeb({ onResult, onError, onEnd, lang }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let r;
  try { r = new SR(); } catch (e) { onError?.(e); return null; }
  r.lang = lang;
  r.interimResults = false;
  r.continuous = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    try {
      const t = e.results?.[0]?.[0]?.transcript || '';
      onResult?.(t);
    } catch (err) { onError?.(err); }
  };
  r.onerror = (e) => onError?.(e);
  r.onend = () => onEnd?.();
  try { r.start(); } catch (e) { onError?.(e); return null; }
  return () => { try { r.stop(); } catch {} };
}

export function startVoice({ onResult, onError, onEnd, lang = 'en-US' } = {}) {
  if (!isVoiceAvailable()) {
    onError?.(new Error('Voice input is not supported on this device'));
    return null;
  }
  if (Platform.OS === 'web') {
    return startWeb({ onResult, onError, onEnd, lang });
  }
  let stop = null;
  startNative({ onResult, onError, onEnd, lang }).then(s => { stop = s; });
  return () => { try { stop?.(); } catch {} };
}
