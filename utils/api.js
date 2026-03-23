const API_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + API_KEY;

export const callAI = async (systemPrompt, userMessage) => {
  if (!API_KEY) throw new Error('Missing EXPO_PUBLIC_GEMINI_KEY in your .env file');

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'API error ' + response.status);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const parseJSON = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    let clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1));
    } catch {}
    return fallback;
  }
};