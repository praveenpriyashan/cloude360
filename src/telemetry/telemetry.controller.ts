import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryDto, BulkTelemetryDto } from './dto/telemetry.dto';
import { SiteSummaryQueryDto, SiteSummaryResponseDto } from './dto/query.dto';
import { AuthGuard } from '../auth/auth.guard';

/**
 * Telemetry controller
 * Handles HTTP endpoints for telemetry data ingestion and retrieval
 */
@Controller('telemetry')
export class TelemetryController {
  private readonly logger = new Logger(TelemetryController.name);

  constructor(private readonly telemetryService: TelemetryService) {}

  /**
   * POST /api/v1/telemetry
   * Accepts single reading or array of readings
   * Protected with optional bearer token authentication
   */
  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async ingestTelemetry(
    @Body() payload: TelemetryDto | BulkTelemetryDto | TelemetryDto[],
  ) {
    this.logger.log('Received telemetry ingestion request');

    // Normalize input to array
    let readings: TelemetryDto[];

    if (Array.isArray(payload)) {
      // Direct array of readings
      readings = payload;
    } else if ('readings' in payload && Array.isArray(payload.readings)) {
      // Bulk payload with readings array
      readings = payload.readings;
    } else {
      // Single reading
      readings = [payload as TelemetryDto];
    }

    const result = await this.telemetryService.ingestTelemetry(readings);

    return {
      success: true,
      message: `Successfully ingested ${result.length} telemetry reading(s)`,
      count: result.length,
    };
  }
}

/**
 * Devices controller
 * Handles device-specific endpoints
 */
@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name);

  constructor(private readonly telemetryService: TelemetryService) {}

  /**
   * GET /api/v1/devices/:deviceId/latest
   * Get latest telemetry reading for a device
   * Checks Redis cache first, falls back to MongoDB
   */
  @Get(':deviceId/latest')
  async getLatest(@Param('deviceId') deviceId: string) {
    this.logger.log(`Request for latest reading: ${deviceId}`);
    return this.telemetryService.getLatest(deviceId);
  }
}

/**
 * Sites controller
 * Handles site-specific endpoints
 */
@Controller('sites')
export class SitesController {
  private readonly logger = new Logger(SitesController.name);

  constructor(private readonly telemetryService: TelemetryService) {}

  /**
   * GET /api/v1/sites/:siteId/summary
   * Get aggregated statistics for a site within a date range
   */
  @Get(':siteId/summary')
  async getSummary(
    @Param('siteId') siteId: string,
    @Query() query: SiteSummaryQueryDto,
  ): Promise<SiteSummaryResponseDto> {
    this.logger.log(`Request for site summary: ${siteId}`);
    return this.telemetryService.getSiteSummary(siteId, query.from, query.to);
  }
}

