import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/** Corps de la requete de connexion. */
export class LoginDto {
  @IsEmail({}, { message: 'Email invalide' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Mot de passe requis' })
  password!: string;

  /** Code TOTP (6 chiffres) si la MFA est activee pour le compte. */
  @IsOptional()
  @IsString()
  mfaToken?: string;
}
