import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { AlertDto, AlertReason } from '../telemetry/dto/alert.dto';

/**
 * Alert service for threshold checking and webhook notifications
 * Handles alert generation, deduplication, and delivery
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly webhookUrl: string;
  private readonly dedupWindow: number;

  // Alert thresholds as per requirements
  private readonly TEMPERATURE_THRESHOLD = 50;
  private readonly HUMIDITY_THRESHOLD = 90;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private redisService: RedisService,
  ) {
    this.webhookUrl = this.configService.get<string>('alert.webhookUrl') || '';
    this.dedupWindow = this.configService.get<number>('alert.dedupWindow') || 60;
  }

  /**
   * Check telemetry reading for threshold violations and trigger alerts
   * @param deviceId - Device identifier
   * @param siteId - Site identifier
   * @param ts - Timestamp
   * @param temperature - Temperature reading
   * @param humidity - Humidity reading
   */
  async checkAndAlert(
    deviceId: string,
    siteId: string,
    ts: string,
    temperature: number,
    humidity: number,
  ): Promise<void> {
    const alerts: AlertDto[] = [];

    // Check temperature threshold
    if (temperature > this.TEMPERATURE_THRESHOLD) {
      const shouldSend = await this.shouldSendAlert(
        deviceId,
        AlertReason.HIGH_TEMPERATURE,
      );

      if (shouldSend) {
        alerts.push({
          deviceId,
          siteId,
          ts,
          reason: AlertReason.HIGH_TEMPERATURE,
          value: temperature,
        });

        await this.redisService.markAlertSent(
          deviceId,
          AlertReason.HIGH_TEMPERATURE,
          this.dedupWindow,
        );
      } else {
        this.logger.debug(
          `Alert suppressed (dedup): ${deviceId} - HIGH_TEMPERATURE`,
        );
      }
    }

    // Check humidity threshold
    if (humidity > this.HUMIDITY_THRESHOLD) {
      const shouldSend = await this.shouldSendAlert(
        deviceId,
        AlertReason.HIGH_HUMIDITY,
      );

      if (shouldSend) {
        alerts.push({
          deviceId,
          siteId,
          ts,
          reason: AlertReason.HIGH_HUMIDITY,
          value: humidity,
        });

        await this.redisService.markAlertSent(
          deviceId,
          AlertReason.HIGH_HUMIDITY,
          this.dedupWindow,
        );
      } else {
        this.logger.debug(
          `Alert suppressed (dedup): ${deviceId} - HIGH_HUMIDITY`,
        );
      }
    }

    // Send all alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
  }

  /**
   * Check if alert should be sent (deduplication logic)
   * @param deviceId - Device identifier
   * @param reason - Alert reason
   * @returns True if alert should be sent
   */
  private async shouldSendAlert(
    deviceId: string,
    reason: AlertReason,
  ): Promise<boolean> {
    const wasRecentlySent = await this.redisService.wasAlertRecentlySent(
      deviceId,
      reason,
    );

    return !wasRecentlySent;
  }

  /**
   * Send alert to configured webhook URL
   * @param alert - Alert data to send
   */
  private async sendAlert(alert: AlertDto): Promise<void> {
    try {
      this.logger.log(
        `🚨 Alert triggered: ${alert.deviceId} - ${alert.reason} (${alert.value})`,
      );

      const response = await firstValueFrom(
        this.httpService.post(this.webhookUrl, alert, {
          timeout: 5000, // 5 second timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.logger.log(
        `Alert sent successfully: ${alert.deviceId} - ${alert.reason} (Status: ${(response as any).status})`,
      );
    } catch (error) {
      // Log error but don't throw - alert failure shouldn't block ingestion
      this.logger.error(
        `Failed to send alert for ${alert.deviceId}:`,
        error.message,
      );

      // Log sanitized error (no sensitive data)
      if (error.response) {
        this.logger.error(
          `Webhook response error: ${error.response.status} - ${error.response.statusText}`,
        );
      }
    }
  }
}
