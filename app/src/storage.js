import * as SecureStore from 'expo-secure-store';

export async function getItem(key, fallback = null) {
  try {
    const v = await SecureStore.getItemAsync(key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}
export async function setItem(key, value) {
  try { await SecureStore.setItemAsync(key, JSON.stringify(value)); } catch {}
}
export async function delItem(key) {
  try { await SecureStore.deleteItemAsync(key); } catch {}
}
