import { randomBytes } from 'node:crypto';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let crypto: CryptoService;

  beforeAll(() => {
    // Cle de test ephemere (jamais une cle de production).
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('base64');
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'test-access';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    process.env.SERVICE_API_KEY = 'test-service';
    crypto = new CryptoService();
  });

  it('chiffre puis dechiffre une valeur (aller-retour)', () => {
    const clear = '0612345678';
    const cipher = crypto.encrypt(clear);
    expect(cipher).not.toBeNull();
    expect(cipher).not.toContain(clear); // le clair ne fuite pas
    expect(crypto.decrypt(cipher)).toBe(clear);
  });

  it('produit un chiffre different a chaque appel (IV aleatoire)', () => {
    const a = crypto.encrypt('Dupont');
    const b = crypto.encrypt('Dupont');
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe('Dupont');
    expect(crypto.decrypt(b)).toBe('Dupont');
  });

  it('propage null/undefined sans chiffrer', () => {
    expect(crypto.encrypt(null)).toBeNull();
    expect(crypto.encrypt(undefined)).toBeNull();
    expect(crypto.decrypt(null)).toBeNull();
  });

  it('rejette un chiffre altere (authentification GCM)', () => {
    const cipher = crypto.encrypt('secret')!;
    const tampered = Buffer.from(cipher, 'base64');
    tampered[tampered.length - 1] ^= 0xff; // corruption du dernier octet
    expect(() => crypto.decrypt(tampered.toString('base64'))).toThrow();
  });

  it('hash deterministe pour la recherche (meme entree -> meme sortie)', () => {
    expect(crypto.hash('0612345678')).toBe(crypto.hash('0612345678'));
    expect(crypto.hash('0612345678')).not.toBe(crypto.hash('0699999999'));
  });
});
