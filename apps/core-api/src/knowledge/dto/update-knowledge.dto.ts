import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { KnowledgeType, Modality, SiteSlug } from '@alpha/domain';

/** Mise à jour d'un item de connaissance (back-office). Toute modif de contenu
 *  incrémente la version et invalide la validation précédente. */
export class UpdateKnowledgeDto {
  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @IsOptional()
  @IsEnum(KnowledgeType)
  type?: KnowledgeType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  content?: string;

  @IsOptional()
  @IsEnum(SiteSlug)
  siteSlug?: SiteSlug;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
