// src/lib/placesSession.ts
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

let currentToken: string | null = null;
let tokenTimer: NodeJS.Timeout | null = null;

export function startPlacesSession() {
  endPlacesSession();
  currentToken = uuidv4();
  tokenTimer = setTimeout(() => endPlacesSession(), 3 * 60 * 1000); // 3 min
  return currentToken!;
}

export function getPlacesSession() {
  return currentToken ?? startPlacesSession();
}

export function endPlacesSession() {
  if (tokenTimer) clearTimeout(tokenTimer);
  tokenTimer = null;
  currentToken = null;
}
