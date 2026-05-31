import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { CallbackStatus } from '@alpha/domain';

/** Mise à jour d'une tâche de rappel (assignation, statut, notes, échéance). */
export class UpdateCallbackDto {
  @IsOptional()
  @IsEnum(CallbackStatus)
  status?: CallbackStatus;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;
}
