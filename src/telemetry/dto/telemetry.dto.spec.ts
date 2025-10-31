import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TelemetryDto, MetricsDto } from './telemetry.dto';

describe('TelemetryDto Validation', () => {
  it('should pass validation with valid data', async () => {
    const dto = plainToInstance(TelemetryDto, {
      deviceId: 'device-001',
      siteId: 'site-A',
      ts: '2025-10-01T10:00:00.000Z',
      metrics: {
        temperature: 25.5,
        humidity: 60,
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with missing deviceId', async () => {
    const dto = plainToInstance(TelemetryDto, {
      siteId: 'site-A',
      ts: '2025-10-01T10:00:00.000Z',
      metrics: {
        temperature: 25.5,
        humidity: 60,
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('deviceId');
  });

  it('should fail validation with invalid timestamp', async () => {
    const dto = plainToInstance(TelemetryDto, {
      deviceId: 'device-001',
      siteId: 'site-A',
      ts: 'invalid-timestamp',
      metrics: {
        temperature: 25.5,
        humidity: 60,
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation with temperature out of range', async () => {
    const dto = plainToInstance(TelemetryDto, {
      deviceId: 'device-001',
      siteId: 'site-A',
      ts: '2025-10-01T10:00:00.000Z',
      metrics: {
        temperature: 200, // Exceeds max
        humidity: 60,
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation with humidity out of range', async () => {
    const dto = plainToInstance(TelemetryDto, {
      deviceId: 'device-001',
      siteId: 'site-A',
      ts: '2025-10-01T10:00:00.000Z',
      metrics: {
        temperature: 25,
        humidity: 150, // Exceeds max
      },
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail validation with missing metrics', async () => {
    const dto = plainToInstance(TelemetryDto, {
      deviceId: 'device-001',
      siteId: 'site-A',
      ts: '2025-10-01T10:00:00.000Z',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

