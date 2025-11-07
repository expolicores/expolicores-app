"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLiveActivityPush = sendLiveActivityPush;
const jwt = __importStar(require("jsonwebtoken"));
const http2 = __importStar(require("http2"));
const teamId = process.env.APNS_TEAM_ID;
const keyId = process.env.APNS_KEY_ID;
const key = (process.env.APNS_AUTH_KEY_P8 || '').replace(/\\n/g, '\n');
const bundleId = process.env.APNS_BUNDLE_ID; // com.expolicores.app
const apnsEnv = process.env.APNS_ENV === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
function createJwt() {
    return jwt.sign({ iss: teamId, iat: Math.floor(Date.now() / 1000) }, key, {
        algorithm: 'ES256',
        header: { alg: 'ES256', kid: keyId },
    });
}
async function sendLiveActivityPush(pushToken, payload) {
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
    return await new Promise((resolve, reject) => {
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
//# sourceMappingURL=live-apns.js.map