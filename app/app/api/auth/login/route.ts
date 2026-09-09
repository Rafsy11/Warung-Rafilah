import { NextResponse } from 'next/server';
import { db as pool } from '@/lib/db';
import * as crypto from 'crypto';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit-logger';
import { validateRequest, loginSchema } from '@/lib/validation';
import { getJwtSecret } from '@/lib/runtime-env';

const JWT_SECRET = getJwtSecret();

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);
  
  try {
    // Parse & validate input
    const body = await req.json();
    const validation = validateRequest(loginSchema, body);
    
    if (!validation.success) {
      await logAudit({
        action: 'login_failed',
        ip_address: ip,
        user_agent: userAgent,
        status: 'failed',
        error_message: validation.error
      });
      return NextResponse.json(
        { error: { code: 'validation_error', message: validation.error } },
        { status: 400 }
      );
    }

    const { username, pin } = validation.data;

    // 1. IP-wide rate limit (15 attempts per 5 mins) to protect against credential stuffing
    const ipRateLimitKey = `login:ip:${ip}`;
    if (rateLimiter.isRateLimited(ipRateLimitKey, 15, RATE_LIMITS.LOGIN.windowMs)) {
      const retryAfter = rateLimiter.getTimeUntilReset(ipRateLimitKey, RATE_LIMITS.LOGIN.windowMs);
      await logAudit({
        action: 'login_failed',
        ip_address: ip,
        user_agent: userAgent,
        status: 'failed',
        error_message: 'IP rate limit exceeded',
        metadata: { username }
      });
      return NextResponse.json(
        { 
          error: { 
            code: 'rate_limited', 
            message: `Terlalu banyak percobaan dari IP ini. Tunggu ${retryAfter} detik.` 
          } 
        },
        { 
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      );
    }

    // 2. Account-specific rate limit (5 attempts per 5 mins)
    const rateLimitKey = `login:${username}:${ip}`;
    if (rateLimiter.isRateLimited(rateLimitKey, RATE_LIMITS.LOGIN.limit, RATE_LIMITS.LOGIN.windowMs)) {
      const retryAfter = rateLimiter.getTimeUntilReset(rateLimitKey, RATE_LIMITS.LOGIN.windowMs);
      await logAudit({
        action: 'login_failed',
        ip_address: ip,
        user_agent: userAgent,
        status: 'failed',
        error_message: 'User rate limit exceeded',
        metadata: { username }
      });
      return NextResponse.json(
        { 
          error: { 
            code: 'rate_limited', 
            message: `Terlalu banyak percobaan untuk akun ini. Coba lagi dalam ${retryAfter} detik.` 
          } 
        },
        { 
          status: 429,
          headers: { 'Retry-After': retryAfter.toString() }
        }
      );
    }

    // Verify credentials directly in DB using pgcrypto crypt()
    const { rows } = await pool.query(
      `SELECT id, username, full_name, role
       FROM core.users
       WHERE username = $1
         AND pin_hash = crypt($2, pin_hash)
         AND is_active = true`,
      [username, pin]
    );

    if (rows.length === 0) {
      // Timing attack countermeasure: simulate constant-time hash verification so execution time is identical
      await pool.query(
        "SELECT crypt($1, '$2a$12$e8Y5lqfQvM1wS5YgC6eIquP9lC6dC0x7.hEaL1lG6qJ2bC8kL4e2G')",
        [pin]
      ).catch(() => {});

      const remaining = rateLimiter.getRemainingAttempts(rateLimitKey, RATE_LIMITS.LOGIN.limit, RATE_LIMITS.LOGIN.windowMs);

      await logAudit({
        action: 'login_failed',
        ip_address: ip,
        user_agent: userAgent,
        status: 'failed',
        error_message: 'Invalid credentials',
        metadata: { username, remaining_attempts: remaining }
      });
      
      return NextResponse.json(
        { 
          error: { 
            code: 'invalid_credentials', 
            message: `Username atau password salah.${remaining <= 2 && remaining > 0 ? ` Sisa percobaan: ${remaining} kali.` : ''}` 
          } 
        },
        { 
          status: 401,
          headers: {
            'X-RateLimit-Remaining': remaining.toString()
          }
        }
      );
    }

    const user = rows[0];

    // Sign JWT manually (no external lib dependency)
    const header     = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadObj = {
      sub:       user.id,
      username:  user.username,
      full_name: user.full_name,
      role:      user.role,
      exp:       Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    };
    const payload   = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    const token = `${header}.${payload}.${signature}`;

    // Reset rate limits on successful login
    rateLimiter.reset(rateLimitKey);
    rateLimiter.reset(ipRateLimitKey);
    
    // Log successful login
    await logAudit({
      user_id: user.id,
      action: 'login_success',
      ip_address: ip,
      user_agent: userAgent,
      status: 'success',
      metadata: { username: user.username, role: user.role }
    });
    
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    });

    const forwardedProto = req.headers.get('x-forwarded-proto');
    const cfVisitor = req.headers.get('cf-visitor');
    const isHttps = forwardedProto === 'https' || (cfVisitor && cfVisitor.includes('https')) || new URL(req.url).protocol === 'https:';

    res.cookies.set(process.env.SESSION_COOKIE_NAME || 'pos_session', token, {
      httpOnly: true,
      secure:   isHttps || process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24,
    });


    return res;
  } catch (err: any) {
    console.error("Login API Error:", err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Terjadi kesalahan server.' } },
      { status: 500 }
    );
  }
}
