import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { Storage, KEYS } from '../utils/storage';
import { callAI } from '../utils/api';

const TODAY = new Date().toDateString();
const CHAT_KEY = (uid) => 'coachchat_' + (uid || 'anon');

export default function CoachChatScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const { t, isRTL } = useI18n();
  const s = makeStyles(C);
  const SUGGESTIONS = [
    t('coach.suggestion1'),
    t('coach.suggestion2'),
    t('coach.suggestion3'),
    t('coach.suggestion4'),
  ];
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [ctx, setCtx] = useState(null);
  const scrollRef = useRef(null);
  const uid = user.email || user.uid;

  const loadCtx = useCallback(async () => {
    const [plan, foodLog, savedChat] = await Promise.all([
      Storage.get(KEYS.PLAN(uid)),
      Storage.get(KEYS.FOODLOG(user.uid, TODAY)),
      Storage.get(CHAT_KEY(uid)),
    ]);
    setCtx({ plan, foodLog: foodLog || [] });
    if (Array.isArray(savedChat) && savedChat.length > 0) {
      setMessages(savedChat);
    } else {
      setMessages([{
        role: 'assistant',
        text: t('coach.welcome', { name: user.fullName?.split(' ')[0] || t('coach.thereDefault') }),
      }]);
    }
  }, [uid, user.uid, user.fullName, t]);

  useEffect(() => { loadCtx(); }, [loadCtx]);

  useEffect(() => {
    if (messages.length === 0) return;
    Storage.set(CHAT_KEY(uid), messages.slice(-30)).catch(() => {});
    setTimeout(() => { try { scrollRef.current?.scrollToEnd({ animated: true }); } catch {} }, 60);
  }, [messages, uid]);

  const buildSystem = () => {
    const p = ctx?.plan;
    const log = ctx?.foodLog || [];
    const totals = log.reduce((a, x) => ({
      cal: a.cal + (x.calories || 0),
      pro: a.pro + (x.protein || 0),
      car: a.car + (x.carbs || 0),
      fat: a.fat + (x.fat || 0),
    }), { cal: 0, pro: 0, car: 0, fat: 0 });
    const target = {
      cal: p?.dailyCalories || 2000,
      pro: p?.protein || 150,
      car: p?.carbs || 200,
      fat: p?.fat || 65,
    };
    const profile = p?.userProfile || {};
    return [
      'You are KrAItos Coach, a warm, expert nutrition + fitness coach. Reply concisely (2-4 short paragraphs max) with practical, specific advice.',
      'Use emoji sparingly. Speak directly. Do not invent data not provided.',
      'USER PROFILE: ' + JSON.stringify({
        goal: profile.goal, weight: profile.weight, height: profile.height,
        age: profile.age, sex: profile.sex, activity: profile.activity,
        exerciseType: profile.exerciseType,
      }),
      'DAILY TARGETS: ' + target.cal + ' kcal · ' + target.pro + 'g P · ' + target.car + 'g C · ' + target.fat + 'g F',
      'EATEN TODAY: ' + Math.round(totals.cal) + ' kcal · ' + Math.round(totals.pro) + 'g P · ' + Math.round(totals.car) + 'g C · ' + Math.round(totals.fat) + 'g F',
      'REMAINING TODAY: ' + Math.max(0, target.cal - totals.cal) + ' kcal · ' + Math.max(0, target.pro - totals.pro) + 'g P · ' + Math.max(0, target.car - totals.car) + 'g C · ' + Math.max(0, target.fat - totals.fat) + 'g F',
      p?.trainingPhilosophy ? ('TRAINING PHILOSOPHY: ' + p.trainingPhilosophy) : '',
      p?.weeklyVolume ? ('WEEKLY VOLUME: ' + p.weeklyVolume) : '',
    ].filter(Boolean).join('\n');
  };

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || thinking) return;
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setThinking(true);
    try {
      const history = next.slice(-8).map(m =>
        (m.role === 'user' ? 'USER: ' : 'COACH: ') + m.text
      ).join('\n');
      const reply = await callAI(buildSystem(), history + '\nCOACH:');
      setMessages([...next, { role: 'assistant', text: reply.trim() || t('coach.replyFallback') }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', text: t('coach.errorReach') }]);
    } finally {
      setThinking(false);
    }
  };

  const clearChat = async () => {
    setMessages([{
      role: 'assistant',
      text: t('coach.cleared'),
    }]);
    try { await Storage.remove(CHAT_KEY(uid)); } catch {}
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => onNavigate('home')} style={s.backBtn}>
          <Text style={s.backText}>{t('coach.back')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.titleBarText}>{t('coach.title')}</Text>
          <Text style={s.titleBarSub}>{t('coach.subtitle')}</Text>
        </View>
        <TouchableOpacity onPress={clearChat} style={s.clearBtn}>
          <Text style={s.clearText}>{t('coach.clear')}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, i) => (
            <View key={i} style={[s.msgRow, m.role === 'user' ? s.msgRowUser : s.msgRowAi]}>
              {m.role === 'assistant' && (
                <View style={s.aiAvatar}><Text style={s.aiAvatarText}>K</Text></View>
              )}
              <View style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleAi]}>
                <Text style={[s.bubbleText, m.role === 'user' && s.bubbleTextUser]}>{m.text}</Text>
              </View>
            </View>
          ))}

          {thinking && (
            <View style={[s.msgRow, s.msgRowAi]}>
              <View style={s.aiAvatar}><Text style={s.aiAvatarText}>K</Text></View>
              <View style={[s.bubble, s.bubbleAi, { flexDirection: 'row', alignItems: 'center' }]}>
                <ActivityIndicator color={C.green} size="small" />
                <Text style={[s.bubbleText, { marginLeft: 8 }]}>{t('coach.thinking')}</Text>
              </View>
            </View>
          )}

          {messages.length <= 1 && !thinking && (
            <View style={s.suggestionsWrap}>
              <Text style={s.suggestionsLabel}>{t('coach.tryAsking')}</Text>
              {SUGGESTIONS.map((q, i) => (
                <TouchableOpacity key={i} style={s.suggestionChip} onPress={() => send(q)} activeOpacity={0.8}>
                  <Text style={s.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder={t('coach.inputPlaceholder')}
            placeholderTextColor={C.muted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || thinking) && { opacity: 0.4 }]}
            onPress={() => send()}
            disabled={!input.trim() || thinking}
            activeOpacity={0.85}
          >
            <Text style={s.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, paddingTop: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { paddingRight: 12 },
  backText: { color: C.green, fontSize: 16, fontWeight: '800' },
  titleBarText: { color: C.white, fontSize: 18, fontWeight: '900' },
  titleBarSub: { color: C.muted, fontSize: 11, marginTop: 1 },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.surface, borderRadius: 10 },
  clearText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 24 },

  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAi: { justifyContent: 'flex-start' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  aiAvatarText: { color: C.bg, fontSize: 13, fontWeight: '900' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleAi: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: C.green, borderBottomRightRadius: 4 },
  bubbleText: { color: C.white, fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: C.bg, fontWeight: '700' },

  suggestionsWrap: { marginTop: 16 },
  suggestionsLabel: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 },
  suggestionChip: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.green + '60',
    borderRadius: 14, padding: 12, marginBottom: 8,
  },
  suggestionText: { color: C.white, fontSize: 13, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg,
  },
  input: {
    flex: 1, backgroundColor: C.card, borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 14,
    color: C.white, fontSize: 14, maxHeight: 100,
    borderWidth: 1, borderColor: C.border, marginRight: 8,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.green,
    alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web' ? { boxShadow: '0 4px 14px rgba(127,255,0,0.35)' } : {}),
  },
  sendBtnText: { color: C.bg, fontSize: 22, fontWeight: '900', marginTop: -2 },
});
