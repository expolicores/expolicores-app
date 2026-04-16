const fs = require('fs');
const list = [
  'node_modules/@kingstinct/react-native-activity-kit/NitroActivityKit.podspec',
  'node_modules/react-native-nitro-modules/NitroModules.podspec',
];
for (const p of list) {
  try {
    const t = fs.readFileSync(p, 'utf8');
    const plat = t.match(/s\.platforms\s*=\s*\{[^}]*:ios\s*=>\s*['"]?([\d.]+)['"]?[^}]*\}/);
    const dep  = t.match(/s\.ios\.deployment_target\s*=\s*['"]?([\d.]+)['"]?/);
    console.log(`[podspec] ${p} -> platforms iOS: ${plat?.[1] || 'N/A'}, deployment_target: ${dep?.[1] || 'N/A'}`);
  } catch (e) {
    console.log(`[podspec] ${p} -> ${e.message}`);
  }
}
