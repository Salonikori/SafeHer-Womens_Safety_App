import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { api, loadToken, saveToken, errText } from '../api';
import { getItem, setItem, delItem } from '../storage';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const hash = async (salt, code) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + ':' + code);

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUserState] = useState(null);
  const setUser = useCallback((u) => { setUserState(u); u ? setItem('user', u) : delItem('user'); }, []);
  const [lang, setLangState] = useState('en');
  const [disguise, setDisguiseState] = useState({ on: false, auto: true });
  const [locked, setLocked] = useState(false);
  const [contacts, setContacts] = useState([]);

  const disguiseRef = useRef(disguise);
  disguiseRef.current = disguise;
  const guardRef = useRef(false);       // true while the app deliberately opens another app (SMS, picker, ...)
  const sosActiveRef = useRef(false);   // set by SosProvider: never hide the app mid-SOS

  // Run something that sends the user to another screen without hiding the app when they come back.
  const guard = useCallback(async (fn) => {
    guardRef.current = true;
    try { return await fn(); } finally { setTimeout(() => { guardRef.current = false; }, 2000); }
  }, []);

  useEffect(() => {
    (async () => {
      const [l, d, c, cu] = await Promise.all([getItem('lang', 'en'), getItem('disguise', { on: false, auto: true }), getItem('contacts', []), getItem('user')]);
      setLangState(l); setDisguiseState(d); setContacts(c);
      if (d.on && d.hash) setLocked(true);
      const tk = await loadToken();
      // Open immediately from what is saved on the phone (works offline); verify with the server in the background.
      if (tk && cu) setUserState(cu);
      setReady(true);
      if (tk) {
        const r = await api('/me', 'GET', undefined, { onUnauthorized: false });
        if (r.ok) setUser(r.j.user);
        else if (r.status === 401) { await saveToken(null); setUser(null); }
      }
    })();
    api.onUnauthorized = async () => { await saveToken(null); setUser(null); };
  }, []);

  // Hide the app again when the user leaves it (if they chose that).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      const d = disguiseRef.current;
      if (st === 'background' && d.on && d.hash && d.auto !== false && !guardRef.current && !sosActiveRef.current) setLocked(true);
    });
    return () => sub.remove();
  }, []);

  const refreshContacts = useCallback(async () => {
    const r = await api('/contacts');
    if (r.ok) { setContacts(r.j.contacts); setItem('contacts', r.j.contacts); }
    return r;
  }, []);
  useEffect(() => { if (user) refreshContacts(); }, [user, refreshContacts]);

  const auth = async (mode, email, password) => {
    const r = await api('/' + mode, 'POST', { email, password });
    if (!r.ok) return errText(r);
    await saveToken(r.j.token); setUser(r.j.user); return '';
  };
  const signOut = async () => {
    await api('/logout', 'POST', {});
    await saveToken(null); await delItem('contacts'); await delItem('sos_bg');
    setContacts([]); setUser(null);
  };
  const deleteAccount = async () => {
    const r = await api('/me', 'DELETE');
    if (r.ok) { await saveToken(null); await delItem('contacts'); await delItem('sos_bg'); setContacts([]); setUser(null); }
    return r.ok ? '' : errText(r);
  };
  const setLang = (l) => { setLangState(l); setItem('lang', l); };

  // code is optional when keeping an existing code. Returns an error message or ''.
  const saveDisguise = async ({ on, code, auto }) => {
    const cur = disguiseRef.current;
    let next = { on, auto, salt: cur.salt, hash: cur.hash };
    if (code) {
      if (!/^\d{4,8}$/.test(code)) return 'The code must be 4 to 8 digits.';
      const salt = Array.from(Crypto.getRandomBytes(16)).map((b) => b.toString(16).padStart(2, '0')).join('');
      next = { ...next, salt, hash: await hash(salt, code) };
    }
    if (on && !next.hash) return 'Choose a secret code first.';
    setDisguiseState(next); await setItem('disguise', next);
    return '';
  };
  const checkCode = async (code) => { const d = disguiseRef.current; return !!(d.on && d.hash && (await hash(d.salt, code)) === d.hash); };
  const lock = () => { const d = disguiseRef.current; if (d.on && d.hash) setLocked(true); };
  const unlock = () => setLocked(false);

  return (
    <Ctx.Provider value={{ ready, user, setUser, lang, setLang, disguise, locked, lock, unlock, checkCode, saveDisguise,
      contacts, refreshContacts, auth, signOut, deleteAccount, guard, sosActiveRef }}>
      {children}
    </Ctx.Provider>
  );
}
