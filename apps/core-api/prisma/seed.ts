/**
 * Seed initial (Phase 0) :
 *  - permissions et roles (matrice RBAC issue de @alpha/domain)
 *  - sites Cergy et Goussainville
 *  - compte admin initial (a changer immediatement en production)
 *  - compte secretaire de demonstration
 *
 * Idempotent : peut etre rejoue sans dupliquer (upserts).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  Modality,
  Permission,
  ROLE_PERMISSIONS,
  RoleName,
  SiteSlug,
} from '@alpha/domain';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1) Permissions
  const allPermissions = Object.values(Permission);
  for (const code of allPermissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
  const permissionRows = await prisma.permission.findMany();
  const permIdByCode = new Map(permissionRows.map((p) => [p.code, p.id]));

  // 2) Roles + rattachement des permissions
  for (const roleName of Object.values(RoleName)) {
    const codes = ROLE_PERMISSIONS[roleName];
    await prisma.role.upsert({
      where: { name: roleName },
      update: {
        permissions: {
          set: codes.map((c) => ({ id: permIdByCode.get(c)! })),
        },
      },
      create: {
        name: roleName,
        permissions: {
          connect: codes.map((c) => ({ id: permIdByCode.get(c)! })),
        },
      },
    });
  }

  // 3) Sites
  await prisma.site.upsert({
    where: { slug: SiteSlug.CERGY },
    update: {},
    create: {
      slug: SiteSlug.CERGY,
      name: 'Alpha Imagerie — Cergy',
      address: 'Cergy (95)',
      modalities: [
        Modality.IRM,
        Modality.SCANNER,
        Modality.RADIOGRAPHIE,
        Modality.ECHOGRAPHIE,
        Modality.MAMMOGRAPHIE,
        Modality.CONE_BEAM,
      ],
      hours: {},
    },
  });
  await prisma.site.upsert({
    where: { slug: SiteSlug.GOUSSAINVILLE },
    update: {},
    create: {
      slug: SiteSlug.GOUSSAINVILLE,
      name: 'Alpha Imagerie — Goussainville',
      address: 'Goussainville (95)',
      modalities: [
        Modality.IRM,
        Modality.SCANNER,
        Modality.RADIOGRAPHIE,
        Modality.ECHOGRAPHIE,
      ],
      hours: {},
    },
  });

  // 4) Comptes initiaux
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.ADMIN },
  });
  const secretaryRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.SECRETARY },
  });

  const adminEmail = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@alpha-imagerie.local'
  ).toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error(
      'SEED_ADMIN_PASSWORD manquant : impossible de creer le compte admin initial.',
    );
  }
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      displayName: 'Administrateur',
      roleId: adminRole.id,
    },
  });

  const secretaryEmail = 'secretaire@alpha-imagerie.local';
  await prisma.user.upsert({
    where: { email: secretaryEmail },
    update: {},
    create: {
      email: secretaryEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      displayName: 'Secretaire Demo',
      roleId: secretaryRole.id,
    },
  });

  console.log('Seed termine : permissions, roles, sites et comptes initiaux.');
}

main()
  .catch((e) => {
    console.error('Echec du seed :', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
