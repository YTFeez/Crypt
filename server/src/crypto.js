import { gcm } from "@noble/ciphers/aes.js";
import { argon2idAsync } from "@noble/hashes/argon2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "node:crypto";

const ARGON2 = { t: 3, m: 12288, p: 1, dkLen: 32 };

function bufToB64(buf) {
  return Buffer.from(buf).toString("base64");
}

function b64ToU8(b64) {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? b64ToU8(saltB64) : randomBytes(16);
  const pass = new TextEncoder().encode(password);
  const key = await argon2idAsync(pass, salt, ARGON2);
  return { hash: bufToB64(key), salt: bufToB64(salt) };
}

export async function verifyPassword(password, saltB64, expectedHash) {
  const pass = new TextEncoder().encode(password);
  const key = await argon2idAsync(pass, b64ToU8(saltB64), ARGON2);
  return timingSafeEqual(bufToB64(key), expectedHash);
}

export function generateVerificationCode() {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

export function hashCode(code) {
  return bufToB64(sha256(new TextEncoder().encode(code.trim())));
}

export async function deriveMasterKey(password, saltB64) {
  const pass = new TextEncoder().encode(password);
  return argon2idAsync(pass, b64ToU8(saltB64), ARGON2);
}

export async function decryptVaultPayload(password, vaultMeta, dataB64, ivB64) {
  const master = await deriveMasterKey(password, vaultMeta.salt);
  const aes = gcm(master, b64ToU8(ivB64));
  const plain = aes.decrypt(b64ToU8(dataB64));
  return new TextDecoder().decode(plain);
}
