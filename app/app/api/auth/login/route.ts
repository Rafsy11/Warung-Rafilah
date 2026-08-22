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

    // Rate limiting dengan sliding window
    const rateLimitKey = `login:${username}:${ip}`;
    
    if (rateLimiter.isRateLimited(rateLimitKey, RATE_LIMITS.LOGIN.limit, RATE_LIMITS.LOGIN.windowMs)) {
      const retryAfter = rateLimiter.getTimeUntilReset(rateLimitKey, RATE_LIMITS.LOGIN.windowMs);
      
      await logAudit({
        action: 'login_failed',
        ip_address: ip,
        user_agent: userAgent,
        status: 'failed',
        error_message: 'Rate limit exceeded',
        metadata: { username }
      });
      
      return NextResponse.json(
        { 
          error: { 
            code: 'rate_limited', 
            message: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfter} detik.` 
          } 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString()
          }
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
      await logAudit({
        action: 'login_failed',
        ip_address: ip,
        user_agent: userAgent,
        status: 'failed',
        error_message: 'Invalid credentials',
        metadata: { username }
      });
      
      return NextResponse.json(
        { error: { code: 'invalid_credentials', message: 'Username atau password salah.' } },
        { status: 401 }
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

    // Reset rate limit on successful login
    rateLimiter.reset(rateLimitKey);
    
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

    const isHttps = req.headers.get('x-forwarded-proto') === 'https' || new URL(req.url).protocol === 'https:';


    res.cookies.set(process.env.SESSION_COOKIE_NAME || 'pos_session', token, {
      httpOnly: true,
      secure:   isHttps,
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
