const API_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + API_KEY;

// Text-only AI call
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

// Vision AI call - sends image + optional text to Gemini
export const callAIWithImage = async (base64Image, mimeType, userText) => {
  if (!API_KEY) throw new Error('Missing EXPO_PUBLIC_GEMINI_KEY in your .env file');

  const prompt = userText
    ? 'Analyze this meal photo. Additional context from user: ' + userText + '. '
    : 'Analyze this meal photo. ';

  const systemText = 'You are a professional nutritionist with expert ability to identify food from photos. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure: {"meal":"descriptive meal name","calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodium":number,"servingSize":"estimated portion","healthScore":number,"ingredients":["item1","item2"],"tips":["tip1","tip2"]}. All macros in grams. healthScore is 1-10. Be as accurate as possible based on what you see.';

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Image } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 2000, temperature: 0.4 },
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
    return JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
  } catch {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1));
    } catch {}
    return fallback;
  }
};