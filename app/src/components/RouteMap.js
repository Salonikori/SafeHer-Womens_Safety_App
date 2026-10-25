import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { C } from '../theme';

// Draws route shapes only (no map tiles, so it works with weak data). Selected route is bold.
export default function RouteMap({ routes, selectedId, height = 190 }) {
  const W = 320, H = height, pad = 16;
  const pts = routes.flatMap((r) => r.geometry);
  if (!pts.length) return null;
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (const [lon, lat] of pts) { minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon); minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat); }
  const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const w = Math.max((maxLon - minLon) * kx, 1e-6), h = Math.max(maxLat - minLat, 1e-6);
  const s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  const proj = ([lon, lat]) => [ox + (lon - minLon) * kx * s, oy + (maxLat - lat) * s];
  const line = (g) => g.map((p) => proj(p).map((n) => n.toFixed(1)).join(',')).join(' ');
  const first = routes[0].geometry[0], last = routes[0].geometry[routes[0].geometry.length - 1];
  const a = proj(first), b = proj(last);
  const ordered = [...routes].sort((x) => (x.id === selectedId ? 1 : -1));
  return (
    <View style={{ borderRadius: 14, overflow: 'hidden', backgroundColor: C.softer, borderWidth: 1, borderColor: C.line }} accessibilityLabel="Route preview">
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {ordered.map((r) => (
          <Polyline key={r.id} points={line(r.geometry)} fill="none" strokeLinecap="round" strokeLinejoin="round"
            stroke={r.id === selectedId ? C.primary : '#C9B8C4'} strokeWidth={r.id === selectedId ? 4 : 2.5} />
        ))}
        <Circle cx={a[0]} cy={a[1]} r={6} fill={C.ok} stroke="#fff" strokeWidth={2} />
        <Circle cx={b[0]} cy={b[1]} r={6} fill={C.primaryDark} stroke="#fff" strokeWidth={2} />
      </Svg>
    </View>
  );
}
