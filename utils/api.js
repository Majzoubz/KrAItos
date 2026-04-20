const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Text-only AI call
export const callAI = async (systemPrompt, userMessage) => {
  if (!GROQ_KEY) throw new Error('Missing EXPO_PUBLIC_GROQ_KEY in your .env file');

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GROQ_KEY,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'API error ' + response.status);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

// Vision call - Groq supports vision via llama-4 scout
export const callAIWithImage = async (base64Image, mimeType, userText, systemPromptOverride) => {
  if (!GROQ_KEY) throw new Error('Missing EXPO_PUBLIC_GROQ_KEY in your .env file');

  const defaultSystem = 'You are a professional nutritionist with expert ability to identify food from photos. Return ONLY valid JSON with no markdown and no extra text. Use this exact structure: {"meal":"descriptive meal name","calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodium":number,"servingSize":"estimated portion","healthScore":number,"ingredients":["item1","item2"],"tips":["tip1","tip2"]}. All macros in grams. healthScore is 1-10.';
  const systemText = systemPromptOverride || defaultSystem;

  const userContent = [
    {
      type: 'image_url',
      image_url: { url: 'data:' + mimeType + ';base64,' + base64Image },
    },
    {
      type: 'text',
      text: systemPromptOverride
        ? (userText || 'Analyze this image as instructed.')
        : (userText
            ? 'Analyze this meal photo. Extra context: ' + userText
            : 'Analyze this meal photo and return the nutrition facts.'),
    },
  ];

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + GROQ_KEY,
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        { role: 'system', content: systemText },
        { role: 'user',   content: userContent },
      ],
      max_tokens: 2000,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'API error ' + response.status);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

export const parseJSON = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
  } catch {
    try {
      const start = raw.indexOf('{');
      const end   = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(raw.slice(start, end + 1));
    } catch {}
    return fallback;
  }
};