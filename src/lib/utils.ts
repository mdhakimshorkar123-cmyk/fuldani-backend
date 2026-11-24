import { randomInt } from 'node:crypto';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** Convert Bangla digits to ASCII digits. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** Normalise a Bangladeshi mobile number to 01XXXXXXXXX, or return null if invalid. */
export function normalizeBdPhone(raw: string): string | null {
  const digits = toAsciiDigits(raw).replace(/\D/g, '');
  const local = digits.startsWith('880') ? digits.slice(2) : digits.startsWith('88') ? digits.slice(2) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

/** Unicode-aware slug (keeps Bangla letters + combining marks). */
export function slugify(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// No 0/O/1/I to avoid confusion when read over the phone.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateOrderCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `SF-${out}`;
}

export function shortId(len = 5): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]!.toLowerCase();
  return out;
}
