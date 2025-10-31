import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Metrics sub-schema for temperature and humidity readings
 */
@Schema({ _id: false })
export class Metrics {
  @Prop({ required: true, type: Number })
  temperature: number;

  @Prop({ required: true, type: Number })
  humidity: number;
}

export const MetricsSchema = SchemaFactory.createForClass(Metrics);

/**
 * Telemetry document schema
 * Stores IoT device telemetry readings with timestamps
 */
@Schema({
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'telemetry',
})
export class Telemetry {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  siteId: string;

  @Prop({ required: true, type: Date, index: true })
  ts: Date;

  @Prop({ required: true, type: MetricsSchema })
  metrics: Metrics;
}

export type TelemetryDocument = Telemetry & Document;
export const TelemetrySchema = SchemaFactory.createForClass(Telemetry);

// Compound indexes for efficient queries
TelemetrySchema.index({ deviceId: 1, ts: -1 }); // Latest per device
TelemetrySchema.index({ siteId: 1, ts: -1 }); // Site analytics
TelemetrySchema.index({ ts: -1 }); // Time-based queries

