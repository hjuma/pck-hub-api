import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { mockPublications, RESOURCE_TYPES, SUBJECTS, GEOGRAPHIES, LANGUAGES } from './data';
import { Publication, PublicationsResponse, TaxonomiesResponse } from './types';

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
// Note: In a stateless Vercel Serverless environment, this would ideally use Vercel KV / Redis.
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

// Server-to-Server Authentication Middleware
const VALID_TOKEN = process.env.PCK_API_TOKEN || 'pck_test_token_2026';

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please provide a valid Bearer Token.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== VALID_TOKEN) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Invalid or expired API token.',
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }

  next();
};

// Root status endpoint (accessible without auth for status/uptime checks)
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    name: 'PC-Kenya Knowledge Hub API Server',
    version: '1.0.0',
    docs: '/v1/openapi.json',
    systemTime: new Date().toISOString()
  });
});

// GET /v1/taxonomies
app.get('/v1/taxonomies', authenticate, (req: Request, res: Response) => {
  const taxonomyResponse: TaxonomiesResponse = {
    resourceTypes: RESOURCE_TYPES,
    subjects: SUBJECTS,
    geographies: GEOGRAPHIES,
    languages: LANGUAGES
  };
  return res.status(200).json(taxonomyResponse);
});

// GET /v1/publications
app.get('/v1/publications', authenticate, (req: Request, res: Response) => {
  const updatedSinceStr = req.query.updatedSince as string | undefined;
  const cursorStr = req.query.cursor as string | undefined;
  const limitQuery = parseInt(req.query.limit as string || '100', 10);
  const limit = Math.min(Math.max(limitQuery, 1), 100); // Enforce max limit of 100

  // 1. Sort the baseline mockPublications deterministically: updatedAt then ID
  let filtered = [...mockPublications].sort((a, b) => {
    const dateCompare = a.updatedAt.localeCompare(b.updatedAt);
    if (dateCompare !== 0) return dateCompare;
    return a.id.localeCompare(b.id);
  });

  // 2. Filter by updatedSince timestamp if supplied
  if (updatedSinceStr) {
    try {
      const updatedSinceDate = new Date(updatedSinceStr).getTime();
      if (isNaN(updatedSinceDate)) {
        return res.status(400).json({
          code: 'INVALID_TIMESTAMP',
          message: "The 'updatedSince' parameter must be a valid ISO 8601 UTC timestamp.",
          correlationId: res.getHeader('X-Correlation-ID') as string
        });
      }
      filtered = filtered.filter(pub => new Date(pub.updatedAt).getTime() > updatedSinceDate);
    } catch {
      return res.status(400).json({
        code: 'INVALID_TIMESTAMP',
        message: "The 'updatedSince' parameter must be a valid ISO 8601 UTC timestamp.",
        correlationId: res.getHeader('X-Correlation-ID') as string
      });
    }
  }

  // 3. Filter by cursor if supplied
  if (cursorStr) {
    try {
      // Decode base64 cursor
      const decodedCursor = Buffer.from(cursorStr, 'base64').toString('utf-8');
      const cursorPayload = JSON.parse(decodedCursor) as { lastUpdatedAt: string; lastId: string };

      if (!cursorPayload.lastUpdatedAt || !cursorPayload.lastId) {
        throw new Error('Invalid cursor fields');
      }

      // Filter publications strictly after the cursor:
      // (updatedAt > lastUpdatedAt) OR (updatedAt === lastUpdatedAt AND id > lastId)
      filtered = filtered.filter(pub => {
        const timeCompare = pub.updatedAt.localeCompare(cursorPayload.lastUpdatedAt);
        if (timeCompare > 0) return true;
        if (timeCompare === 0) {
          return pub.id.localeCompare(cursorPayload.lastId) > 0;
        }
        return false;
      });
    } catch (err) {
      return res.status(400).json({
        code: 'INVALID_CURSOR',
        message: "The pagination 'cursor' is invalid or has been corrupted.",
        correlationId: res.getHeader('X-Correlation-ID') as string
      });
    }
  }

  // 4. Slice to the requested page size (limit)
  const hasMore = filtered.length > limit;
  const pageItems = filtered.slice(0, limit);

  // 5. Generate opaque nextCursor if more items are available
  let nextCursor: string | null = null;
  if (hasMore && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    const cursorPayload = {
      lastUpdatedAt: lastItem.updatedAt,
      lastId: lastItem.id
    };
    nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64');
  }

  // 6. Calculate source-generated syncWatermark
  // The syncWatermark represents the updatedAt of the last processed item in this page.
  // If the page is empty, we return the client's current updatedSince or the system epoch.
  const syncWatermark = pageItems.length > 0 
    ? pageItems[pageItems.length - 1].updatedAt 
    : (updatedSinceStr || new Date(0).toISOString());

  const response: PublicationsResponse = {
    items: pageItems,
    nextCursor,
    syncWatermark
  };

  return res.status(200).json(response);
});

// GET /v1/publications/{id}
app.get('/v1/publications/:id', authenticate, (req: Request, res: Response) => {
  const { id } = req.params;
  const pub = mockPublications.find(p => p.id === id);
  if (!pub) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: `Publication with ID '${id}' was not found.`,
      correlationId: res.getHeader('X-Correlation-ID') as string
    });
  }
  return res.status(200).json(pub);
});

// Serve OpenAPI Spec
app.get('/v1/openapi.json', (req: Request, res: Response) => {
  // Simple JSON-formatted OpenAPI spec aligned with PRD
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
