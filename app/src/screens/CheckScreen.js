import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import MC from '../lib/msgcheck';
import { Btn, Card, H, P, Row, Field, Check } from '../components/ui';
import { useApp } from '../state/AppContext';
import { makeT } from '../i18n';
import { api } from '../api';
import { getItem, setItem } from '../storage';
import { C } from '../theme';

const LVL = {
  high: { k: 'lvlHigh', bg: C.badBg, fg: C.bad, icon: '🚫' },
  med: { k: 'lvlMed', bg: C.warnBg, fg: C.warn, icon: '⚠️' },
  low: { k: 'lvlLow', bg: C.warnBg, fg: C.warn, icon: '🟡' },
  none: { k: 'lvlNone', bg: C.okBg, fg: C.ok, icon: '✅' }
};

export default function CheckScreen() {
  const { lang } = useApp();
  const t = makeT(lang);
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const [muted, setMuted] = useState([]);
  const [fb, setFb] = useState({ sent: false, incl: false });

  useEffect(() => { getItem('muted', []).then(setMuted); }, []);

  const run = (m = muted) => { setRes(MC.analyze(text, { muted: m })); setFb({ sent: false, incl: false }); };
  const mute = (id) => { const m = [...new Set([...muted, id])]; setMuted(m); setItem('muted', m); api('/feedback', 'POST', { verdict: 'false_alarm', level: res.level, rules: [id], lang: res.lang }); setRes(MC.analyze(text, { muted: m })); };
  const send = async (verdict) => {
    await api('/feedback', 'POST', { verdict, level: res.level, rules: res.hits.map((h) => h.id), lang: res.lang, include_text: fb.incl, text: fb.incl ? text : '' });
    setFb((f) => ({ ...f, sent: true }));
  };

  // Split the message into plain and highlighted pieces using the engine's marks.
  const pieces = () => {
    const out = []; let p = 0;
    res.marks.forEach((m, i) => {
      if (m.s > p) out.push(<Text key={'a' + i}>{text.slice(p, m.s)}</Text>);
      out.push(<Text key={'m' + i} style={{ backgroundColor: m.w >= 3 ? '#F9A8A8' : '#FDE68A', fontWeight: '700' }}>{text.slice(m.s, m.e)}<Text style={{ fontSize: 11, color: C.bad }}> [{m.ids.map((x) => x + 1).join(',')}]</Text></Text>);
      p = m.e;
    });
    if (p < text.length) out.push(<Text key="z">{text.slice(p)}</Text>);
    return out;
  };

  const L = res && LVL[res.level];
  const links = res ? MC.links(text) : [];

  return (
    <View>
      <H>{t('checkTitle')}</H>
      <P>{t('checkHint')}</P>
      <Field value={text} onChangeText={(v) => { setText(v); setRes(null); }} multiline placeholder="…" style={{ minHeight: 140, textAlignVertical: 'top' }} />
      <Row style={{ marginBottom: 14 }}>
        <Btn variant="ghost" small title={t('paste')} onPress={async () => { const s = await Clipboard.getStringAsync(); if (s) { setText(s); setRes(null); } }} />
        <Btn variant="ghost" small title={t('clear')} onPress={() => { setText(''); setRes(null); }} />
        <Btn title={t('checkBtn')} onPress={() => run()} disabled={!text.trim()} style={{ flex: 1 }} />
      </Row>

      {res && (
        <>
          <Card style={{ backgroundColor: L.bg, borderColor: L.bg }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: L.fg }}>{L.icon}  {t(L.k)}</Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>Message language: {({ en: 'English', hi: 'Hindi', mr: 'Marathi', hinglish: 'Hinglish' })[res.lang]}</Text>
          </Card>
          {res.hits.length > 0 && (
            <Card>
              <Text style={{ fontSize: 16, lineHeight: 24, color: C.ink }}>{pieces()}</Text>
            </Card>
          )}
          {res.hits.map((h, i) => (
            <Card key={h.id}>
              <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 4 }}>{i + 1}. {MC.CATS[h.cat][lang] || MC.CATS[h.cat].en}</Text>
              <Text style={{ color: C.ink, lineHeight: 22 }}>{h.msg[lang] || h.msg.en}</Text>
              <Btn small variant="ghost" title="Not a problem" onPress={() => mute(h.id)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </Card>
          ))}
          {links.length > 0 && (
            <Card>
              <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 6 }}>Links in this message</Text>
              {links.map((l) => <Text key={l} selectable style={{ color: C.bad, marginBottom: 3 }}>{l}</Text>)}
              <P style={{ marginTop: 6 }}>Do not open links you were not expecting. Check the real domain carefully.</P>
            </Card>
          )}
          <Card>
            <Text style={{ fontWeight: '800', color: C.ink, marginBottom: 8 }}>Was this result right?</Text>
            {fb.sent ? <Text style={{ color: C.ok, fontWeight: '700' }}>Thank you. This helps improve the checker.</Text> : (
              <>
                <Row>
                  <Btn small variant="ghost" title="Yes" onPress={() => send('correct')} />
                  <Btn small variant="ghost" title="No, it is a scam" onPress={() => send('missed_scam')} />
                  <Btn small variant="ghost" title="No, it is safe" onPress={() => send('false_alarm')} />
                </Row>
                <Check on={fb.incl} onChange={(v) => setFb((f) => ({ ...f, incl: v }))} label="Include the message text with my feedback (off by default)" />
              </>
            )}
          </Card>
          <P style={{ fontSize: 13 }}>This checker is a guide, not a guarantee. It can miss new scams and can flag real messages. When unsure, call the company on its official number.</P>
        </>
      )}
    </View>
  );
}
