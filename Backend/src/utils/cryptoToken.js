// FILE: backend/src/utils/cryptoToken.js
// KAAM: per-user Cloudflare API token ko DB me PLAIN nahi, ENCRYPTED rakhna.
//
// WHY Web Crypto (crypto.subtle), node:crypto NAHI:
//   - Cloudflare Worker me `node:crypto` poora support nahi; `crypto.subtle`
//     (Web Crypto) Worker AUR Node 18+ dono me native chalta hai → ek hi code
//     local + prod me kaam karega.
//
// Algo: AES-256-GCM (authenticated). Har encrypt pe naya random 12-byte IV.
// Stored string format:  v1:<base64(iv)>:<base64(ciphertext+tag)>
//
// Key: `ENCRYPTION_KEY` env/secret se. Local me .env, prod me
//   `wrangler secret put ENCRYPTION_KEY`. Key ko SHA-256 se 32-byte bana lete
//   hain → koi bhi length ki passphrase chalegi (production me lambi random ho).

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function b64(bytes) {
  let s = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}
function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// passphrase → 32-byte AES key (SHA-256), imported as a CryptoKey.
async function deriveKey(secret) {
  if (!secret) throw new Error('ENCRYPTION_KEY is not set');
  const hash = await crypto.subtle.digest('SHA-256', ENC.encode(secret));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// Plain token → "v1:iv:ciphertext" string (DB me yahi save hota hai).
export async function encryptToken(plain, secret) {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ENC.encode(plain));
  return `v1:${b64(iv)}:${b64(ct)}`;
}

// "v1:iv:ciphertext" → plain token. Galat key / tampering → throw (catch karna).
export async function decryptToken(stored, secret) {
  const [ver, ivB64, ctB64] = String(stored).split(':');
  if (ver !== 'v1' || !ivB64 || !ctB64) throw new Error('bad token format');
  const key = await deriveKey(secret);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(ivB64) },
    key,
    unb64(ctB64)
  );
  return DEC.decode(pt);
}
