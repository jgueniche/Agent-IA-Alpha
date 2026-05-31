/**
 * Jeu de connaissances initial (imagerie). Contenu indicatif et generique,
 * destine a etre RELU ET VALIDE par un radiologue avant mise en service
 * (champ validatedBy / versioning gere en back-office). Tant qu'il n'est pas
 * valide, validatedById reste null.
 *
 * La cle (`key`) rend le seed idempotent et sert de reference d'edition.
 */
import { KnowledgeType, Modality, SiteSlug } from '@alpha/domain';

export interface KnowledgeSeedItem {
  key: string;
  modality: Modality | null;
  type: KnowledgeType;
  title: string;
  content: string;
  siteSlug?: SiteSlug;
}

export const KNOWLEDGE_SEED: KnowledgeSeedItem[] = [
  {
    key: 'irm_contre_indications',
    modality: Modality.IRM,
    type: KnowledgeType.CONTRE_INDICATION,
    title: 'IRM — contre-indications et précautions',
    content:
      "L'IRM utilise un champ magnétique puissant. Signalez impérativement : " +
      'pacemaker ou défibrillateur, implants ou clips métalliques, neurostimulateur, ' +
      "pompe à insuline, corps étranger métallique (notamment oculaire), prothèses. " +
      'Signalez une grossesse et une claustrophobie. Retirez tout objet métallique ' +
      '(bijoux, piercings, montre, carte bancaire) avant l\'examen.',
  },
  {
    key: 'irm_preparation',
    modality: Modality.IRM,
    type: KnowledgeType.PREPARATION,
    title: 'IRM — préparation',
    content:
      "En général, l'IRM ne nécessite pas d'être à jeun, sauf indication contraire " +
      "(certaines IRM abdominales/pelviennes). Prévoyez une tenue sans métal. " +
      "L'examen dure de 15 à 30 minutes. En cas d'injection de produit de contraste " +
      '(gadolinium), une prise de sang récente peut être demandée.',
  },
  {
    key: 'scanner_injecte_preparation',
    modality: Modality.SCANNER,
    type: KnowledgeType.PREPARATION,
    title: 'Scanner (TDM) avec injection — préparation',
    content:
      "Pour un scanner avec injection de produit de contraste iodé, présentez-vous " +
      'à jeun depuis 3 à 4 heures (vous pouvez boire de l\'eau et prendre vos médicaments). ' +
      "Un dosage récent de la créatinine (fonction rénale) peut être demandé. Signalez " +
      "toute allergie à l'iode, un diabète (traitement par metformine) et une grossesse. " +
      "Hydratez-vous bien après l'examen.",
  },
  {
    key: 'mammographie_preparation',
    modality: Modality.MAMMOGRAPHIE,
    type: KnowledgeType.PREPARATION,
    title: 'Mammographie — préparation',
    content:
      'Réalisez de préférence la mammographie en première partie du cycle (juste après ' +
      'les règles), quand la poitrine est moins sensible. N\'appliquez ni déodorant, ni ' +
      'crème, ni talc sur la poitrine et les aisselles le jour de l\'examen. Apportez vos ' +
      'anciens clichés pour comparaison. Signalez une grossesse éventuelle.',
  },
  {
    key: 'echographie_pelvienne_preparation',
    modality: Modality.ECHOGRAPHIE,
    type: KnowledgeType.PREPARATION,
    title: 'Échographie pelvienne — préparation (vessie pleine)',
    content:
      'Pour une échographie pelvienne (sus-pubienne), présentez-vous la vessie pleine : ' +
      "buvez environ 1 litre d'eau une heure avant l'examen et n'urinez pas avant. " +
      'Aucune autre préparation particulière.',
  },
  {
    key: 'echographie_abdominale_preparation',
    modality: Modality.ECHOGRAPHIE,
    type: KnowledgeType.PREPARATION,
    title: 'Échographie abdominale — préparation (à jeun)',
    content:
      "Pour une échographie de l'abdomen, présentez-vous à jeun depuis 6 heures " +
      '(ni aliment, ni boisson sucrée ; eau et médicaments autorisés) afin de limiter ' +
      'les gaz digestifs et de bien visualiser la vésicule biliaire.',
  },
  {
    key: 'radiographie_preparation',
    modality: Modality.RADIOGRAPHIE,
    type: KnowledgeType.PREPARATION,
    title: 'Radiographie — préparation',
    content:
      "La radiographie est rapide et ne nécessite aucune préparation ni d'être à jeun. " +
      'Retirez les bijoux et objets métalliques de la zone examinée. Signalez une ' +
      'grossesse éventuelle.',
  },
  {
    key: 'cone_beam_preparation',
    modality: Modality.CONE_BEAM,
    type: KnowledgeType.PREPARATION,
    title: 'Cone Beam (dentaire) — préparation',
    content:
      'Le Cone Beam est un examen rapide du massif facial / des dents. Aucune préparation ' +
      'ni jeûne. Retirez bijoux, lunettes et appareils dentaires amovibles avant l\'examen.',
  },
  {
    key: 'documents_general',
    modality: null,
    type: KnowledgeType.DOCUMENT,
    title: 'Documents à apporter',
    content:
      'Apportez : votre ordonnance (prescription médicale), votre carte Vitale et votre ' +
      'carte de mutuelle, une pièce d\'identité, vos anciens examens et comptes rendus en ' +
      'rapport, et le courrier de votre médecin le cas échéant.',
  },
  {
    key: 'grossesse_radiologie',
    modality: null,
    type: KnowledgeType.CONTRE_INDICATION,
    title: 'Grossesse et imagerie',
    content:
      'Signalez toute grossesse ou suspicion de grossesse avant un examen utilisant des ' +
      'rayons X (radiographie, scanner, mammographie). Une alternative sans rayons ' +
      '(échographie, IRM) pourra être envisagée selon la prescription.',
  },
  {
    key: 'horaires_cergy',
    modality: null,
    type: KnowledgeType.HORAIRES,
    title: 'Horaires — site de Cergy',
    content:
      'Le site de Cergy est ouvert du lundi au vendredi de 8h00 à 19h00 et le samedi ' +
      'de 8h00 à 12h00.',
    siteSlug: SiteSlug.CERGY,
  },
  {
    key: 'horaires_goussainville',
    modality: null,
    type: KnowledgeType.HORAIRES,
    title: 'Horaires — site de Goussainville',
    content:
      'Le site de Goussainville est ouvert du lundi au vendredi de 8h30 à 18h30. ' +
      'Fermé le samedi.',
    siteSlug: SiteSlug.GOUSSAINVILLE,
  },
  {
    key: 'acces_cergy',
    modality: null,
    type: KnowledgeType.ACCES,
    title: 'Accès et stationnement — site de Cergy',
    content:
      'Le site de Cergy est accessible en RER A (gare de Cergy) et dispose d\'un parking ' +
      'à proximité. Accès de plain-pied, adapté aux personnes à mobilité réduite.',
    siteSlug: SiteSlug.CERGY,
  },
];
