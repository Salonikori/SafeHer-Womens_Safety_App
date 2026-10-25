import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../state/AppContext';

// Small recursive-descent evaluator (no eval). Supports + - * / ( ) and postfix %.
function evalExpr(s) {
  let i = 0;
  const num = () => { const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
  const fac = () => {
    let v;
    if (s[i] === '-') { i++; v = -fac(); }
    else if (s[i] === '+') { i++; v = fac(); }
    else if (s[i] === '(') { i++; v = expr(); if (s[i++] !== ')') throw 0; }
    else v = num();
    while (s[i] === '%') { i++; v /= 100; }
    return v;
  };
  const term = () => { let v = fac(); while (s[i] === '*' || s[i] === '/') { const o = s[i++], r = fac(); v = o === '*' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (s[i] === '+' || s[i] === '-') { const o = s[i++], r = term(); v = o === '+' ? v + r : v - r; } return v; };
  const v = expr();
  if (i !== s.length || !isFinite(v)) throw 0;
  return v;
}
const pretty = (x) => x.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
const KEYS = [
  ['C', '( )', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', 'B', '=']
];
const LABEL = { '/': '÷', '*': '×', '-': '−', B: '⌫' };

export default function CalculatorScreen() {
  const { checkCode, unlock } = useApp();
  const { width } = useWindowDimensions();
  const [expr, setExpr] = useState('');
  const [shown, setShown] = useState('0');
  const [off, setOff] = useState(false);
  const size = Math.min(84, (width - 5 * 12) / 4);

  const show = (e) => { setExpr(e); setShown(pretty(e || '0')); };

  const press = async (k) => {
    if (k === 'C') return show('');
    if (k === 'B') return show(expr === 'Error' ? '' : expr.slice(0, -1));
    let cur = expr === 'Error' ? '' : expr;
    if (k === '=') {
      // The secret code opens the real app; anything else is just a calculation.
      if (/^\d{4,8}$/.test(cur) && (await checkCode(cur))) { show(''); unlock(); return; }
      if (!cur) return;
      try { return show(String(+evalExpr(cur).toPrecision(12))); } catch { return show('Error'); }
    }
    if (k === '( )') {
      const open = (cur.match(/\(/g) || []).length - (cur.match(/\)/g) || []).length;
      const last = cur.slice(-1);
      if (open > 0 && /[\d)%]/.test(last)) return show(cur + ')');
      return show(cur + (/[\d)%]/.test(last) ? '*(' : '('));
    }
    if (/[+*/-]/.test(k) && /[+*/-]$/.test(cur) && cur.length > 1) cur = cur.slice(0, -1); // replace the operator
    show(cur + k);
  };

  const style = (k) => {
    if (['/', '*', '-', '+', '='].includes(k)) return { bg: '#F2B84B', fg: '#1B1424' };
    if (['C', '( )', '%'].includes(k)) return { bg: '#A5A5A5', fg: '#000' };
    return { bg: '#333333', fg: '#fff' };
  };

  if (off) {
    return (
      <Pressable style={s.off} onLongPress={() => setOff(false)} delayLongPress={2500} accessibilityLabel="Screen off">
        <StatusBar hidden />
        <View style={s.offIcon}><View style={s.offTop} /><View style={s.offArc} /></View>
        <Text style={{ fontSize: 20, color: '#D0D0D0', fontWeight: '500' }}>Power off</Text>
        <Text style={{ fontSize: 13, color: '#777', marginTop: 8 }}>Device is shutting down…</Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={s.root} accessibilityLabel="Calculator">
      <StatusBar style="light" />
      <View style={s.disp}>
        <Text style={[s.dispT, { fontSize: shown.length > 12 ? 40 : shown.length > 8 ? 56 : 76 }]} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="text">{shown}</Text>
      </View>
      {KEYS.map((row, r) => (
        <View key={r} style={s.row}>
          {row.map((k) => {
            const st = style(k);
            return (
              <Pressable key={k} onPress={() => press(k)} onLongPress={k === 'C' ? () => setOff(true) : undefined} delayLongPress={900} accessibilityRole="button" accessibilityLabel={LABEL[k] || k}
                style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: st.bg, opacity: pressed ? 0.7 : 1 }, s.key]}>
                <Text style={{ color: st.fg, fontSize: k === 'B' ? 26 : 32 }}>{LABEL[k] || k}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 6, paddingBottom: 8 },
  disp: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 12 },
  dispT: { color: '#fff', fontWeight: '300' },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  key: { alignItems: 'center', justifyContent: 'center' },
  off: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  offIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  offTop: { position: 'absolute', top: 0, width: 5, height: 29, backgroundColor: '#B8B8B8', borderRadius: 3, zIndex: 2 },
  offArc: { width: 54, height: 54, borderWidth: 5, borderColor: '#B8B8B8', borderTopColor: 'transparent', borderRadius: 30, transform: [{ rotate: '-45deg' }] }
});
