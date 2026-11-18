import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Desteklenen özet algoritmaları. */
export type HashAlgorithm = 'sha1' | 'sha256' | 'sha512';

/** Çıktı kodlaması. */
export type DigestEncoding = 'hex' | 'base64';

/**
 * Verinin özetini (hash) hesaplar.
 *
 * @param algorithm - Özet algoritması
 * @param data - UTF-8 metin veya ham bayt dizisi
 * @param encoding - Çıktı kodlaması (varsayılan `hex`)
 */
export function hash(
  algorithm: HashAlgorithm,
  data: string | Uint8Array,
  encoding: DigestEncoding = 'hex',
): string {
  return createHash(algorithm).update(data).digest(encoding);
}

/**
 * HMAC imzası hesaplar. Sağlayıcı istek imzalamada kullanılır.
 *
 * @param algorithm - Özet algoritması
 * @param key - Gizli anahtar
 * @param data - İmzalanacak veri
 * @param encoding - Çıktı kodlaması (varsayılan `hex`)
 */
export function hmac(
  algorithm: HashAlgorithm,
  key: string | Uint8Array,
  data: string | Uint8Array,
  encoding: DigestEncoding = 'hex',
): string {
  return createHmac(algorithm, key).update(data).digest(encoding);
}

/** UTF-8 metni Base64'e çevirir. */
export function base64Encode(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

/** Base64 metni UTF-8 metne çevirir. */
export function base64Decode(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

/**
 * Kriptografik olarak güvenli rastgele onaltılık metin üretir (örn. istek nonce'u).
 *
 * @param byteLength - Bayt uzunluğu (çıktı uzunluğu bunun iki katıdır)
 */
export function randomHex(byteLength = 16): string {
  return randomBytes(byteLength).toString('hex');
}

/**
 * İki metni zamanlama saldırılarına karşı sabit sürede karşılaştırır.
 * Callback/webhook imza doğrulamasında kullanılmalıdır.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
