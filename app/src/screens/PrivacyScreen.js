import React, { useState } from 'react';
import { View, Text, Image, Linking, Pressable } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { Btn, Card, H, P, Row, Field, Err, Check, Segments } from '../components/ui';
import { useApp } from '../state/AppContext';
import { makeT } from '../i18n';
import { api, errText } from '../api';
import { C } from '../theme';

export default function PrivacyScreen() {
  const { lang } = useApp();
  const t = makeT(lang);
  const [tab, setTab] = useState('scan');
  return (
    <View>
      <H>{t('privacyTitle')}</H>
      <Segments items={[['scan', t('scan')], ['pw', t('pwCheck')], ['photo', t('photoGuard')]]} value={tab} onChange={setTab} />
      {tab === 'scan' ? <Scan /> : tab === 'pw' ? <Password /> : <PhotoGuard />}
    </View>
  );
}

const open = (u) => Linking.openURL(u);

function Scan() {
  const { guard } = useApp();
  const [ok, setOk] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', username: '', city: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const run = async () => {
    setErr(''); setBusy(true);
    const r = await api('/scan', 'POST', { consent: true, ...f }, { timeout: 45000 });
    setBusy(false);
    if (!r.ok) return setErr(errText(r));
    setRes(r.j);
  };

  if (res) return (
    <View>
      <Card>
        <H style={{ fontSize: 18 }}>Data breaches (your account email)</H>
        {res.breach.status === 'found' ? <><Text style={{ color: C.bad, fontWeight: '700', marginBottom: 6 }}>Found in {res.breach.names.length} breach(es):</Text><Text style={{ color: C.ink }}>{res.breach.names.slice(0, 25).join(', ')}</Text><P style={{ marginTop: 8 }}>Change the password on those sites, and anywhere you reused it. Turn on two-step verification.</P></> :
          res.breach.status === 'clear' ? <Text style={{ color: C.ok, fontWeight: '700' }}>Not found in known breaches.</Text> : <P>Could not check right now.</P>}
      </Card>
      <Card>
        <H style={{ fontSize: 18 }}>Public profile photo</H>
        <Text style={{ color: res.gravatar.status === 'found' ? C.warn : C.ok, fontWeight: '700' }}>{res.gravatar.status === 'found' ? 'A public photo is linked to your email (Gravatar).' : res.gravatar.status === 'clear' ? 'None found.' : 'Could not check right now.'}</Text>
      </Card>
      {res.usernames.status !== 'skipped' && (
        <Card>
          <H style={{ fontSize: 18 }}>Username on public sites</H>
          {res.usernames.status === 'found' ? res.usernames.found.map((x) => (
            <Pressable key={x.site} onPress={() => guard(() => open(x.url))}><Text style={{ color: C.primary, fontWeight: '700', paddingVertical: 4 }}>{x.site}  ↗</Text></Pressable>
          )) : <Text style={{ color: res.usernames.status === 'clear' ? C.ok : C.muted, fontWeight: '700' }}>{res.usernames.status === 'clear' ? `Not found on ${res.usernames.checked} sites checked.` : 'Could not check right now.'}</Text>}
        </Card>
      )}
      <Card>
        <H style={{ fontSize: 18 }}>Web results about you</H>
        {res.search.status === 'skipped' ? <P style={{ marginBottom: 0 }}>Not checked. Add a name, phone, or ask the server owner to enable web search.</P> :
          res.search.status === 'found' ? res.search.items.map((x) => (
            <Pressable key={x.url} onPress={() => guard(() => open(x.url))} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={{ color: C.ink, fontWeight: '700' }} numberOfLines={2}>{x.title}</Text>
              <Text style={{ color: x.broker ? C.bad : C.muted }}>{x.domain}{x.broker ? ' · data broker site' : ''}{x.verified ? ' · mentions your detail' : ''}</Text>
            </Pressable>
          )) : <Text style={{ color: res.search.status === 'clear' ? C.ok : C.muted, fontWeight: '700' }}>{res.search.status === 'clear' ? 'Nothing found.' : 'Could not check right now.'}</Text>}
      </Card>
      <Card>
        <H style={{ fontSize: 18 }}>Check these yourself</H>
        <P>“Nothing found” only means these sources had no match. Also review:</P>
        <Row>
          <Btn small variant="ghost" title="Google: results about you" onPress={() => guard(() => open('https://myactivity.google.com/results-about-you'))} />
          <Btn small variant="ghost" title="Have I Been Pwned" onPress={() => guard(() => open('https://haveibeenpwned.com'))} />
        </Row>
        <P style={{ marginTop: 8 }}>Also look up your number in caller-ID apps, and set your social accounts to private.</P>
      </Card>
      <Btn title="Scan again" onPress={() => setRes(null)} />
    </View>
  );

  return (
    <View>
      <P>See what is publicly findable about you. Details are used once for the lookups and are not stored. Limited to 8 scans a day.</P>
      <Check on={ok} onChange={setOk} label="I confirm I am scanning only my own information. This tool must never be used to look up another person." />
      <View style={{ marginTop: 10 }}>
        <Field label="Full name (optional)" value={f.name} onChangeText={set('name')} />
        <Field label="Phone with country code (optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Field label="Username, for example Instagram (optional)" value={f.username} onChangeText={set('username')} autoCapitalize="none" />
        <Field label="City (optional)" value={f.city} onChangeText={set('city')} />
      </View>
      <Err>{err}</Err>
      <Btn title="Scan now" onPress={run} disabled={!ok} busy={busy} />
    </View>
  );
}

function Password() {
  const [pw, setPw] = useState('');
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setOut(null);
    const sha = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, pw)).toUpperCase();
    const r = await api('/pwned', 'POST', { prefix: sha.slice(0, 5) });
    setBusy(false);
    if (!r.ok) return setOut({ err: errText(r) });
    const line = String(r.j.text || '').split(/\r?\n/).find((l) => l.startsWith(sha.slice(5)));
    const n = line ? parseInt(line.split(':')[1], 10) : 0;
    setOut(n > 0 ? { bad: n } : { good: true });
  };
  return (
    <View>
      <P>Find out if a password has appeared in a known data leak. Only the first 5 characters of a scrambled copy leave your phone. Your password never does.</P>
      <Field label="Password" value={pw} onChangeText={(v) => { setPw(v); setOut(null); }} secureTextEntry autoCapitalize="none" />
      <Btn title="Check password" onPress={run} disabled={!pw} busy={busy} />
      {out && out.err ? <Err>{out.err}</Err> : null}
      {out && out.bad ? <Card tone="bad" style={{ marginTop: 12 }}><Text style={{ color: C.bad, fontWeight: '800' }}>Seen {out.bad.toLocaleString()} times in leaks. Do not use it. Change it anywhere you used it.</Text></Card> : null}
      {out && out.good ? <Card tone="ok" style={{ marginTop: 12 }}><Text style={{ color: C.ok, fontWeight: '800' }}>Not found in known leaks. Still use a different password for every account.</Text></Card> : null}
    </View>
  );
}

function PhotoGuard() {
  const { guard } = useApp();
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    const r = await guard(() => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], exif: true, quality: 1 }));
    if (r && !r.canceled) setImg(r.assets[0]);
  };
  const ex = (img && img.exif) || {};
  const gps = ex.GPSLatitude != null && ex.GPSLongitude != null;
  const when = ex.DateTimeOriginal || ex.DateTime;
  const device = [ex.Make, ex.Model].filter(Boolean).join(' ');
  const found = gps || when || device || ex.Software;
  const clean = async () => {
    setBusy(true);
    // Re-encoding the pixels into a new JPEG leaves the hidden metadata behind.
    const out = await ImageManipulator.manipulateAsync(img.uri, [], { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG });
    setBusy(false);
    await guard(() => Sharing.shareAsync(out.uri, { mimeType: 'image/jpeg', dialogTitle: 'Share clean photo' }));
  };
  return (
    <View>
      <P>Photos can hide where and when they were taken, and on which phone. Check a photo before you post or share it. It stays on your phone.</P>
      <Btn variant="soft" title="Choose a photo" onPress={pick} />
      {img && (
        <View style={{ marginTop: 14 }}>
          <Image source={{ uri: img.uri }} style={{ width: '100%', height: 220, borderRadius: 16, resizeMode: 'cover' }} />
          <Card tone={found ? 'warn' : 'ok'} style={{ marginTop: 12 }}>
            {found ? <>
              <Text style={{ fontWeight: '800', color: C.warn, marginBottom: 6 }}>Hidden details found</Text>
              {gps ? <Text style={{ color: C.ink }}>📍 Exact location is stored in this photo</Text> : null}
              {when ? <Text style={{ color: C.ink }}>🕒 Taken: {String(when)}</Text> : null}
              {device ? <Text style={{ color: C.ink }}>📱 Device: {device}</Text> : null}
              {ex.Software ? <Text style={{ color: C.ink }}>⚙️ Software: {String(ex.Software)}</Text> : null}
            </> : <Text style={{ color: C.ok, fontWeight: '800' }}>No hidden location or device details were readable.</Text>}
          </Card>
          <Btn title="Share a clean copy" onPress={clean} busy={busy} />
        </View>
      )}
    </View>
  );
}
