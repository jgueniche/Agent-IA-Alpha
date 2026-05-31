import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';
import { FollowupChannel } from '@alpha/domain';

/** Programmation d'une relance. */
export class ScheduleFollowupDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsEnum(FollowupChannel)
  channel!: FollowupChannel;

  @IsString()
  @MinLength(2)
  template!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsBoolean()
  marketing?: boolean;
}
