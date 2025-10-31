import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelemetryService } from './telemetry.service';
import {
  TelemetryController,
  DevicesController,
  SitesController,
} from './telemetry.controller';
import { Telemetry, TelemetrySchema } from './schemas/telemetry.schema';
import { AlertModule } from '../alert/alert.module';

/**
 * Telemetry module
 * Provides telemetry ingestion, storage, and retrieval functionality
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Telemetry.name, schema: TelemetrySchema },
    ]),
    AlertModule,
  ],
  controllers: [TelemetryController, DevicesController, SitesController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}

