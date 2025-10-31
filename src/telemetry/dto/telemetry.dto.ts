import {
  IsString,
  IsNotEmpty,
  IsDateString,
  ValidateNested,
  IsNumber,
  IsArray,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Metrics DTO for temperature and humidity validation
 */
export class MetricsDto {
  @IsNumber()
  @Min(-100, { message: 'Temperature must be at least -100°C' })
  @Max(150, { message: 'Temperature must not exceed 150°C' })
  temperature: number;

  @IsNumber()
  @Min(0, { message: 'Humidity must be at least 0%' })
  @Max(100, { message: 'Humidity must not exceed 100%' })
  humidity: number;
}

/**
 * Single telemetry reading DTO
 */
export class TelemetryDto {
  @IsString()
  @IsNotEmpty({ message: 'Device ID is required' })
  deviceId: string;

  @IsString()
  @IsNotEmpty({ message: 'Site ID is required' })
  siteId: string;

  @IsDateString(
    {},
    { message: 'Timestamp must be a valid ISO 8601 date string' },
  )
  ts: string;

  @ValidateNested()
  @Type(() => MetricsDto)
  metrics: MetricsDto;
}

/**
 * Bulk telemetry ingestion DTO
 * Accepts either a single reading or an array of readings
 */
export class BulkTelemetryDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one telemetry reading is required' })
  @ValidateNested({ each: true })
  @Type(() => TelemetryDto)
  readings?: TelemetryDto[];
}

