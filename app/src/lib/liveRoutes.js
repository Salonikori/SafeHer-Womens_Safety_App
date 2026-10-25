// Live walking routes from OpenStreetMap-based public services. No sample data, no invented scores.
// Geometry is [lon, lat] pairs (GeoJSON order). Anything that can't be fetched stays null (unknown).
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const ROUTING = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const NEAR_METERS = 120; // an amenity counts for a route if it is within this distance of the path
const SHOP_AMENITIES = ['cafe', 'restaurant', 'fast_food', 'pharmacy', 'hospital', 'clinic', 'fuel'];

async function getJson(url, opts = {}, ms = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, headers: { Accept: 'application/json', 'User-Agent': 'SafeHer/1.0 (mobile safety app)', ...(opts.headers || {}) }, signal: ctl.signal });
    if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') { const t = new Error('timeout'); t.status = 0; throw t; }
    throw e;
  } finally { clearTimeout(timer); }
}

// near = { lat, lon } biases results toward the user's area without restricting them.
export async function geocodePlace(query, near) {
  let url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  if (near) url += `&viewbox=${near.lon - 0.6},${near.lat + 0.6},${near.lon + 0.6},${near.lat - 0.6}`;
  let data;
  try { data = await getJson(url); } catch (e) { throw new Error(`Place search is unavailable right now${e.status ? ' (' + e.status + ')' : ''}. Check your connection and try again.`); }
  if (!Array.isArray(data) || !data[0]) throw new Error(`Could not find "${query}". Try a more specific address or landmark.`);
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), label: data[0].display_name || query };
}

// ---- distance helpers (equirectangular approximation, accurate enough at street scale) ----
const R = 6371000, rad = Math.PI / 180;
function pointToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
function nearRoute(lat, lon, xy, lat0, box) {
  if (lat < box.minLat || lat > box.maxLat || lon < box.minLon || lon > box.maxLon) return false;
  const k = Math.cos(lat0 * rad);
  const px = lon * rad * R * k, py = lat * rad * R;
  for (let i = 1; i < xy.length; i++) {
    if (pointToSegment(px, py, xy[i - 1][0], xy[i - 1][1], xy[i][0], xy[i][1]) <= NEAR_METERS) return true;
  }
  return false;
}
function boundsOf(geom, padDeg) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const [lon, lat] of geom) { if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon; }
  return { minLat: minLat - padDeg, maxLat: maxLat + padDeg, minLon: minLon - padDeg, maxLon: maxLon + padDeg };
}

async function fetchPois(box) {
  const bbox = `${box.minLat},${box.minLon},${box.maxLat},${box.maxLon}`;
  const q = `[out:json][timeout:20];(nwr[amenity=police](${bbox});nwr[shop](${bbox});nwr[amenity~"${SHOP_AMENITIES.join('|')}"](${bbox}););out center;`;
  let lastErr;
  for (const ep of OVERPASS) {
    try {
      const json = await getJson(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'data=' + encodeURIComponent(q) }, 25000);
      return (json.elements || []).map((el) => ({ lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon, police: el.tags?.amenity === 'police' })).filter((e) => e.lat != null && e.lon != null);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

export async function getLiveWalkingRoutes(origin, destination) {
  const url = `${ROUTING}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&alternatives=true&steps=false`;
  let json;
  try { json = await getJson(url); } catch (e) { throw new Error(`The walking route service is unavailable${e.status ? ' (' + e.status + ')' : ''}. Try again in a moment.`); }
  if (json.code !== 'Ok' || !Array.isArray(json.routes) || !json.routes.length) throw new Error('No walking route was found between these places.');
  const raw = json.routes.slice(0, 3);

  // One place-data request for all alternatives, then count what is actually near each path.
  const all = raw.flatMap((r) => r.geometry?.coordinates || []);
  const union = boundsOf(all, 0.002);
  let pois = null;
  if (all.length && union.maxLat - union.minLat < 0.3 && union.maxLon - union.minLon < 0.3) {
    try { pois = await fetchPois(union); } catch { pois = null; } // unknown stays unknown
  }

  const routes = raw.map((r, i) => {
    const geometry = r.geometry?.coordinates || [];
    let amenityCounts = null, safetySignal = null;
    if (pois && geometry.length > 1) {
      const lat0 = geometry[0][1], k = Math.cos(lat0 * rad);
      const xy = geometry.map(([lon, lat]) => [lon * rad * R * k, lat * rad * R]);
      const box = boundsOf(geometry, NEAR_METERS / 111000 * 1.2);
      let police = 0, shops = 0;
      for (const p of pois) { if (nearRoute(p.lat, p.lon, xy, lat0, box)) { if (p.police) police++; else shops++; } }
      amenityCounts = { police, shopsAndServices: shops };
      safetySignal = Math.min(100, police * 18 + Math.min(shops, 12) * 5);
    }
    return {
      id: String(i), distanceMeters: Number(r.distance), durationSeconds: Number(r.duration), geometry, amenityCounts, safetySignal,
      dataNote: amenityCounts ? `Counts mapped police and shop/service locations within ${NEAR_METERS} m of this path. It is not a verified safety rating.` : 'Nearby place data could not be loaded, so no safety signal is shown for this route.'
    };
  });
  return { routes, sourceTime: new Date().toISOString(), origin, destination };
}

// Rank without ever treating unknown as safe.
export function rankRoutes(routes, mode) {
  return [...routes].sort((a, b) => {
    if (mode === 'fast') return a.durationSeconds - b.durationSeconds;
    if (a.safetySignal === null && b.safetySignal !== null) return 1;
    if (b.safetySignal === null && a.safetySignal !== null) return -1;
    return (b.safetySignal ?? -1) - (a.safetySignal ?? -1) || a.durationSeconds - b.durationSeconds;
  });
}

export const routeLink = (origin, destination) =>
  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${origin.lat}%2C${origin.lon}%3B${destination.lat}%2C${destination.lon}`;
export const fmtDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
export const fmtDuration = (s) => { const m = Math.max(1, Math.round(s / 60)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
