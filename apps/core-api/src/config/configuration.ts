/**
 * Chargement et validation de la configuration depuis l'environnement.
 * Aucune valeur par defaut sensible : les secrets DOIVENT venir de l'env / coffre.
 * L'application refuse de demarrer si un secret critique manque (fail-fast).
 */

/** Recupere une variable obligatoire ou leve une erreur explicite. */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Variable d'environnement obligatoire manquante : ${name}`);
  }
  return value;
}

/** Recupere une variable optionnelle avec valeur de repli. */
function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export interface AppConfig {
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  redisUrl: string;
  encryptionKey: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  mfaRequired: boolean;
  retention: {
    dataDays: number;
    auditDays: number;
  };
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(optional('CORE_API_PORT', '4000'), 10),
    corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    databaseUrl: required('DATABASE_URL'),
    redisUrl: optional('REDIS_URL', 'redis://redis:6379'),
    encryptionKey: required('ENCRYPTION_KEY'),
    jwt: {
      accessSecret: required('JWT_ACCESS_SECRET'),
      refreshSecret: required('JWT_REFRESH_SECRET'),
      accessTtl: parseInt(optional('JWT_ACCESS_TTL', '900'), 10),
      refreshTtl: parseInt(optional('JWT_REFRESH_TTL', '604800'), 10),
    },
    mfaRequired: optional('MFA_REQUIRED', 'true') === 'true',
    retention: {
      dataDays: parseInt(optional('DATA_RETENTION_DAYS', '365'), 10),
      auditDays: parseInt(optional('AUDIT_LOG_RETENTION_DAYS', '1825'), 10),
    },
  };
}
