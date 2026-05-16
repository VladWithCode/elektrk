/**
 * Password hashing utilities — Node.js crypto (no additional dependencies).
 *
 * Uses scrypt (memory-hard KDF) via the built-in `crypto` module.
 * Compatible with Node.js 10+ — no external packages needed.
 *
 * Format: "<16-byte-salt-hex>:<64-byte-derived-key-hex>"
 *
 * Why not bcrypt?
 *   bcrypt requires native bindings which complicate cross-platform builds.
 *   Node's built-in scrypt is equally secure and has no extra dependencies.
 *
 * NOT compatible with Edge runtime (uses Node.js crypto module).
 * Use in Server Actions and API route handlers only.
 */

import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// scrypt parameters — N=2^14, r=8, p=1 (OWASP minimum recommendation)
const KEY_LENGTH = 64;

// ---------------------------------------------------------------------------
// hashPassword
// ---------------------------------------------------------------------------

/**
 * Hashes a plaintext password with a random salt.
 * Store the returned string in the database — it contains both salt and hash.
 *
 * @example
 * const hash = await hashPassword("myPassword123");
 * // "a3f9c2e1b...:<hex-key>"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

// ---------------------------------------------------------------------------
// verifyPassword
// ---------------------------------------------------------------------------

/**
 * Verifies a plaintext password against a stored hash string.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param password   - The plaintext password to verify
 * @param storedHash - The hash string returned by hashPassword()
 * @returns true if the password matches, false otherwise
 *
 * @example
 * const valid = await verifyPassword("myPassword123", user.password_hash);
 * if (!valid) return null; // incorrect password
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;

  const storedKeyBuffer = Buffer.from(keyHex, "hex");

  try {
    const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
    return timingSafeEqual(storedKeyBuffer, derivedKey);
  } catch {
    return false;
  }
}
