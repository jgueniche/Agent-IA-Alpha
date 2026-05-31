# Intégration agenda — contrainte Doctolib

## Le constat

**Doctolib n'expose pas d'API publique.** L'accès programmatique est réservé aux
**partenaires agréés** via une procédure d'accréditation. Par conséquent :

- ❌ On n'écrit **jamais** de code appelant une « API Doctolib » publique (elle
  n'existe pas).
- ❌ On ne fait **pas** de scraping / RPA sur Doctolib : violation des CGU,
  fragilité technique, et manipulation de données de santé hors cadre.

## La solution : couche d'abstraction `CalendarProvider`

Toute la logique métier dépend d'une interface unique
(`packages/providers/src/calendar/calendar-provider.ts`). On peut changer de
source d'agenda **sans réécrire le métier**.

| Adaptateur | Rôle | Disponibilité |
|---|---|---|
| `ICalSyncAdapter` | **Lecture seule** via flux iCal synchronisé depuis Doctolib (export calendrier). Fonctionne dès le jour 1, sans accréditation. | Phase 4 |
| `DoctolibPartnerAdapter` | API **officielle partenaire** (lecture + écriture), activée si/quand l'accréditation est obtenue. Stub conforme à l'interface en attendant. | Quand accréditation obtenue |

Sélection par variable d'environnement :

```
CALENDAR_PROVIDER=ical          # défaut, lecture seule
# CALENDAR_PROVIDER=doctolib_partner   # si accréditation
ICAL_FEED_URL_CERGY=...
ICAL_FEED_URL_GOUSSAINVILLE=...
DOCTOLIB_PARTNER_CLIENT_ID=...  # uniquement si partenaire
DOCTOLIB_PARTNER_SECRET=...
```

## Et l'écriture (prise de RDV) ?

Tant que l'API officielle n'est pas branchée, **l'agent ne crée pas de RDV
directement**. Il :

1. qualifie la demande et propose des **créneaux indicatifs** (lus via iCal) ;
2. crée une **tâche de prise de RDV** (`callback_tasks`) pour une secrétaire ;
   *ou*
3. envoie au patient le **lien de prise de RDV en ligne** (SMS/WhatsApp).

L'interface expose `createAppointment()` en **optionnel** ; un adaptateur en
lecture seule lève `WriteNotSupportedError`, ce qui déclenche le déport vers le
back-office. Le jour où l'accréditation est obtenue, on active
`DoctolibPartnerAdapter` et l'écriture devient native — sans toucher au métier.
