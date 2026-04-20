import { Platform } from 'react-native';

export function isVoiceAvailable() {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startVoice({ onResult, onError, onEnd, lang = 'en-US' } = {}) {
  if (!isVoiceAvailable()) {
    onError?.(new Error('Voice input is not supported on this device'));
    return null;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let r;
  try {
    r = new SR();
  } catch (e) {
    onError?.(e);
    return null;
  }
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
