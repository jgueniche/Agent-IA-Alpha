import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { KnowledgeType, Modality, SiteSlug } from '@alpha/domain';

/** Création d'un item de connaissance (back-office). */
export class CreateKnowledgeDto {
  @IsString()
  @MinLength(3)
  key!: string;

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @IsEnum(KnowledgeType)
  type!: KnowledgeType;

  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  content!: string;

  @IsOptional()
  @IsEnum(SiteSlug)
  siteSlug?: SiteSlug;
}
