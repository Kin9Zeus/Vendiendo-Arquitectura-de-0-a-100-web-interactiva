/**
 * Cifrado de la base de conocimiento (AES-256-GCM + gzip).
 * El repositorio es público: el texto del libro solo viaja cifrado y la clave
 * (KB_KEY, 32 bytes en base64) vive en las variables de entorno.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const MAGIC = Buffer.from('VAKB1');

export function parseKey(b64) {
  const key = Buffer.from(String(b64 || ''), 'base64');
  if (key.length !== 32) throw new Error('KB_KEY debe ser una clave de 32 bytes en base64');
  return key;
}

export function encryptKB(obj, keyB64) {
  const key = parseKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(obj)), { level: 9 })), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

export function decryptKB(buf, keyB64) {
  const key = parseKey(keyB64);
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Archivo de base de conocimiento no reconocido');
  const iv = buf.subarray(5, 17);
  const tag = buf.subarray(17, 33);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(buf.subarray(33)), decipher.final()]);
  return JSON.parse(gunzipSync(plain).toString('utf8'));
}

/** Vectores Float32 ↔ base64 para guardarlos compactos dentro del JSON. */
export const f32ToB64 = (arr) => Buffer.from(new Float32Array(arr).buffer).toString('base64');
export const b64ToF32 = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};
