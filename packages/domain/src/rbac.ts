import { Permission, RoleName } from './enums';

/**
 * Matrice RBAC : permissions accordees a chaque role.
 * Source de verite unique, utilisee par le seed (core-api) et le front (affichage conditionnel).
 *
 * Principe du moindre privilege :
 *  - secretary : exploitation quotidienne (appels, rappels, relances, lecture connaissance)
 *  - manager   : + supervision, validation connaissance
 *  - admin     : tout (gestion utilisateurs, audit)
 */
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  [RoleName.SECRETARY]: [
    Permission.CALLS_READ,
    Permission.TRANSCRIPTS_READ,
    Permission.RECORDINGS_READ,
    Permission.CALLBACKS_READ,
    Permission.CALLBACKS_WRITE,
    Permission.FOLLOWUPS_READ,
    Permission.FOLLOWUPS_WRITE,
    Permission.KNOWLEDGE_READ,
    Permission.PATIENTS_READ,
  ],
  [RoleName.MANAGER]: [
    Permission.CALLS_READ,
    Permission.TRANSCRIPTS_READ,
    Permission.RECORDINGS_READ,
    Permission.CALLBACKS_READ,
    Permission.CALLBACKS_WRITE,
    Permission.FOLLOWUPS_READ,
    Permission.FOLLOWUPS_WRITE,
    Permission.KNOWLEDGE_READ,
    Permission.KNOWLEDGE_WRITE,
    Permission.KNOWLEDGE_VALIDATE,
    Permission.PATIENTS_READ,
    Permission.SUPERVISION_READ,
  ],
  [RoleName.ADMIN]: Object.values(Permission),
};
