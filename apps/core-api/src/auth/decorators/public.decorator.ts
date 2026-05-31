import { SetMetadata } from '@nestjs/common';

/** Cle de metadonnee marquant une route publique (sans JWT). */
export const IS_PUBLIC_KEY = 'isPublic';

/** Decorateur : rend une route accessible sans authentification. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
