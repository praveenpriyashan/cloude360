import { Controller, Get, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../redis/redis.service';

/**
 * Health check controller
 * Provides health status for MongoDB and Redis connections
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @InjectConnection() private mongoConnection: Connection,
    private redisService: RedisService,
  ) {}

  /**
   * GET /api/v1/health
   * Check health status of all dependencies
   */
  @Get()
  async checkHealth() {
    const mongoHealthy = this.mongoConnection.readyState === 1; // 1 = connected
    const redisHealthy = await this.redisService.isHealthy();

    const overallHealthy = mongoHealthy && redisHealthy;

    const response = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: {
          status: mongoHealthy ? 'up' : 'down',
          readyState: this.mongoConnection.readyState,
        },
        redis: {
          status: redisHealthy ? 'up' : 'down',
        },
      },
    };

    if (!overallHealthy) {
      this.logger.warn('Health check failed', response);
    }

    return response;
  }
}
