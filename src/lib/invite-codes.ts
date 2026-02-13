import { nanoid } from "nanoid"

/**
 * Generate a 12-character, cryptographically secure, URL-safe invite code.
 * 68 bits of entropy — collision probability ~1% after 9 billion codes.
 */
export function generateInviteCode(): string {
  return nanoid(12)
}
