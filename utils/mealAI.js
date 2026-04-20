import { callAI, callAIWithImage, parseJSON } from './api';

const dietLine = (profile) => {
  if (!profile) return '';
  const parts = [];
  if (profile.diet)        parts.push(`Diet preference: ${profile.diet}`);
  if (profile.allergies)   parts.push(`Allergies / avoid: ${profile.allergies}`);
  if (profile.goal)        parts.push(`Goal: ${profile.goal}`);
  if (profile.proteinPct)  parts.push(`Macro split target: P${profile.proteinPct}/C${profile.carbsPct}/F${profile.fatPct}`);
  return parts.length ? '\nUSER CONSTRAINTS:\n' + parts.join('\n') : '';
};

export async function generateMealFromIngredients({ ingredients, mealType, targetCalories, servings = 1, cookTime, difficulty, profile }) {
  const sys = `You are a Michelin-trained chef + Registered Dietitian. Build ONE realistic, delicious meal using the provided ingredients (you may add basic pantry items like salt, pepper, oil, garlic, onions, herbs, spices). Honor user constraints exactly.

Return ONLY valid JSON, no markdown:
{
  "name": "appetizing meal name",
  "mealType": "Breakfast | Lunch | Dinner | Snack",
  "servings": number,
  "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number,
  "ingredients": [{"item": "name", "qty": "e.g. 200g, 2 cups, 1 tbsp"}],
  "missingIngredients": ["items the user did NOT provide but are needed"],
  "instructions": ["step 1", "step 2", "..."],
  "cookTime": "e.g. 25 min",
  "difficulty": "Easy | Medium | Hard",
  "tips": ["1-3 chef tips"],
  "tags": ["e.g. high-protein, low-carb, mediterranean"]
}

Macros are PER SERVING. If targetCalories is given, scale portions to land within ±10%. If user gave too few ingredients to form a meal, list what's missing in missingIngredients but still produce the recipe.`;

  const usr = `Ingredients on hand: ${ingredients.join(', ') || '(none — please suggest a complete meal)'}
Meal type: ${mealType || 'any'}
Servings: ${servings}
${targetCalories ? `Target calories per serving: ${targetCalories} kcal` : ''}
${cookTime ? `Max cook time: ${cookTime}` : ''}
${difficulty ? `Difficulty: ${difficulty}` : ''}
${dietLine(profile)}`;

  const raw = await callAI(sys, usr);
  return parseJSON(raw, null);
}

export async function generateWeeklyPlanFromGroceries({ groceries, days = 7, mealsPerDay = 3, dailyCalories, profile }) {
  const sys = `You are an elite meal-prep chef + sports nutritionist. Build a ${days}-day meal plan using ONLY items from the provided grocery list (plus basic pantry staples: salt, pepper, oil, garlic, onions, herbs, spices, water). Distribute the groceries efficiently — minimize waste, repeat ingredients across meals, plan leftovers where it makes sense.

Return ONLY valid JSON, no markdown:
{
  "summary": "2-3 sentences: how the week is structured, big-picture macro targeting, prep strategy",
  "dailyAvg": {"calories": number, "protein": number, "carbs": number, "fat": number},
  "shoppingGaps": ["any KEY ingredients that are missing from the grocery list and would significantly improve the plan — keep this short, max 5"],
  "days": [
    {
      "day": "Monday",
      "totals": {"calories": number, "protein": number, "carbs": number, "fat": number},
      "meals": [
        {
          "slot": "Breakfast | Lunch | Dinner | Snack",
          "name": "meal name",
          "calories": number, "protein": number, "carbs": number, "fat": number,
          "ingredients": [{"item": "name", "qty": "amount"}],
          "quickInstructions": "1-2 sentence prep summary",
          "prepTime": "e.g. 15 min"
        }
      ]
    }
  ],
  "prepTips": ["3-5 batch-prep / time-saving tips for the week"]
}

Hit ${dailyCalories || 'an appropriate'} kcal/day ±150 kcal. Vary meals — do not repeat the same dinner more than twice in a week. Honor diet preference strictly.`;

  const usr = `Grocery list (${groceries.length} items): ${groceries.join(', ')}
Days: ${days}
Meals per day: ${mealsPerDay}
${dailyCalories ? `Target daily calories: ${dailyCalories} kcal` : ''}
${dietLine(profile)}`;

  const raw = await callAI(sys, usr);
  return parseJSON(raw, null);
}

export async function generateMealsFromFridge({ fridgeItems, mealsWanted = 3, dailyCalories, profile }) {
  const sys = `You are a creative chef + RD. The user opened their fridge — design ${mealsWanted} distinct meals they can make TODAY using only the items listed (plus pantry basics: salt, pepper, oil, garlic, onions, dried herbs, spices, water). Prioritize items the user marked as "expiring soon" first.

Return ONLY valid JSON, no markdown:
{
  "summary": "1-2 sentence overview of the day",
  "totals": {"calories": number, "protein": number, "carbs": number, "fat": number},
  "meals": [
    {
      "slot": "Breakfast | Lunch | Dinner | Snack",
      "name": "meal name",
      "calories": number, "protein": number, "carbs": number, "fat": number,
      "ingredients": [{"item": "name", "qty": "amount", "fromFridge": true}],
      "instructions": ["step 1", "step 2"],
      "cookTime": "e.g. 20 min",
      "usesExpiring": ["items used that were marked expiring"]
    }
  ],
  "leftovers": ["fridge items NOT used today and why (or 'none')"],
  "tips": ["1-3 short tips"]
}

Stay within ${dailyCalories || 'a balanced'} kcal/day total ±200 kcal.`;

  const fridgeStr = fridgeItems.map(f => `${f.name}${f.qty ? ' (' + f.qty + ')' : ''}${f.expiring ? ' [EXPIRING SOON]' : ''}`).join(', ');
  const usr = `Fridge contents: ${fridgeStr}
Meals wanted: ${mealsWanted}
${dailyCalories ? `Daily calorie target: ${dailyCalories} kcal` : ''}
${dietLine(profile)}`;

  const raw = await callAI(sys, usr);
  return parseJSON(raw, null);
}

export async function extractItemsFromFridgePhoto(base64, mimeType) {
  const sys = `You identify food items inside refrigerator and pantry photos. Return ONLY valid JSON, no markdown, no prose:
{"items":[{"name":"specific item name","qty":"estimated amount or count","category":"produce|dairy|protein|grain|condiment|beverage|other","expiring":false}],"notes":"1 short sentence about anything that looks past prime, or empty string"}

Rules:
- Be specific: "red bell pepper" not "vegetable", "cheddar cheese" not "cheese".
- Mark expiring:true for items that look wilted, browning, moldy, or past prime.
- Do NOT invent items you cannot clearly see.
- If the photo doesn't appear to be a fridge/pantry, return {"items":[],"notes":"photo does not look like a fridge or pantry"}.`;
  const usr = `List every distinct food item you can clearly see in this image.`;
  const raw = await callAIWithImage(base64, mimeType, usr, sys);
  const parsed = parseJSON(raw, { items: [], notes: '' });
  if (!parsed || !Array.isArray(parsed.items)) return { items: [], notes: '' };
  return parsed;
}
