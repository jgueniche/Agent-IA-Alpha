import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { CallsService } from './calls.service';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { UpsertTranscriptDto } from './dto/upsert-transcript.dto';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ServiceOnly } from '../service-auth/service-only.decorator';

/** Extrait l'IP client (reverse-proxy aware). */
function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]?.trim();
  return req.ip;
}

@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  // --- Ingestion (voice-gateway, cle de service) ---------------------------

  /** Demarrage d'un appel. */
  @Public()
  @ServiceOnly()
  @Post()
  create(@Body() dto: CreateCallDto, @Req() req: Request) {
    return this.calls.createCall(dto, clientIp(req));
  }

  /** Mise a jour d'un appel (fin / transfert). */
  @Public()
  @ServiceOnly()
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCallDto,
    @Req() req: Request,
  ) {
    await this.calls.updateCall(id, dto, clientIp(req));
    return { ok: true };
  }

  /** Transcription de l'appel (upsert). */
  @Public()
  @ServiceOnly()
  @Put(':id/transcript')
  async transcript(
    @Param('id') id: string,
    @Body() dto: UpsertTranscriptDto,
    @Req() req: Request,
  ) {
    await this.calls.upsertTranscript(id, dto, clientIp(req));
    return { ok: true };
  }

  // --- Lecture (back-office, JWT + RBAC) -----------------------------------

  /** Liste des appels recents (secretaires). */
  @RequirePermissions(Permission.CALLS_READ)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.calls.listCalls(user.id);
  }

  /** Detail d'un appel (numero appelant dechiffre — acces trace). */
  @RequirePermissions(Permission.CALLS_READ)
  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.calls.getCallDetail(id, user.id);
  }

  /** Transcription d'un appel (acces trace). */
  @RequirePermissions(Permission.TRANSCRIPTS_READ)
  @Get(':id/transcript')
  transcriptRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calls.getTranscript(id, user.id);
  }
}
