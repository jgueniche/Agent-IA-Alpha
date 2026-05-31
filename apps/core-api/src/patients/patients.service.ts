import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums } from '@prisma/client';
import type { ConsentType } from '@alpha/domain';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';

/** Normalise un numéro (chiffres uniquement) pour le hash de recherche. */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Service patients (minimal) : identité chiffrée, recherche par HMAC du téléphone,
 * et enregistrement des consentements (distincts par type). Toute donnée sensible
 * est chiffrée ; les accès sont audités.
 */
@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Crée ou retrouve un patient par téléphone (upsert sur le HMAC). */
  async upsertByPhone(input: {
    phone: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ id: string }> {
    const phoneHash = this.crypto.hash(normalizePhone(input.phone));
    const existing = await this.prisma.patient.findUnique({ where: { phoneHash } });
    if (existing) {
      return { id: existing.id };
    }
    const patient = await this.prisma.patient.create({
      data: {
        phoneHash,
        phoneEnc: this.crypto.encrypt(input.phone),
        firstName: this.crypto.encrypt(input.firstName),
        lastName: this.crypto.encrypt(input.lastName),
      },
      select: { id: true },
    });
    await this.audit.record({
      action: 'create',
      resourceType: 'patient',
      resourceId: patient.id,
      // Aucune donnée d'identité en clair dans l'audit.
    });
    return { id: patient.id };
  }

  /** Enregistre un consentement (recording / followup transactionnel|marketing / data). */
  async recordConsent(
    patientId: string,
    type: ConsentType,
    granted: boolean,
    source?: string,
  ): Promise<void> {
    await this.ensurePatient(patientId);
    await this.prisma.consent.create({
      data: {
        patientId,
        type: type as $Enums.ConsentType,
        granted,
        source: source ?? null,
        revokedAt: granted ? null : new Date(),
      },
    });
    await this.audit.record({
      action: 'consent',
      resourceType: 'patient',
      resourceId: patientId,
      metadata: { type, granted },
    });
  }

  /** Numéro déchiffré (usage interne : relances). */
  async getPhone(patientId: string): Promise<string | null> {
    const p = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { phoneEnc: true },
    });
    return this.crypto.decrypt(p?.phoneEnc);
  }

  /** Dernier état de consentement pour un type donné (granted effectif). */
  async hasConsent(patientId: string, type: ConsentType): Promise<boolean> {
    const last = await this.prisma.consent.findFirst({
      where: { patientId, type: type as $Enums.ConsentType },
      orderBy: { grantedAt: 'desc' },
    });
    return !!last && last.granted && last.revokedAt === null;
  }

  private async ensurePatient(id: string): Promise<void> {
    const p = await this.prisma.patient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Patient introuvable');
  }
}
