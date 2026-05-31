import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { Modality, SiteSlug } from '@alpha/domain';

/** Requête de disponibilités (appelée par l'agent — outil get_availabilities). */
export class AvailabilitiesDto {
  @IsEnum(SiteSlug)
  site!: SiteSlug;

  @IsEnum(Modality)
  modality!: Modality;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
