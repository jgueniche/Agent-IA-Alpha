import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums } from '@prisma/client';
import { LoggingTelephonyConnector, type TelephonyConnector } from '@alpha/telephony';
import type { CallbackStatus } from '@alpha/domain';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../crypto/crypto.service';
import { UpdateCallbackDto } from './dto/update-callback.dto';

/** Masque un numéro : ne conserve que les 2 derniers chiffres. */
function maskNumber(n: string): string {
  const digits = n.replace(/\D/g, '');
  return digits.length <= 2 ? '••' : `••••••${digits.slice(-2)}`;
}

const callbackInclude = {
  call: { select: { id: true, startedAt: true, outcome: true, site: { select: { slug: true } } } },
  assignedTo: { select: { id: true, displayName: true } },
} as const;

/**
 * Service file de rappel : liste, assignation, statut, et click-to-call (rappel
 * d'un patient). Le click-to-call réel passe par 3CX (Phase 2) ; ici un
 * connecteur de repli enregistre l'intention. Toute consultation est auditée.
 */
@Injectable()
export class CallbacksService {
  // Connecteur téléphonie : stub de repli en Phase 5, remplacé par le connecteur
  // 3CX (SIP/REFER/click-to-call) en Phase 2. Non injecté par Nest (interface
  // sans token) ; assignable pour les tests.
  private telephony: TelephonyConnector = new LoggingTelephonyConnector();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: CryptoService,
  ) {}

  /** Liste de la file de rappel (filtrable par statut), plus ancien d'abord. */
  async list(actorId: string, status?: CallbackStatus) {
    const tasks = await this.prisma.callbackTask.findMany({
      where: status ? { status: status as $Enums.CallbackStatus } : {},
      orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
      include: callbackInclude,
      take: 200,
    });
    await this.audit.record({
      actorId,
      action: 'read',
      resourceType: 'callback_task',
      metadata: { count: tasks.length, status: status ?? null },
    });
    return tasks;
  }

  async getById(id: string, actorId: string) {
    const task = await this.prisma.callbackTask.findUnique({
      where: { id },
      include: callbackInclude,
    });
    if (!task) throw new NotFoundException('Tâche de rappel introuvable');
    await this.audit.record({
      actorId,
      action: 'read',
      resourceType: 'callback_task',
      resourceId: id,
    });
    return task;
  }

  async update(id: string, dto: UpdateCallbackDto, actorId: string) {
    await this.ensure(id);
    const task = await this.prisma.callbackTask.update({
      where: { id },
      data: {
        status: dto.status ? (dto.status as $Enums.CallbackStatus) : undefined,
        assignedToId: dto.assignedToId,
        notes: dto.notes,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
      include: callbackInclude,
    });
    await this.audit.record({
      actorId,
      action: 'update',
      resourceType: 'callback_task',
      resourceId: id,
      metadata: { status: dto.status ?? null, assigned: dto.assignedToId ?? null },
    });
    return task;
  }

  /** S'assigne la tâche (passe en "assigned" si elle était en attente). */
  async assignToMe(id: string, actorId: string) {
    const current = await this.ensure(id);
    const task = await this.prisma.callbackTask.update({
      where: { id },
      data: {
        assignedToId: actorId,
        status:
          current.status === $Enums.CallbackStatus.pending
            ? $Enums.CallbackStatus.assigned
            : undefined,
      },
      include: callbackInclude,
    });
    await this.audit.record({
      actorId,
      action: 'assign',
      resourceType: 'callback_task',
      resourceId: id,
    });
    return task;
  }

  /**
   * Click-to-call : rappelle le patient. Résout le numéro (appel lié ou patient),
   * déclenche le connecteur téléphonie, et trace l'action (numéro masqué).
   */
  async clickToCall(id: string, actorId: string, fromExtension: string) {
    const task = await this.prisma.callbackTask.findUnique({
      where: { id },
      include: {
        call: { select: { callerNumber: true } },
        patient: { select: { phoneEnc: true } },
      },
    });
    if (!task) throw new NotFoundException('Tâche de rappel introuvable');

    const enc = task.call?.callerNumber ?? task.patient?.phoneEnc ?? null;
    const number = this.crypto.decrypt(enc);
    if (!number) {
      throw new BadRequestException('Aucun numéro disponible pour rappeler');
    }

    await this.telephony.clickToCall(fromExtension, number);
    await this.audit.record({
      actorId,
      action: 'click_to_call',
      resourceType: 'callback_task',
      resourceId: id,
      // Numéro masqué : jamais en clair dans l'audit.
      metadata: { to: maskNumber(number) },
    });
    return { status: 'initiated', to: maskNumber(number) };
  }

  private async ensure(id: string) {
    const task = await this.prisma.callbackTask.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!task) throw new NotFoundException('Tâche de rappel introuvable');
    return task;
  }
}
