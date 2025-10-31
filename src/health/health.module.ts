import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Health module
 * Provides health check endpoints for service monitoring
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}

