/**
 * Configuration factory for application settings
 * Provides type-safe configuration object from environment variables
 */
export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  mongodb: {
    uri: process.env.MONGO_URI || '',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  alert: {
    webhookUrl: process.env.ALERT_WEBHOOK_URL || '',
    dedupWindow: parseInt(process.env.ALERT_DEDUP_WINDOW || '60', 10),
  },
  
  auth: {
    ingestToken: process.env.INGEST_TOKEN,
  },
  
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
});
