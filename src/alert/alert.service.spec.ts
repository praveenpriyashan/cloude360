import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AlertService } from './alert.service';
import { RedisService } from '../redis/redis.service';
import { AlertReason } from '../telemetry/dto/alert.dto';

describe('AlertService', () => {
  let service: AlertService;
  let mockHttpService: any;
  let mockRedisService: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

    mockRedisService = {
      wasAlertRecentlySent: jest.fn().mockResolvedValue(false),
      markAlertSent: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config = {
          'alert.webhookUrl': 'https://webhook.site/test-uuid',
          'alert.dedupWindow': 60,
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AlertService>(AlertService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAndAlert', () => {
    it('should send alert for high temperature', async () => {
      mockHttpService.post.mockReturnValue(
        of({ status: 200, data: { success: true } }),
      );

      await service.checkAndAlert(
        'device-001',
        'site-A',
        '2025-10-01T10:00:00Z',
        55,
        60,
      );

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://webhook.site/test-uuid',
        expect.objectContaining({
          deviceId: 'device-001',
          siteId: 'site-A',
          reason: AlertReason.HIGH_TEMPERATURE,
          value: 55,
        }),
        expect.any(Object),
      );

      expect(mockRedisService.markAlertSent).toHaveBeenCalledWith(
        'device-001',
        AlertReason.HIGH_TEMPERATURE,
        60,
      );
    });

    it('should send alert for high humidity', async () => {
      mockHttpService.post.mockReturnValue(
        of({ status: 200, data: { success: true } }),
      );

      await service.checkAndAlert(
        'device-001',
        'site-A',
        '2025-10-01T10:00:00Z',
        30,
        95,
      );

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://webhook.site/test-uuid',
        expect.objectContaining({
          deviceId: 'device-001',
          siteId: 'site-A',
          reason: AlertReason.HIGH_HUMIDITY,
          value: 95,
        }),
        expect.any(Object),
      );

      expect(mockRedisService.markAlertSent).toHaveBeenCalledWith(
        'device-001',
        AlertReason.HIGH_HUMIDITY,
        60,
      );
    });

    it('should not send alert when values are below threshold', async () => {
      await service.checkAndAlert(
        'device-001',
        'site-A',
        '2025-10-01T10:00:00Z',
        30,
        60,
      );

      expect(mockHttpService.post).not.toHaveBeenCalled();
      expect(mockRedisService.markAlertSent).not.toHaveBeenCalled();
    });

    it('should suppress duplicate alerts', async () => {
      mockRedisService.wasAlertRecentlySent.mockResolvedValue(true);

      await service.checkAndAlert(
        'device-001',
        'site-A',
        '2025-10-01T10:00:00Z',
        55,
        60,
      );

      expect(mockHttpService.post).not.toHaveBeenCalled();
      expect(mockRedisService.markAlertSent).not.toHaveBeenCalled();
    });

    it('should handle webhook errors gracefully', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Webhook unavailable')),
      );

      // Should not throw error
      await expect(
        service.checkAndAlert(
          'device-001',
          'site-A',
          '2025-10-01T10:00:00Z',
          55,
          60,
        ),
      ).resolves.not.toThrow();

      expect(mockHttpService.post).toHaveBeenCalled();
    });

    it('should send both alerts when both thresholds exceeded', async () => {
      mockHttpService.post.mockReturnValue(
        of({ status: 200, data: { success: true } }),
      );

      await service.checkAndAlert(
        'device-001',
        'site-A',
        '2025-10-01T10:00:00Z',
        55,
        95,
      );

      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
      expect(mockRedisService.markAlertSent).toHaveBeenCalledWith(
        'device-001',
        AlertReason.HIGH_TEMPERATURE,
        60,
      );
      expect(mockRedisService.markAlertSent).toHaveBeenCalledWith(
        'device-001',
        AlertReason.HIGH_HUMIDITY,
        60,
      );
    });
  });
});

