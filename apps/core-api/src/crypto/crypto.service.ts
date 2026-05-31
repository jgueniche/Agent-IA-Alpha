import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { loadConfig } from '../config/configuration';

/**
 * Chiffrement applicatif des champs sensibles (donnees d'identite patient,
 * secrets MFA, numeros d'appel).
 *
 * Algorithme : AES-256-GCM (chiffrement authentifie).
 * Format de sortie (base64) : iv(12o) | tag(16o) | ciphertext.
 *
 * La cle provient de ENCRYPTION_KEY (32 octets, base64). En production elle est
 * fournie par un coffre (Vault) et fait l'objet d'une rotation.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private static readonly ALGO = 'aes-256-gcm';
  private static readonly IV_LEN = 12;
  private static readonly TAG_LEN = 16;

  constructor() {
    const { encryptionKey } = loadConfig();
    const key = Buffer.from(encryptionKey, 'base64');
    if (key.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY invalide : 32 octets attendus en base64 (openssl rand -base64 32).',
      );
    }
    this.key = key;
  }

  /** Chiffre une chaine en clair. Retourne null si l'entree est null/undefined. */
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined) {
      return null;
    }
    const iv = randomBytes(CryptoService.IV_LEN);
    const cipher = createCipheriv(CryptoService.ALGO, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  /** Dechiffre une valeur produite par encrypt(). Retourne null si l'entree est null. */
  decrypt(payload: string | null | undefined): string | null {
    if (payload === null || payload === undefined) {
      return null;
    }
    const raw = Buffer.from(payload, 'base64');
    const iv = raw.subarray(0, CryptoService.IV_LEN);
    const tag = raw.subarray(
      CryptoService.IV_LEN,
      CryptoService.IV_LEN + CryptoService.TAG_LEN,
    );
    const ciphertext = raw.subarray(CryptoService.IV_LEN + CryptoService.TAG_LEN);
    const decipher = createDecipheriv(CryptoService.ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  /**
   * HMAC-SHA256 deterministe : permet de rechercher un patient par telephone
   * sans dechiffrer (ex. phoneHash). Le clair n'est jamais expose.
   */
  hash(value: string): string {
    return createHmac('sha256', this.key).update(value).digest('hex');
  }
}
