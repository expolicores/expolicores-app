//frontend/scripts/patch-nitro-podspec.js
const fs = require('fs');
const path = require('path');

const podspecPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@kingstinct',
  'react-native-activity-kit',
  'NitroActivityKit.podspec'
);

try {
  let txt = fs.readFileSync(podspecPath, 'utf8');
  const before = txt;

  // Normaliza platforms => iOS 18.2 (o el que prefieras)
  // Ej: s.platforms    = { :ios => 26.0 }
  txt = txt.replace(/s\.platforms\s*=\s*\{\s*:ios\s*=>\s*[\d.]+\s*\}/, `s.platforms = { :ios => '26.0' }`);

  // Por si el podspec usa deployment_target en otra línea
  txt = txt.replace(/s\.ios\.deployment_target\s*=\s*['"]?[\d.]+['"]?/, `s.ios.deployment_target = '26.0'`);

  if (txt !== before) {
    fs.writeFileSync(podspecPath, txt, 'utf8');
    console.log('[patch-nitro] Patched NitroActivityKit.podspec to iOS 26.0');
  } else {
    console.log('[patch-nitro] No changes applied (pattern not found).');
  }
} catch (e) {
  console.error('[patch-nitro] Failed:', e.message);
  process.exit(1);
}
