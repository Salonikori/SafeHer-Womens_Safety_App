// Bluetooth Low Energy SOS relay (client side). Loaded lazily so the app still runs where the native module is missing (Expo Go).
// Receiver protocol: GATT service SERVICE_UUID with a writable characteristic SOS_CHAR_UUID.
// The sender writes the JSON payload as UTF-8 in consecutive chunks and ends it with a single "\n" byte.
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

export const SERVICE_UUID = 'f3641400-00b0-4240-ba50-05ca45bf8abc';
export const SOS_CHAR_UUID = 'f3641401-00b0-4240-ba50-05ca45bf8abc';
const NO_NATIVE = 'Bluetooth relay needs the SafeHer development build (it does not run in Expo Go).';

let lib = null, mgr = null;
function load() {
  if (lib === null) { try { lib = require('react-native-ble-plx'); } catch { lib = false; } }
  return lib;
}
export const bleAvailable = () => !!load();
function manager() {
  const m = load();
  if (!m) throw new Error(NO_NATIVE);
  if (!mgr) { try { mgr = new m.BleManager(); } catch { throw new Error(NO_NATIVE); } }
  return mgr;
}

async function permissions() {
  if (Platform.OS !== 'android') return true;
  const P = PermissionsAndroid.PERMISSIONS;
  if (Number(Platform.Version) >= 31) {
    const r = await PermissionsAndroid.requestMultiple([P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT, P.ACCESS_FINE_LOCATION]);
    return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  return (await PermissionsAndroid.request(P.ACCESS_FINE_LOCATION)) === PermissionsAndroid.RESULTS.GRANTED;
}

// Starts a scan and returns a stop() function. Rejects with a readable message if it cannot start.
export async function scanPeers(onPeer, ms = 12000, onDone) {
  const m = manager();
  if (!(await permissions())) throw new Error('Bluetooth permission was not granted. Allow it in your phone settings.');
  const state = await m.state();
  if (state !== 'PoweredOn') throw new Error('Turn on Bluetooth to look for nearby SafeHer devices.');
  let stopped = false;
  const stop = () => { if (stopped) return; stopped = true; clearTimeout(timer); try { m.stopDeviceScan(); } catch {} onDone && onDone(); };
  const timer = setTimeout(stop, ms);
  m.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, (err, dev) => {
    if (err) { stop(); return; }
    if (dev) onPeer({ id: dev.id, name: dev.name || dev.localName || null });
  });
  return stop;
}

export async function relayPayload(deviceId, payload) {
  const m = manager();
  const dev = await m.connectToDevice(deviceId, { timeout: 8000, requestMTU: 247 });
  try {
    await dev.discoverAllServicesAndCharacteristics();
    const size = Math.max(20, Math.min(180, (dev.mtu || 23) - 3));
    const bytes = Buffer.from(JSON.stringify(payload) + '\n', 'utf8');
    for (let i = 0; i < bytes.length; i += size) {
      await dev.writeCharacteristicWithResponseForService(SERVICE_UUID, SOS_CHAR_UUID, bytes.subarray(i, i + size).toString('base64'));
    }
    return true;
  } finally { try { await m.cancelDeviceConnection(deviceId); } catch {} }
}

export function stopScanNow() { try { mgr && mgr.stopDeviceScan(); } catch {} }
