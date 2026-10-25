import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Linking, Alert, Share } from 'react-native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import * as Clipboard from 'expo-clipboard';
import { Btn, Card, H, P, Row, Chip, Check, Err } from '../components/ui';
import ContactsCard from '../components/ContactsCard';
import BluetoothCard from '../components/BluetoothCard';
import { useApp } from '../state/AppContext';
import { useSos } from '../state/Sos';
import { makeT } from '../i18n';
import { trackLink } from '../config';
import { useNow, fmtLeft, accQuality } from '../util';
import { C } from '../theme';

const DURATIONS = [[30, '30 min'], [60, '1 hour'], [120, '2 hours'], [240, '4 hours'], [480, '8 hours'], [720, '12 hours']];

export default function SosScreen({ goTab }) {
  const { lang, user, contacts, disguise, guard } = useApp();
  const t = makeT(lang);
  const S = useSos();
  const { sos } = S;
  const call = (n) => guard(() => Linking.openURL('tel:' + n));

  return (
    <View>
      {S.notice ? <Card tone="ok"><P muted={false}>{S.notice}</P><Btn small variant="ghost" title="OK" onPress={() => S.setNotice('')} /></Card> : null}
      <Card tone="bad" style={{ backgroundColor: C.soft }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 150 }}>
            <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16 }}>In danger right now?</Text>
            <Text style={{ color: C.muted }}>Call for help first.</Text>
          </View>
          <Btn variant="call" small title={t('call112')} onPress={() => call('112')} />
          <Btn variant="ghost" small title={t('call181')} onPress={() => call('181')} />
        </Row>
      </Card>
      {sos ? <ActiveView t={t} call={call} /> : <IdleView t={t} goTab={goTab} />}
    </View>
  );
}

function IdleView({ t, goTab }) {
  const { user, contacts, disguise, guard } = useApp();
  const S = useSos();
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [consent, setConsent] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [mins, setMins] = useState(120);
  const [tick, setTick] = useState(false);
  const [bgOk, setBgOk] = useState(true);
  const timer = useRef(null);

  useEffect(() => { Location.getBackgroundPermissionsAsync().then((p) => setBgOk(p.granted)).catch(() => {}); return () => clearInterval(timer.current); }, []);

  const fire = async () => {
    setBusy(true); setMsg('');
    const r = await S.startSos('sos', 240);
    if (!r.ok) {
      if (r.network) {
        const f = await S.smsFallback(user && user.name);
        setMsg(f.ok ? 'Could not reach the server, so nobody has been alerted yet. Press Send in the SMS app to alert your contacts. Then call 112 if you are in danger.' : f.error);
      } else setMsg(r.error);
    }
    setBusy(false); setCount(null);
  };
  const begin = () => {
    setMsg(''); let n = 5; setCount(n);
    clearInterval(timer.current);
    timer.current = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(timer.current); fire(); } else setCount(n); }, 1000);
  };
  const cancel = () => { clearInterval(timer.current); setCount(null); };

  const share = async () => {
    setMsg(''); setBusy(true);
    const r = await S.startSos('share', mins);
    setBusy(false);
    if (!r.ok) setMsg(r.error); else { setShowShare(false); setConsent(false); }
  };

  const enableBg = async () => {
    await guard(async () => {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.granted) { const bg = await Location.requestBackgroundPermissionsAsync(); setBgOk(bg.granted); }
    });
  };

  return (
    <View>
      <View style={{ alignItems: 'center', marginVertical: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink, textAlign: 'center' }}>{t('sosHeadline')}</Text>
        <P style={{ textAlign: 'center', marginTop: 4 }}>{t('sosHint')}</P>
        <Pressable onPress={count == null && !busy ? begin : undefined} accessibilityRole="button" accessibilityLabel="SOS emergency button"
          style={({ pressed }) => ({ width: 190, height: 190, borderRadius: 95, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 10, borderColor: '#FFC2D4', opacity: pressed ? 0.85 : 1, elevation: 6, shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 14 })}>
          <Text style={{ color: '#fff', fontSize: count != null ? 64 : 44, fontWeight: '900' }}>{count != null ? count : t('sosBtn')}</Text>
        </Pressable>
        {count != null && (
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={{ color: C.ink, fontWeight: '700', textAlign: 'center', marginBottom: 10 }}>{t('sendingIn')} {count}… Anyone with the link can see your live location.</Text>
            <Btn variant="ghost" title={t('cancelIt')} onPress={cancel} />
          </View>
        )}
        {busy && count == null ? <Text style={{ marginTop: 12, color: C.muted }}>Sending…</Text> : null}
      </View>
      <Err>{msg}</Err>
      {S.geoErr ? <Card tone="warn"><P muted={false}>{S.geoErr}</P></Card> : null}

      {!showShare ? (
        <Btn variant="soft" title={'📍  ' + t('shareLive')} onPress={() => setShowShare(true)} style={{ marginBottom: 14 }} />
      ) : (
        <Card>
          <H style={{ fontSize: 18 }}>{t('shareLive')}</H>
          <P>A link is created. Anyone who has it can see your live location and name until it expires or you stop. The app does not send the link for you.</P>
          <Row style={{ marginBottom: 8 }}>{DURATIONS.map(([m, l]) => <Chip key={m} label={l} on={mins === m} onPress={() => setMins(m)} />)}</Row>
          <Check on={consent} onChange={setConsent} label="I understand and want to share my live location." />
          <Row style={{ marginTop: 8 }}>
            <Btn title="Start sharing" onPress={share} disabled={!consent} busy={busy} />
            <Btn variant="ghost" title={t('cancel')} onPress={() => setShowShare(false)} />
          </Row>
        </Card>
      )}

      {!bgOk && (
        <Card>
          <H style={{ fontSize: 17 }}>Keep sharing when the screen is off</H>
          <P>Allow location “all the time” so your contacts still see you if you lock your phone or open another app. It only runs during an SOS or when you start sharing.</P>
          <Btn small variant="soft" title="Allow in settings" onPress={enableBg} />
        </Card>
      )}

      <ContactsCard />
      <BluetoothCard />

      {!disguise.on && (
        <Card>
          <H style={{ fontSize: 17 }}>🧮  Hide this app</H>
          <P>Make SafeHer open as a normal calculator so nobody knows it is here.</P>
          <Btn small variant="soft" title="Set up calculator disguise" onPress={() => goTab('me')} />
        </Card>
      )}
    </View>
  );
}

function ActiveView({ t, call }) {
  const { user, contacts, guard } = useApp();
  const S = useSos();
  const { sos, fix, fail, lastOk } = S;
  const now = useNow(1000);
  const [state, setState] = useState({}); // contactId -> 'opened' | 'confirmed'
  const [err, setErr] = useState('');
  const text = S.alertText(user && user.name);
  const link = trackLink(sos.token);
  const [q, qLabel] = accQuality(fix && fix.acc);
  const seen = sos.views > 0;
  const watching = sos.last_view_at && now - Date.parse(sos.last_view_at) < 30000;

  const mark = (id, v) => setState((s) => ({ ...s, [id]: v }));
  const viaWhatsApp = (c) => { mark(c.id, 'opened'); guard(() => Linking.openURL(`https://wa.me/${c.phone.replace('+', '')}?text=${encodeURIComponent(text)}`)); };
  const viaSms = async (list) => {
    list.forEach((c) => mark(c.id, 'opened'));
    await guard(async () => {
      if (await SMS.isAvailableAsync()) {
        const r = await SMS.sendSMSAsync(list.map((c) => c.phone), text);
        if (r.result === 'sent') list.forEach((c) => mark(c.id, 'confirmed'));
      } else Linking.openURL(`sms:${list.map((c) => c.phone).join(',')}?body=${encodeURIComponent(text)}`);
    });
  };
  const statusOf = (c) => state[c.id] === 'confirmed' ? ['✅ You confirmed it was sent', C.ok] : state[c.id] === 'opened' ? ['Opened. Not sent until you press Send there.', C.warn] : ['Not sent yet', C.bad];

  return (
    <View>
      <Card tone={sos.kind === 'sos' ? 'bad' : 'ok'}>
        <H>{sos.kind === 'sos' ? '🚨 SOS is on' : '📍 ' + t('sharingOn')}</H>
        <Text style={{ color: C.ink, fontSize: 15, lineHeight: 24 }}>
          Time left: <Text style={{ fontWeight: '800' }}>{fmtLeft(Date.parse(sos.expires_at) - now)}</Text>{'\n'}
          Server: <Text style={{ fontWeight: '800', color: fail ? C.bad : C.ok }}>{fail ? `not reaching the server (${fail} tries, retrying)` : lastOk ? 'working' : 'connecting…'}</Text>{'\n'}
          Location accuracy: <Text style={{ fontWeight: '800', color: q === 'good' ? C.ok : q === 'fair' ? C.warn : C.bad }}>{qLabel}</Text>{'\n'}
          Link opened by someone: <Text style={{ fontWeight: '800' }}>{seen ? (watching ? 'Yes, watching now' : 'Yes') : 'Not yet'}</Text>
        </Text>
        {S.geoErr ? <Text style={{ color: C.bad, marginTop: 6, fontWeight: '600' }}>{S.geoErr}</Text> : null}
        {fail ? <Row style={{ marginTop: 10 }}><Btn small variant="ghost" title="Retry now" onPress={S.pushLoc} /><Btn small variant="ghost" title="Send my location by SMS" onPress={() => S.smsFallback(user && user.name)} /></Row> : null}
      </Card>

      <Card>
        <H style={{ fontSize: 18 }}>Alert your contacts</H>
        <P>Tap a button, then press Send in that app. We can only mark a message as sent when you confirm it.</P>
        {contacts.length === 0 ? <P>No contacts saved. Share the link below.</P> : (
          <>
            {contacts.map((c) => { const [label, col] = statusOf(c); return (
              <View key={c.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
                <Row style={{ justifyContent: 'space-between' }}><Text style={{ fontWeight: '700', color: C.ink, fontSize: 16 }}>{c.name}</Text><Text style={{ color: col, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{label}</Text></Row>
                <Row style={{ marginTop: 8 }}>
                  <Btn small title={t('whatsapp')} onPress={() => viaWhatsApp(c)} />
                  <Btn small variant="ghost" title={t('sms')} onPress={() => viaSms([c])} />
                  {state[c.id] === 'opened' ? <Btn small variant="soft" title="I pressed Send" onPress={() => mark(c.id, 'confirmed')} /> : null}
                </Row>
              </View>
            ); })}
            <Btn variant="soft" title="Text everyone at once (SMS)" onPress={() => viaSms(contacts)} style={{ marginTop: 10 }} />
          </>
        )}
      </Card>

      <Card>
        <H style={{ fontSize: 18 }}>Tracking link</H>
        <Text selectable style={{ color: C.muted, marginBottom: 10 }}>{link}</Text>
        <Row>
          <Btn small variant="ghost" title={t('shareLink')} onPress={() => guard(() => Share.share({ message: text }))} />
          <Btn small variant="ghost" title="Copy" onPress={() => Clipboard.setStringAsync(text)} />
          <Btn small variant="ghost" title={t('add30')} onPress={async () => setErr(await S.extend())} />
        </Row>
        <Err>{err}</Err>
      </Card>

      <BluetoothCard />

      <Row style={{ marginBottom: 14 }}>
        <Btn variant="call" title={t('call112')} onPress={() => call('112')} />
        <Btn variant="ghost" title={t('call181')} onPress={() => call('181')} />
      </Row>
      <Btn variant="danger" title={t('imSafe')} onPress={() => sos.kind === 'sos'
        ? Alert.alert('Stop the SOS?', 'Your contacts will no longer see your location.', [{ text: t('cancel'), style: 'cancel' }, { text: t('stop'), style: 'destructive', onPress: S.stop }])
        : S.stop()} />
    </View>
  );
}
