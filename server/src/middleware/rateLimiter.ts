import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Demasiadas solicitudes. Por favor, inténtelo de nuevo más tarde.',
    statusCode = 429,
    skipSuccessfulRequests = false,
  } = options;

  const hits = new Map<string, RateLimitRecord>();

  // Periodically clean up expired entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanupInterval.unref) cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine client identifier (IP or X-Forwarded-For)
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
    const key = `${req.baseUrl}${req.path}:${ip}`;

    const now = Date.now();
    let record = hits.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      hits.set(key, record);
    }

    record.count++;

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(statusCode).json({
        error: message,
        retryAfter: retryAfterSeconds,
      });
    }

    if (skipSuccessfulRequests) {
      // If configured, decrement count on 2xx responses
      res.on('finish', () => {
        if (res.statusCode < 400 && record && record.count > 0) {
          record.count--;
        }
      });
    }

    next();
  };
}

// Pre-configured rate limiters
// Auth limiter: Max 10 attempts per 15 minutes per IP
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos fallidos de autenticación. Por favor, espere 15 minutos.',
});

// Setup limiter: Max 5 attempts per 15 minutes
export const setupRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiadas solicitudes de configuración inicial. Por favor, espere.',
});

// Password change limiter: Max 5 attempts per 15 minutes
export const passwordChangeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiadas solicitudes de cambio de contraseña.',
});
