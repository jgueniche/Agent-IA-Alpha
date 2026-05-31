import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Permission } from '@alpha/domain';
import type { AuthenticatedUser } from '@alpha/domain';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ConsentDto } from './dto/consent.dto';
import { Public } from '../auth/decorators/public.decorator';
import { ServiceOnly } from '../service-auth/service-only.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  // --- Agent (clé de service) ----------------------------------------------

  /** Identifie/crée un patient par téléphone. */
  @Public()
  @ServiceOnly()
  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.patients.upsertByPhone(dto);
  }

  /** Enregistre un consentement (enregistrement, relances, traitement). */
  @Public()
  @ServiceOnly()
  @Post(':id/consents')
  async consent(@Param('id') id: string, @Body() dto: ConsentDto) {
    await this.patients.recordConsent(id, dto.type, dto.granted, dto.source);
    return { ok: true };
  }

  // --- Droits RGPD (back-office) -------------------------------------------

  /** Droit d'accès : export des données du patient. */
  @RequirePermissions(Permission.PATIENTS_READ)
  @Get(':id/export')
  exportData(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.patients.exportData(id, user.id);
  }

  /** Droit à l'effacement : suppression du patient (admin). */
  @RequirePermissions(Permission.USERS_MANAGE)
  @Delete(':id')
  erase(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.patients.erase(id, user.id);
  }
}
