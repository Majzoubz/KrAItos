import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView,
  SafeAreaView, ActivityIndicator, Modal, Platform, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import { Storage, KEYS } from '../utils/storage';
import {
  generateMealFromIngredients, generateWeeklyPlanFromGroceries,
  generateMealsFromFridge, extractItemsFromFridgePhoto,
} from '../utils/mealAI';
import { tick as hTick, select as hSelect, success as hSuccess } from '../utils/haptics';
import { getRecipeImageUrl } from '../utils/recipeImages';

const TABS = [
  { id: 'ingredients', label: 'Cook',     sub: 'From ingredients', icon: '🥘' },
  { id: 'weekly',      label: 'Weekly',   sub: 'Grocery → 7-day',  icon: '🛒' },
  { id: 'fridge',      label: 'Fridge',   sub: 'Smart inventory',  icon: '🧊' },
];

const MEAL_TYPES = ['Any', 'Breakfast', 'Lunch', 'Dinner', 'Snack'];
const COOK_TIMES = ['Any', '15 min', '30 min', '1 hour'];
const DIFFICULTIES = ['Any', 'Easy', 'Medium', 'Hard'];

const showAlert = (t, m) => {
  if (Platform.OS === 'web') { try { window.alert(`${t}\n\n${m}`); } catch {} return; }
  try { Alert.alert(t, m); } catch {}
};

/* ----------------------------- shared bits ------------------------------ */

function Chip({ label, active, onPress, onRemove, color }) {
  const { C } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: active ? (color || C.green) : C.surface,
        borderColor: active ? (color || C.green) : C.border,
        borderWidth: 1, borderRadius: 999,
        paddingHorizontal: 14, paddingVertical: 8,
        flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 8,
      }}
    >
      <Text style={{
        color: active ? C.bg : C.white,
        fontSize: 13, fontWeight: '700',
      }}>
        {label}
      </Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} style={{ marginLeft: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: active ? C.bg : C.muted, fontSize: 14, fontWeight: '900' }}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function MacroPills({ p, c, f, kcal }) {
  const { C } = useTheme();
  const item = (label, val, color) => (
    <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 12, padding: 10, alignItems: 'center', marginHorizontal: 3 }}>
      <Text style={{ color, fontSize: 17, fontWeight: '900' }}>{Math.round(val || 0)}{label === 'kcal' ? '' : 'g'}</Text>
      <Text style={{ color: C.muted, fontSize: 10, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', marginVertical: 10 }}>
      {item('kcal', kcal, C.green)}
      {item('Protein', p, '#3FA9FF')}
      {item('Carbs', c, '#FF8A00')}
      {item('Fat', f, '#7B61FF')}
    </View>
  );
}

function RecipeCard({ recipe, onAddToLog, onSave, saved }) {
  const { C } = useTheme();
  const [imgUrl, setImgUrl] = React.useState(null);
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setImgUrl(null); setImgFailed(false);
    if (recipe?.name) {
      getRecipeImageUrl(recipe).then(u => { if (!cancelled) setImgUrl(u); });
    }
    return () => { cancelled = true; };
  }, [recipe?.name]);
  if (!recipe) return null;
  return (
    <View style={{
      backgroundColor: C.card, borderRadius: 20, padding: 0, overflow: 'hidden',
      borderWidth: 1, borderColor: C.green + '40', marginTop: 16,
    }}>
      {imgUrl && !imgFailed ? (
        <View style={{ width: '100%', height: 180, backgroundColor: C.surface }}>
          <Image
            source={{ uri: imgUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
          <View style={{
            position: 'absolute', top: 10, left: 10,
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>AI PREVIEW</Text>
          </View>
        </View>
      ) : null}
      <View style={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          {recipe.mealType && (
            <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }}>
              {String(recipe.mealType).toUpperCase()}
              {recipe.servings ? `  ·  ${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}` : ''}
            </Text>
          )}
          <Text style={{ color: C.white, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{recipe.name}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {recipe.cookTime ? <Text style={{ color: C.muted, fontSize: 12, marginRight: 12 }}>⏱ {recipe.cookTime}</Text> : null}
            {recipe.difficulty ? <Text style={{ color: C.muted, fontSize: 12, marginRight: 12 }}>◐ {recipe.difficulty}</Text> : null}
            {(recipe.tags || []).slice(0, 2).map((t, i) => (
              <Text key={i} style={{ color: C.green, fontSize: 11, marginRight: 8, fontWeight: '700' }}>#{t}</Text>
            ))}
          </View>
        </View>
        <TouchableOpacity onPress={onSave} style={{ padding: 6 }}>
          <Text style={{ fontSize: 22 }}>{saved ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      <MacroPills p={recipe.protein} c={recipe.carbs} f={recipe.fat} kcal={recipe.calories} />

      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 8 }}>INGREDIENTS</Text>
      <View style={{ marginTop: 6 }}>
        {(recipe.ingredients || []).map((ing, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: i === (recipe.ingredients.length - 1) ? 0 : 1, borderBottomColor: C.border }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginRight: 10 }} />
            <Text style={{ color: C.white, fontSize: 14, flex: 1 }}>{typeof ing === 'string' ? ing : ing.item}</Text>
            {typeof ing === 'object' && ing.qty ? <Text style={{ color: C.muted, fontSize: 13 }}>{ing.qty}</Text> : null}
          </View>
        ))}
      </View>

      {recipe.missingIngredients?.length > 0 && (
        <View style={{ marginTop: 12, padding: 10, backgroundColor: '#FF8A0022', borderRadius: 10, borderWidth: 1, borderColor: '#FF8A0055' }}>
          <Text style={{ color: '#FF8A00', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>YOU'LL NEED</Text>
          <Text style={{ color: C.white, fontSize: 13, marginTop: 4 }}>{recipe.missingIngredients.join(' · ')}</Text>
        </View>
      )}

      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 16 }}>INSTRUCTIONS</Text>
      <View style={{ marginTop: 6 }}>
        {(recipe.instructions || []).map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 }}>
              <Text style={{ color: C.bg, fontSize: 11, fontWeight: '900' }}>{i + 1}</Text>
            </View>
            <Text style={{ color: C.light, fontSize: 14, flex: 1, lineHeight: 20 }}>{step}</Text>
          </View>
        ))}
      </View>

      {recipe.tips?.length > 0 && (
        <View style={{ marginTop: 12, padding: 12, backgroundColor: C.green + '15', borderRadius: 12 }}>
          <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>CHEF TIPS</Text>
          {recipe.tips.map((t, i) => (
            <Text key={i} style={{ color: C.light, fontSize: 13, marginTop: 4, lineHeight: 18 }}>• {t}</Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={onAddToLog}
        style={{ marginTop: 16, backgroundColor: C.green, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
      >
        <Text style={{ color: C.bg, fontWeight: '900', letterSpacing: 1 }}>+ ADD TO TODAY'S LOG</Text>
      </TouchableOpacity>
      </View>
    </View>
  );
}

/* ----------------------------- INGREDIENTS ------------------------------ */

function IngredientsTab({ uid, profile, onAddToLog, onSavedChange }) {
  const { C } = useTheme();
  const [pantry, setPantry]       = useState([]);
  const [input, setInput]         = useState('');
  const [selected, setSelected]   = useState({});
  const [mealType, setMealType]   = useState('Any');
  const [cookTime, setCookTime]   = useState('Any');
  const [difficulty, setDiff]     = useState('Any');
  const [servings, setServings]   = useState('1');
  const [targetCal, setTargetCal] = useState('');
  const [loading, setLoading]     = useState(false);
  const [recipe, setRecipe]       = useState(null);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    Storage.get(KEYS.PANTRY(uid)).then(p => setPantry(Array.isArray(p) ? p : []));
  }, [uid]);

  const persistPantry = async (next) => {
    setPantry(next);
    await Storage.set(KEYS.PANTRY(uid), next);
  };

  const addIngredient = async () => {
    const v = input.trim();
    if (!v) return;
    const parts = v.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const next = [...new Set([...pantry, ...parts])];
    await persistPantry(next);
    const sel = { ...selected };
    parts.forEach(p => sel[p] = true);
    setSelected(sel);
    setInput('');
    hTick();
  };

  const toggle = (item) => {
    setSelected(s => ({ ...s, [item]: !s[item] }));
    hTick();
  };

  const removePantry = async (item) => {
    await persistPantry(pantry.filter(p => p !== item));
    setSelected(s => { const x = { ...s }; delete x[item]; return x; });
  };

  const generate = async () => {
    const ings = pantry.filter(p => selected[p]);
    if (ings.length === 0) {
      showAlert('Pick ingredients', 'Tap one or more ingredients in your pantry first.');
      return;
    }
    setLoading(true); setRecipe(null); setSaved(false);
    hSelect();
    try {
      const r = await generateMealFromIngredients({
        ingredients: ings,
        mealType: mealType === 'Any' ? null : mealType,
        targetCalories: parseInt(targetCal) || null,
        servings: parseInt(servings) || 1,
        cookTime: cookTime === 'Any' ? null : cookTime,
        difficulty: difficulty === 'Any' ? null : difficulty,
        profile,
      });
      if (r) { setRecipe(r); hSuccess(); }
      else showAlert('AI failed', 'Could not generate a meal. Try again.');
    } catch (e) { showAlert('Error', e.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const saveFavorite = async () => {
    if (!recipe) return;
    const list = (await Storage.get(KEYS.SAVED_MEALS(uid))) || [];
    await Storage.set(KEYS.SAVED_MEALS(uid), [{ ...recipe, savedAt: Date.now() }, ...list].slice(0, 50));
    setSaved(true); hSuccess();
    onSavedChange && onSavedChange();
  };

  const addThisToLog = () => {
    if (!recipe) return;
    onAddToLog({
      name: recipe.name,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      mealTime: ['Breakfast','Lunch','Dinner','Snack'].includes(recipe.mealType) ? recipe.mealType : 'Lunch',
    });
  };

  const selectedCount = pantry.filter(p => selected[p]).length;

  return (
    <View>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
        Tell the AI what's in your kitchen. Tap to select what you want to use, then generate a meal.
      </Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="e.g. chicken breast, rice, broccoli"
          placeholderTextColor={C.muted}
          onSubmitEditing={addIngredient}
          returnKeyType="done"
          style={{
            flex: 1, backgroundColor: C.surface, color: C.white,
            paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
            borderWidth: 1, borderColor: C.border, fontSize: 14,
          }}
        />
        <TouchableOpacity onPress={addIngredient} style={{
          backgroundColor: C.green, paddingHorizontal: 18, borderRadius: 12,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: C.bg, fontWeight: '900', fontSize: 22 }}>+</Text>
        </TouchableOpacity>
      </View>

      {pantry.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>YOUR PANTRY ({pantry.length})</Text>
            {selectedCount > 0 && <Text style={{ color: C.green, fontSize: 11, fontWeight: '900' }}>{selectedCount} selected</Text>}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {pantry.map(p => (
              <Chip key={p} label={p} active={!!selected[p]} onPress={() => toggle(p)} onRemove={() => removePantry(p)} />
            ))}
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 16, padding: 18, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
          <Text style={{ fontSize: 30 }}>🥕</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 6, textAlign: 'center' }}>Your pantry is empty. Add ingredients above to get started.</Text>
        </View>
      )}

      <View style={{ marginTop: 18 }}>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>MEAL TYPE</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {MEAL_TYPES.map(t => <Chip key={t} label={t} active={mealType === t} onPress={() => setMealType(t)} />)}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>SERVINGS</Text>
          <TextInput value={servings} onChangeText={setServings} keyboardType="numeric" placeholder="1" placeholderTextColor={C.muted}
            style={{ backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 15, fontWeight: '700' }} />
        </View>
        <View style={{ flex: 1.5 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>TARGET KCAL (optional)</Text>
          <TextInput value={targetCal} onChangeText={setTargetCal} keyboardType="numeric" placeholder="e.g. 600" placeholderTextColor={C.muted}
            style={{ backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 15, fontWeight: '700' }} />
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>COOK TIME</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {COOK_TIMES.map(t => <Chip key={t} label={t} active={cookTime === t} onPress={() => setCookTime(t)} />)}
        </View>
        <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 4, marginBottom: 8 }}>DIFFICULTY</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {DIFFICULTIES.map(t => <Chip key={t} label={t} active={difficulty === t} onPress={() => setDiff(t)} />)}
        </View>
      </View>

      <TouchableOpacity onPress={generate} disabled={loading} style={{
        marginTop: 18, backgroundColor: loading ? C.surface : C.green,
        paddingVertical: 16, borderRadius: 14, alignItems: 'center',
        flexDirection: 'row', justifyContent: 'center',
      }}>
        {loading ? <ActivityIndicator color={C.green} /> : (
          <Text style={{ color: C.bg, fontWeight: '900', letterSpacing: 1.2 }}>✨ GENERATE MEAL</Text>
        )}
      </TouchableOpacity>

      <RecipeCard recipe={recipe} onAddToLog={addThisToLog} onSave={saveFavorite} saved={saved} />
    </View>
  );
}

/* ----------------------------- WEEKLY ----------------------------------- */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim();
const PANTRY_BASICS = new Set(['salt','pepper','oil','olive oil','water','garlic','onion','onions','butter','spices','herbs','pepper black','black pepper','sugar','flour']);

const singularize = (w) => w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.endsWith('es') && w.length > 3 ? w.slice(0, -2) : w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w;
const tokens = (s) => new Set(norm(s).split(/\s+/).filter(Boolean).map(singularize));

function computeShoppingList(plan, pantry) {
  if (!plan?.days) return [];
  const haveTokenSets = (pantry || []).map(tokens).filter(t => t.size > 0);
  const seen = new Map();
  plan.days.forEach(d => (d.meals || []).forEach(m => (m.ingredients || []).forEach(ing => {
    const name = typeof ing === 'string' ? ing : ing.item;
    const key = norm(name);
    if (!key || PANTRY_BASICS.has(key)) return;
    const needTokens = tokens(name);
    // Match only if every meaningful token of the needed item is present in some pantry entry
    const covered = haveTokenSets.some(have => [...needTokens].every(t => have.has(t)));
    if (covered) return;
    if (!seen.has(key)) seen.set(key, name);
  })));
  return [...seen.values()];
}

function WeeklyTab({ uid, profile, dailyCalories, onAddToLog }) {
  const { C } = useTheme();
  const [groceries, setGroceries] = useState([]);
  const [pantry, setPantry]       = useState([]);
  const [input, setInput]         = useState('');
  const [days, setDays]           = useState('7');
  const [meals, setMeals]         = useState('3');
  const [loading, setLoading]     = useState(false);
  const [plan, setPlan]           = useState(null);
  const [openDay, setOpenDay]     = useState(0);

  useEffect(() => {
    Storage.get(KEYS.GROCERY(uid)).then(g => setGroceries(Array.isArray(g) ? g : []));
    Storage.get(KEYS.PANTRY(uid)).then(p => setPantry(Array.isArray(p) ? p : []));
    Storage.get(KEYS.WEEKLY_PLAN(uid)).then(p => p && setPlan(p));
  }, [uid]);

  const persist = async (next) => {
    setGroceries(next);
    await Storage.set(KEYS.GROCERY(uid), next);
  };

  const add = async () => {
    const v = input.trim(); if (!v) return;
    const parts = v.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    await persist([...new Set([...groceries, ...parts])]);
    setInput(''); hTick();
  };

  const remove = async (item) => {
    await persist(groceries.filter(g => g !== item));
  };

  const clearAll = async () => {
    await persist([]); hSelect();
  };

  const generate = async () => {
    if (groceries.length < 3) {
      showAlert('Add more groceries', 'Add at least 3 items to your grocery list first.');
      return;
    }
    setLoading(true); setPlan(null); hSelect();
    try {
      const p = await generateWeeklyPlanFromGroceries({
        groceries,
        days: parseInt(days) || 7,
        mealsPerDay: parseInt(meals) || 3,
        dailyCalories,
        profile,
      });
      if (p) {
        setPlan(p);
        await Storage.set(KEYS.WEEKLY_PLAN(uid), p);
        hSuccess();
      } else showAlert('AI failed', 'Could not build the plan. Try again.');
    } catch (e) { showAlert('Error', e.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <View>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
        Drop in your weekly grocery list. The AI builds a {days}-day meal plan that uses what you bought, hits your macros, and tells you what's missing.
      </Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Add item — e.g. eggs, salmon, oats"
          placeholderTextColor={C.muted}
          onSubmitEditing={add} returnKeyType="done"
          style={{ flex: 1, backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 14 }}
        />
        <TouchableOpacity onPress={add} style={{ backgroundColor: C.green, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' }}>
          <Text style={{ color: C.bg, fontWeight: '900', fontSize: 22 }}>+</Text>
        </TouchableOpacity>
      </View>

      {groceries.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>GROCERY LIST ({groceries.length})</Text>
            <TouchableOpacity onPress={clearAll}><Text style={{ color: C.danger || '#FF3B6E', fontSize: 11, fontWeight: '800' }}>Clear all</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {groceries.map(g => <Chip key={g} label={g} active onRemove={() => remove(g)} />)}
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>DAYS</Text>
          <TextInput value={days} onChangeText={setDays} keyboardType="numeric"
            style={{ backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 15, fontWeight: '700' }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>MEALS / DAY</Text>
          <TextInput value={meals} onChangeText={setMeals} keyboardType="numeric"
            style={{ backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 15, fontWeight: '700' }} />
        </View>
        <View style={{ flex: 1.2 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>KCAL / DAY</Text>
          <View style={{ backgroundColor: C.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, justifyContent: 'center' }}>
            <Text style={{ color: dailyCalories ? C.white : C.muted, fontSize: 15, fontWeight: '700' }}>
              {dailyCalories || 'Auto'}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={generate} disabled={loading} style={{
        marginTop: 18, backgroundColor: loading ? C.surface : C.green,
        paddingVertical: 16, borderRadius: 14, alignItems: 'center',
      }}>
        {loading ? <ActivityIndicator color={C.green} /> : (
          <Text style={{ color: C.bg, fontWeight: '900', letterSpacing: 1.2 }}>✨ BUILD WEEKLY PLAN</Text>
        )}
      </TouchableOpacity>

      {plan && (
        <View style={{ marginTop: 18 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.green + '40' }}>
            <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }}>WEEKLY OVERVIEW</Text>
            <Text style={{ color: C.light, fontSize: 13, marginTop: 6, lineHeight: 19 }}>{plan.summary}</Text>
            {plan.dailyAvg && <MacroPills p={plan.dailyAvg.protein} c={plan.dailyAvg.carbs} f={plan.dailyAvg.fat} kcal={plan.dailyAvg.calories} />}
            {plan.shoppingGaps?.length > 0 && (
              <View style={{ marginTop: 8, padding: 12, backgroundColor: '#FF8A0022', borderRadius: 12 }}>
                <Text style={{ color: '#FF8A00', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>SHOPPING GAPS</Text>
                <Text style={{ color: C.white, fontSize: 13, marginTop: 4 }}>{plan.shoppingGaps.join(' · ')}</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
            {(plan.days || []).map((d, i) => (
              <TouchableOpacity key={i} onPress={() => { hTick(); setOpenDay(i); }} style={{
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
                backgroundColor: openDay === i ? C.green : C.surface,
                borderWidth: 1, borderColor: openDay === i ? C.green : C.border,
                marginRight: 8, marginBottom: 8,
              }}>
                <Text style={{ color: openDay === i ? C.bg : C.white, fontWeight: '800', fontSize: 12 }}>{d.day}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {plan.days?.[openDay] && (
            <View style={{ marginTop: 6 }}>
              {plan.days[openDay].totals && (
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
                  Day total: {plan.days[openDay].totals.calories} kcal · P{plan.days[openDay].totals.protein}g · C{plan.days[openDay].totals.carbs}g · F{plan.days[openDay].totals.fat}g
                </Text>
              )}
              {(plan.days[openDay].meals || []).map((m, i) => (
                <View key={i} style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{(m.slot || '').toUpperCase()}{m.prepTime ? `  ·  ${m.prepTime}` : ''}</Text>
                      <Text style={{ color: C.white, fontSize: 15, fontWeight: '800', marginTop: 2 }}>{m.name}</Text>
                    </View>
                    <Text style={{ color: C.green, fontSize: 16, fontWeight: '900' }}>{m.calories}</Text>
                  </View>
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>P {m.protein}g · C {m.carbs}g · F {m.fat}g</Text>
                  {m.quickInstructions && <Text style={{ color: C.light, fontSize: 12, marginTop: 6, lineHeight: 17 }}>{m.quickInstructions}</Text>}
                  <TouchableOpacity onPress={() => onAddToLog({
                    name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
                    mealTime: ['Breakfast','Lunch','Dinner','Snack'].includes(m.slot) ? m.slot : 'Lunch',
                  })} style={{ marginTop: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: C.green + '22', alignItems: 'center' }}>
                    <Text style={{ color: C.green, fontWeight: '900', fontSize: 12 }}>+ Add to today's log</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {(() => {
            const shop = computeShoppingList(plan, [...pantry, ...groceries]);
            if (shop.length === 0) return (
              <View style={{ marginTop: 14, padding: 14, backgroundColor: C.green + '15', borderRadius: 14 }}>
                <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>✓ FULLY STOCKED</Text>
                <Text style={{ color: C.light, fontSize: 12, marginTop: 4 }}>Your pantry and grocery list cover this entire plan.</Text>
              </View>
            );
            return (
              <View style={{ marginTop: 14, padding: 14, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: '#FF8A0055' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#FF8A00', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>🛒 STILL TO BUY ({shop.length})</Text>
                  <TouchableOpacity onPress={async () => {
                    const next = [...new Set([...groceries, ...shop])];
                    setGroceries(next);
                    await Storage.set(KEYS.GROCERY(uid), next);
                    hSuccess();
                    showAlert('Added', `${shop.length} items added to your grocery list.`);
                  }}>
                    <Text style={{ color: C.green, fontSize: 11, fontWeight: '900' }}>+ Add all to list</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, marginBottom: 8 }}>Items the AI plan needs that aren't in your pantry or list yet.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {shop.map((it, i) => (
                    <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, marginRight: 6, marginBottom: 6 }}>
                      <Text style={{ color: C.white, fontSize: 12 }}>{it}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}

          {plan.prepTips?.length > 0 && (
            <View style={{ marginTop: 8, padding: 14, backgroundColor: C.green + '15', borderRadius: 14 }}>
              <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>PREP TIPS</Text>
              {plan.prepTips.map((t, i) => <Text key={i} style={{ color: C.light, fontSize: 13, marginTop: 4 }}>• {t}</Text>)}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ----------------------------- FRIDGE ----------------------------------- */

function FridgeTab({ uid, profile, dailyCalories, onAddToLog }) {
  const { C } = useTheme();
  const [items, setItems]         = useState([]);
  const [input, setInput]         = useState('');
  const [scanning, setScanning]   = useState(false);
  const [generating, setGen]      = useState(false);
  const [meals, setMeals]         = useState(null);
  const [showProvider, setProv]   = useState(false);

  useEffect(() => {
    Storage.get(KEYS.FRIDGE(uid)).then(f => setItems(Array.isArray(f) ? f : []));
  }, [uid]);

  const persist = async (next) => {
    setItems(next);
    await Storage.set(KEYS.FRIDGE(uid), next);
  };

  const add = async () => {
    const v = input.trim(); if (!v) return;
    const parts = v.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const newItems = parts.map(name => ({ name, qty: '', expiring: false, addedAt: Date.now() }));
    await persist([...items, ...newItems]);
    setInput(''); hTick();
  };

  const remove = async (i) => { await persist(items.filter((_, idx) => idx !== i)); };

  const toggleExpiring = async (i) => {
    const next = items.map((it, idx) => idx === i ? { ...it, expiring: !it.expiring } : it);
    await persist(next); hTick();
  };

  const scanFridgePhoto = async () => {
    hSelect();
    if (Platform.OS === 'web') {
      // Web: file picker via expo-image-picker
    }
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : 'Images',
        quality: 0.7, base64: true,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0]; if (!asset) return;
      let b64 = asset.base64;
      if (!b64 && asset.uri && Platform.OS !== 'web') {
        b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      if (!b64) { showAlert('Image error', 'Could not read the photo.'); return; }
      setScanning(true);
      const result = await extractItemsFromFridgePhoto(b64, asset.mimeType || 'image/jpeg');
      setScanning(false);
      const found = (result?.items || []).map(it => ({
        name: it.name, qty: it.qty || '', expiring: !!it.expiring, category: it.category, addedAt: Date.now(),
      }));
      if (found.length === 0) {
        showAlert('Nothing detected', 'Try a clearer, well-lit photo of your open fridge.');
        return;
      }
      await persist([...items, ...found]);
      hSuccess();
      showAlert('Scan complete', `Added ${found.length} items.${result?.notes ? '\n\n' + result.notes : ''}`);
    } catch (e) { setScanning(false); showAlert('Scan failed', e.message || 'Try again.'); }
  };

  const generate = async () => {
    if (items.length === 0) { showAlert('Empty fridge', 'Add items or scan your fridge first.'); return; }
    setGen(true); setMeals(null); hSelect();
    try {
      const r = await generateMealsFromFridge({ fridgeItems: items, mealsWanted: 3, dailyCalories, profile });
      if (r) { setMeals(r); hSuccess(); }
      else showAlert('AI failed', 'Could not generate meals.');
    } catch (e) { showAlert('Error', e.message || 'Failed'); }
    finally { setGen(false); }
  };

  return (
    <View>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
        Snap a photo inside your fridge and the AI lists what's there — or add items by hand. Mark anything wilting as "expiring" and the AI will use it first.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <TouchableOpacity onPress={scanFridgePhoto} disabled={scanning} style={{
          flex: 1, backgroundColor: C.green, paddingVertical: 14, borderRadius: 14,
          alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
        }}>
          {scanning ? <ActivityIndicator color={C.bg} /> :
            <Text style={{ color: C.bg, fontWeight: '900', letterSpacing: 0.5 }}>📷  Scan Fridge Photo</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setProv(true); hSelect(); }} style={{
          backgroundColor: C.surface, paddingHorizontal: 16, borderRadius: 14,
          alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border,
        }}>
          <Text style={{ color: C.white, fontSize: 18 }}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Add by hand — e.g. milk, cheddar, spinach"
          placeholderTextColor={C.muted}
          onSubmitEditing={add} returnKeyType="done"
          style={{ flex: 1, backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 14 }}
        />
        <TouchableOpacity onPress={add} style={{ backgroundColor: C.green, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' }}>
          <Text style={{ color: C.bg, fontWeight: '900', fontSize: 22 }}>+</Text>
        </TouchableOpacity>
      </View>

      {items.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 8 }}>FRIDGE INVENTORY ({items.length})</Text>
          {items.map((it, i) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: C.card, padding: 12, borderRadius: 12, marginBottom: 6,
              borderWidth: 1, borderColor: it.expiring ? '#FF8A0080' : C.border,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.white, fontSize: 14, fontWeight: '700' }}>{it.name}</Text>
                {(it.qty || it.category) && (
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                    {it.qty || ''}{it.qty && it.category ? ' · ' : ''}{it.category || ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => toggleExpiring(i)} style={{
                paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                backgroundColor: it.expiring ? '#FF8A0033' : 'transparent',
                borderWidth: 1, borderColor: it.expiring ? '#FF8A00' : C.border, marginRight: 6,
              }}>
                <Text style={{ color: it.expiring ? '#FF8A00' : C.muted, fontSize: 10, fontWeight: '900' }}>
                  {it.expiring ? '⏳ EXPIRING' : 'fresh'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: C.muted, fontSize: 18, fontWeight: '900' }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: 18, padding: 22, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
          <Text style={{ fontSize: 36 }}>🧊</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>No items yet. Scan your fridge or add ingredients by hand.</Text>
        </View>
      )}

      <TouchableOpacity onPress={generate} disabled={generating} style={{
        marginTop: 16, backgroundColor: generating ? C.surface : C.green,
        paddingVertical: 16, borderRadius: 14, alignItems: 'center',
      }}>
        {generating ? <ActivityIndicator color={C.green} /> :
          <Text style={{ color: C.bg, fontWeight: '900', letterSpacing: 1.2 }}>✨ DESIGN MEALS FROM FRIDGE</Text>}
      </TouchableOpacity>

      {meals && (
        <View style={{ marginTop: 18 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.green + '40' }}>
            <Text style={{ color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 }}>TODAY'S MEAL PLAN</Text>
            {meals.summary && <Text style={{ color: C.light, fontSize: 13, marginTop: 6, lineHeight: 19 }}>{meals.summary}</Text>}
            {meals.totals && <MacroPills p={meals.totals.protein} c={meals.totals.carbs} f={meals.totals.fat} kcal={meals.totals.calories} />}
          </View>
          {(meals.meals || []).map((m, i) => (
            <View key={i} style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, marginTop: 10, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{(m.slot || '').toUpperCase()}{m.cookTime ? `  ·  ${m.cookTime}` : ''}</Text>
                  <Text style={{ color: C.white, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{m.name}</Text>
                </View>
                <Text style={{ color: C.green, fontSize: 17, fontWeight: '900' }}>{m.calories}</Text>
              </View>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>P {m.protein}g · C {m.carbs}g · F {m.fat}g</Text>
              {m.usesExpiring?.length > 0 && (
                <Text style={{ color: '#FF8A00', fontSize: 11, marginTop: 6, fontWeight: '700' }}>⏳ Uses expiring: {m.usesExpiring.join(', ')}</Text>
              )}
              {(m.instructions || []).slice(0, 4).map((step, j) => (
                <Text key={j} style={{ color: C.light, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{j + 1}. {step}</Text>
              ))}
              <TouchableOpacity onPress={() => onAddToLog({
                name: m.name, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat,
                mealTime: ['Breakfast','Lunch','Dinner','Snack'].includes(m.slot) ? m.slot : 'Lunch',
              })} style={{ marginTop: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: C.green + '22', alignItems: 'center' }}>
                <Text style={{ color: C.green, fontWeight: '900', fontSize: 12 }}>+ Add to today's log</Text>
              </TouchableOpacity>
            </View>
          ))}
          {meals.leftovers?.length > 0 && (
            <View style={{ marginTop: 10, padding: 12, backgroundColor: C.surface, borderRadius: 12 }}>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>LEFTOVERS</Text>
              <Text style={{ color: C.light, fontSize: 12, marginTop: 4 }}>{meals.leftovers.join(' · ')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Smart fridge providers (honest placeholders) */}
      <Modal visible={showProvider} transparent animationType="slide" onRequestClose={() => setProv(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36 }}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
            </View>
            <Text style={{ color: C.white, fontSize: 20, fontWeight: '900', marginBottom: 4 }}>Connect a Smart Fridge</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 16, lineHeight: 17 }}>
              Live fridge inventory APIs from Samsung Family Hub and LG ThinQ are closed/regional and require a custom build with each manufacturer's developer key. For now, photo scanning works on every fridge instantly.
            </Text>
            {[
              { name: 'Samsung Family Hub', sub: 'View Inside camera + ingredient list', icon: '🌐' },
              { name: 'LG ThinQ',           sub: 'InstaView fridge inventory',           icon: '◆' },
              { name: 'Bosch Home Connect', sub: 'Fridge contents via Home Connect API', icon: '◐' },
            ].map(p => (
              <View key={p.name} style={{ backgroundColor: C.card, padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, marginRight: 12 }}>{p.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.white, fontWeight: '800' }}>{p.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{p.sub}</Text>
                  <Text style={{ color: C.muted, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>Requires custom dev build + manufacturer API key</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => setProv(false)} style={{ marginTop: 10, paddingVertical: 14, borderRadius: 14, backgroundColor: C.green, alignItems: 'center' }}>
              <Text style={{ color: C.bg, fontWeight: '900' }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ------------------------------- MAIN ---------------------------------- */

export default function MealStudioScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  const uid = user?.email || user?.uid;
  const [tab, setTab] = useState('ingredients');
  const [plan, setPlan] = useState(null);
  const [prefs, setPrefs] = useState({ allergies: '', dislikes: '' });
  const [showPrefs, setShowPrefs] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saved, setSaved] = useState([]);
  const [allergiesDraft, setAllergiesDraft] = useState('');
  const [dislikesDraft, setDislikesDraft] = useState('');

  useEffect(() => {
    Storage.get(KEYS.PLAN(uid)).then(setPlan);
    Storage.get(KEYS.MEAL_PREFS(uid)).then(p => {
      const v = p && typeof p === 'object' ? p : { allergies: '', dislikes: '' };
      setPrefs(v); setAllergiesDraft(v.allergies || ''); setDislikesDraft(v.dislikes || '');
    });
    Storage.get(KEYS.SAVED_MEALS(uid)).then(v => setSaved(Array.isArray(v) ? v : []));
  }, [uid]);

  const refreshSaved = async () => {
    const v = await Storage.get(KEYS.SAVED_MEALS(uid));
    setSaved(Array.isArray(v) ? v : []);
  };

  const savePrefs = async () => {
    const next = { allergies: allergiesDraft.trim(), dislikes: dislikesDraft.trim() };
    setPrefs(next);
    await Storage.set(KEYS.MEAL_PREFS(uid), next);
    setShowPrefs(false);
    hSuccess();
  };

  const deleteSaved = async (idx) => {
    const next = saved.filter((_, i) => i !== idx);
    setSaved(next);
    await Storage.set(KEYS.SAVED_MEALS(uid), next);
    hTick();
  };

  const profile = {
    diet: plan?.userProfile?.diet,
    goal: plan?.userProfile?.goal,
    allergies: prefs.allergies,
    dislikes: prefs.dislikes,
    proteinPct: plan?.proteinPct, carbsPct: plan?.carbsPct, fatPct: plan?.fatPct,
  };

  // Map our compact slots to FoodLog's full meal-time taxonomy so entries actually render in sections.
  const mapMealTime = (slot) => {
    const map = {
      Breakfast: 'Breakfast', Lunch: 'Lunch', Dinner: 'Dinner',
      Snack: 'Afternoon Snack',
    };
    return map[slot] || 'Lunch';
  };

  const addToLog = useCallback(async (entry) => {
    const today = new Date().toDateString();
    const log = (await Storage.get(KEYS.FOODLOG(user.uid, today))) || [];
    const item = {
      id: Date.now(),
      name: entry.name,
      mealTime: mapMealTime(entry.mealTime),
      calories: Math.round(entry.calories || 0),
      protein:  Math.round(entry.protein  || 0),
      carbs:    Math.round(entry.carbs    || 0),
      fat:      Math.round(entry.fat      || 0),
      addedAt: Date.now(),
      source: 'mealStudio',
    };
    const ok = await Storage.set(KEYS.FOODLOG(user.uid, today), [...log, item]);
    if (ok === false) {
      showAlert('Save failed', 'Could not save to your log. Check your connection and try again.');
      return;
    }
    hSuccess();
    showAlert('Added', `${entry.name} added to today's log.`);
  }, [user.uid]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.titleBar}>
        <TouchableOpacity onPress={() => { hSelect(); onNavigate('foodlog'); }} style={s.backBtn}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>AI Meal Studio</Text>
        <TouchableOpacity onPress={() => { hSelect(); refreshSaved(); setShowSaved(true); }} style={s.savedPill}>
          <Text style={{ color: C.green, fontSize: 14 }}>❤</Text>
          <Text style={{ color: C.green, fontWeight: '900', fontSize: 12, marginLeft: 4 }}>{saved.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Preferences strip */}
      <TouchableOpacity onPress={() => { hSelect(); setShowPrefs(true); }} activeOpacity={0.85} style={s.prefsStrip}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>YOUR PREFERENCES</Text>
          <Text style={{ color: C.white, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
            <Text style={{ color: C.green, fontWeight: '800' }}>Diet: </Text>
            {plan?.userProfile?.diet || 'Not set'}
            <Text style={{ color: C.green, fontWeight: '800' }}>   ·   Allergies: </Text>
            {prefs.allergies || 'none'}
            {prefs.dislikes ? <><Text style={{ color: C.green, fontWeight: '800' }}>   ·   Avoid: </Text>{prefs.dislikes}</> : null}
          </Text>
        </View>
        <Text style={{ color: C.green, fontSize: 18 }}>✎</Text>
      </TouchableOpacity>

      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} onPress={() => { hSelect(); setTab(t.id); }} style={[s.tabBtn, tab === t.id && s.tabBtnActive]}>
            <Text style={[s.tabIcon]}>{t.icon}</Text>
            <Text style={[s.tabLabel, tab === t.id && s.tabLabelActive]}>{t.label}</Text>
            <Text style={[s.tabSub, tab === t.id && s.tabSubActive]}>{t.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {tab === 'ingredients' && <IngredientsTab uid={uid} profile={profile} onAddToLog={addToLog} onSavedChange={refreshSaved} />}
        {tab === 'weekly'      && <WeeklyTab      uid={uid} profile={profile} dailyCalories={plan?.dailyCalories} onAddToLog={addToLog} />}
        {tab === 'fridge'      && <FridgeTab      uid={uid} profile={profile} dailyCalories={plan?.dailyCalories} onAddToLog={addToLog} />}
      </ScrollView>

      {/* Preferences modal */}
      <Modal visible={showPrefs} transparent animationType="slide" onRequestClose={() => setShowPrefs(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36 }}>
            <View style={{ alignItems: 'center', marginBottom: 14 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} /></View>
            <Text style={{ color: C.white, fontSize: 20, fontWeight: '900' }}>Meal preferences</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, marginBottom: 16 }}>The AI will honor these on every recipe and meal plan.</Text>

            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>DIET (FROM ONBOARDING)</Text>
            <View style={{ backgroundColor: C.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14 }}>
              <Text style={{ color: C.white, fontSize: 14 }}>{plan?.userProfile?.diet || 'Not set'}</Text>
            </View>

            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>ALLERGIES</Text>
            <TextInput value={allergiesDraft} onChangeText={setAllergiesDraft}
              placeholder="e.g. peanuts, shellfish, gluten" placeholderTextColor={C.muted}
              style={{ backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 14, marginBottom: 14 }} />

            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 }}>DISLIKES / AVOID</Text>
            <TextInput value={dislikesDraft} onChangeText={setDislikesDraft}
              placeholder="e.g. mushrooms, cilantro, very spicy" placeholderTextColor={C.muted}
              style={{ backgroundColor: C.surface, color: C.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.border, fontSize: 14, marginBottom: 18 }} />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => { setAllergiesDraft(prefs.allergies || ''); setDislikesDraft(prefs.dislikes || ''); setShowPrefs(false); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.white, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={savePrefs} style={{ flex: 1.4, paddingVertical: 14, borderRadius: 14, backgroundColor: C.green, alignItems: 'center' }}>
                <Text style={{ color: C.bg, fontWeight: '900' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Saved favorites modal */}
      <Modal visible={showSaved} transparent animationType="slide" onRequestClose={() => setShowSaved(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ marginTop: 60, flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ color: C.white, fontSize: 18, fontWeight: '900' }}>Saved Recipes ({saved.length})</Text>
              <TouchableOpacity onPress={() => setShowSaved(false)}>
                <Text style={{ color: C.muted, fontSize: 22, fontWeight: '900' }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
              {saved.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 40 }}>
                  <Text style={{ fontSize: 36 }}>❤️</Text>
                  <Text style={{ color: C.muted, fontSize: 13, marginTop: 8, textAlign: 'center' }}>No saved recipes yet. Tap the heart on any AI-generated meal to save it here.</Text>
                </View>
              ) : saved.map((r, i) => (
                <View key={r.savedAt || i} style={{ backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.green, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{(r.mealType || 'MEAL').toUpperCase()}{r.cookTime ? `  ·  ${r.cookTime}` : ''}{r.difficulty ? `  ·  ${r.difficulty}` : ''}</Text>
                      <Text style={{ color: C.white, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{r.name}</Text>
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{r.calories} kcal · P {r.protein}g · C {r.carbs}g · F {r.fat}g</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteSaved(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: C.muted, fontSize: 20 }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => { addToLog({ name: r.name, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, mealTime: r.mealType }); }}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: C.green + '22', alignItems: 'center' }}>
                      <Text style={{ color: C.green, fontWeight: '900', fontSize: 12 }}>+ Add to today's log</Text>
                    </TouchableOpacity>
                  </View>
                  {r.ingredients?.length > 0 && (
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 8 }} numberOfLines={2}>
                      {r.ingredients.slice(0, 6).map(ing => typeof ing === 'string' ? ing : ing.item).join(' · ')}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (C) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
  title: { color: C.white, fontSize: 18, fontWeight: '900' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backTxt: { color: C.white, fontSize: 22, fontWeight: '700', marginTop: -2 },
  savedPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.green + '22', borderWidth: 1, borderColor: C.green + '55' },
  prefsStrip: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginBottom: 12, padding: 12, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  tabBar: { flexDirection: 'row', paddingHorizontal: 14, gap: 8 },
  tabBtn: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  tabBtnActive: { borderColor: C.green, backgroundColor: C.green + '15' },
  tabIcon: { fontSize: 22 },
  tabLabel: { color: C.muted, fontSize: 13, fontWeight: '900', marginTop: 4 },
  tabLabelActive: { color: C.green },
  tabSub: { color: C.muted, fontSize: 9, marginTop: 2, fontWeight: '600' },
  tabSubActive: { color: C.green + 'CC' },
});
