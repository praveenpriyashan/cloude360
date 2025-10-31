import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { RedisModule } from './redis/redis.module';
import { AlertModule } from './alert/alert.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Global configuration module with validation
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: ['env.local', '.env'],
      cache: true,
    }),

    // MongoDB connection with async configuration
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
        retryWrites: true,
        w: 'majority',
        connectionFactory: (connection) => {
          void connection.on('connected', () => {
            console.log('✅ MongoDB connected successfully');
          });
          void connection.on('error', (error: Error) => {
            console.error('❌ MongoDB connection error:', error);
          });
          void connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
          });
          return connection;
        },
      }),
    }),

    // Rate limiting configuration
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('rateLimit.ttl', 60) * 1000, // Convert to ms
          limit: configService.get<number>('rateLimit.max', 100),
        },
      ],
    }),

    // Application modules
    RedisModule,
    AlertModule,
    TelemetryModule,
    AuthModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
