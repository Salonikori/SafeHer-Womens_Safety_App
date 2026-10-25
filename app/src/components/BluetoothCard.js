import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Btn, Card, H, P, Row } from './ui';
import { scanPeers, relayPayload, stopScanNow, bleAvailable } from '../lib/ble';
import { useSos } from '../state/Sos';
import { useApp } from '../state/AppContext';
import { trackLink } from '../config';
import { C } from '../theme';

// Experimental nearby relay: hands your SOS to another phone running a SafeHer-compatible receiver. Works with no internet.
export default function BluetoothCard() {
  const S = useSos();
  const { user } = useApp();
  const [peers, setPeers] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const stopRef = useRef(null);

  useEffect(() => () => { stopScanNow(); }, []);

  const scan = async () => {
    setMsg(''); setPeers([]); setScanning(true);
    try {
      stopRef.current = await scanPeers(
        (p) => setPeers((old) => (old.some((x) => x.id === p.id) ? old : [...old, p])),
        12000,
        () => { setScanning(false); setMsg((m) => m || 'Scan finished.'); }
      );
    } catch (e) { setScanning(false); setMsg(e.message || 'Could not start scanning.'); }
  };
  const stop = () => { stopRef.current && stopRef.current(); };

  const build = async () => {
    const f = (S.fix && Date.now() - S.fix.at < 60000 ? S.fix : null) || (await S.getPosition());
    return {
      app: 'SafeHer', v: 1, type: 'SOS', time: new Date().toISOString(), name: (user && user.name) || '',
      lat: f ? f.lat : null, lon: f ? f.lon : null, acc: f && f.acc ? Math.round(f.acc) : null,
      map: f ? `https://maps.google.com/?q=${f.lat},${f.lon}` : null,
      track: S.sos ? trackLink(S.sos.token) : null,
      message: 'I may need help. Please contact me and check my location.'
    };
  };

  const send = async (p) => {
    setBusyId(p.id); setMsg('');
    try {
      await relayPayload(p.id, await build());
      Alert.alert('Sent to nearby device', `The SOS was written to ${p.name || 'the nearby device'}. That only means this device received it. It does not mean a person or emergency service has seen it.`);
    } catch (e) { Alert.alert('Relay failed', (e && e.message) || 'That device may not support the SafeHer SOS protocol.'); }
    setBusyId(null);
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H style={{ fontSize: 18, marginBottom: 0 }}>Nearby relay (Bluetooth)</H>
        <Text style={{ fontSize: 11, fontWeight: '800', color: scanning ? C.warn : C.muted }}>{scanning ? 'SCANNING' : 'EXPERIMENTAL'}</Text>
      </Row>
      <P style={{ marginTop: 6 }}>No internet needed. Finds phones nearby that run a SafeHer receiver and hands them your SOS and location. It only works when the other phone is set up to receive.</P>
      {!bleAvailable() ? <P style={{ color: C.warn }}>Bluetooth is not available in this build. Install the development build to use it.</P> : (
        <Btn variant="soft" title={scanning ? 'Stop scanning' : 'Find nearby SafeHer devices'} onPress={scanning ? stop : scan} />
      )}
      {peers.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line, marginTop: 10, gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: C.ink }}>{p.name || 'SafeHer device'}</Text>
            <Text style={{ fontSize: 11, color: C.muted }}>{p.id}</Text>
          </View>
          <Btn small title="Relay SOS" busy={busyId === p.id} onPress={() => send(p)} />
        </View>
      ))}
      {msg ? <P style={{ marginTop: 8, marginBottom: 0 }}>{msg}</P> : null}
    </Card>
  );
}
