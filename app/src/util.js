import { useEffect, useState } from 'react';
export const useNow = (ms = 1000) => {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setN(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return n;
};
export const fmtLeft = (ms) => {
  if (ms <= 0) return '0m';
  const m = Math.ceil(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
};
export const accQuality = (a) => (a == null ? ['none', 'No location yet'] : a <= 30 ? ['good', `Good (${Math.round(a)} m)`] : a <= 100 ? ['fair', `Fair (${Math.round(a)} m)`] : ['poor', `Poor (${Math.round(a)} m). Move near a window or outdoors.`]);
export const fmtDate = (iso) => { try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return iso; } };
