import axios from 'axios';

// Expo expone variables EXPO_PUBLIC_* en process.env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

// Permite que el AuthProvider actualice el header Authorization
authHeaderSetter(undefined);
let _setAuthHeader: (token: string | null) => void = () => {};
export function authHeaderSetter(fn?: (token: string | null) => void) {
  if (fn) _setAuthHeader = fn; else _setAuthHeader = (t) => {
    if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
    else delete api.defaults.headers.common.Authorization;
  };
}

export function setAuthToken(token: string | null) { _setAuthHeader(token); }