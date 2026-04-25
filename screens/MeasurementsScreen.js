import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, SafeAreaView,
  ScrollView, Alert, Image, Modal, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { useT, useI18n } from '../i18n/I18nContext';
import { useUnits, lbToKg, inToCm, kgToLb, cmToIn } from '../utils/units';
import { Storage, KEYS } from '../utils/storage';

const ENTRY_VERSION = 2;

// Convert legacy measurement entries (saved before canonical-metric storage existed)
// into kg/cm. Heuristic: assume entries were saved in the user's current unit system.
function migrateLegacyEntries(entries, system) {
  if (!Array.isArray(entries) || entries.length === 0) return { entries: entries || [], changed: false };
  let changed = false;
  const next = entries.map(e => {
    if (!e || (typeof e.v === 'number' && e.v >= ENTRY_VERSION)) return e;
    const out = { ...e };
    let convertedAny = false;
    if (system === 'imperial') {
      for (const f of FIELD_DEFS) {
        const val = out[f.key];
        if (val == null) continue;
        const n = Number(val);
        if (!isFinite(n)) continue;
        if (f.kind === 'weight') { out[f.key] = Math.round(lbToKg(n) * 100) / 100; convertedAny = true; }
        else if (f.kind === 'length') { out[f.key] = Math.round(inToCm(n) * 100) / 100; convertedAny = true; }
      }
      if (convertedAny) {
        out.migrated = true;
        out.migratedFrom = 'imperial';
      }
    }
    out.v = ENTRY_VERSION;
    changed = true;
    return out;
  });
  return { entries: next, changed };
}

const { width: SCREEN_W } = Dimensions.get('window');

// Canonical storage: weight = kg, lengths = cm, bodyFat = %.
// `kind` tells us which converter to use for display/parse.
const FIELD_DEFS = [
  { key: 'weight',  labelKey: 'measurements.weight',  kind: 'weight', icon: '⚖️' },
  { key: 'waist',   labelKey: 'measurements.waist',   kind: 'length', icon: '📏' },
  { key: 'chest',   labelKey: 'measurements.chest',   kind: 'length', icon: '🎯' },
  { key: 'hips',    labelKey: 'measurements.hips',    kind: 'length', icon: '🔻' },
  { key: 'arm',     labelKey: 'measurements.arm',     kind: 'length', icon: '💪' },
  { key: 'thigh',   labelKey: 'measurements.thigh',   kind: 'length', icon: '🦵' },
  { key: 'neck',    labelKey: 'measurements.neck',    kind: 'length', icon: '👔' },
  { key: 'bodyFat', labelKey: 'measurements.bodyFat', kind: 'pct',    icon: '📊' },
];

const PHOTO_LABELS = ['Front', 'Side', 'Back'];

export default function MeasurementsScreen({ user, onNavigate }) {
  const { C } = useTheme();
  const t = useT();
  const { isRTL } = useI18n();
  const U = useUnits();
  const s = makeStyles(C);
  const uid = user.email || user.uid;

  // Build per-render fields with localized labels + correct unit symbol for the user's system.
  const FIELDS = FIELD_DEFS.map(f => ({
    ...f,
    label: t(f.labelKey),
    unit: f.kind === 'weight' ? U.weightUnit : f.kind === 'length' ? U.lengthUnit : '%',
  }));

  // Convert a stored canonical value to the user's display unit.
  const toDisplay = (key, kind, val) => {
    if (val == null) return null;
    if (kind === 'weight') return U.weight(val).value;
    if (kind === 'length') return U.length(val).value;
    return Math.round(Number(val) * 10) / 10; // pct
  };

  // Convert a typed display-unit string back to canonical metric for storage.
  const toCanonical = (kind, str) => {
    if (kind === 'weight') return U.parseWeight(str);
    if (kind === 'length') return U.parseLength(str);
    const n = parseFloat(String(str).replace(',', '.'));
    return isFinite(n) ? n : null;
  };

  const [tab, setTab] = useState('measure');
  const [history, setHistory] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addDraft, setAddDraft] = useState({});
  const [editingTimestamp, setEditingTimestamp] = useState(null);
  const [compare, setCompare] = useState({ a: null, b: null });
  const [pickerLabel, setPickerLabel] = useState(null); // string when picking compare slot
  const [actionSheet, setActionSheet] = useState(null); // { title, actions: [{label, onPress, destructive}] }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const openActions = (title, actions) => setActionSheet({ title, actions });
  const closeActions = () => setActionSheet(null);

  const load = useCallback(async () => {
    const [m, p, mig] = await Promise.all([
      Storage.get(KEYS.MEASUREMENTS(uid)),
      Storage.get(KEYS.PROGRESS_PHOTOS(uid)),
      Storage.get(KEYS.MEASUREMENTS_MIGRATION(uid)),
    ]);
    let entries = Array.isArray(m) ? m : [];
    const alreadyMigrated = mig && typeof mig.v === 'number' && mig.v >= ENTRY_VERSION;
    if (!alreadyMigrated) {
      const result = migrateLegacyEntries(entries, U.system);
      entries = result.entries;
      if (result.changed) {
        await Storage.set(KEYS.MEASUREMENTS(uid), entries);
      }
      await Storage.set(KEYS.MEASUREMENTS_MIGRATION(uid), {
        v: ENTRY_VERSION,
        system: U.system,
        at: Date.now(),
      });
    }
    setHistory(entries);
    setPhotos(Array.isArray(p) ? p : []);
  }, [uid, U.system]);

  useEffect(() => { load(); }, [load]);

  const latest = history[history.length - 1] || {};
  const previous = history[history.length - 2] || null;

  const saveAdd = async () => {
    setSaveError(null);
    const isEditing = editingTimestamp != null;
    const existing = isEditing ? history.find(e => e.timestamp === editingTimestamp) : null;
    const entry = isEditing
      ? { ...existing, v: ENTRY_VERSION, migrated: false, migratedFrom: undefined }
      : { date: new Date().toISOString().slice(0, 10), timestamp: Date.now(), v: ENTRY_VERSION };
    if (isEditing) {
      // Clear previous values so blanked-out fields are removed.
      FIELD_DEFS.forEach(f => { delete entry[f.key]; });
    }
    let count = 0;
    FIELD_DEFS.forEach(f => {
      const raw = (addDraft[f.key] || '').trim();
      if (!raw) return;
      const v = toCanonical(f.kind, raw);
      if (v != null && v > 0) {
        entry[f.key] = Math.round(v * 100) / 100; // store metric, 2dp
        count += 1;
      }
    });
    if (count === 0) {
      setSaveError(t('common.error'));
      return;
    }
    setSaving(true);
    const next = isEditing
      ? history.map(e => (e.timestamp === editingTimestamp ? entry : e))
      : [...history, entry].slice(-200);
    try {
      const ok = await Storage.set(KEYS.MEASUREMENTS(uid), next);
      if (ok === false) throw new Error('Could not save to cloud. Check your connection.');
      setHistory(next);
      setAddDraft({});
      setEditingTimestamp(null);
      setShowAdd(false);
    } catch (e) {
      setSaveError(e.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const closeAdd = () => {
    if (saving) return;
    setShowAdd(false);
    setAddDraft({});
    setEditingTimestamp(null);
    setSaveError(null);
  };

  const openEdit = (entry) => {
    if (!entry) return;
    const draft = {};
    FIELD_DEFS.forEach(f => {
      if (entry[f.key] != null) {
        const dv = toDisplay(f.key, f.kind, entry[f.key]);
        if (dv != null) draft[f.key] = String(dv);
      }
    });
    setAddDraft(draft);
    setEditingTimestamp(entry.timestamp);
    setSaveError(null);
    setShowAdd(true);
  };

  // Compute the original (pre-migration) value in the system the entry was migrated from.
  const originalValue = (key, kind, val, fromSystem) => {
    if (val == null) return null;
    if (fromSystem !== 'imperial') return val;
    if (kind === 'weight') return Math.round(kgToLb(Number(val)) * 10) / 10;
    if (kind === 'length') return Math.round(cmToIn(Number(val)) * 10) / 10;
    return val;
  };

  const originalUnit = (kind, fromSystem) => {
    if (kind === 'weight') return fromSystem === 'imperial' ? 'lb' : 'kg';
    if (kind === 'length') return fromSystem === 'imperial' ? 'in' : 'cm';
    return '%';
  };

  const showMigrationInfo = (entry) => {
    const from = entry.migratedFrom || 'imperial';
    const lines = FIELD_DEFS
      .filter(f => entry[f.key] != null && (f.kind === 'weight' || f.kind === 'length'))
      .map(f => {
        const orig = originalValue(f.key, f.kind, entry[f.key], from);
        const cur = toDisplay(f.key, f.kind, entry[f.key]);
        const curUnit = f.kind === 'weight' ? U.weightUnit : U.lengthUnit;
        return `${f.icon} ${t(f.labelKey)}: ${orig}${originalUnit(f.kind, from)} → ${cur}${curUnit}`;
      })
      .join('\n');
    const explain = t('measurements.autoConvertedExplain', {
      from: from === 'imperial' ? 'lb/in' : 'kg/cm',
      to: 'kg/cm',
    });
    openActions(
      t('measurements.autoConvertedTitle') + (lines ? '\n\n' + lines + '\n\n' + explain : '\n\n' + explain),
      [
        { label: t('measurements.editEntry'), onPress: () => openEdit(entry) },
      ]
    );
  };

  const removeEntry = async (timestamp) => {
    const next = history.filter(e => e.timestamp !== timestamp);
    await Storage.set(KEYS.MEASUREMENTS(uid), next);
    setHistory(next);
  };

  const openRowActions = (entry) => {
    if (!entry) return;
    const dateLabel = new Date(entry.timestamp || entry.date).toLocaleDateString();
    openActions(dateLabel, [
      { label: t('measurements.editEntry'), onPress: () => openEdit(entry) },
      { label: 'Delete', destructive: true, onPress: () => removeEntry(entry.timestamp) },
    ]);
  };

  // Photos
  const addPhoto = (label) => {
    openActions('Add ' + label + ' photo', [
      { label: '📸 Take Photo', onPress: async () => {
          const camPerm = await ImagePicker.requestCameraPermissionsAsync();
          if (camPerm.status !== 'granted') { Alert.alert('Camera permission needed'); return; }
          const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: Platform.OS === 'web', allowsEditing: true });
          handlePicked(r, label);
        } },
      { label: '🖼️ Choose from library', onPress: async () => {
          const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (libPerm.status !== 'granted') { Alert.alert('Photo library permission needed'); return; }
          const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: Platform.OS === 'web', allowsEditing: true });
          handlePicked(r, label);
        } },
    ]);
  };

  const handlePicked = async (r, label) => {
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    let uri = asset.uri;
    if (Platform.OS === 'web' && asset.base64 && asset.mimeType) {
      uri = `data:${asset.mimeType};base64,${asset.base64}`;
    }
    const entry = {
      id: Date.now().toString(36),
      date: new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
      label,
      uri,
    };
    const next = [entry, ...photos].slice(0, 200);
    await Storage.set(KEYS.PROGRESS_PHOTOS(uid), next);
    setPhotos(next);
  };

  const deletePhoto = (id) => {
    openActions('Delete this photo?', [
      { label: 'Delete', destructive: true, onPress: async () => {
        const next = photos.filter(p => p.id !== id);
        await Storage.set(KEYS.PROGRESS_PHOTOS(uid), next);
        setPhotos(next);
        if (compare.a?.id === id) setCompare(c => ({ ...c, a: null }));
        if (compare.b?.id === id) setCompare(c => ({ ...c, b: null }));
      }},
    ]);
  };

  const setCompareSlot = (slot, photo) => {
    setCompare(c => ({ ...c, [slot]: photo }));
    setPickerLabel(null);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => onNavigate('progress')} style={s.backBtn}><Text style={s.backBtnText}>{isRTL ? '›' : '‹'}</Text></TouchableOpacity>
        <Text style={s.headerTitle}>{t('measurements.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, tab === 'measure' && s.tabActive]} onPress={() => setTab('measure')}>
          <Text style={[s.tabText, tab === 'measure' && s.tabTextActive]}>{t('measurements.tabMeasure')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'photos' && s.tabActive]} onPress={() => setTab('photos')}>
          <Text style={[s.tabText, tab === 'photos' && s.tabTextActive]}>{t('measurements.tabPhotos')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {tab === 'measure' && (
          <>
            <View style={s.latestCard}>
              <Text style={s.latestLabel}>{t('measurements.latest')}</Text>
              {history.length === 0 ? (
                <Text style={s.emptySub}>{t('measurements.empty')}</Text>
              ) : (
                <View style={s.latestGrid}>
                  {FIELDS.filter(f => latest[f.key] != null).map(f => {
                    const cur = toDisplay(f.key, f.kind, latest[f.key]);
                    const prev = previous?.[f.key] != null ? toDisplay(f.key, f.kind, previous[f.key]) : null;
                    const delta = prev != null && cur != null ? +(cur - prev).toFixed(1) : null;
                    const goodDir = f.key === 'weight' || f.key === 'waist' || f.key === 'bodyFat' ? 'down' : 'up';
                    const isGood = delta != null && (goodDir === 'down' ? delta < 0 : delta > 0);
                    return (
                      <View key={f.key} style={s.latestItem}>
                        <Text style={s.latestIcon}>{f.icon}</Text>
                        <Text style={s.latestVal}>{cur}<Text style={s.latestUnit}> {f.unit}</Text></Text>
                        <Text style={s.latestField}>{f.label}</Text>
                        {delta != null && delta !== 0 && (
                          <Text style={[s.latestDelta, { color: isGood ? C.green : C.muted }]}>
                            {delta > 0 ? '+' : ''}{delta}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
              <Text style={s.addBtnText}>{t('measurements.add')}</Text>
            </TouchableOpacity>

            {history.length > 0 && (
              <>
                <Text style={s.sectionTitle}>{t('measurements.history')}</Text>
                {[...history].reverse().map((e, i) => (
                  <TouchableOpacity key={e.timestamp || i} style={s.histRow} onPress={() => openRowActions(e)} onLongPress={() => openRowActions(e)}>
                    <View style={s.histLeft}>
                      <Text style={s.histDate}>{new Date(e.timestamp || e.date).toLocaleDateString()}</Text>
                      {e.migrated && (
                        <TouchableOpacity
                          onPress={() => showMigrationInfo(e)}
                          style={s.migBadge}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={s.migBadgeText}>↻ {t('measurements.autoConverted')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={s.histVals}>
                      {FIELDS.filter(f => e[f.key] != null).map(f => (
                        <Text key={f.key} style={s.histVal}>{f.icon}{toDisplay(f.key, f.kind, e[f.key])}{f.unit}</Text>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
                <Text style={s.histHint}>{t('measurements.deleteHint')}</Text>
              </>
            )}
          </>
        )}

        {tab === 'photos' && (
          <>
            <Text style={s.sectionTitle}>Add new photo</Text>
            <View style={s.addPhotoRow}>
              {PHOTO_LABELS.map(l => (
                <TouchableOpacity key={l} style={s.addPhotoBtn} onPress={() => addPhoto(l)}>
                  <Text style={s.addPhotoIcon}>📸</Text>
                  <Text style={s.addPhotoText}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionTitle}>Compare</Text>
            <View style={s.compareRow}>
              <CompareSlot label="Then" photo={compare.a} C={C} s={s} onPick={() => setPickerLabel('a')} />
              <CompareSlot label="Now"  photo={compare.b} C={C} s={s} onPick={() => setPickerLabel('b')} />
            </View>

            <Text style={s.sectionTitle}>Gallery</Text>
            {photos.length === 0 ? (
              <Text style={s.emptySub}>Add your first progress photo above.</Text>
            ) : (
              <View style={s.galleryGrid}>
                {photos.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={s.galleryItem}
                    onPress={() => openActions(p.label + ' · ' + p.date, [
                      { label: 'Use as "Then"', onPress: () => setCompareSlot('a', p) },
                      { label: 'Use as "Now"',  onPress: () => setCompareSlot('b', p) },
                      { label: 'Delete', destructive: true, onPress: () => deletePhoto(p.id) },
                    ])}
                  >
                    <Image source={{ uri: p.uri }} style={s.galleryImg} resizeMode="cover" />
                    <View style={s.galleryOverlay}>
                      <Text style={s.galleryLabel}>{p.label}</Text>
                      <Text style={s.galleryDate}>{p.date}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Add measurement modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={closeAdd}>
        <TouchableOpacity activeOpacity={1} style={s.modalBackdrop} onPress={closeAdd}>
          <TouchableOpacity activeOpacity={1} style={s.modalSheet} onPress={() => {}}>
            <Text style={s.modalTitle}>{editingTimestamp != null ? t('measurements.modalTitleEdit') : t('measurements.modalTitle')}</Text>
            <Text style={s.modalHint}>{t('measurements.modalHint')}</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {FIELDS.map(f => {
                const lastDisplay = latest[f.key] != null ? toDisplay(f.key, f.kind, latest[f.key]) : null;
                return (
                  <View key={f.key} style={s.modalRow}>
                    <Text style={s.modalLabel}>{f.icon} {f.label}</Text>
                    <View style={s.modalInputWrap}>
                      <TextInput
                        style={s.modalInput}
                        value={addDraft[f.key] || ''}
                        onChangeText={(v) => {
                          const cleaned = v.replace(',', '.').replace(/[^0-9.]/g, '');
                          const single = cleaned.split('.').slice(0, 2).join('.');
                          setAddDraft(d => ({ ...d, [f.key]: single }));
                          if (saveError) setSaveError(null);
                        }}
                        placeholder={lastDisplay != null ? String(lastDisplay) : '0'}
                        placeholderTextColor={C.muted}
                        keyboardType={Platform.OS === 'web' ? 'default' : 'decimal-pad'}
                        inputMode="decimal"
                      />
                      <Text style={s.modalUnit}>{f.unit}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            {saveError && <Text style={s.errorText}>{saveError}</Text>}
            <View style={s.modalBtnRow}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={closeAdd} disabled={saving}>
                <Text style={s.modalBtnGhostText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, saving && { opacity: 0.6 }]} onPress={saveAdd} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={C.bg} />
                  : <Text style={s.modalBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Cross-platform action sheet */}
      <Modal visible={!!actionSheet} transparent animationType="fade" onRequestClose={closeActions}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closeActions}>
          <TouchableOpacity activeOpacity={1} style={s.actionSheet} onPress={() => {}}>
            {actionSheet?.title && <Text style={s.actionTitle}>{actionSheet.title}</Text>}
            {actionSheet?.actions?.map((a, i) => (
              <TouchableOpacity
                key={i}
                style={[s.actionBtn, a.destructive && s.actionBtnDanger]}
                onPress={async () => { closeActions(); try { await a.onPress?.(); } catch {} }}
              >
                <Text style={[s.actionBtnText, a.destructive && s.actionBtnTextDanger]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.actionBtn, s.actionBtnGhost]} onPress={closeActions}>
              <Text style={s.actionBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Photo picker modal */}
      <Modal visible={!!pickerLabel} transparent animationType="fade" onRequestClose={() => setPickerLabel(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Pick a photo</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={s.galleryGrid}>
                {photos.map(p => (
                  <TouchableOpacity key={p.id} style={s.galleryItem} onPress={() => setCompareSlot(pickerLabel, p)}>
                    <Image source={{ uri: p.uri }} style={s.galleryImg} resizeMode="cover" />
                    <View style={s.galleryOverlay}>
                      <Text style={s.galleryLabel}>{p.label}</Text>
                      <Text style={s.galleryDate}>{p.date}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[s.modalBtn, { marginTop: 10 }]} onPress={() => setPickerLabel(null)}>
              <Text style={s.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CompareSlot({ label, photo, C, s, onPick }) {
  return (
    <TouchableOpacity style={s.compareSlot} onPress={onPick} activeOpacity={0.85}>
      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={s.compareImg} resizeMode="cover" />
          <View style={s.compareTag}><Text style={s.compareTagText}>{label} · {photo.date}</Text></View>
        </>
      ) : (
        <View style={s.compareEmpty}>
          <Text style={s.comparePlus}>+</Text>
          <Text style={s.compareEmptyText}>{label}</Text>
          <Text style={s.compareHint}>Tap to pick</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (C) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: C.white, fontSize: 22, fontWeight: '700', marginTop: -2 },
  headerTitle: { color: C.white, fontSize: 17, fontWeight: '800' },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, backgroundColor: C.card, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  tabActive: { backgroundColor: C.green, borderColor: C.green },
  tabText: { color: C.muted, fontWeight: '800' },
  tabTextActive: { color: C.bg, fontWeight: '900' },

  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: C.white, fontSize: 14, fontWeight: '800', marginTop: 18, marginBottom: 10 },
  emptySub: { color: C.muted, fontSize: 13, lineHeight: 19 },

  latestCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  latestLabel: { color: C.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  latestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  latestItem: { width: '31%', backgroundColor: C.bg, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  latestIcon: { fontSize: 18, marginBottom: 4 },
  latestVal: { color: C.white, fontSize: 18, fontWeight: '900' },
  latestUnit: { color: C.muted, fontSize: 11, fontWeight: '700' },
  latestField: { color: C.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  latestDelta: { fontSize: 11, fontWeight: '900', marginTop: 3 },

  addBtn: { backgroundColor: C.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12 },
  addBtnText: { color: C.bg, fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },

  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: C.card, padding: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  histLeft: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  histDate: { color: C.white, fontSize: 12, fontWeight: '700' },
  migBadge: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  migBadgeText: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  histVals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, flex: 1 },
  histVal: { color: C.muted, fontSize: 11 },
  histHint: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 6 },

  addPhotoRow: { flexDirection: 'row', gap: 8 },
  addPhotoBtn: { flex: 1, backgroundColor: C.card, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  addPhotoIcon: { fontSize: 24 },
  addPhotoText: { color: C.white, fontSize: 12, fontWeight: '800', marginTop: 6 },

  compareRow: { flexDirection: 'row', gap: 8 },
  compareSlot: { flex: 1, height: 240, backgroundColor: C.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  compareImg: { width: '100%', height: '100%' },
  compareTag: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.65)', padding: 6 },
  compareTagText: { color: C.white, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  compareEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  comparePlus: { color: C.muted, fontSize: 36 },
  compareEmptyText: { color: C.white, fontSize: 13, fontWeight: '800', marginTop: 4 },
  compareHint: { color: C.muted, fontSize: 10, marginTop: 2 },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  galleryItem: { width: (SCREEN_W - 32 - 12) / 3, height: 130, borderRadius: 10, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  galleryImg: { width: '100%', height: '100%' },
  galleryOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 4, backgroundColor: 'rgba(0,0,0,0.5)' },
  galleryLabel: { color: C.white, fontSize: 10, fontWeight: '900' },
  galleryDate: { color: C.muted, fontSize: 9 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  modalSheet: { backgroundColor: C.bg, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  modalTitle: { color: C.white, fontSize: 18, fontWeight: '900', marginBottom: 4 },
  modalHint: { color: C.muted, fontSize: 12, marginBottom: 12 },
  errorText: { color: C.danger || '#FF5555', fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  modalRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  modalLabel: { color: C.white, flex: 1, fontSize: 13, fontWeight: '700' },
  modalInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: C.border, width: 120 },
  modalInput: { flex: 1, color: C.white, paddingVertical: 8, fontWeight: '700', textAlign: 'right' },
  modalUnit: { color: C.muted, fontSize: 11, fontWeight: '800', marginLeft: 6 },
  modalBtnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  modalBtn: { flex: 1, backgroundColor: C.green, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: C.bg, fontWeight: '900' },
  modalBtnGhost: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  modalBtnGhostText: { color: C.white, fontWeight: '800' },

  actionSheet: { backgroundColor: C.bg, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, alignSelf: 'center', minWidth: 280, maxWidth: 360 },
  actionTitle: { color: C.white, fontSize: 14, fontWeight: '800', textAlign: 'center', paddingVertical: 8, marginBottom: 6 },
  actionBtn: { backgroundColor: C.card, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginBottom: 6, borderWidth: 1, borderColor: C.border },
  actionBtnText: { color: C.white, fontWeight: '800', fontSize: 14 },
  actionBtnDanger: { borderColor: C.danger || '#FF5555' },
  actionBtnTextDanger: { color: C.danger || '#FF5555' },
  actionBtnGhost: { backgroundColor: 'transparent', marginTop: 4, borderColor: 'transparent' },
  actionBtnGhostText: { color: C.muted, fontWeight: '700' },
});
