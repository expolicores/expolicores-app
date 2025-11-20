// frontend/src/lib/version.ts
import Constants from 'expo-constants';

export function getAppVersion() {
  // "1.2.0" desde app.json
  return Constants?.expoConfig?.version ?? '0.0.0';
}

// Comparador simple semver: "1.2.3"
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}
