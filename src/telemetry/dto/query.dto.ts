import { IsDateString } from 'class-validator';

/**
 * Query parameters for site summary endpoint
 */
export class SiteSummaryQueryDto {
  @IsDateString({}, { message: 'from must be a valid ISO 8601 date string' })
  from: string;

  @IsDateString({}, { message: 'to must be a valid ISO 8601 date string' })
  to: string;
}

/**
 * Response DTO for site summary aggregation
 */
export class SiteSummaryResponseDto {
  count: number;
  avgTemperature: number;
  maxTemperature: number;
  avgHumidity: number;
  maxHumidity: number;
  uniqueDevices: number;
}
