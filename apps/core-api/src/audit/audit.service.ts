import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Entree d'audit a journaliser. */
export interface AuditEntry {
  actorId?: string | null;
  action: string; // ex. "login", "read", "create", "update", "export"
  resourceType: string; // ex. "patient", "call", "transcript", "user"
  resourceId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Cles interdites dans les metadonnees d'audit : on ne journalise JAMAIS de
 * donnee de sante ni d'identite en clair (RGPD/HDS).
 */
const FORBIDDEN_METADATA_KEYS = new Set([
  'firstname',
  'lastname',
  'phone',
  'phonenumber',
  'callernumber',
  'birthdate',
  'transcript',
  'segments',
  'summary',
  'content',
  'recording',
  'password',
  'passwordhash',
  'mfasecret',
  'token',
]);

/**
 * Service d'audit append-only : trace tous les acces et modifications de
 * donnees patient. Aucune route applicative ne met a jour/supprime ces lignes.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre une entree d'audit. Les metadonnees sont filtrees pour retirer
   * toute cle sensible avant persistance.
   */
  async record(entry: AuditEntry): Promise<void> {
    const safeMetadata = this.sanitize(entry.metadata);
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          ip: entry.ip ?? null,
          // Json nullable Prisma : sentinelle DbNull si pas de metadonnees.
          metadata:
            safeMetadata === null
              ? Prisma.DbNull
              : (safeMetadata as Prisma.InputJsonValue),
        },
      });
    } catch (err) {
      // L'echec d'audit ne doit jamais exposer de donnee ; on log un message neutre.
      this.logger.error(
        `Echec d'ecriture du journal d'audit (action=${entry.action}, resource=${entry.resourceType})`,
      );
      throw err;
    }
  }

  /** Retire les cles sensibles (insensible a la casse) des metadonnees. */
  sanitize(
    metadata: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> | null {
    if (!metadata) {
      return null;
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
        result[key] = '[redacted]';
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
