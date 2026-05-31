import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { SearchKnowledgeDto } from './dto/search-knowledge.dto';
import { scoreItem, tokenize } from './text-score';

/** Résultat de recherche exposé à l'agent (retrieval RAG). */
export interface KnowledgeSearchResult {
  id: string;
  key: string;
  title: string;
  content: string;
  type: string;
  modality: string | null;
  siteSlug: string | null;
  validated: boolean;
  score: number;
}

/**
 * Service de la base de connaissance imagerie : édition versionnée + validation
 * (radiologue) côté back-office, et recherche (retrieval) côté agent.
 */
@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateKnowledgeDto, actorId: string) {
    const existing = await this.prisma.knowledgeItem.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`Clé déjà utilisée : ${dto.key}`);
    }
    const item = await this.prisma.knowledgeItem.create({
      data: {
        key: dto.key,
        modality: (dto.modality ?? null) as $Enums.Modality | null,
        type: dto.type as $Enums.KnowledgeType,
        title: dto.title,
        content: dto.content,
        siteSlug: dto.siteSlug ?? null,
      },
    });
    await this.audit.record({
      actorId,
      action: 'create',
      resourceType: 'knowledge',
      resourceId: item.id,
      metadata: { key: item.key, type: item.type },
    });
    return item;
  }

  async update(id: string, dto: UpdateKnowledgeDto, actorId: string) {
    const current = await this.prisma.knowledgeItem.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Item de connaissance introuvable');
    }
    // Une modification de contenu invalide la validation et incrémente la version.
    const contentChanged =
      dto.content !== undefined && dto.content !== current.content;

    const item = await this.prisma.knowledgeItem.update({
      where: { id },
      data: {
        modality:
          dto.modality !== undefined
            ? (dto.modality as $Enums.Modality)
            : undefined,
        type: dto.type ? (dto.type as $Enums.KnowledgeType) : undefined,
        title: dto.title,
        content: dto.content,
        siteSlug: dto.siteSlug,
        isActive: dto.isActive,
        version: contentChanged ? { increment: 1 } : undefined,
        validatedById: contentChanged ? null : undefined,
        validatedAt: contentChanged ? null : undefined,
      },
    });
    await this.audit.record({
      actorId,
      action: 'update',
      resourceType: 'knowledge',
      resourceId: id,
      metadata: { key: item.key, version: item.version, contentChanged },
    });
    return item;
  }

  /** Validation par un responsable/radiologue (traçabilité du "validé par"). */
  async validate(id: string, actorId: string) {
    const current = await this.prisma.knowledgeItem.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Item de connaissance introuvable');
    }
    const item = await this.prisma.knowledgeItem.update({
      where: { id },
      data: { validatedById: actorId, validatedAt: new Date() },
    });
    await this.audit.record({
      actorId,
      action: 'validate',
      resourceType: 'knowledge',
      resourceId: id,
      metadata: { key: item.key, version: item.version },
    });
    return item;
  }

  async list(actorId: string) {
    const items = await this.prisma.knowledgeItem.findMany({
      orderBy: [{ type: 'asc' }, { key: 'asc' }],
    });
    await this.audit.record({
      actorId,
      action: 'read',
      resourceType: 'knowledge',
      metadata: { count: items.length },
    });
    return items;
  }

  async getById(id: string, actorId: string) {
    const item = await this.prisma.knowledgeItem.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException('Item de connaissance introuvable');
    }
    await this.audit.record({
      actorId,
      action: 'read',
      resourceType: 'knowledge',
      resourceId: id,
    });
    return item;
  }

  /**
   * Recherche (retrieval) : renvoie les items actifs les plus pertinents pour la
   * question, filtrés par modalité/type/site quand fournis.
   */
  async search(dto: SearchKnowledgeDto): Promise<KnowledgeSearchResult[]> {
    const limit = dto.limit ?? 3;
    const candidates = await this.prisma.knowledgeItem.findMany({
      where: {
        isActive: true,
        ...(dto.type ? { type: dto.type as $Enums.KnowledgeType } : {}),
        // Modalité demandée OU items généraux (sans modalité).
        ...(dto.modality
          ? { OR: [{ modality: dto.modality as $Enums.Modality }, { modality: null }] }
          : {}),
      },
    });

    const queryTokens = tokenize(dto.query);
    const scored = candidates
      .map((item) => ({
        item,
        score: scoreItem(queryTokens, item, {
          modality: dto.modality ?? null,
          type: dto.type ?? null,
          siteSlug: dto.siteSlug ?? null,
        }),
      }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    await this.audit.record({
      action: 'read',
      resourceType: 'knowledge',
      // On ne journalise pas le texte de la question.
      metadata: { results: scored.length, modality: dto.modality ?? null, type: dto.type ?? null },
    });

    return scored.map(({ item, score }) => ({
      id: item.id,
      key: item.key,
      title: item.title,
      content: item.content,
      type: item.type,
      modality: item.modality,
      siteSlug: item.siteSlug,
      validated: item.validatedById !== null,
      score,
    }));
  }
}
