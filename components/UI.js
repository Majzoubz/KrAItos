import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function LoadingState({ message, compact }) {
  const { C } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: compact ? 24 : 60 }}>
      <ActivityIndicator color={C.green} size={compact ? 'small' : 'large'} />
      {message ? (
        <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body, actionLabel, onAction }) {
  const { C } = useTheme();
  return (
    <View style={{
      alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24,
      backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border,
    }}>
      {icon ? (
        <View style={{
          width: 64, height: 64, borderRadius: 32, backgroundColor: C.green + '18',
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Text style={{ fontSize: 28 }}>{icon}</Text>
        </View>
      ) : null}
      {title ? (
        <Text style={{ color: C.white, fontSize: 17, fontWeight: '900', textAlign: 'center', marginBottom: 6 }}>
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: actionLabel ? 18 : 0 }}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={{ backgroundColor: C.green, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12 }}
        >
          <Text style={{ color: C.bg, fontWeight: '900', letterSpacing: 0.5 }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ErrorState({ title = 'Something went wrong', body, onRetry, retryLabel = 'Try again' }) {
  const { C } = useTheme();
  return (
    <View style={{
      alignItems: 'center', paddingVertical: 28, paddingHorizontal: 22,
      backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: '#FF555555',
    }}>
      <View style={{
        width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF555518',
        alignItems: 'center', justifyContent: 'center', marginBottom: 12,
      }}>
        <Text style={{ fontSize: 24 }}>⚠️</Text>
      </View>
      <Text style={{ color: C.white, fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: 6 }}>{title}</Text>
      {body ? (
        <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: onRetry ? 14 : 0 }}>
          {body}
        </Text>
      ) : null}
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={{
          backgroundColor: C.surface, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 10,
          borderWidth: 1, borderColor: C.green,
        }}>
          <Text style={{ color: C.green, fontWeight: '800' }}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function OfflineBanner({ queued }) {
  const { C } = useTheme();
  if (!queued) return null;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: '#FF8A0022', borderColor: '#FF8A0055', borderWidth: 1,
      borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10,
    }}>
      <Text style={{ fontSize: 14, marginRight: 8 }}>⏳</Text>
      <Text style={{ color: C.white, fontSize: 12, fontWeight: '700', flex: 1 }}>
        Offline — {queued} change{queued === 1 ? '' : 's'} waiting to sync.
      </Text>
    </View>
  );
}

export function Field({ label, ...props }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
        placeholderTextColor={C.muted}
        {...props}
      />
    </>
  );
}

export function ScreenHeader({ title, icon, onBack }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <View style={s.screenHeader}>
      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backText}>←</Text>
      </TouchableOpacity>
      <Text style={s.screenTitle}>{icon} {title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

export function SectionTitle({ children }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return <Text style={s.sectionTitle}>{children}</Text>;
}

export function PrimaryButton({ label, onPress, disabled, children, style }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <TouchableOpacity
      style={[s.primaryBtn, disabled && { opacity: 0.5 }, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {children ?? <Text style={s.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <TouchableOpacity style={s.secondaryBtn} onPress={onPress} activeOpacity={0.85}>
      <Text style={s.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function MacroGrid({ items }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <View style={s.macroGrid}>
      {items.map(([label, val, unit, color]) => (
        <View key={label} style={s.macroItem}>
          <Text style={[s.macroVal, { color }]}>
            {val}<Text style={s.macroUnit}>{unit}</Text>
          </Text>
          <Text style={s.macroLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function CalorieHero({ calories, label = 'CALORIES' }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <View style={s.calorieHero}>
      <Text style={s.calorieNum}>{calories}</Text>
      <Text style={s.calorieLabel}>{label}</Text>
    </View>
  );
}

export function TipsBox({ title, tips }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <View style={s.tipsBox}>
      <Text style={s.tipsTitle}>{title}</Text>
      {tips?.map((tip, i) => (
        <Text key={i} style={s.tipItem}> {tip}</Text>
      ))}
    </View>
  );
}

export function ChipSelector({ label, options, selected, onSelect }) {
  const { C } = useTheme();
  const s = makeStyles(C);
  return (
    <>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.chipRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[s.chip, selected === opt && s.chipActive]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[s.chipText, selected === opt && s.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const makeStyles = (C) => StyleSheet.create({
  fieldLabel: { color: C.white, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 4, letterSpacing: 0.5 },
  input: {
    backgroundColor: C.surface, color: C.white, padding: 16,
    borderRadius: 14, fontSize: 15, marginBottom: 18,
    borderWidth: 1.5, borderColor: C.border,
  },
  screenHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 44, height: 44, backgroundColor: C.surface,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  backText: { color: C.white, fontSize: 20, fontWeight: '600' },
  screenTitle: { color: C.white, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: C.green, paddingVertical: 18, borderRadius: 16,
    alignItems: 'center', marginTop: 8, flexDirection: 'row', justifyContent: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12,
  },
  primaryBtnText: { color: C.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  secondaryBtn: { borderWidth: 1.5, borderColor: C.green, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 16 },
  secondaryBtnText: { color: C.green, fontSize: 15, fontWeight: '700' },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  macroItem: { width: '30%', backgroundColor: C.card, borderRadius: 14, padding: 14, alignItems: 'center', marginRight: 6, marginBottom: 6, borderWidth: 1, borderColor: C.border },
  macroVal: { fontSize: 22, fontWeight: '800' },
  macroUnit: { fontSize: 13, fontWeight: '400' },
  macroLabel: { color: C.muted, fontSize: 12, marginTop: 2 },
  calorieHero: { backgroundColor: C.surface, borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: C.border },
  calorieNum: { color: C.green, fontSize: 56, fontWeight: '900' },
  calorieLabel: { color: C.muted, fontSize: 13, letterSpacing: 2, marginTop: -4 },
  tipsBox: { backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  tipsTitle: { color: C.white, fontWeight: '800', marginBottom: 10 },
  tipItem: { color: C.muted, fontSize: 13, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 8,
    backgroundColor: C.surface, borderRadius: 22, borderWidth: 1.5, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.greenGlow, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.green, fontWeight: '700' },
});
