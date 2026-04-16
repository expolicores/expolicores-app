import * as jwt from 'jsonwebtoken';
import * as http2 from 'http2';

const teamId = process.env.APNS_TEAM_ID!;
const keyId = process.env.APNS_KEY_ID!;
const key = (process.env.APNS_AUTH_KEY_P8 || '').replace(/\\n/g, '\n');
const bundleId = process.env.APNS_BUNDLE_ID!; // com.expolicores.app
const apnsEnv = process.env.APNS_ENV === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

function createJwt() {
  return jwt.sign({ iss: teamId, iat: Math.floor(Date.now() / 1000) }, key, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId },
  });
}

export async function sendLiveActivityPush(pushToken: string, payload: any) {
  const client = http2.connect(`https://${apnsEnv}`);
  const req = client.request({
    ':method': 'POST',
    ':path': `/3/device/${pushToken}`,
    'apns-topic': `${bundleId}.push-type.liveactivity`,
    'apns-push-type': 'liveactivity',
    'apns-priority': '10',
    authorization: `bearer ${createJwt()}`,
    'content-type': 'application/json'
  });

  return await new Promise<void>((resolve, reject) => {
    req.setEncoding('utf8');
    req.on('response', (headers) => {
      const status = Number(headers[':status'] || 0);
      if (status < 200 || status >= 300) {
        reject(new Error(`APNs status ${status}`));
      }
    });
    req.on('error', reject);
    req.on('end', () => { client.close(); resolve(); });
    req.end(JSON.stringify(payload));
  });
}