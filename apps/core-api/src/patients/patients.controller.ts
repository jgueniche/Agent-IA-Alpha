import { Body, Controller, Param, Post } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { ConsentDto } from './dto/consent.dto';
import { Public } from '../auth/decorators/public.decorator';
import { ServiceOnly } from '../service-auth/service-only.decorator';

/** Routes patients (appelées par l'agent — clé de service). */
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

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
}
