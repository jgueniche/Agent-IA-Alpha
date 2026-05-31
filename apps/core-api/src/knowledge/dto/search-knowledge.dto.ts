import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { KnowledgeType, Modality, SiteSlug } from '@alpha/domain';

/** Requête de recherche de connaissance (appelée par l'agent — retrieval RAG). */
export class SearchKnowledgeDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @IsOptional()
  @IsEnum(KnowledgeType)
  type?: KnowledgeType;

  @IsOptional()
  @IsEnum(SiteSlug)
  siteSlug?: SiteSlug;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}
