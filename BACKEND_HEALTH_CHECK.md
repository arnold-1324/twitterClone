# Backend Health Check Endpoint

## Overview

The frontend network diagnostics system expects a health check endpoint to test backend connectivity. This endpoint should be implemented on your backend server.

## Required Endpoint

**URL**: `/api/health`  
**Method**: `GET`  
**Purpose**: Verify backend server accessibility

## Implementation Example

### Express.js Implementation

Add this route to your backend server:

```javascript
// In your main server file or routes
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});
```

### Advanced Health Check (Optional)

For more comprehensive health monitoring:

```javascript
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'ok',
        redis: 'ok',
        socketio: 'ok'
      }
    };

    // Test database connection
    try {
      await mongoose.connection.db.admin().ping();
      health.services.database = 'ok';
    } catch (error) {
      health.services.database = 'error';
      health.status = 'degraded';
    }

    // Test Redis connection (if using)
    try {
      if (redisClient) {
        await redisClient.ping();
        health.services.redis = 'ok';
      }
    } catch (error) {
      health.services.redis = 'error';
      health.status = 'degraded';
    }

    // Check Socket.IO status
    const socketConnections = io.sockets.sockets.size;
    health.services.socketio = {
      status: 'ok',
      connections: socketConnections
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});
```

## Response Format

### Success Response (200)
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Error Response (503)
```json
{
  "status": "error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "error": "Service temporarily unavailable"
}
```

## CORS Configuration

Ensure the health endpoint allows CORS requests:

```javascript
// If using cors middleware
app.use('/api/health', cors({
  origin: [
    'http://localhost:3000',
    'https://your-frontend-domain.com'
  ],
  credentials: false
}));
```

## Testing

You can test the health endpoint manually:

```bash
curl https://twitterclone-backend-681i.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

## Integration with Frontend

The frontend network diagnostics will automatically use this endpoint to test backend connectivity. No additional frontend configuration is required.

The diagnostic results will show:
- ✅ Backend Reachable: Yes (if endpoint responds with 200)
- ❌ Backend Reachable: No (if endpoint fails or returns error)

## Security Considerations

- The health endpoint should not expose sensitive information
- Consider rate limiting to prevent abuse
- Monitor access patterns for unusual activity

## Monitoring Integration

This endpoint can also be used by external monitoring services:
- Uptime monitoring services
- Load balancer health checks
- Container orchestration health probes

## Notes

- Keep the health check lightweight to avoid impacting performance
- Consider caching health check results for high-traffic scenarios
- Log health check requests for monitoring purposes