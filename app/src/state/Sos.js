import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Linking } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SMS from 'expo-sms';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { api, loadToken, errText } from '../api';
import { getItem, setItem, delItem } from '../storage';
import { trackLink } from '../config';
import { useApp } from './AppContext';

// Background location: keeps sharing while the screen is off. Must be defined at module load.
const BG_TASK = 'safeher-bg-location';
TaskManager.defineTask(BG_TASK, async ({ data, error }) => {
  if (error || !data || !data.locations || !data.locations.length) return;
  const st = await getItem('sos_bg');
  if (!st) return;
  const p = data.locations[data.locations.length - 1].coords;
  await loadToken();
  await api(`/sos/${st.id}/loc`, 'POST', { lat: p.latitude, lon: p.longitude, acc: p.accuracy }, { onUnauthorized: false });
});

const Ctx = createContext(null);
export const useSos = () => useContext(Ctx);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

export function SosProvider({ children }) {
  const { user, contacts, disguise, sosActiveRef, guard } = useApp();
  const [sos, setSos] = useState(null);        // { id, token, kind, expires_at, views, last_view_at }
  const [fix, setFix] = useState(null);        // { lat, lon, acc, at }
  const [geoErr, setGeoErr] = useState('');
  const [fail, setFail] = useState(0);
  const [lastOk, setLastOk] = useState(null);
  const [notice, setNotice] = useState('');
  const sosRef = useRef(null), fixRef = useRef(null), watchRef = useRef(null), timerRef = useRef(null);
  sosRef.current = sos;
  sosActiveRef.current = !!sos;

  const setFixBoth = (f) => { fixRef.current = f; setFix(f); };

  const getPosition = useCallback(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { setGeoErr('Location permission is off. Turn it on in your phone settings so contacts can see where you are.'); return null; }
    try {
      let p = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 9000);
      if (!p) p = await Location.getLastKnownPositionAsync();
      if (!p) { setGeoErr('Could not get your location yet. Try moving near a window or outdoors.'); return null; }
      const f = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() };
      setFixBoth(f); setGeoErr(''); return f;
    } catch { setGeoErr('Location is unavailable. Check that GPS is on.'); return null; }
  }, []);

  const pushLoc = useCallback(async () => {
    const cur = sosRef.current;
    if (!cur) return;
    const f = fixRef.current;
    const r = await api(`/sos/${cur.id}/loc`, 'POST', f ? { lat: f.lat, lon: f.lon, acc: f.acc } : {});
    if (r.ok) {
      setFail(0); setLastOk(Date.now());
      setSos((s) => (s ? { ...s, views: r.j.views || 0, last_view_at: r.j.last_view_at || null, expires_at: r.j.expires_at || s.expires_at } : s));
    } else if (r.status === 404) {
      await stopTracking(); setSos(null);
      setNotice(r.j.error === 'Sharing time ended' ? 'Sharing time ended. Your link is closed and your location points were deleted.' : 'Sharing has stopped.');
    } else setFail((n) => n + 1);
  }, []);

  const stopTracking = useCallback(async () => {
    clearInterval(timerRef.current); timerRef.current = null;
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null; }
    try { if (await Location.hasStartedLocationUpdatesAsync(BG_TASK)) await Location.stopLocationUpdatesAsync(BG_TASK); } catch {}
    await delItem('sos_bg'); deactivateKeepAwake();
  }, []);

  const startTracking = useCallback(async (id) => {
    await setItem('sos_bg', { id });
    activateKeepAwakeAsync();
    try {
      watchRef.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 0 },
        (p) => { setFixBoth({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }); setGeoErr(''); });
    } catch { setGeoErr('Location is unavailable. Check that GPS is on.'); }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(pushLoc, 10000);
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.granted) {
        await Location.startLocationUpdatesAsync(BG_TASK, {
          accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 0, pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          foregroundService: { notificationTitle: disguise.on ? 'Calculator' : 'SafeHer', notificationBody: 'Running', notificationColor: '#E11D52' }
        });
      }
    } catch {}
  }, [pushLoc, disguise.on]);

  // Resume if sharing was still on when the app was reopened or the user signed in.
  useEffect(() => {
    if (!user) { stopTracking(); setSos(null); return; }
    (async () => {
      const r = await api('/sos/active');
      if (r.ok && r.j.sos) { setSos(r.j.sos); startTracking(r.j.sos.id); }
    })();
  }, [user]);

  // Returns { ok, error }. Caller shows consent before calling (the server also requires consent:true).
  const startSos = async (kind, minutes) => {
    setNotice('');
    const f = await getPosition();
    let r = null;
    for (let i = 0; i < 3; i++) {
      r = await api('/sos', 'POST', { consent: true, kind, minutes, ...(f ? { lat: f.lat, lon: f.lon, acc: f.acc } : {}) });
      if (r.ok || (r.status >= 400 && r.status < 500)) break;
      await sleep(1500 * (i + 1));
    }
    if (!r.ok) return { ok: false, error: errText(r), network: r.status === 0 || r.status >= 500 };
    setSos(r.j); setFail(0); setLastOk(Date.now());
    sosRef.current = r.j;
    await startTracking(r.j.id);
    return { ok: true };
  };

  const stop = async () => {
    const cur = sosRef.current;
    if (cur) await api(`/sos/${cur.id}/end`, 'POST', {});
    await stopTracking(); setSos(null); setNotice('Sharing stopped. Your link is closed and your location points were deleted.');
  };

  const extend = async () => {
    const cur = sosRef.current;
    if (!cur) return '';
    const r = await api(`/sos/${cur.id}/extend`, 'POST', {});
    if (r.ok) setSos((s) => s && { ...s, expires_at: r.j.expires_at });
    return r.ok ? '' : errText(r);
  };

  const alertText = (name) => `${name ? name + ': ' : ''}I need help. Track my live location: ${sos ? trackLink(sos.token) : ''}`;

  // Works with no internet: opens the SMS app with your location pre-filled for all saved contacts.
  const smsFallback = async (name) => {
    let f = fixRef.current && Date.now() - fixRef.current.at < 60000 ? fixRef.current : await getPosition();
    const link = f ? `https://maps.google.com/?q=${f.lat},${f.lon}` : 'location unavailable';
    const acc = f && f.acc ? ` (accurate to about ${Math.round(f.acc)} m)` : '';
    const text = `${name ? name + ': ' : ''}SOS - I need help. My location: ${link}${acc}`;
    const nums = contacts.map((c) => c.phone);
    if (!nums.length) return { ok: false, error: 'No saved contacts on this phone. Call 112 now.' };
    await guard(async () => {
      if (await SMS.isAvailableAsync()) await SMS.sendSMSAsync(nums, text);
      else await Linking.openURL(`sms:${nums.join(',')}?body=${encodeURIComponent(text)}`);
    });
    return { ok: true };
  };

  return (
    <Ctx.Provider value={{ sos, fix, geoErr, fail, lastOk, notice, setNotice, startSos, stop, extend, pushLoc, alertText, smsFallback, getPosition }}>
      {children}
    </Ctx.Provider>
  );
}
