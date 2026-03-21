
Copy

// ─── AI API (Google Gemini - Free Tier) ──────────────────────────────────────
// To switch to Anthropic later, just replace this file with the Anthropic version.
// Get your free Gemini key at: https://aistudio.google.com/apikey
 
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
 
export const callClaude = async (systemPrompt, userMessage) => {
  if (!API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_KEY in your .env file');
  }
 
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    }),
  });
 
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
 
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};
 
export const parseJSON = (raw, fallback) => {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return fallback;
  }
};
 
// ─── HOW TO SWITCH TO ANTHROPIC LATER ────────────────────────────────────────
// 1. Get an Anthropic key at https://console.anthropic.com
// 2. In .env, replace EXPO_PUBLIC_GEMINI_KEY with EXPO_PUBLIC_ANTHROPIC_KEY
// 3. Replace this entire file with the Anthropic version (saved below as api.anthropic.js)