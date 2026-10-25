import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import * as SMS from 'expo-sms';
import { Btn, Card, H, P, Field, Err, Segments, Row } from '../components/ui';
import RouteMap from '../components/RouteMap';
import { useApp } from '../state/AppContext';
import { useSos } from '../state/Sos';
import { makeT } from '../i18n';
import { geocodePlace, getLiveWalkingRoutes, rankRoutes, routeLink, fmtDistance, fmtDuration } from '../lib/liveRoutes';
import { C } from '../theme';

export default function RoutesScreen({ goTab }) {
  const { lang, contacts, user, guard } = useApp();
  const t = makeT(lang);
  const S = useSos();
  const [origin, setOrigin] = useState('Current location');
  const [dest, setDest] = useState('');
  const [mode, setMode] = useState('safe');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);   // { routes, sourceTime, origin, destination }
  const [pick, setPick] = useState(null);       // user-chosen route id, else the top-ranked one

  const ranked = useMemo(() => (result ? rankRoutes(result.routes, mode) : []), [result, mode]);
  const selected = ranked.find((r) => r.id === pick) || ranked[0];

  const find = async () => {
    setErr('');
    if (!dest.trim()) return setErr('Enter a destination first.');
    setBusy(true); setResult(null); setPick(null);
    try {
      let start, near = null;
      const useGps = !origin.trim() || origin.trim().toLowerCase() === 'current location';
      const f = S.fix || (await S.getPosition()); if (f) near = { lat: f.lat, lon: f.lon };
      if (useGps) {
        if (!near) throw new Error(S.geoErr || 'Could not get your location. Turn on GPS and allow location, or type a starting place.');
        start = { lat: near.lat, lon: near.lon, label: 'Current location' };
      } else start = await geocodePlace(origin.trim(), near);
      const end = await geocodePlace(dest.trim(), near);
      setResult(await getLiveWalkingRoutes(start, end));
    } catch (e) { setErr(e.message || 'Live route data could not be loaded.'); }
    setBusy(false);
  };

  const open = () => selected && Linking.openURL(routeLink(result.origin, result.destination));
  const textContacts = async () => {
    if (!contacts.length) return setErr('No saved contacts yet. Add them on the SOS tab.');
    const text = `${user && user.name ? user.name + ': ' : ''}I am walking to ${dest.trim()} (${fmtDistance(selected.distanceMeters)}, about ${fmtDuration(selected.durationSeconds)}). Route: ${routeLink(result.origin, result.destination)}`;
    const nums = contacts.map((c) => c.phone);
    await guard(async () => {
      if (await SMS.isAvailableAsync()) await SMS.sendSMSAsync(nums, text);
      else await Linking.openURL(`sms:${nums.join(',')}?body=${encodeURIComponent(text)}`);
    });
  };

  return (
    <View>
      <H>{t('routesTitle')}</H>
      <P>{t('routesHint')}</P>
      <Field label="Starting point" value={origin} onChangeText={setOrigin} placeholder="Current location" />
      <Field label="Destination" value={dest} onChangeText={setDest} placeholder="Address, landmark or place" returnKeyType="search" onSubmitEditing={find} />
      <Btn title="Find live walking routes" onPress={find} busy={busy} style={{ marginBottom: 12 }} />
      <Segments items={[['safe', '🛡  Most amenities'], ['fast', '➜  Fastest']]} value={mode} onChange={(m) => { setMode(m); setPick(null); }} />
      <Err>{err}</Err>

      {selected ? (
        <>
          <Card>
            <RouteMap routes={ranked} selectedId={selected.id} />
            <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.ink }}>{fmtDistance(selected.distanceMeters)} · about {fmtDuration(selected.durationSeconds)}</Text>
                <Text style={{ color: C.muted, marginTop: 2 }}>{mode === 'fast' ? 'Fastest of the routes found' : 'Most mapped amenities nearby'}</Text>
              </View>
              <View style={{ alignItems: 'center', backgroundColor: C.okBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, minWidth: 84 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: C.ok }}>{selected.safetySignal === null ? '—' : selected.safetySignal}</Text>
                <Text style={{ fontSize: 9, fontWeight: '800', color: C.ok }}>{selected.safetySignal === null ? 'UNKNOWN' : 'AMENITY SIGNAL'}</Text>
              </View>
            </Row>
            <P style={{ marginTop: 10 }}>{selected.dataNote}</P>
            {selected.amenityCounts ? <P muted={false}>Police stations nearby: {selected.amenityCounts.police} · Shops and services nearby: {selected.amenityCounts.shopsAndServices}</P> : null}
            <Row>
              <Btn small title="Open in OpenStreetMap" onPress={open} />
              <Btn small variant="ghost" title="Text route to contacts" onPress={textContacts} />
              <Btn small variant="soft" title="Share live location" onPress={() => goTab('sos')} />
            </Row>
            {pick && ranked[0] && pick !== ranked[0].id ? <P style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>The OpenStreetMap link opens its own suggested walking route, which may differ slightly from the alternative you picked.</P> : null}
          </Card>

          {ranked.length > 1 ? (
            <Card>
              <H style={{ fontSize: 17 }}>Other routes found</H>
              {ranked.map((r, i) => (
                <Pressable key={r.id} onPress={() => setPick(r.id)} accessibilityRole="button" accessibilityState={{ selected: r.id === selected.id }}
                  style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: r.id === selected.id ? C.primary : '#C9B8C4' }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: C.ink }}>Route {i + 1} · {fmtDistance(r.distanceMeters)} · {fmtDuration(r.durationSeconds)}</Text>
                    <Text style={{ fontSize: 12, color: C.muted }}>Police {r.amenityCounts ? r.amenityCounts.police : 'unknown'} · Shops/services {r.amenityCounts ? r.amenityCounts.shopsAndServices : 'unknown'}</Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : null}
          <Text style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Updated {new Date(result.sourceTime).toLocaleTimeString()} · © OpenStreetMap contributors</Text>
        </>
      ) : null}

      <Card tone="warn">
        <P muted={false} style={{ marginBottom: 0, fontSize: 13 }}>This is not a safety rating. The signal only counts mapped police stations and shops near the path. Street lighting, crowds, opening hours and incidents are not available, so they are not shown. Keep to routes you know and trust your judgement.</P>
      </Card>
    </View>
  );
}
