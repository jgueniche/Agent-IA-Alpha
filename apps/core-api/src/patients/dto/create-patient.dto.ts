import { IsOptional, IsString, MinLength } from 'class-validator';

/** Création/identification d'un patient (appelée par l'agent). */
export class CreatePatientDto {
  @IsString()
  @MinLength(6, { message: 'Numéro de téléphone invalide' })
  phone!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}
