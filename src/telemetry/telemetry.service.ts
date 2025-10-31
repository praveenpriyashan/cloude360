import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telemetry, TelemetryDocument } from './schemas/telemetry.schema';
import { TelemetryDto } from './dto/telemetry.dto';
import { SiteSummaryResponseDto } from './dto/query.dto';
import { RedisService } from '../redis/redis.service';
import { AlertService } from '../alert/alert.service';

/**
 * Telemetry service
 * Handles telemetry data ingestion, storage, caching, and retrieval
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectModel(Telemetry.name)
    private telemetryModel: Model<TelemetryDocument>,
    private redisService: RedisService,
    private alertService: AlertService,
  ) {}

  /**
   * Ingest single or multiple telemetry readings
   * @param readings - Array of telemetry readings
   * @returns Created telemetry documents
   */
  async ingestTelemetry(
    readings: TelemetryDto[],
  ): Promise<TelemetryDocument[]> {
    this.logger.log(`Ingesting ${readings.length} telemetry reading(s)`);

    const documents = await this.telemetryModel.insertMany(
      readings.map((reading) => ({
        deviceId: reading.deviceId,
        siteId: reading.siteId,
        ts: new Date(reading.ts),
        metrics: reading.metrics,
      })),
    );

    // Process each reading for caching and alerts (async, non-blocking)
    for (let i = 0; i < readings.length; i++) {
      const reading = readings[i];
      const doc = documents[i];

      // Cache latest reading per device (fire and forget)
      this.cacheLatestReading(reading, doc).catch((error) =>
        this.logger.error(
          `Failed to cache reading for ${reading.deviceId}:`,
          error.message,
        ),
      );

      // Check for alerts (fire and forget)
      this.alertService
        .checkAndAlert(
          reading.deviceId,
          reading.siteId,
          reading.ts,
          reading.metrics.temperature,
          reading.metrics.humidity,
        )
        .catch((error) =>
          this.logger.error(
            `Failed to process alerts for ${reading.deviceId}:`,
            error.message,
          ),
        );
    }

    this.logger.log(`Successfully ingested ${documents.length} reading(s)`);
    return documents;
  }

  /**
   * Cache latest reading for a device
   * @param reading - Telemetry reading DTO
   * @param doc - Saved Mongo document
   */
  private async cacheLatestReading(
    reading: TelemetryDto,
    doc: TelemetryDocument,
  ): Promise<void> {
    const cacheData = {
      deviceId: reading.deviceId,
      siteId: reading.siteId,
      ts: reading.ts,
      metrics: reading.metrics,
      _id: (doc as any)._id?.toString(),
      createdAt: (doc as any).createdAt,
    };

    await this.redisService.cacheLatest(reading.deviceId, cacheData);
  }

  /**
   * Get latest telemetry reading for a device
   * Tries Redis first, falls back to MongoDB
   * @param deviceId - Device identifier
   * @returns Latest telemetry reading
   */
  async getLatest(deviceId: string): Promise<any> {
    this.logger.log(`Fetching latest reading for device: ${deviceId}`);

    // Try Redis cache first
    const cached = await this.redisService.getLatest(deviceId);
    if (cached) {
      this.logger.debug(`Cache hit for device: ${deviceId}`);
      return cached;
    }

    this.logger.debug(`Cache miss for device: ${deviceId}, querying MongoDB`);

    // Fallback to MongoDB
    const latest = await this.telemetryModel
      .findOne({ deviceId })
      .sort({ ts: -1 })
      .lean()
      .exec();

    if (!latest) {
      throw new NotFoundException(
        `No telemetry data found for device: ${deviceId}`,
      );
    }

    // Cache the result for next time (fire and forget)
    this.redisService
      .cacheLatest(deviceId, latest)
      .catch((error) =>
        this.logger.error(
          `Failed to cache latest for ${deviceId}:`,
          error.message,
        ),
      );

    return latest;
  }

  /**
   * Get site summary with aggregated statistics
   * @param siteId - Site identifier
   * @param from - Start date (ISO string)
   * @param to - End date (ISO string)
   * @returns Aggregated site statistics
   */
  async getSiteSummary(
    siteId: string,
    from: string,
    to: string,
  ): Promise<SiteSummaryResponseDto> {
    this.logger.log(
      `Generating summary for site: ${siteId} (${from} to ${to})`,
    );

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const result = await this.telemetryModel.aggregate([
      // Match documents for this site and date range
      {
        $match: {
          siteId,
          ts: {
            $gte: fromDate,
            $lte: toDate,
          },
        },
      },
      // Calculate aggregations
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgTemperature: { $avg: '$metrics.temperature' },
          maxTemperature: { $max: '$metrics.temperature' },
          avgHumidity: { $avg: '$metrics.humidity' },
          maxHumidity: { $max: '$metrics.humidity' },
          uniqueDevices: { $addToSet: '$deviceId' },
        },
      },
      // Format output
      {
        $project: {
          _id: 0,
          count: 1,
          avgTemperature: { $round: ['$avgTemperature', 2] },
          maxTemperature: { $round: ['$maxTemperature', 2] },
          avgHumidity: { $round: ['$avgHumidity', 2] },
          maxHumidity: { $round: ['$maxHumidity', 2] },
          uniqueDevices: { $size: '$uniqueDevices' },
        },
      },
    ]);

    if (!result || result.length === 0) {
      // Return empty statistics if no data found
      return {
        count: 0,
        avgTemperature: 0,
        maxTemperature: 0,
        avgHumidity: 0,
        maxHumidity: 0,
        uniqueDevices: 0,
      };
    }

    this.logger.log(
      `Summary generated: ${result[0].count} readings for site ${siteId}`,
    );
    return result[0];
  }
}
