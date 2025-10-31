import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TelemetryService } from './telemetry.service';
import { Telemetry } from './schemas/telemetry.schema';
import { RedisService } from '../redis/redis.service';
import { AlertService } from '../alert/alert.service';

describe('TelemetryService', () => {
  let service: TelemetryService;
  let mockTelemetryModel: any;
  let mockRedisService: any;
  let mockAlertService: any;

  beforeEach(async () => {
    // Mock Mongoose model
    mockTelemetryModel = {
      insertMany: jest.fn(),
      findOne: jest.fn(),
      aggregate: jest.fn(),
    };

    // Mock Redis service
    mockRedisService = {
      cacheLatest: jest.fn().mockResolvedValue(undefined),
      getLatest: jest.fn(),
    };

    // Mock Alert service
    mockAlertService = {
      checkAndAlert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelemetryService,
        {
          provide: getModelToken(Telemetry.name),
          useValue: mockTelemetryModel,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AlertService,
          useValue: mockAlertService,
        },
      ],
    }).compile();

    service = module.get<TelemetryService>(TelemetryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestTelemetry', () => {
    it('should ingest telemetry and cache latest reading', async () => {
      const readings = [
        {
          deviceId: 'device-001',
          siteId: 'site-A',
          ts: '2025-10-01T10:00:00.000Z',
          metrics: { temperature: 25, humidity: 60 },
        },
      ];

      const mockDocs = [
        {
          _id: 'mock-id',
          deviceId: 'device-001',
          siteId: 'site-A',
          ts: new Date('2025-10-01T10:00:00.000Z'),
          metrics: { temperature: 25, humidity: 60 },
          createdAt: new Date(),
        },
      ];

      mockTelemetryModel.insertMany.mockResolvedValue(mockDocs);

      const result = await service.ingestTelemetry(readings);

      expect(result).toEqual(mockDocs);
      expect(mockTelemetryModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            deviceId: 'device-001',
            siteId: 'site-A',
          }),
        ]),
      );

      // Wait for async cache operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockRedisService.cacheLatest).toHaveBeenCalled();
      expect(mockAlertService.checkAndAlert).toHaveBeenCalled();
    });

    it('should trigger alert for high temperature', async () => {
      const readings = [
        {
          deviceId: 'device-001',
          siteId: 'site-A',
          ts: '2025-10-01T10:00:00.000Z',
          metrics: { temperature: 55, humidity: 60 }, // Above threshold
        },
      ];

      const mockDocs = [
        {
          _id: 'mock-id',
          deviceId: 'device-001',
          siteId: 'site-A',
          ts: new Date('2025-10-01T10:00:00.000Z'),
          metrics: { temperature: 55, humidity: 60 },
          createdAt: new Date(),
        },
      ];

      mockTelemetryModel.insertMany.mockResolvedValue(mockDocs);

      await service.ingestTelemetry(readings);

      // Wait for async alert operation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockAlertService.checkAndAlert).toHaveBeenCalledWith(
        'device-001',
        'site-A',
        '2025-10-01T10:00:00.000Z',
        55,
        60,
      );
    });
  });

  describe('getLatest', () => {
    it('should return cached data from Redis if available', async () => {
      const cachedData = {
        deviceId: 'device-001',
        metrics: { temperature: 25, humidity: 60 },
      };

      mockRedisService.getLatest.mockResolvedValue(cachedData);

      const result = await service.getLatest('device-001');

      expect(result).toEqual(cachedData);
      expect(mockRedisService.getLatest).toHaveBeenCalledWith('device-001');
      expect(mockTelemetryModel.findOne).not.toHaveBeenCalled();
    });

    it('should fallback to MongoDB when Redis cache misses', async () => {
      const mongoData = {
        deviceId: 'device-001',
        siteId: 'site-A',
        ts: new Date('2025-10-01T10:00:00.000Z'),
        metrics: { temperature: 25, humidity: 60 },
      };

      mockRedisService.getLatest.mockResolvedValue(null);
      mockTelemetryModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mongoData),
          }),
        }),
      });

      const result = await service.getLatest('device-001');

      expect(result).toEqual(mongoData);
      expect(mockRedisService.getLatest).toHaveBeenCalledWith('device-001');
      expect(mockTelemetryModel.findOne).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no data found', async () => {
      mockRedisService.getLatest.mockResolvedValue(null);
      mockTelemetryModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      await expect(service.getLatest('nonexistent-device')).rejects.toThrow();
    });
  });

  describe('getSiteSummary', () => {
    it('should return aggregated site statistics', async () => {
      const mockAggregation = [
        {
          count: 10,
          avgTemperature: 25.5,
          maxTemperature: 30.0,
          avgHumidity: 65.0,
          maxHumidity: 80.0,
          uniqueDevices: 3,
        },
      ];

      mockTelemetryModel.aggregate.mockResolvedValue(mockAggregation);

      const result = await service.getSiteSummary(
        'site-A',
        '2025-10-01T00:00:00.000Z',
        '2025-10-02T00:00:00.000Z',
      );

      expect(result).toEqual(mockAggregation[0]);
      expect(mockTelemetryModel.aggregate).toHaveBeenCalled();
    });

    it('should return zero statistics when no data found', async () => {
      mockTelemetryModel.aggregate.mockResolvedValue([]);

      const result = await service.getSiteSummary(
        'empty-site',
        '2025-10-01T00:00:00.000Z',
        '2025-10-02T00:00:00.000Z',
      );

      expect(result).toEqual({
        count: 0,
        avgTemperature: 0,
        maxTemperature: 0,
        avgHumidity: 0,
        maxHumidity: 0,
        uniqueDevices: 0,
      });
    });
  });
});

