import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, Modal,
  ScrollView, ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import {
  getFavorites, getYesterdayMeal, getUsualForSlot, parseMealDescription,
  appendToTodayLog, currentMealTime, loadPinnedFavorites, pinFavorite,
} from '../utils/quickLog';

const MEAL_TIMES = ['Breakfast', 'Morning Snack', 'Lunch', 'Afternoon Snack', 'Dinner', 'Late Snack'];

// Cross-platform speech recognition (web only)
function useSpeechToText(onResult) {
  const recRef = useRef(null);
  const supported = Platform.OS === 'web'
    && typeof window !== 'undefined'
    && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = () => {
    if (!supported) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const txt = Array.from(ev.results).map(r => r[0].transcript).join(' ');
      onResult(txt);
    };
    rec.onerror = () => {};
    rec.start();
    recRef.current = rec;
    return true;
  };
  const stop = () => { try { recRef.current?.stop(); } catch {} };
  return { supported, start, stop };
}

export default function QuickLogSheet({ visible, onClose, uid, onLogged }) {
  const { C } = useTheme();
  const s = makeStyles(C);

  const [pinned, setPinned] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [yesterday, setYesterday] = useState(null);
  const [usual, setUsual] = useState(null);
  const [slot, setSlot] = useState(currentMealTime());
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [listening, setListening] = useState(false);
  const speech = useSpeechToText((txt) => { setText(txt); setListening(false); });

  const refresh = useCallback(async () => {
    const [pin, favs, ym, us] = await Promise.all([
      loadPinnedFavorites(uid),
      getFavorites(uid, 6),
      getYesterdayMeal(uid, slot),
      getUsualForSlot(uid, slot),
    ]);
    setPinned(pin);
    setFavorites(favs);
    setYesterday(ym);
    setUsual(us);
  }, [uid, slot]);

  useEffect(() => {
    if (visible) {
      setText('');
      setParsed(null);
      refresh();
    }
  }, [visible, refresh]);

  const logEntry = async (entry) => {
    const stripped = {
      name: entry.name,
      calories: entry.calories || 0,
      protein:  entry.protein  || 0,
      carbs:    entry.carbs    || 0,
      fat:      entry.fat      || 0,
      mealTime: slot,
    };
    await appendToTodayLog(uid, stripped);
    if (onLogged) onLogged();
    onClose();
  };

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const result = await parseMealDescription(text.trim());
      setParsed(result);
    } catch (e) {
      Alert.alert('Could not parse', e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleVoice = () => {
    if (!speech.supported) {
      Alert.alert('Voice not supported here', 'Voice input works in your browser. Just type the meal below — we\'ll figure out the macros.');
      return;
    }
    setListening(true);
    if (!speech.start()) setListening(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={s.backdropTap} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>Quick Log</Text>
            <TouchableOpacity onPress={onClose} style={s.xBtn}><Text style={s.xText}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <Text style={s.sectionLabel}>MEAL</Text>
            <View style={s.slotRow}>
              {MEAL_TIMES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.slotChip, slot === m && s.slotChipActive]}
                  onPress={() => setSlot(m)}
                >
                  <Text style={[s.slotChipText, slot === m && s.slotChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* One-tap repeats */}
            {(yesterday || usual) && (
              <>
                <Text style={s.sectionLabel}>ONE-TAP REPEAT</Text>
                {yesterday && (
                  <RepeatRow s={s} C={C} title={`Same as yesterday's ${slot}`} entry={yesterday} onLog={() => logEntry(yesterday)} />
                )}
                {usual && (!yesterday || usual.name !== yesterday.name) && (
                  <RepeatRow s={s} C={C} title={`What I usually have for ${slot}`} entry={usual} onLog={() => logEntry(usual)} />
                )}
              </>
            )}

            {pinned.length > 0 && (
              <>
                <Text style={s.sectionLabel}>PINNED</Text>
                {pinned.map(e => (
                  <RepeatRow key={'p_' + e.name} s={s} C={C} title={e.name} entry={e} subtitle={`${e.calories} kcal · ${e.protein}P/${e.carbs}C/${e.fat}F`} onLog={() => logEntry(e)} />
                ))}
              </>
            )}

            {favorites.length > 0 && (
              <>
                <Text style={s.sectionLabel}>FREQUENT MEALS</Text>
                {favorites.map(f => {
                  const e = f.sample;
                  const isPinned = pinned.find(p => (p.name || '').toLowerCase() === (e.name || '').toLowerCase());
                  return (
                    <View key={'f_' + f.name} style={s.favRow}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => logEntry(e)} activeOpacity={0.8}>
                        <Text style={s.favTitle}>{e.name}</Text>
                        <Text style={s.favSub}>{f.count}× · {e.calories} kcal · {e.protein}P/{e.carbs}C/{e.fat}F</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => { await pinFavorite(uid, e); refresh(); }}
                        style={s.starBtn}
                      >
                        <Text style={[s.starText, isPinned && { color: C.green }]}>{isPinned ? '★' : '☆'}</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            {/* Free-text + voice */}
            <Text style={s.sectionLabel}>DESCRIBE A MEAL</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={text}
                onChangeText={setText}
                placeholder='e.g. "chicken caesar wrap with fries"'
                placeholderTextColor={C.muted}
                multiline
              />
              <TouchableOpacity style={[s.micBtn, listening && s.micBtnOn]} onPress={handleVoice}>
                <Text style={s.micText}>{listening ? '●' : '🎤'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[s.parseBtn, (!text.trim() || parsing) && s.parseBtnDisabled]}
              onPress={handleParse}
              disabled={!text.trim() || parsing}
            >
              {parsing
                ? <ActivityIndicator color={C.bg} />
                : <Text style={s.parseBtnText}>Estimate macros with AI</Text>}
            </TouchableOpacity>

            {parsed && (
              <View style={s.parsedCard}>
                <Text style={s.parsedName}>{parsed.name}</Text>
                <Text style={s.parsedConf}>AI confidence: {parsed.confidence}</Text>
                <View style={s.parsedMacros}>
                  <Macro v={parsed.calories} label="kcal" C={C} />
                  <Macro v={parsed.protein}  label="P" C={C} />
                  <Macro v={parsed.carbs}    label="C" C={C} />
                  <Macro v={parsed.fat}      label="F" C={C} />
                </View>
                <TouchableOpacity style={s.confirmBtn} onPress={() => logEntry(parsed)}>
                  <Text style={s.confirmBtnText}>ADD TO LOG</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function RepeatRow({ s, C, title, subtitle, entry, onLog }) {
  return (
    <TouchableOpacity style={s.repeatRow} onPress={onLog} activeOpacity={0.8}>
      <View style={{ flex: 1 }}>
        <Text style={s.repeatTitle}>{title}</Text>
        <Text style={s.repeatSub}>{subtitle || `${entry.name} · ${entry.calories} kcal · ${entry.protein}P/${entry.carbs}C/${entry.fat}F`}</Text>
      </View>
      <View style={s.logChip}><Text style={s.logChipText}>+ LOG</Text></View>
    </TouchableOpacity>
  );
}

function Macro({ v, label, C }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: C.white, fontSize: 18, fontWeight: '900' }}>{v}</Text>
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTap: { ...StyleSheet.absoluteFillObject },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 16 },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  title: { color: C.white, fontSize: 20, fontWeight: '900', flex: 1 },
  xBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  xText: { color: C.white, fontSize: 14 },

  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  sectionLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },

  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotChip: { backgroundColor: C.card, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  slotChipActive: { backgroundColor: C.green, borderColor: C.green },
  slotChipText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  slotChipTextActive: { color: C.bg, fontWeight: '900' },

  repeatRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border },
  repeatTitle: { color: C.white, fontSize: 13, fontWeight: '800' },
  repeatSub: { color: C.muted, fontSize: 11, marginTop: 3 },
  logChip: { backgroundColor: C.green, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  logChipText: { color: C.bg, fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  favRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  favTitle: { color: C.white, fontSize: 13, fontWeight: '700' },
  favSub: { color: C.muted, fontSize: 10, marginTop: 2 },
  starBtn: { padding: 6 },
  starText: { color: C.muted, fontSize: 22 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  input: { flex: 1, backgroundColor: C.card, color: C.white, padding: 12, borderRadius: 12, fontSize: 14, minHeight: 60, borderWidth: 1, borderColor: C.border },
  micBtn: { width: 50, height: 60, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  micBtnOn: { backgroundColor: C.danger, borderColor: C.danger },
  micText: { fontSize: 22 },
  parseBtn: { backgroundColor: C.green, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  parseBtnDisabled: { opacity: 0.4 },
  parseBtnText: { color: C.bg, fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  parsedCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.green },
  parsedName: { color: C.white, fontSize: 16, fontWeight: '800' },
  parsedConf: { color: C.muted, fontSize: 11, marginTop: 3 },
  parsedMacros: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, paddingVertical: 12, marginTop: 10 },
  confirmBtn: { backgroundColor: C.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  confirmBtnText: { color: C.bg, fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
});
