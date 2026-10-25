import { API } from './config';
import { getItem, setItem, delItem } from './storage';

let token = null;
export const loadToken = async () => (token = await getItem('token'));
export const saveToken = async (t) => { token = t; t ? await setItem('token', t) : await delItem('token'); };
export const currentToken = () => token;

// Returns { ok, status, j }. Never throws: network problems come back as status 0.
export async function api(path, method = 'GET', body, extra = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), extra.timeout || 12000);
  try {
    const res = await fetch(API + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctl.signal
    });
    const text = await res.text();
    let j = {};
    try { j = text ? JSON.parse(text) : {}; } catch { j = { text }; }
    if (res.status === 401 && token && extra.onUnauthorized !== false) api.onUnauthorized && api.onUnauthorized();
    return { ok: res.ok, status: res.status, j };
  } catch {
    return { ok: false, status: 0, j: { error: 'Could not reach the server. Check your internet connection.' } };
  } finally { clearTimeout(timer); }
}
export const errText = (r) => (r && r.j && r.j.error) || 'Something went wrong. Please try again.';
