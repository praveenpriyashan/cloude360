/**
 * Alert reason enum
 */
export enum AlertReason {
  HIGH_TEMPERATURE = 'HIGH_TEMPERATURE',
  HIGH_HUMIDITY = 'HIGH_HUMIDITY',
}

/**
 * Alert payload sent to webhook
 */
export class AlertDto {
  deviceId: string;
  siteId: string;
  ts: string;
  reason: AlertReason;
  value: number;
}

