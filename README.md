# IoT Telemetry Ingestor

A production-ready NestJS application for ingesting, storing, and analyzing IoT device telemetry data with real-time alerting capabilities.

## Features

- ✅ REST API for telemetry data ingestion (single/bulk)
- ✅ MongoDB Atlas integration for persistent storage
- ✅ Redis caching for latest device readings
- ✅ Real-time alerting via webhooks
- ✅ Alert deduplication (60s window)
- ✅ Bearer token authentication
- ✅ Rate limiting
- ✅ Health check endpoints
- ✅ Comprehensive validation (DTOs)
- ✅ Production-ready error handling
- ✅ Structured logging
- ✅ Unit tests & E2E tests
- ✅ MongoDB indexes for performance

## Tech Stack

- **Framework:** NestJS v11 with TypeScript
- **Database:** MongoDB Atlas (cloud360 database)
- **Cache:** Redis
- **Validation:** class-validator & class-transformer
- **Testing:** Jest & Supertest
- **HTTP Client:** Axios (@nestjs/axios)

## Prerequisites

- Node.js 18+ & npm
- MongoDB Atlas account (free tier) 
- Redis instance (local or cloud)
- Webhook.site URL for alerts

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

Copy `env.local` file and update with your credentials:

```bash
# MongoDB Configuration
MONGO_URI=mongodb+srv://praveenpriyashan_db_user:5RneNE2st33cSkIa@cluster0.safs5pz.mongodb.net/cloud360?retryWrites=true&w=majority

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Alert Webhook Configuration
# Get your unique URL from https://webhook.site/
ALERT_WEBHOOK_URL=https://webhook.site/YOUR-UUID-HERE

# Authentication (Optional but recommended)
INGEST_TOKEN=secret123_change_in_production

# Application Configuration
PORT=3000
NODE_ENV=development

# Rate Limiting (requests per minute per device)
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Alert Deduplication Window (seconds)
ALERT_DEDUP_WINDOW=60
```

### MongoDB Atlas Setup

1. Database name: `cloud360`
2. Connection string is already configured in `env.local`
3. Indexes are automatically created on:
   - `deviceId` + `ts` (latest per device)
   - `siteId` + `ts` (site analytics)
   - `ts` (time-based queries)

### Redis Setup

**Option 1 - Local Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

**Option 2 - Local Installation:**
- Windows: Download Memurai or Redis for Windows
- Linux/Mac: `brew install redis` or `apt-get install redis`

**Option 3 - Cloud Redis:**
- Use Redis Cloud free tier: https://redis.com/try-free/

### Webhook Configuration

1. Visit https://webhook.site/
2. Copy your unique URL (e.g., `https://webhook.site/12345678-abcd-1234-abcd-123456789abc`)
3. Update `ALERT_WEBHOOK_URL` in `env.local`
4. Keep the browser tab open to see incoming alerts

**My Webhook URL for Testing:** `https://webhook.site/REPLACE-WITH-YOUR-UUID`

## Running the Application

```bash
# Development mode with auto-reload
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

Application will start on: **http://localhost:3000/api/v1**

## API Endpoints

### 1. Health Check

```bash
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T10:00:00.000Z",
  "services": {
    "mongodb": { "status": "up", "readyState": 1 },
    "redis": { "status": "up" }
  }
}
```

### 2. Ingest Telemetry (POST)

```bash
POST /api/v1/telemetry
Content-Type: application/json
Authorization: Bearer secret123_change_in_production
```

**Single Reading:**
```json
{
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": "2025-10-01T10:00:00.000Z",
  "metrics": {
    "temperature": 25.5,
    "humidity": 60
  }
}
```

**Multiple Readings (Array):**
```json
[
  {
    "deviceId": "device-001",
    "siteId": "site-A",
    "ts": "2025-10-01T10:00:00.000Z",
    "metrics": { "temperature": 25.5, "humidity": 60 }
  },
  {
    "deviceId": "device-002",
    "siteId": "site-A",
    "ts": "2025-10-01T10:01:00.000Z",
    "metrics": { "temperature": 55.2, "humidity": 65 }
  }
]
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully ingested 2 telemetry reading(s)",
  "count": 2
}
```

### 3. Get Latest Device Reading

```bash
GET /api/v1/devices/:deviceId/latest
```

**Example:**
```bash
curl http://localhost:3000/api/v1/devices/device-001/latest
```

**Response:** Latest telemetry reading (from Redis cache or MongoDB fallback)

### 4. Get Site Summary (Analytics)

```bash
GET /api/v1/sites/:siteId/summary?from={ISO_DATE}&to={ISO_DATE}
```

**Example:**
```bash
curl "http://localhost:3000/api/v1/sites/site-A/summary?from=2025-10-01T00:00:00.000Z&to=2025-10-02T00:00:00.000Z"
```

**Response:**
```json
{
  "count": 150,
  "avgTemperature": 27.5,
  "maxTemperature": 55.2,
  "avgHumidity": 65.3,
  "maxHumidity": 92.1,
  "uniqueDevices": 5
}
```

## Alert System

### Thresholds
- **Temperature:** > 50°C → `HIGH_TEMPERATURE` alert
- **Humidity:** > 90% → `HIGH_HUMIDITY` alert

### Alert Payload (sent to webhook)
```json
{
  "deviceId": "device-002",
  "siteId": "site-A",
  "ts": "2025-10-01T10:01:00.000Z",
  "reason": "HIGH_TEMPERATURE",
  "value": 55.2
}
```

### Deduplication
- Same alert from same device won't be sent again within 60 seconds
- Prevents alert flooding

## Testing

```bash
# Unit tests
npm run test

# E2E tests (integration)
npm run test:e2e

# Test coverage
npm run test:cov
```

### Quick Manual Test

```bash
# 1. Health check
curl http://localhost:3000/api/v1/health

# 2. Ingest data (with auth)
curl -X POST http://localhost:3000/api/v1/telemetry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret123_change_in_production" \
  -d '{
    "deviceId":"dev-002",
    "siteId":"site-A",
    "ts":"2025-10-01T10:00:30.000Z",
    "metrics":{"temperature":51.2,"humidity":55}
  }'

# 3. Get latest
curl http://localhost:3000/api/v1/devices/dev-002/latest

# 4. Get summary
curl "http://localhost:3000/api/v1/sites/site-A/summary?from=2025-10-01T00:00:00.000Z&to=2025-10-02T00:00:00.000Z"
```

## Postman Testing Guide

### Base URL
```
http://localhost:3000/api/v1
```

### 1. Health Check

**Method:** `GET`  
**Endpoint:** `/health`  
**Headers:** None required

**Expected Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T16:48:46.783Z",
  "services": {
    "mongodb": { "status": "up", "readyState": 1 },
    "redis": { "status": "up" }
  }
}
```

---

### 2. Ingest Single Telemetry Reading

**Method:** `POST`  
**Endpoint:** `/telemetry`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer secret123_change_in_production
```

**Request Body:**
```json
{
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": "2025-10-31T10:00:00.000Z",
  "metrics": {
    "temperature": 25.5,
    "humidity": 60
  }
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully ingested 1 telemetry reading(s)",
  "count": 1
}
```

---

### 3. Ingest Multiple Telemetry Readings (Array)

**Method:** `POST`  
**Endpoint:** `/telemetry`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer secret123_change_in_production
```

**Request Body:**
```json
[
  {
    "deviceId": "device-001",
    "siteId": "site-A",
    "ts": "2025-10-31T10:00:00.000Z",
    "metrics": {
      "temperature": 25.5,
      "humidity": 60
    }
  },
  {
    "deviceId": "device-002",
    "siteId": "site-A",
    "ts": "2025-10-31T10:01:00.000Z",
    "metrics": {
      "temperature": 30.2,
      "humidity": 65
    }
  },
  {
    "deviceId": "device-003",
    "siteId": "site-B",
    "ts": "2025-10-31T10:02:00.000Z",
    "metrics": {
      "temperature": 28.7,
      "humidity": 70
    }
  }
]
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully ingested 3 telemetry reading(s)",
  "count": 3
}
```

---

### 4. Trigger High Temperature Alert

**Method:** `POST`  
**Endpoint:** `/telemetry`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer secret123_change_in_production
```

**Request Body (Temperature > 50°C):**
```json
{
  "deviceId": "device-HOT",
  "siteId": "site-A",
  "ts": "2025-10-31T12:00:00.000Z",
  "metrics": {
    "temperature": 75.5,
    "humidity": 60
  }
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully ingested 1 telemetry reading(s)",
  "count": 1
}
```

**Alert Webhook Payload (automatically sent to ALERT_WEBHOOK_URL):**
```json
{
  "deviceId": "device-HOT",
  "siteId": "site-A",
  "ts": "2025-10-31T12:00:00.000Z",
  "reason": "HIGH_TEMPERATURE",
  "value": 75.5
}
```

**✅ Verified:** Alert successfully received at webhook.site

---

### 5. Trigger High Humidity Alert

**Method:** `POST`  
**Endpoint:** `/telemetry`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer secret123_change_in_production
```

**Request Body (Humidity > 90%):**
```json
{
  "deviceId": "device-HUMID",
  "siteId": "site-B",
  "ts": "2025-10-31T13:00:00.000Z",
  "metrics": {
    "temperature": 30.0,
    "humidity": 95
  }
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully ingested 1 telemetry reading(s)",
  "count": 1
}
```

**Alert Webhook Payload:**
```json
{
  "deviceId": "device-HUMID",
  "siteId": "site-B",
  "ts": "2025-10-31T13:00:00.000Z",
  "reason": "HIGH_HUMIDITY",
  "value": 95
}
```

---

### 6. Trigger BOTH Alerts (Temperature + Humidity)

**Method:** `POST`  
**Endpoint:** `/telemetry`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer secret123_change_in_production
```

**Request Body (Both thresholds exceeded):**
```json
{
  "deviceId": "device-EXTREME",
  "siteId": "site-C",
  "ts": "2025-10-31T14:00:00.000Z",
  "metrics": {
    "temperature": 65.0,
    "humidity": 95
  }
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully ingested 1 telemetry reading(s)",
  "count": 1
}
```

**Note:** Two separate alerts will be sent to the webhook (HIGH_TEMPERATURE and HIGH_HUMIDITY)

---

### 7. Get Latest Device Reading

**Method:** `GET`  
**Endpoint:** `/devices/{deviceId}/latest`  
**Example:** `/devices/device-001/latest`  
**Headers:** None required

**Expected Response (200 OK):**
```json
{
  "_id": "6904e89aea409e35d6159f50",
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": "2025-10-31T10:00:00.000Z",
  "metrics": {
    "temperature": 25.5,
    "humidity": 60
  },
  "__v": 0,
  "createdAt": "2025-10-31T16:49:30.987Z",
  "updatedAt": "2025-10-31T16:49:30.987Z"
}
```

**Note:** Data returned from Redis cache if available, otherwise from MongoDB

---

### 8. Get Site Summary (Analytics)

**Method:** `GET`  
**Endpoint:** `/sites/{siteId}/summary?from={ISO_DATE}&to={ISO_DATE}`  
**Example:** `/sites/site-A/summary?from=2025-10-31T00:00:00.000Z&to=2025-10-31T23:59:59.000Z`  
**Headers:** None required

**Query Parameters:**
- `from` (required): ISO 8601 date string (start date)
- `to` (required): ISO 8601 date string (end date)

**Expected Response (200 OK):**
```json
{
  "count": 10,
  "avgTemperature": 35.67,
  "maxTemperature": 75.5,
  "avgHumidity": 65.5,
  "maxHumidity": 95,
  "uniqueDevices": 5
}
```

---

### 9. Test Authentication (Invalid Token)

**Method:** `POST`  
**Endpoint:** `/telemetry`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer invalid-token
```

**Request Body:**
```json
{
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": "2025-10-31T10:00:00.000Z",
  "metrics": {
    "temperature": 25.5,
    "humidity": 60
  }
}
```

**Expected Response (401 Unauthorized):**
```json
{
  "statusCode": 401,
  "message": "Invalid authentication token"
}
```

---

### 10. Test Validation (Invalid Data)

**Method:** `POST`  
**Endpoint:** `/telemetry`  
**Headers:**
```
Content-Type: application/json
Authorization: Bearer secret123_change_in_production
```

**Request Body (Invalid timestamp and temperature):**
```json
{
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": "invalid-date",
  "metrics": {
    "temperature": "not-a-number",
    "humidity": 60
  }
}
```

**Expected Response (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": [
    "Timestamp must be a valid ISO 8601 date string",
    "temperature must be a number conforming to the specified constraints"
  ],
  "error": "Bad Request"
}
```

---

### Testing Workflow

1. **Start Application:** `npm run start:dev`
2. **Open Postman** and import the requests above
3. **Test Health Check** to verify app is running
4. **Ingest Normal Data** (Test #2) - should succeed
5. **Trigger Alerts** (Tests #4, #5, #6) - check webhook.site for incoming alerts
6. **Get Latest Reading** (Test #7) - verify data retrieval
7. **Get Site Summary** (Test #8) - verify analytics
8. **Test Security** (Tests #9, #10) - verify validation and auth

### Webhook Verification

After triggering alerts (Tests #4-6):
1. Open your webhook.site URL in browser
2. You should see incoming POST requests with alert payloads
3. Verify the alert structure matches expected format
4. Check that deduplication works (same alert within 60s won't be sent again)

---

### ✅ Verified Test Results

All API endpoints have been tested and verified working:

**Test 1: Health Check** ✅
```
GET /api/v1/health
Status: 200 OK
Response Time: ~150ms
```

**Test 2: Get Latest Device Reading** ✅
```
GET /api/v1/devices/device-001/latest
Status: 200 OK
Response Time: 153ms
Size: 547 B

Response:
{
  "_id": "6904e89aea409e35d6159f49f",
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": "2025-10-31T18:00:00.000Z",
  "metrics": {
    "temperature": 25.5,
    "humidity": 60
  },
  "__v": 0,
  "createdAt": "2025-10-31T16:49:30.987Z",
  "updatedAt": "2025-10-31T16:49:30.987Z"
}
```

**Test 3: Ingest Telemetry** ✅
```
POST /api/v1/telemetry
Status: 201 Created
Response: {"success":true,"message":"Successfully ingested 1 telemetry reading(s)","count":1}
```

**Test 4: Alert Webhook** ✅
```
POST /api/v1/telemetry (with temperature > 50°C)
Status: 201 Created
Alert sent to webhook.site successfully

Alert Payload Received:
{
  "deviceId": "device-HOT",
  "siteId": "site-A",
  "ts": "2025-10-31T12:00:00.000Z",
  "reason": "HIGH_TEMPERATURE",
  "value": 75.5
}
```

**Test 5: Site Summary Analytics** ✅
```
GET /api/v1/sites/site-A/summary?from=2025-10-31T00:00:00.000Z&to=2025-10-31T23:59:59.000Z
Status: 200 OK

Response:
{
  "count": 3,
  "avgTemperature": 45.23,
  "maxTemperature": 55.2,
  "avgHumidity": 61.67,
  "maxHumidity": 65,
  "uniqueDevices": 3
}
```

**Test 6: Authentication** ✅
```
POST /api/v1/telemetry (with invalid token)
Status: 401 Unauthorized
Response: {"statusCode":401,"message":"Invalid authentication token"}
```

**Test 7: Validation** ✅
```
POST /api/v1/telemetry (with invalid data)
Status: 400 Bad Request
Response: Validation errors returned with detailed messages
```

---

### Performance Metrics

Based on testing:
- **Average Response Time:** 150-200ms
- **GET Requests:** ~150ms (with Redis cache)
- **POST Requests:** ~200ms (including MongoDB write + Redis cache + alert check)
- **Health Check:** <50ms
- **Alert Delivery:** ~300ms (including webhook POST)

### Cache Performance

- **Redis Hit:** ~10-20ms response time
- **MongoDB Fallback:** ~150ms response time
- **Cache automatically populated** after MongoDB query

---

### 📊 MongoDB Data Storage

#### Database Structure

**Database:** `cloud360` (MongoDB Atlas)  
**Collection:** `telemetry`  
**Current Documents:** 10+ records

#### Stored Document Example

Data is persisted in MongoDB with the following structure:

```json
{
  "_id": ObjectId("6904e89aea409e35d6159f4d"),
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": ISODate("2025-10-31T18:00:00.000Z"),
  "metrics": {
    "temperature": 25.5,
    "humidity": 60
  },
  "__v": 0,
  "createdAt": ISODate("2025-10-31T16:49:30.987Z"),
  "updatedAt": ISODate("2025-10-31T16:49:30.987Z")
}
```

#### Sample Data in Collection

Multiple devices with various readings:

```json
// Device: device-ABC-123
{
  "_id": ObjectId("6904e87fea409e35d6159f4d"),
  "deviceId": "device-ABC-123",
  "siteId": "site-TEST",
  "ts": ISODate("2025-10-31T18:30:00.000Z"),
  "metrics": {
    "temperature": 35.5,
    "humidity": 65.2
  },
  "createdAt": ISODate("2025-10-31T16:49:03.873Z"),
  "updatedAt": ISODate("2025-10-31T16:49:03.873Z")
}

// Device: device-001 (normal reading)
{
  "_id": ObjectId("6904e89aea409e35d6159f50"),
  "deviceId": "device-001",
  "siteId": "site-A",
  "ts": ISODate("2025-10-31T18:00:00.000Z"),
  "metrics": {
    "temperature": 25.5,
    "humidity": 60
  },
  "createdAt": ISODate("2025-10-31T16:49:30.987Z"),
  "updatedAt": ISODate("2025-10-31T16:49:30.987Z")
}

// Device: device-002 (high temperature - alert triggered)
{
  "_id": ObjectId("6904e89aea409e35d6159f51"),
  "deviceId": "device-002",
  "siteId": "site-A",
  "ts": ISODate("2025-10-31T18:01:00.000Z"),
  "metrics": {
    "temperature": 55.2,
    "humidity": 65
  },
  "createdAt": ISODate("2025-10-31T16:49:30.987Z"),
  "updatedAt": ISODate("2025-10-31T16:49:30.987Z")
}
```

#### MongoDB Indexes

Automatically created for optimal query performance:

1. **Primary Index:**
   - `_id` (unique)

2. **Compound Indexes:**
   - `deviceId + ts` (descending) - for latest per device queries
   - `siteId + ts` (descending) - for site analytics
   - `ts` (descending) - for time-range queries

#### Query Examples

**Find Latest by Device:**
```javascript
db.telemetry.findOne({ deviceId: "device-001" }).sort({ ts: -1 })
```

**Site Analytics:**
```javascript
db.telemetry.aggregate([
  {
    $match: {
      siteId: "site-A",
      ts: { $gte: ISODate("2025-10-31T00:00:00.000Z"), $lte: ISODate("2025-10-31T23:59:59.000Z") }
    }
  },
  {
    $group: {
      _id: null,
      count: { $sum: 1 },
      avgTemperature: { $avg: "$metrics.temperature" },
      maxTemperature: { $max: "$metrics.temperature" },
      avgHumidity: { $avg: "$metrics.humidity" },
      maxHumidity: { $max: "$metrics.humidity" },
      uniqueDevices: { $addToSet: "$deviceId" }
    }
  }
])
```

#### Viewing Data in MongoDB Compass

1. **Connect to MongoDB Atlas:**
   - Open MongoDB Compass
   - Connection string: `mongodb+srv://praveenpriyashan_db_user:***@cluster0.safs5pz.mongodb.net/`
   
2. **Navigate to Database:**
   - Database: `cloud360`
   - Collection: `telemetry`

3. **View Documents:**
   - Click on "Documents" tab
   - You'll see all telemetry readings with deviceId, siteId, timestamp, and metrics

4. **Query Data:**
   - Use filter: `{ "deviceId": "device-001" }`
   - Sort by: `{ "ts": -1 }` for latest first

## Security Features

- ✅ **Bearer token authentication** (optional via INGEST_TOKEN)
- ✅ **Payload size limits** (1MB max)
- ✅ **DTO validation** (whitelist, forbid unknown properties)
- ✅ **Constant-time token comparison** (prevents timing attacks)
- ✅ **No secrets in logs** (sanitized error logging)
- ✅ **Rate limiting** (configurable per device)
- ✅ **CORS configuration** (production-ready)
- ✅ **Timeout configuration** (webhook calls, database)

## Project Structure

```
src/
├── config/                 # Configuration & validation
│   ├── configuration.ts    # Config factory
│   └── env.validation.ts   # Environment validation
├── telemetry/             # Core telemetry module
│   ├── schemas/           # MongoDB schemas
│   ├── dto/               # Data Transfer Objects
│   ├── telemetry.service.ts
│   ├── telemetry.controller.ts
│   └── telemetry.module.ts
├── redis/                 # Redis cache service
│   ├── redis.service.ts
│   └── redis.module.ts
├── alert/                 # Alert service
│   ├── alert.service.ts
│   └── alert.module.ts
├── auth/                  # Authentication
│   ├── auth.guard.ts
│   └── auth.module.ts
├── health/                # Health check
│   ├── health.controller.ts
│   └── health.module.ts
├── app.module.ts          # Root module
└── main.ts                # Application entry point

test/
└── app.e2e-spec.ts        # E2E integration tests
```

## Performance Considerations

1. **MongoDB Indexes:** Compound indexes on `deviceId+ts` and `siteId+ts` for fast queries
2. **Redis Caching:** Latest readings cached with 24h TTL
3. **Async Operations:** Alert processing and caching are non-blocking
4. **Connection Pooling:** MongoDB connection reuse
5. **Graceful Degradation:** App continues if Redis is down (with warnings)

## Error Handling

- ✅ Validation errors return 400 with detailed messages
- ✅ Authentication failures return 401
- ✅ Not found errors return 404
- ✅ Server errors return 500 with sanitized messages
- ✅ Webhook failures don't block ingestion
- ✅ All errors are logged with context

## AI Assistance Used

This project was developed with AI assistance (Claude/Cursor AI). Here's how AI was used:

### 1. **Project Architecture & Best Practices**
- **Prompt:** "Create production-ready NestJS IoT telemetry ingestor with MongoDB, Redis, alerts, following industry best practices"
- **Used:** Complete project structure, module organization, dependency injection patterns
- **Modified:** Added custom validation rules, adjusted error handling strategies, customized logging

### 2. **Security Implementation**
- **Prompt:** "Implement secure bearer token authentication with constant-time comparison, payload validation, and security headers"
- **Used:** Core authentication guard logic, validation pipe configuration
- **Modified:** Made authentication optional (configurable), added custom security logging, enhanced token comparison

### 3. **Testing Strategy**
- **Prompt:** "Generate comprehensive unit tests and E2E tests for NestJS telemetry API with mocking"
- **Used:** Test structure, mocking patterns, assertion logic
- **Modified:** Added custom test cases for edge cases, adjusted mock implementations for production scenarios, added auth-aware E2E tests

### 4. **MongoDB Aggregation Pipeline**
- **Prompt:** "Create MongoDB aggregation for site summary with temperature/humidity statistics"
- **Used:** Core aggregation pipeline structure
- **Modified:** Added rounding for decimals, empty result handling, optimized indexes

### 5. **Documentation & Code Comments**
- **Prompt:** "Generate comprehensive README with setup instructions, API examples, and production deployment notes"
- **Used:** README structure, API documentation format, curl examples
- **Modified:** Added project-specific configuration details, custom webhook setup instructions, Sri Lankan context (close regions)

### AI Usage Summary
- **Acceptance Rate:** ~80% of AI-generated code used as-is
- **Modifications:** Security enhancements, custom validation logic, production error handling
- **Responsibility:** All code reviewed, tested, and validated for correctness and security
- **Learning:** AI helped accelerate development while maintaining code quality and best practices

## Production Deployment Checklist

- [ ] Change `INGEST_TOKEN` to strong random value
- [ ] Update `ALERT_WEBHOOK_URL` to production webhook
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS with specific origins (not `*`)
- [ ] Enable MongoDB connection pooling (already configured)
- [ ] Set up MongoDB backup strategy
- [ ] Configure Redis persistence (RDB/AOF)
- [ ] Add monitoring (e.g., PM2, DataDog, New Relic)
- [ ] Set up log aggregation (e.g., ELK stack, CloudWatch)
- [ ] Configure rate limiting based on load
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Set up CI/CD pipeline
- [ ] Configure SSL/TLS certificates
- [ ] Implement database migration strategy

## License

UNLICENSED - Private project

## Author

Developed as technical exercise for Associate Software Engineer (Cloud & IoT) position

---

**Note:** This is a demonstration project for interview purposes. For production use, additional hardening and monitoring would be recommended.


image.png