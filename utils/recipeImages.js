import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gg_recipe_image_cache_v1';
let mem = null;

async function load() {
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    mem = raw ? JSON.parse(raw) : {};
  } catch { mem = {}; }
  return mem;
}
async function persist() {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(mem || {})); } catch {}
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function buildPrompt(recipe) {
  const name = (recipe?.name || 'food').trim();
  const tags = (recipe?.tags || []).slice(0, 2).join(', ');
  return `appetizing high-end food photography of "${name}"${tags ? ', ' + tags : ''}, top-down on dark plate, natural light, shallow depth of field, no text, no watermark`;
}

/**
 * Returns a stable image URL for a recipe. Uses Pollinations.ai (no API key required).
 * Caches the URL keyed by recipe name so the same dish always shows the same image.
 */
export async function getRecipeImageUrl(recipe) {
  if (!recipe?.name) return null;
  const cache = await load();
  const k = recipe.name.trim().toLowerCase();
  if (cache[k]) return cache[k];
  const seed = hashStr(k) % 100000;
  const prompt = buildPrompt(recipe);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=400&nologo=true&seed=${seed}`;
  cache[k] = url;
  persist();
  return url;
}
