/**
 * Jeu de DÉMO (QA) : peuple l'application pour la prévisualisation back-office
 * (journal d'appels + transcriptions, file de rappel, relances, agenda, métriques).
 *
 * Activé par SEED_DEMO=true. Idempotent (identifiants fixes + upsert).
 * Données fictives uniquement — aucune donnée réelle de patient.
 */
import { PrismaClient } from '@prisma/client';
import { Modality, SiteSlug } from '@alpha/domain';
import { CryptoService } from '../src/crypto/crypto.service';

const DAY = 86_400_000;
const id = (n: string) => `00000000-0000-0000-0000-0000000000${n}`;

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  const crypto = new CryptoService();
  const now = Date.now();
  const cergy = await prisma.site.findUnique({ where: { slug: SiteSlug.CERGY } });
  const siteId = cergy?.id ?? null;

  // --- Patients (identité chiffrée) + consentements -------------------------
  const patients = [
    { id: id('a1'), phone: '0612345678', firstName: 'Marie', lastName: 'Durand' },
    { id: id('a2'), phone: '0698765432', firstName: 'Paul', lastName: 'Martin' },
  ];
  for (const p of patients) {
    await prisma.patient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        phoneHash: crypto.hash(p.phone),
        phoneEnc: crypto.encrypt(p.phone),
        firstName: crypto.encrypt(p.firstName),
        lastName: crypto.encrypt(p.lastName),
      },
    });
    await prisma.consent.upsert({
      where: { id: `${p.id}-c` },
      update: {},
      create: {
        id: `${p.id}-c`,
        patientId: p.id,
        type: 'followup_transactional',
        granted: true,
        source: 'demo',
      },
    });
  }

  // --- Appels + transcriptions ---------------------------------------------
  const calls = [
    {
      n: 'c1', caller: '0612345678', startedAt: now - 2 * DAY, duration: 95,
      outcome: 'resolved_by_agent', resolved: true, latency: 420,
      intent: 'prise_rdv', urgency: 'none',
      segments: [
        { speaker: 'patient', ts: 0, text: 'Bonjour, je voudrais un rendez-vous pour une IRM.' },
        { speaker: 'agent', ts: 3, text: 'Voici des créneaux disponibles à Cergy : le 05/06 à 09:00, le 06/06 à 14:00.' },
        { speaker: 'patient', ts: 9, text: 'Le premier me convient.' },
        { speaker: 'agent', ts: 12, text: "C'est noté, une secrétaire confirmera votre rendez-vous." },
      ],
    },
    {
      n: 'c2', caller: '0698765432', startedAt: now - 1 * DAY, duration: 40,
      outcome: 'transferred_to_human', resolved: false, latency: 380, transferredTo: '721',
      intent: 'autre', urgency: 'critical',
      segments: [
        { speaker: 'patient', ts: 0, text: "J'ai une forte douleur dans la poitrine." },
        { speaker: 'agent', ts: 2, text: 'Vos symptômes peuvent relever d\'une urgence. Composez le 15. Je vous mets en relation avec une secrétaire.' },
      ],
    },
    {
      n: 'c3', caller: '0600000003', startedAt: now - 5 * 3600 * 1000, duration: 18,
      outcome: 'missed', resolved: false, latency: null,
      intent: null, urgency: 'none', segments: [],
    },
    {
      n: 'c4', caller: '0600000004', startedAt: now - 3600 * 1000, duration: 60,
      outcome: 'resolved_by_agent', resolved: true, latency: 510,
      intent: 'preparation_examen', urgency: 'none',
      segments: [
        { speaker: 'patient', ts: 0, text: 'Faut-il être à jeun pour un scanner avec injection ?' },
        { speaker: 'agent', ts: 3, text: 'Oui, présentez-vous à jeun depuis 3 à 4 heures ; une prise de sang récente peut être demandée.' },
      ],
    },
  ];
  for (const c of calls) {
    await prisma.call.upsert({
      where: { id: id(c.n) },
      update: {},
      create: {
        id: id(c.n),
        siteId,
        callerNumber: crypto.encrypt(c.caller),
        direction: 'inbound',
        startedAt: new Date(c.startedAt),
        endedAt: new Date(c.startedAt + c.duration * 1000),
        duration: c.duration,
        outcome: c.outcome as never,
        agentResolved: c.resolved,
        transferredTo: (c as { transferredTo?: string }).transferredTo ?? null,
        agentLatencyMs: c.latency,
      },
    });
    if (c.segments.length > 0) {
      await prisma.transcript.upsert({
        where: { callId: id(c.n) },
        update: {},
        create: {
          callId: id(c.n),
          segments: c.segments as never,
          summary: `Demande : ${c.segments[0]?.text ?? ''}`,
          intent: c.intent,
          urgencyFlag: c.urgency as never,
        },
      });
    }
  }

  // --- File de rappel -------------------------------------------------------
  const callbacks = [
    { n: 'b1', callId: id('c3'), motif: 'Appel manqué — rappeler le patient', status: 'pending', urgency: 'none' },
    { n: 'b2', callId: id('c1'), patientId: id('a1'), motif: 'Prise de RDV irm — cergy', status: 'pending', urgency: 'none' },
    { n: 'b3', patientId: id('a2'), motif: 'Compléter le dossier (ordonnance manquante)', status: 'assigned', urgency: 'low' },
  ];
  for (const b of callbacks) {
    await prisma.callbackTask.upsert({
      where: { id: id(b.n) },
      update: {},
      create: {
        id: id(b.n),
        callId: b.callId ?? null,
        patientId: (b as { patientId?: string }).patientId ?? null,
        motif: b.motif,
        status: b.status as never,
        urgency: b.urgency as never,
      },
    });
  }

  // --- Relances -------------------------------------------------------------
  await prisma.followup.upsert({
    where: { id: id('f1') },
    update: {},
    create: {
      id: id('f1'), patientId: id('a1'), channel: 'sms', template: 'rappel_rdv',
      scheduledAt: new Date(now + 1 * DAY), status: 'scheduled',
    },
  });
  await prisma.followup.upsert({
    where: { id: id('f2') },
    update: {},
    create: {
      id: id('f2'), patientId: id('a2'), channel: 'whatsapp', template: 'rappel_rdv',
      scheduledAt: new Date(now - 2 * 3600 * 1000), status: 'sent',
      sentAt: new Date(now - 2 * 3600 * 1000), providerRef: 'demo-sent-1',
    },
  });

  // --- Agenda (créneaux libres synchronisés) --------------------------------
  const slots = [
    { n: 's1', mod: Modality.IRM, start: now + 4 * DAY + 9 * 3600 * 1000 },
    { n: 's2', mod: Modality.IRM, start: now + 5 * DAY + 14 * 3600 * 1000 },
    { n: 's3', mod: Modality.SCANNER, start: now + 3 * DAY + 10 * 3600 * 1000 },
  ];
  for (const s of slots) {
    await prisma.appointmentCache.upsert({
      where: { externalId: `demo-${s.n}` },
      update: {},
      create: {
        externalId: `demo-${s.n}`,
        siteId,
        modality: s.mod as never,
        startAt: new Date(s.start),
        endAt: new Date(s.start + 30 * 60 * 1000),
        status: 'free',
      },
    });
  }

  console.log('Seed DÉMO : 2 patients, 4 appels, 3 rappels, 2 relances, 3 créneaux.');
}
