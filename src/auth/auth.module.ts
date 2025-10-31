import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

/**
 * Authentication module
 * Provides bearer token authentication guard
 */
@Module({
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}

