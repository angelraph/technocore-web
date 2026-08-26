// Mirrors flop-labs/technocore-chat's scripts/sign.py exactly, so signatures
// produced here verify against the same server. See that file for the
// canonical-string spec this implementation must match byte-for-byte.
import { ed25519 } from '@noble/curves/ed25519.js';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MULTICODEC_ED25519 = new Uint8Array([0xed, 0x01]);

export interface Identity {
  seedHex: string;
  priv: Uint8Array;
  pub: Uint8Array;
  did: string;
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error('seed must be exactly 64 hex characters (32 bytes)');
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// base58btc, big-endian. Safe here because the encoded buffer always starts
// with the fixed 0xed multicodec byte, never 0x00, so there is no leading-zero
// ambiguity to worry about (same assumption sign.py's multibase() makes).
function multibaseBase58(raw: Uint8Array): string {
  let n = 0n;
  for (const byte of raw) n = (n << 8n) | BigInt(byte);
  let out = '';
  while (n > 0n) {
    const rem = Number(n % 58n);
    n /= 58n;
    out = B58[rem] + out;
  }
  return out;
}

export function didFromPublicKey(pub: Uint8Array): string {
  const raw = concatBytes(MULTICODEC_ED25519, pub);
  const mb = 'z' + multibaseBase58(raw);
  if (mb.length !== 48) throw new Error(`internal: bad multibase length ${mb.length}`);
  return 'did:key:' + mb;
}

export function randomSeedHex(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

export function identityFromSeedHex(seedHex: string): Identity {
  const priv = hexToBytes(seedHex);
  const pub = ed25519.getPublicKey(priv);
  return { seedHex: bytesToHex(priv), priv, pub, did: didFromPublicKey(pub) };
}

export async function sha256HexPrefix(s: string, len = 16): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return bytesToHex(new Uint8Array(digest)).slice(0, len);
}

// Mirrors src/store.py's clean_text on the server: these Unicode categories
// become a single space, then the ends are trimmed. Signing the raw
// (un-swept) text produces a signature the server will reject with 403,
// because it verifies against the bytes it actually stores.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/gu;

export function sweepText(text: string, limit: number): string {
  const cleaned = text.replace(INVISIBLE, ' ').trim();
  if (!cleaned) {
    throw new Error('nothing visible would remain after the sweep — the server would refuse this text');
  }
  if (cleaned.length > limit) {
    throw new Error(`${cleaned.length} characters after the sweep, over the ${limit}-character cap`);
  }
  return cleaned;
}

function base64UrlNoPad(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signCanonical(priv: Uint8Array, canonical: string): string {
  const sig = ed25519.sign(new TextEncoder().encode(canonical), priv);
  return base64UrlNoPad(sig);
}

export function assertNonce(nonce: string): void {
  if (!/^[0-9]{1,19}$/.test(nonce)) {
    throw new Error(`nonce must be 1-19 ASCII digits, got ${JSON.stringify(nonce)}`);
  }
}

export const MAX_TEXT_CHARS = 4096;
export const MAX_VALUE_CHARS = 8192;

export function signSay(identity: Identity, room: string, nonce: string, text: string) {
  assertNonce(nonce);
  const swept = sweepText(text, MAX_TEXT_CHARS);
  const canonical = `${room}|${nonce}|${swept}`;
  return { sig: signCanonical(identity.priv, canonical), swept, canonical };
}
