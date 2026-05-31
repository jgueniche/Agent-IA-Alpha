import { SetMetadata } from '@nestjs/common';

/** Marque une route comme reservee a un appel service-a-service (cle partagee). */
export const SERVICE_ONLY_KEY = 'serviceOnly';

/**
 * Decorateur : la route est appelee par un service interne (ex. voice-gateway)
 * authentifie par cle partagee (header x-service-key), pas par un utilisateur.
 */
export const ServiceOnly = () => SetMetadata(SERVICE_ONLY_KEY, true);
