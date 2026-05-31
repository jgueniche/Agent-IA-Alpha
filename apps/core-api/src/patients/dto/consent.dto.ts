import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ConsentType } from '@alpha/domain';

/** Enregistrement d'un consentement patient (distinct par type). */
export class ConsentDto {
  @IsEnum(ConsentType)
  type!: ConsentType;

  @IsBoolean()
  granted!: boolean;

  @IsOptional()
  @IsString()
  source?: string;
}
