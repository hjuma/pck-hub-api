import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getTaxonomiesData, getPublicationsData, getPublicationByIdData, isSupabaseConfigured } from './supabase';

const app = express();

app.use(cors());
app.use(express.json());

// Request-response logger or debug middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = `req-${Math.random().toString(36).substring(2, 11)}`;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// Mock Rate Limiting State (Local Memory)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimits = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;  // 60 requests/min

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const limitData = rateLimits.get(ip);

  if (!limitData || now > limitData.resetTime) {
    rateLimits.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS_PER_WINDOW - 1);
    return next();
  }

  if (limitData.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((limitData.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', 0);
    return res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down and try again later.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }

  limitData.count += 1;
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS_PER_WINDOW - limitData.count);
  next();
};

app.use(rateLimiter);

// Supabase JWKS Client Setup
const JWKS_URL = new URL('https://exyhjkjgyiakccrlmpds.supabase.co/auth/v1/.well-known/jwks.json');
let jwksCache: any = null;

async function getJWKS() {
  if (!jwksCache) {
    const { createRemoteJWKSet } = await import('jose');
    jwksCache = createRemoteJWKSet(JWKS_URL);
  }
  return jwksCache;
}

const VALID_STATIC_TOKEN = process.env.PCK_API_TOKEN || 'pck_test_token_2026';

// Server-to-Server Authentication Middleware (Supports both static tokens for testing and Supabase ES256 JWKS JWTs)
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please provide a valid Bearer Token or Supabase JWT.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }

  const token = authHeader.split(' ')[1];

  // 1. Allow static fallback token (useful for local development & test suites)
  if (token === VALID_STATIC_TOKEN) {
    return next();
  }

  // 2. Verify Supabase ES256 JWT via JWKS
  try {
    const { jwtVerify } = await import('jose');
    const JWKS = await getJWKS();
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['ES256']
    });
    // Attach user payload to request if needed
    (req as any).user = payload;
    return next();
  } catch (err) {
    // If Supabase is not configured and token didn't match static token, treat as invalid token
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Invalid or expired Supabase JWT / API token.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }
};

// Root status endpoint (accessible without auth for status/uptime checks)
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    name: 'PC-Kenya Knowledge Hub API Server',
    version: '1.0.0',
    supabaseConnected: isSupabaseConfigured(),
    docs: '/v1/openapi.json',
    systemTime: new Date().toISOString()
  });
});

// GET /v1/taxonomies
app.get('/v1/taxonomies', authenticate, async (req: Request, res: Response) => {
  try {
    const taxonomyResponse = await getTaxonomiesData();
    return res.status(200).json(taxonomyResponse);
  } catch (err: any) {
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Failed to retrieve taxonomies.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }
});

// GET /v1/publications
app.get('/v1/publications', authenticate, async (req: Request, res: Response) => {
  const updatedSinceStr = req.query.updatedSince as string | undefined;
  const cursorStr = req.query.cursor as string | undefined;
  const limitQuery = parseInt(req.query.limit as string || '100', 10);
  const limit = Math.min(Math.max(limitQuery, 1), 100); // Enforce max limit of 100

  // Validate updatedSince timestamp if supplied
  if (updatedSinceStr) {
    const updatedSinceDate = new Date(updatedSinceStr).getTime();
    if (isNaN(updatedSinceDate)) {
      return res.status(400).json({
        code: 'INVALID_TIMESTAMP',
        message: "The 'updatedSince' parameter must be a valid ISO 8601 UTC timestamp.",
        correlationId: res.getHeader('X-Correlation-ID') as string
      });
    }
  }

  // Validate cursor format if supplied
  if (cursorStr) {
    try {
      const decodedCursor = Buffer.from(cursorStr, 'base64').toString('utf-8');
      const cursorPayload = JSON.parse(decodedCursor);
      if (!cursorPayload.lastUpdatedAt || !cursorPayload.lastId) {
        throw new Error('Invalid cursor structure');
      }
    } catch {
      return res.status(400).json({
        code: 'INVALID_CURSOR',
        message: "The pagination 'cursor' is invalid or has been corrupted.",
        correlationId: res.getHeader('X-Correlation-ID') as string
      });
    }
  }

  try {
    const { items, nextCursor, syncWatermark } = await getPublicationsData(updatedSinceStr, cursorStr, limit);
    return res.status(200).json({
      items,
      nextCursor,
      syncWatermark
    });
  } catch (err: any) {
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Failed to retrieve publications.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }
});

// GET /v1/publications/{id}
app.get('/v1/publications/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const pub = await getPublicationByIdData(id);
    if (!pub) {
      return res.status(404).json({
        code: 'NOT_FOUND',
        message: `Publication with ID '${id}' was not found.`,
        correlationId: res.getHeader('X-Correlation-ID') as string
      });
    }
    return res.status(200).json(pub);
  } catch (err: any) {
    return res.status(500).json({
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Failed to retrieve publication.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }
});

// Serve OpenAPI Spec
app.get('/v1/openapi.json', (req: Request, res: Response) => {
  res.sendFile(__dirname + '/openapi.json');
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  const correlationId = res.getHeader('X-Correlation-ID') as string || 'system';
  res.status(err.status || 500).json({
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred on the server.',
    correlationId
  });
});

// Start server locally (if run directly)
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
  });
}

// Export for Vercel Serverless handler
export default app;
