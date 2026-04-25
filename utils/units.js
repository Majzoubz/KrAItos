import { useI18n } from '../i18n/I18nContext';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const KM_PER_MI = 1.609344;

export function kgToLb(kg) { return kg / KG_PER_LB; }
export function lbToKg(lb) { return lb * KG_PER_LB; }
export function cmToIn(cm) { return cm / CM_PER_IN; }
export function inToCm(inch) { return inch * CM_PER_IN; }
export function kmToMi(km) { return km / KM_PER_MI; }
export function miToKm(mi) { return mi * KM_PER_MI; }

export function cmToFtIn(cm) {
  const totalIn = cm / CM_PER_IN;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  if (inch === 12) return { ft: ft + 1, in: 0 };
  return { ft, in: inch };
}

export function ftInToCm(ft, inch) {
  return (Number(ft) || 0) * 12 * CM_PER_IN + (Number(inch) || 0) * CM_PER_IN;
}

const round = (n, d = 1) => {
  if (!isFinite(n)) return n;
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
};

// Display helpers — value is stored canonically in metric (kg / cm / km).
// These return { value, unit, formatted } for the user's chosen system.
export function displayWeight(kg, system, decimals = 1) {
  if (kg == null || kg === '') return { value: '', unit: '', formatted: '' };
  const n = Number(kg);
  if (!isFinite(n)) return { value: '', unit: '', formatted: '' };
  if (system === 'imperial') {
    const v = round(kgToLb(n), decimals);
    return { value: v, unit: 'lb', formatted: `${v} lb` };
  }
  const v = round(n, decimals);
  return { value: v, unit: 'kg', formatted: `${v} kg` };
}

export function displayLength(cm, system, decimals = 1) {
  if (cm == null || cm === '') return { value: '', unit: '', formatted: '' };
  const n = Number(cm);
  if (!isFinite(n)) return { value: '', unit: '', formatted: '' };
  if (system === 'imperial') {
    const v = round(cmToIn(n), decimals);
    return { value: v, unit: 'in', formatted: `${v} in` };
  }
  const v = round(n, decimals);
  return { value: v, unit: 'cm', formatted: `${v} cm` };
}

export function displayHeight(cm, system) {
  if (cm == null || cm === '') return { primary: '', formatted: '' };
  const n = Number(cm);
  if (!isFinite(n)) return { primary: '', formatted: '' };
  if (system === 'imperial') {
    const { ft, in: inch } = cmToFtIn(n);
    return { primary: `${ft}' ${inch}"`, formatted: `${ft}'${inch}"` };
  }
  const v = round(n, 0);
  return { primary: `${v} cm`, formatted: `${v} cm` };
}

export function displayDistance(km, system, decimals = 2) {
  if (km == null || km === '') return { value: '', unit: '', formatted: '' };
  const n = Number(km);
  if (!isFinite(n)) return { value: '', unit: '', formatted: '' };
  if (system === 'imperial') {
    const v = round(kmToMi(n), decimals);
    return { value: v, unit: 'mi', formatted: `${v} mi` };
  }
  const v = round(n, decimals);
  return { value: v, unit: 'km', formatted: `${v} km` };
}

// Parse a user-entered value back into canonical metric for storage.
export function parseWeightToKg(value, system) {
  const n = parseFloat(String(value).replace(',', '.'));
  if (!isFinite(n)) return null;
  return system === 'imperial' ? lbToKg(n) : n;
}

export function parseLengthToCm(value, system) {
  const n = parseFloat(String(value).replace(',', '.'));
  if (!isFinite(n)) return null;
  return system === 'imperial' ? inToCm(n) : n;
}

// Hook that exposes the current units system + helpers bound to it.
export function useUnits() {
  const { units } = useI18n();
  return {
    system: units,
    isMetric: units === 'metric',
    isImperial: units === 'imperial',
    weightUnit: units === 'imperial' ? 'lb' : 'kg',
    lengthUnit: units === 'imperial' ? 'in' : 'cm',
    distanceUnit: units === 'imperial' ? 'mi' : 'km',
    weight: (kg, decimals) => displayWeight(kg, units, decimals),
    length: (cm, decimals) => displayLength(cm, units, decimals),
    height: (cm) => displayHeight(cm, units),
    distance: (km, decimals) => displayDistance(km, units, decimals),
    parseWeight: (v) => parseWeightToKg(v, units),
    parseLength: (v) => parseLengthToCm(v, units),
  };
}
