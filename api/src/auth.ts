/**
 * Password hashing and sessions, using only the Workers runtime's WebCrypto.
 *
 * Passwords: PBKDF2-SHA256 with a random 16-byte salt per admin. 100,000
 * iterations is the most the Workers runtime allows for PBKDF2.
 * Sessions: a random 32-byte token goes to the browser; only its SHA-256
 * is stored, so the sessions table is useless to anyone who reads it.
 */

export const PBKDF2_ITERATIONS = 100_000;
export const SESSION_DAYS = 7;

const encoder = new TextEncoder();

export function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function hashPassword(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  iterations: number,
): Promise<boolean> {
  const expected = fromBase64(storedHash);
  const actual = await hashPassword(password, fromBase64(storedSalt), iterations);
  return actual.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(actual, expected);
}

export function newSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  return toBase64(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
}

/** Spends about as long as a real check, so unknown emails can't be told apart by timing. */
export async function dummyPasswordCheck(password: string): Promise<void> {
  await hashPassword(password, newSalt(), PBKDF2_ITERATIONS);
}
