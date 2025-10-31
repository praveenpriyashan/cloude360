import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ConfigService } from '@nestjs/config';

describe('Telemetry API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const configService = app.get(ConfigService);
    authToken = configService.get<string>('auth.ingestToken') || '';

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/api/v1/health (GET) should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('services');
          expect(res.body.services).toHaveProperty('mongodb');
          expect(res.body.services).toHaveProperty('redis');
        });
    });
  });

  describe('POST /api/v1/telemetry', () => {
    const validTelemetry = {
      deviceId: 'test-device-001',
      siteId: 'test-site-A',
      ts: new Date().toISOString(),
      metrics: {
        temperature: 25.5,
        humidity: 60,
      },
    };

    it('should ingest single telemetry reading (with auth)', () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send(validTelemetry)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('count', 1);
        });
    });

    it('should ingest array of telemetry readings', () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send([
          validTelemetry,
          { ...validTelemetry, deviceId: 'test-device-002' },
        ])
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('count', 2);
        });
    });

    it('should reject invalid telemetry (missing deviceId)', () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      const invalid = { ...validTelemetry };
      delete invalid.deviceId;

      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send(invalid)
        .expect(400);
    });

    it('should reject invalid timestamp', () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send({ ...validTelemetry, ts: 'invalid-timestamp' })
        .expect(400);
    });

    it('should reject temperature out of range', () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send({
          ...validTelemetry,
          metrics: { temperature: 200, humidity: 60 },
        })
        .expect(400);
    });

    it('should reject humidity out of range', () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      return request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send({
          ...validTelemetry,
          metrics: { temperature: 25, humidity: 150 },
        })
        .expect(400);
    });

    if (authToken) {
      it('should reject request without authentication', () => {
        return request(app.getHttpServer())
          .post('/api/v1/telemetry')
          .send(validTelemetry)
          .expect(401);
      });

      it('should reject request with invalid token', () => {
        return request(app.getHttpServer())
          .post('/api/v1/telemetry')
          .set('authorization', 'Bearer invalid-token')
          .send(validTelemetry)
          .expect(401);
      });
    }
  });

  describe('GET /api/v1/devices/:deviceId/latest', () => {
    it('should return latest reading for device', async () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      // First ingest a reading
      const deviceId = 'test-device-latest';
      await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send({
          deviceId,
          siteId: 'test-site-A',
          ts: new Date().toISOString(),
          metrics: { temperature: 25, humidity: 60 },
        });

      // Then fetch latest
      return request(app.getHttpServer())
        .get(`/api/v1/devices/${deviceId}/latest`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('deviceId', deviceId);
          expect(res.body).toHaveProperty('metrics');
        });
    });

    it('should return 404 for nonexistent device', () => {
      return request(app.getHttpServer())
        .get('/api/v1/devices/nonexistent-device/latest')
        .expect(404);
    });
  });

  describe('GET /api/v1/sites/:siteId/summary', () => {
    it('should return aggregated site statistics', async () => {
      const headers: any = {};
      if (authToken) {
        headers.authorization = `Bearer ${authToken}`;
      }

      const siteId = 'test-site-summary';
      const now = new Date();
      const from = new Date(now.getTime() - 3600000).toISOString(); // 1 hour ago
      const to = new Date(now.getTime() + 3600000).toISOString(); // 1 hour from now

      // Ingest some test data
      await request(app.getHttpServer())
        .post('/api/v1/telemetry')
        .set(headers)
        .send([
          {
            deviceId: 'device-summary-1',
            siteId,
            ts: now.toISOString(),
            metrics: { temperature: 25, humidity: 60 },
          },
          {
            deviceId: 'device-summary-2',
            siteId,
            ts: now.toISOString(),
            metrics: { temperature: 30, humidity: 70 },
          },
        ]);

      // Fetch summary
      return request(app.getHttpServer())
        .get(`/api/v1/sites/${siteId}/summary?from=${from}&to=${to}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('count');
          expect(res.body).toHaveProperty('avgTemperature');
          expect(res.body).toHaveProperty('maxTemperature');
          expect(res.body).toHaveProperty('avgHumidity');
          expect(res.body).toHaveProperty('maxHumidity');
          expect(res.body).toHaveProperty('uniqueDevices');
          expect(res.body.count).toBeGreaterThan(0);
        });
    });

    it('should require from and to query parameters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sites/test-site/summary')
        .expect(400);
    });

    it('should return empty statistics for site with no data', () => {
      const from = new Date('2020-01-01').toISOString();
      const to = new Date('2020-01-02').toISOString();

      return request(app.getHttpServer())
        .get(`/api/v1/sites/empty-site-999/summary?from=${from}&to=${to}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.count).toBe(0);
          expect(res.body.uniqueDevices).toBe(0);
        });
    });
  });
});
