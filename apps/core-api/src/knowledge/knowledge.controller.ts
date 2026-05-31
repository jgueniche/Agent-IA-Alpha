import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeDto } from './dto/create-knowledge.dto';
import { UpdateKnowledgeDto } from './dto/update-knowledge.dto';
import { SearchKnowledgeDto } from './dto/search-knowledge.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ServiceOnly } from '../service-auth/service-only.decorator';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  // --- Retrieval (agent, clé de service) -----------------------------------

  /** Recherche de connaissances pour l'agent vocal (outil lookup_exam_prep). */
  @Public()
  @ServiceOnly()
  @Post('search')
  search(@Body() dto: SearchKnowledgeDto) {
    return this.knowledge.search(dto);
  }

  // --- Édition (back-office, JWT + RBAC) -----------------------------------

  @RequirePermissions(Permission.KNOWLEDGE_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledge.list(user.id);
  }

  @RequirePermissions(Permission.KNOWLEDGE_READ)
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.knowledge.getById(id, user.id);
  }

  @RequirePermissions(Permission.KNOWLEDGE_WRITE)
  @Post()
  create(
    @Body() dto: CreateKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledge.create(dto, user.id);
  }

  @RequirePermissions(Permission.KNOWLEDGE_WRITE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledge.update(id, dto, user.id);
  }

  /** Validation (radiologue / responsable) — trace le "validé par". */
  @RequirePermissions(Permission.KNOWLEDGE_VALIDATE)
  @Post(':id/validate')
  validate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.knowledge.validate(id, user.id);
  }
}
