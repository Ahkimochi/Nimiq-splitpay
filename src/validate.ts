// Address validation.
//
// The Nimiq user-friendly address format and checksum are copied verbatim
// from the official @nimiq/utils package (ValidationUtils, MIT, Nimiq team),
// which itself copies Nimiq Core's Address implementation:
//  - "NQ" prefix, 36 chars (ignoring spaces)
//  - restricted alphabet (no I, O, W, Z in the payload alphabet)
//  - IBAN-style mod-97 checksum (ISO 7064)

const NIMIQ_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVXY';

function ibanCheck(str: string): number {
  const num = str
    .split('')
    .map((c) => {
      const code = c.toUpperCase().charCodeAt(0);
      return code >= 48 && code <= 57 ? c : (code - 55).toString();
    })
    .join('');
  let tmp = '';
  for (let i = 0; i < Math.ceil(num.length / 6); i++) {
    tmp = (parseInt(tmp + num.substr(i * 6, 6), 10) % 97).toString();
  }
  return parseInt(tmp, 10);
}

function alphabetCheck(str: string): boolean {
  const upper = str.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    if (!NIMIQ_ALPHABET.includes(upper[i]!)) return false;
  }
  return true;
}

/** True if the string is a valid Nimiq user-friendly address (checksum included). */
export function isValidNimiqAddress(address: string): boolean {
  if (!address) return false;
  const str = address.replace(/ /g, '');
  if (str.substr(0, 2).toUpperCase() !== 'NQ') return false;
  if (str.length !== 36) return false;
  if (!alphabetCheck(str)) return false;
  return ibanCheck(str.substr(4) + str.substr(0, 4)) === 1;
}

/** Normalize to the canonical grouped form: "NQ07 0000 0000 …". */
export function normalizeNimiqAddress(address: string): string {
  return address
    .toUpperCase()
    .replace(/[\s+-]|%20/g, '')
    .replace(/(.)(?=(.{4})+$)/g, '$1 ');
}

/** True if the string looks like an EVM address (0x + 40 hex chars). */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

/** Shorten a Nimiq address for display: "NQ17 D2ES … NNY1". */
export function shortenNimiqAddress(address: string): string {
  const compact = address.replace(/ /g, '');
  if (compact.length <= 14) return address;
  return `${compact.slice(0, 8)}…${compact.slice(-4)}`;
}

/** Shorten an EVM address for display: "0x1234…5678". */
export function shortenEvmAddress(address: string): string {
  if (address.length <= 13) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
