// The address of your SafeHer server. Set EXPO_PUBLIC_API_URL in .env (see .env.example).
export const SERVER = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000').replace(/\/$/, '');
export const API = SERVER + '/api';
export const trackLink = (token) => `${SERVER}/track.html?t=${token}`;
export const HELPLINES = { police: '112', women: '181' };
