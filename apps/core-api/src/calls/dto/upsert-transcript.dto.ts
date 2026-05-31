import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Urgency } from '@alpha/domain';

/** Un tour de parole de la transcription. */
export class TranscriptSegmentDto {
  @IsIn(['patient', 'agent'])
  speaker!: 'patient' | 'agent';

  @IsNumber()
  @Min(0)
  ts!: number;

  @IsString()
  text!: string;
}

/** Transcription complete d'un appel (upsert en fin d'appel). */
export class UpsertTranscriptDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentDto)
  segments!: TranscriptSegmentDto[];

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  intent?: string;

  @IsOptional()
  @IsEnum(Urgency)
  urgency?: Urgency;
}
