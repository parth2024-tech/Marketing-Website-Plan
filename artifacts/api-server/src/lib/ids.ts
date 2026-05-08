import { randomBytes } from "crypto";

// Base32 alphabet (Crockford, lowercase) — URL-safe, unambiguous
const B32 = "0123456789abcdefghjkmnpqrstvwxyz";

function randomBase32(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes)
    .map((b) => B32[b & 0x1f])
    .join("");
}

/** 12-character base32 report ID (~60 bits of entropy) */
export function newReportId(): string {
  return randomBase32(12);
}

/** 16-character base32 claim token (~80 bits of entropy) */
export function newClaimToken(): string {
  return randomBase32(16);
}

/** SHA-256 hex of a string — used for IP hashing before storage */
export async function sha256hex(input: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(input).digest("hex");
}
