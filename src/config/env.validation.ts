import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

/**
 * Environment variables validation schema
 * Ensures all required environment variables are present and valid
 */
class EnvironmentVariables {
  @IsEnum(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  MONGO_URI: string;

  @IsString()
  REDIS_URL: string;

  @IsUrl({ require_tld: false })
  ALERT_WEBHOOK_URL: string;

  @IsString()
  @IsOptional()
  INGEST_TOKEN?: string;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX: number = 100;

  @IsNumber()
  @IsOptional()
  ALERT_DEDUP_WINDOW: number = 60;
}

/**
 * Validates environment variables against the schema
 * @param config - Raw environment configuration object
 * @returns Validated configuration object
 * @throws Error if validation fails
 */
export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((err) => Object.values(err.constraints || {}).join(', '))
        .join('\n')}`,
    );
  }

  return validatedConfig;
}

