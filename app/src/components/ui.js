import React from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { C, R } from '../theme';

export function Btn({ title, onPress, variant = 'primary', small, disabled, busy, style, icon }) {
  const v = {
    primary: { bg: C.primary, fg: '#fff', bd: C.primary },
    ghost: { bg: '#fff', fg: C.primary, bd: C.line },
    danger: { bg: C.bad, fg: '#fff', bd: C.bad },
    call: { bg: C.ink, fg: '#fff', bd: C.ink },
    soft: { bg: C.soft, fg: C.primaryDark, bd: C.line }
  }[variant];
  const off = disabled || busy;
  return (
    <Pressable onPress={off ? undefined : onPress} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [s.btn, small && s.btnSm, { backgroundColor: v.bg, borderColor: v.bd, opacity: off ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {busy ? <ActivityIndicator color={v.fg} /> : <Text style={[s.btnT, small && { fontSize: 14 }, { color: v.fg }]}>{icon ? icon + '  ' : ''}{title}</Text>}
    </Pressable>
  );
}

export const Card = ({ children, style, tone }) => (
  <View style={[s.card, tone === 'warn' && { backgroundColor: C.warnBg, borderColor: '#F5D68A' }, tone === 'ok' && { backgroundColor: C.okBg, borderColor: '#B7E4D2' }, tone === 'bad' && { backgroundColor: C.badBg, borderColor: '#F7B4B4' }, style]}>{children}</View>
);

export const H = ({ children, style }) => <Text style={[s.h, style]} accessibilityRole="header">{children}</Text>;
export const P = ({ children, style, muted = true }) => <Text style={[s.p, !muted && { color: C.ink }, style]}>{children}</Text>;
export const Row = ({ children, style }) => <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }, style]}>{children}</View>;

export function Field({ label, error, style, ...rest }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#A79BB0" style={[s.input, error && { borderColor: C.bad }, style]} {...rest} />
      {error ? <Text style={s.err}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }}
      style={[s.chip, on && { backgroundColor: C.primary, borderColor: C.primary }]}>
      <Text style={[s.chipT, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export const Err = ({ children }) => (children ? <Text style={[s.err, { marginBottom: 10 }]} accessibilityLiveRegion="polite">{children}</Text> : null);

export function Check({ on, onChange, label }) {
  return (
    <Pressable onPress={() => onChange(!on)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginVertical: 6 }}>
      <View style={[s.box, on && { backgroundColor: C.primary, borderColor: C.primary }]}>{on ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}</View>
      <Text style={{ flex: 1, color: C.ink, fontSize: 15, lineHeight: 21 }}>{label}</Text>
    </Pressable>
  );
}

export function Segments({ items, value, onChange }) {
  return (
    <View style={s.seg}>
      {items.map(([k, label]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={[s.segI, value === k && { backgroundColor: C.primary }]} accessibilityRole="button" accessibilityState={{ selected: value === k }}>
          <Text style={[s.segT, value === k && { color: '#fff' }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 50, borderRadius: R.btn, borderWidth: 1.5, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnSm: { minHeight: 40, paddingHorizontal: 14, borderRadius: 12 },
  btnT: { fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: R.card, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 14 },
  h: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 6 },
  p: { fontSize: 15, lineHeight: 22, color: C.muted, marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: C.ink, backgroundColor: '#fff' },
  err: { color: C.bad, fontSize: 13, marginTop: 4, fontWeight: '600' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: C.line, backgroundColor: '#fff' },
  chipT: { color: C.ink, fontWeight: '600', fontSize: 14 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  seg: { flexDirection: 'row', backgroundColor: C.soft, borderRadius: 14, padding: 4, marginBottom: 14 },
  segI: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  segT: { fontWeight: '700', color: C.primaryDark, fontSize: 13 }
});
