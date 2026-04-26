import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Image,
  TextInput, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useT, useI18n } from '../i18n/I18nContext';
import { callGemini, isGeminiAvailable } from '../utils/gemini';
import { buildUserContext } from '../utils/userContext';
import BrandName from './BrandName';

const TOPIC_RULES = `You are KrAItos, an AI fitness, nutrition, and training coach embedded in a fitness app.

STRICT TOPIC SCOPE — you ONLY answer questions about:
- Nutrition, diet, food, calories, macros, hydration, supplements
- Training, workouts, exercises, programming, recovery, mobility
- Body composition, weight management, sleep, stress as they affect fitness
- Form, technique, equipment, gym etiquette
- Habit-building and motivation related to health/fitness

If a user asks about anything else (politics, coding, news, relationships, general trivia, etc.), politely decline in 1 short sentence and steer them back to fitness/nutrition. Example:
"That's outside what I can help with — I'm your fitness and nutrition coach. Want to talk about your training or meals instead?"

STYLE:
- Direct, encouraging, no fluff. Talk to the user like a knowledgeable friend who happens to be a coach.
- Use the user context below to give PERSONAL advice (reference their goal, weight, training split, what they ate today, etc. when relevant).
- Keep replies short by default (3–6 sentences). Only go long when the user asks for detail or a structured plan.
- No markdown headings (#) or bold (**); plain text and short bullet lines (•) are fine.
- Use metric/imperial units matching what the user uses in their profile.
- If you don't have enough context to answer, ask one clarifying question.

SAFETY:
- Never recommend extreme calorie cuts (<1200 kcal for women, <1500 for men) or unsafe weight loss rates (>1% body weight/week).
- For medical symptoms or anything beyond general fitness/nutrition, suggest seeing a qualified professional.`;

export default function FloatingChatbot({ user, onNavigate }) {
  const { C } = useTheme();
  const t = useT();
  const { isRTL } = useI18n();
  const s = makeStyles(C, isRTL);
  const SUGGESTIONS = [
    t('chatbot.suggestion1'),
    t('chatbot.suggestion2'),
    t('chatbot.suggestion3'),
    t('chatbot.suggestion4'),
  ];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user'|'model', content }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [contextText, setContextText] = useState('');
  const [contextLoaded, setContextLoaded] = useState(false);
  const scrollRef = useRef(null);

  const loadContext = useCallback(async () => {
    try {
      const ctx = await buildUserContext(user);
      setContextText(ctx);
    } catch {
      setContextText('No user data available.');
    } finally {
      setContextLoaded(true);
    }
  }, [user]);

  // Refresh context each time chat is opened (so today's logs are fresh)
  useEffect(() => {
    if (open) loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && scrollRef.current) {
      setTimeout(() => { try { scrollRef.current.scrollToEnd({ animated: true }); } catch {} }, 50);
    }
  }, [messages, open, sending]);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;

    if (!isGeminiAvailable()) {
      setMessages(m => [...m, { role: 'user', content: text }, {
        role: 'model',
        content: t('chatbot.unavailable'),
      }]);
      setInput('');
      return;
    }

    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);

    try {
      const sys = `${TOPIC_RULES}\n\n=== USER CONTEXT ===\n${contextText || '(loading…)'}\n=== END CONTEXT ===`;
      const reply = await callGemini(sys, next);
      setMessages(m => [...m, { role: 'model', content: reply || t('chatbot.noReply') }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'model', content: t('chatbot.error', { message: e.message || t('chatbot.errorUnknown') }) }]);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([]);
    loadContext();
  };

  return (
    <>
      <TouchableOpacity
        style={s.fab}
        onPress={() => { if (onNavigate) onNavigate('coach'); else setOpen(true); }}
        activeOpacity={0.85}
        accessibilityLabel={t('chatbot.openLabel')}
      >
        <Image source={require('../assets/logo.png')} style={s.fabIcon} resizeMode="contain" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={s.kav}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <View style={s.sheet}>
              <View style={s.header}>
                <View style={s.headerLeft}>
                  <Image source={require('../assets/logo.png')} style={s.headerLogo} resizeMode="contain" />
                  <View>
                    <BrandName style={s.headerTitle} />
                    <Text style={s.headerSub}>{t('fab.subtitle')}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  {messages.length > 0 && (
                    <TouchableOpacity onPress={reset} style={s.headerBtn}>
                      <Text style={s.headerBtnText}>↻</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setOpen(false)} style={s.headerBtn}>
                    <Text style={s.headerBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                ref={scrollRef}
                style={s.body}
                contentContainerStyle={s.bodyContent}
                keyboardShouldPersistTaps="handled"
              >
                {messages.length === 0 ? (
                  <View style={s.welcome}>
                    <Image source={require('../assets/logo.png')} style={s.welcomeLogo} resizeMode="contain" />
                    <Text style={s.welcomeTitle}>{t('chatbot.welcomeGreeting', { name: user?.fullName?.split(' ')[0] || t('chatbot.thereDefault') })}</Text>
                    <Text style={s.welcomeText}>
                      {t('chatbot.welcomeText')}
                    </Text>
                    <View style={{ marginTop: 16, width: '100%' }}>
                      {SUGGESTIONS.map((q, i) => (
                        <TouchableOpacity key={i} style={s.suggestion} onPress={() => send(q)}>
                          <Text style={s.suggestionText}>{q}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  messages.map((m, i) => (
                    <View
                      key={i}
                      style={[s.bubble, m.role === 'user' ? s.bubbleUser : s.bubbleBot]}
                    >
                      <Text style={[s.bubbleText, m.role === 'user' ? s.bubbleTextUser : s.bubbleTextBot]}>
                        {m.content}
                      </Text>
                    </View>
                  ))
                )}
                {sending && (
                  <View style={[s.bubble, s.bubbleBot]}>
                    <ActivityIndicator color={C.green} size="small" />
                  </View>
                )}
              </ScrollView>

              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder={t('chatbot.placeholder')}
                  placeholderTextColor={C.muted}
                  multiline
                  onSubmitEditing={() => send()}
                  blurOnSubmit={false}
                  editable={!sending}
                />
                <TouchableOpacity
                  style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
                  onPress={() => send()}
                  disabled={!input.trim() || sending}
                >
                  <Text style={s.sendBtnText}>↑</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (C, isRTL) => StyleSheet.create({
  fab: {
    position: 'absolute',
    ...(isRTL ? { left: 16 } : { right: 16 }),
    bottom: 100,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 6px 20px rgba(127,255,0,0.45)', cursor: 'pointer' }
      : {}),
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }
      : {}),
  },
  fabIcon: { paddingTop: 8, paddingRight: 2, width: 100, height: 100, tintColor: '#000000' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    borderTopWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', flex: 1 },
  headerLogo: { width: 36, height: 36, marginRight: isRTL ? 0 : 12, marginLeft: isRTL ? 12 : 0 },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  headerSub: { color: C.muted, fontSize: 11, marginTop: 1 },
  headerBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    marginLeft: isRTL ? 0 : 6, marginRight: isRTL ? 6 : 0, borderWidth: 1, borderColor: C.border,
  },
  headerBtnText: { color: C.white, fontSize: 14, fontWeight: '900' },

  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 8 },

  welcome: { alignItems: 'center', paddingVertical: 16 },
  welcomeLogo: { width: 64, height: 64, marginBottom: 14 },
  welcomeTitle: { color: C.white, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  welcomeText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },
  suggestion: {
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  suggestionText: { color: C.light, fontSize: 13, fontWeight: '600' },

  bubble: {
    maxWidth: '85%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, marginBottom: 8,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: C.green,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: C.bg, fontWeight: '600' },
  bubbleTextBot: { color: C.light },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  input: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    color: C.white,
    fontSize: 14,
    maxHeight: 120,
    borderWidth: 1, borderColor: C.border,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.green, alignItems: 'center', justifyContent: 'center',
    marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0,
  },
  sendBtnDisabled: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  sendBtnText: { color: C.bg, fontSize: 22, fontWeight: '900', marginTop: -2 },
});
