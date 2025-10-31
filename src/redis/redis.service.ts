import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis service for caching latest telemetry readings
 * Provides connection management and cache operations
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('redis.url') || 'redis://localhost:6379';
    
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          this.logger.warn(`Retrying Redis connection... Attempt ${times}`);
          return delay;
        },
        reconnectOnError: (err) => {
          this.logger.error('Redis reconnect on error:', err.message);
          return true;
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('✅ Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.logger.error('❌ Redis connection error:', error.message);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('⚠️ Redis connection closed');
      });

      // Test connection
      await this.client.ping();
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error.message);
      // Don't throw error - allow app to continue with degraded functionality
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed gracefully');
    }
  }

  /**
   * Cache latest telemetry reading for a device
   * @param deviceId - Unique device identifier
   * @param data - Telemetry data to cache
   * @param ttl - Time to live in seconds (optional, default: 24 hours)
   */
  async cacheLatest(
    deviceId: string,
    data: any,
    ttl: number = 86400,
  ): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping cache operation');
      return;
    }

    try {
      const key = `latest:${deviceId}`;
      await this.client.setex(key, ttl, JSON.stringify(data));
      this.logger.debug(`Cached latest reading for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to cache data for ${deviceId}:`, error.message);
      // Fail gracefully - don't throw error
    }
  }

  /**
   * Get latest cached telemetry reading for a device
   * @param deviceId - Unique device identifier
   * @returns Cached telemetry data or null if not found
   */
  async getLatest(deviceId: string): Promise<Record<string, unknown> | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning null');
      return null;
    }

    try {
      const key = `latest:${deviceId}`;
      const data = await this.client.get(key);

      if (!data) {
        this.logger.debug(`No cached data found for device: ${deviceId}`);
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(
        `Failed to get cached data for ${deviceId}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Check if an alert was recently sent (deduplication)
   * @param deviceId - Device identifier
   * @param reason - Alert reason
   * @returns True if alert was recently sent
   */
  async wasAlertRecentlySent(
    deviceId: string,
    reason: string,
  ): Promise<boolean> {
    if (!this.isConnected) {
      return false; // Allow alert if Redis is down
    }

    try {
      const key = `alert:${deviceId}:${reason}`;
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error('Failed to check alert deduplication:', error.message);
      return false;
    }
  }

  /**
   * Mark an alert as sent (for deduplication)
   * @param deviceId - Device identifier
   * @param reason - Alert reason
   * @param windowSeconds - Deduplication window in seconds
   */
  async markAlertSent(
    deviceId: string,
    reason: string,
    windowSeconds: number,
  ): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = `alert:${deviceId}:${reason}`;
      await this.client.setex(key, windowSeconds, '1');
      this.logger.debug(`Alert marked as sent: ${key}`);
    } catch (error) {
      this.logger.error('Failed to mark alert as sent:', error.message);
    }
  }

  /**
   * Check Redis health status
   * @returns True if Redis is connected and responsive
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed:', error.message);
      return false;
    }
  }
}
