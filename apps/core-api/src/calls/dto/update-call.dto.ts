import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CallOutcome } from '@alpha/domain';

/** Mise a jour d'un appel (emise en fin d'appel ou lors d'un transfert). */
export class UpdateCallDto {
  @IsOptional()
  @IsEnum(CallOutcome)
  outcome?: CallOutcome;

  @IsOptional()
  @IsISO8601()
  endedAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsBoolean()
  agentResolved?: boolean;

  @IsOptional()
  @IsString()
  transferredTo?: string;
}
