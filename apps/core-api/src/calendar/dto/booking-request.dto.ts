import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Modality, SiteSlug } from '@alpha/domain';

/** Demande de prise de RDV déportée (agent → tâche de rappel back-office). */
export class BookingRequestDto {
  @IsEnum(SiteSlug)
  site!: SiteSlug;

  @IsEnum(Modality)
  modality!: Modality;

  @IsOptional()
  @IsISO8601()
  desiredStartAt?: string;

  @IsOptional()
  @IsString()
  callId?: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
