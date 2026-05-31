import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

/** Module utilisateurs. */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
