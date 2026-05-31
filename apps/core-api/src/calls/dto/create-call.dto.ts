import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CallDirection, SiteSlug } from '@alpha/domain';

/** Creation d'un appel (emise par la voice-gateway au debut de l'appel). */
export class CreateCallDto {
  @IsOptional()
  @IsEnum(SiteSlug, { message: 'site invalide' })
  site?: SiteSlug;

  /** Numero appelant en clair (chiffre par core-api avant persistance). */
  @IsOptional()
  @IsString()
  callerNumber?: string;

  @IsOptional()
  @IsEnum(CallDirection)
  direction?: CallDirection;
}
