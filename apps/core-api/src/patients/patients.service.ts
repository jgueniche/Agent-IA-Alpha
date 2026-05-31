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

  /** Droit d'accès (RGPD) : export des données d'un patient (déchiffrées). Audité. */
  async exportData(id: string, actorId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: { consents: true, followups: true, callbackTasks: true },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');
    await this.audit.record({
      actorId,
      action: 'export',
      resourceType: 'patient',
      resourceId: id,
    });
    return {
      id: patient.id,
      firstName: this.crypto.decrypt(patient.firstName),
      lastName: this.crypto.decrypt(patient.lastName),
      phone: this.crypto.decrypt(patient.phoneEnc),
      createdAt: patient.createdAt,
      consents: patient.consents,
      followups: patient.followups.map((f) => ({
        id: f.id,
        channel: f.channel,
        status: f.status,
      })),
      callbackTasks: patient.callbackTasks.map((t) => ({
        id: t.id,
        motif: t.motif,
        status: t.status,
      })),
    };
  }

  /**
   * Droit à l'effacement (RGPD) : supprime le patient. Consentements supprimés
   * en cascade ; relances et tâches de rappel détachées (SetNull).
   */
  async erase(id: string, actorId: string): Promise<{ erased: boolean }> {
    await this.ensurePatient(id);
    await this.prisma.patient.delete({ where: { id } });
    await this.audit.record({
      actorId,
      action: 'erase',
      resourceType: 'patient',
      resourceId: id,
    });
    return { erased: true };
  }

  private async ensurePatient(id: string): Promise<void> {
    const p = await this.prisma.patient.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Patient introuvable');
  }
}
