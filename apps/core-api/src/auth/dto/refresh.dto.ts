import { IsString, MinLength } from 'class-validator';

/** Corps de la requete de rafraichissement de token. */
export class RefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
