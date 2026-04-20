import { Storage, KEYS } from './storage';

const BASE = 'https://world.openfoodfacts.org/api/v2/product/';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function normalize(p, code) {
  if (!p) return null;
  const n = p.nutriments || {};
  // Open Food Facts gives per-100g values reliably; per-serving when serving_size present.
  const per100 = {
    calories: num(n['energy-kcal_100g']) || (num(n['energy_100g']) ? num(n['energy_100g']) / 4.184 : 0),
    protein:  num(n['proteins_100g']),
    carbs:    num(n['carbohydrates_100g']),
    fat:      num(n['fat_100g']),
    fiber:    num(n['fiber_100g']),
    sugar:    num(n['sugars_100g']),
  };
  const perServing = {
    calories: num(n['energy-kcal_serving']) || (num(n['energy_serving']) ? num(n['energy_serving']) / 4.184 : 0),
    protein:  num(n['proteins_serving']),
    carbs:    num(n['carbohydrates_serving']),
    fat:      num(n['fat_serving']),
    fiber:    num(n['fiber_serving']),
    sugar:    num(n['sugars_serving']),
  };
  return {
    barcode: code,
    name: p.product_name || p.generic_name || 'Unknown product',
    brand: (p.brands || '').split(',')[0].trim() || '',
    image: p.image_front_small_url || p.image_front_url || p.image_url || null,
    servingSize: p.serving_size || '',
    servingQty: num(p.serving_quantity) || 0, // grams in one serving
    per100g: per100,
    perServing: perServing.calories ? perServing : null,
    nutriscore: (p.nutriscore_grade || '').toUpperCase(),
    novaGroup: p.nova_group || null,
    ingredients: p.ingredients_text || '',
  };
}

async function getCache() {
  try { return (await Storage.get(KEYS.BARCODE_CACHE())) || {}; } catch { return {}; }
}
async function putCache(code, value) {
  try {
    const c = await getCache();
    c[code] = { value, ts: Date.now() };
    // keep last ~150 entries
    const keys = Object.keys(c).sort((a, b) => (c[b].ts || 0) - (c[a].ts || 0)).slice(0, 150);
    const trimmed = {};
    keys.forEach(k => { trimmed[k] = c[k]; });
    await Storage.set(KEYS.BARCODE_CACHE(), trimmed);
  } catch {}
}

export async function lookupBarcode(code) {
  if (!code) return null;
  const cleaned = String(code).replace(/\D/g, '');
  if (!cleaned) return null;
  // cache
  try {
    const c = await getCache();
    if (c[cleaned] && Date.now() - (c[cleaned].ts || 0) < 30 * 24 * 3600 * 1000) {
      return c[cleaned].value;
    }
  } catch {}

  const res = await fetch(BASE + cleaned + '.json?fields=product_name,generic_name,brands,nutriments,image_front_small_url,image_front_url,image_url,serving_size,serving_quantity,nutriscore_grade,nova_group,ingredients_text', {
    headers: { 'User-Agent': 'KrAItos/1.0 (fitness tracker)' },
  });
  if (!res.ok) throw new Error('Lookup failed (' + res.status + ')');
  const json = await res.json();
  if (json.status === 0 || !json.product) {
    await putCache(cleaned, null);
    return null;
  }
  const value = normalize(json.product, cleaned);
  await putCache(cleaned, value);
  return value;
}

// Scale per-100g values to a chosen gram amount.
export function macrosForGrams(product, grams) {
  if (!product) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const g = parseFloat(grams) || 0;
  const factor = g / 100;
  const p = product.per100g || {};
  return {
    calories: Math.round((p.calories || 0) * factor),
    protein:  Math.round((p.protein  || 0) * factor * 10) / 10,
    carbs:    Math.round((p.carbs    || 0) * factor * 10) / 10,
    fat:      Math.round((p.fat      || 0) * factor * 10) / 10,
  };
}

export function macrosForServings(product, servings) {
  const s = parseFloat(servings) || 0;
  const ps = product?.perServing;
  if (ps && ps.calories) {
    return {
      calories: Math.round(ps.calories * s),
      protein:  Math.round(ps.protein  * s * 10) / 10,
      carbs:    Math.round(ps.carbs    * s * 10) / 10,
      fat:      Math.round(ps.fat      * s * 10) / 10,
    };
  }
  // fall back to per-100g via grams-per-serving
  if (product?.servingQty) return macrosForGrams(product, product.servingQty * s);
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}
