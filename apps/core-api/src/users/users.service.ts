import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser, Permission, RoleName } from '@alpha/domain';
import { PrismaService } from '../prisma/prisma.service';

/** Utilisateur charge avec son role et ses permissions. */
const userInclude = { role: { include: { permissions: true } } } as const;

/**
 * Service utilisateurs : lecture des comptes (secretaires / responsables / admins)
 * et de leurs permissions effectives.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recherche par email (login). Inclut le role et les permissions. */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userInclude,
    });
  }

  /** Recherche par identifiant. Inclut le role et les permissions. */
  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });
  }

  /** Projette un utilisateur (avec role/permissions) vers la vue publique. */
  toAuthenticatedUser(user: {
    id: string;
    email: string;
    displayName: string;
    role: { name: string; permissions: { code: string }[] };
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role.name as RoleName,
      permissions: user.role.permissions.map((p) => p.code as Permission),
    };
  }
}
