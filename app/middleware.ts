import { NextRequest, NextResponse } from 'next/server';
import { getJwtSecret } from '@/lib/runtime-env';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'pos_session';
const PUBLIC_PATHS   = ['/login', '/api/auth/login', '/api/health'];
const JWT_SECRET = getJwtSecret();

async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return null;

    const encoder = new TextEncoder();
    
    // Import the secret key
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Convert base64url signature to Uint8Array
    const sigBase64 = sig.replace(/-/g, '+').replace(/_/g, '/');
    // pad string with '='
    const padLen = (4 - (sigBase64.length % 4)) % 4;
    const paddedSig = sigBase64 + '='.repeat(padLen);
    const sigBytes = Uint8Array.from(atob(paddedSig), c => c.charCodeAt(0));
    
    // Verify signature
    const dataBytes = encoder.encode(`${header}.${payload}`);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
    if (!isValid) return null;

    // Check expiration
    const payloadBase64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padPayloadLen = (4 - (payloadBase64.length % 4)) % 4;
    const paddedPayload = payloadBase64 + '='.repeat(padPayloadLen);
    const decoded = JSON.parse(atob(paddedPayload));
    
    if (decoded.exp > Math.floor(Date.now() / 1000)) {
      return decoded;
    }
    return null;
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let decoded = null;
  if (token) {
    decoded = await verifyToken(token);
  }

  const requestHeaders = new Headers(req.headers);
  // Always strip any client-supplied spoofed headers
  requestHeaders.delete('x-user-id');
  requestHeaders.delete('x-user-role');

  // CSRF Protection on state-modifying API requests
  if (pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.get('origin') || req.headers.get('referer');
    const host = req.headers.get('host');
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          console.warn(`CSRF blocked: origin ${originHost} does not match host ${host}`);
          return applySecurityHeaders(
            NextResponse.json(
              { error: { code: 'csrf_forbidden', message: 'Permintaan ditolak karena ketidaksesuaian asal (CSRF Protection).' } },
              { status: 403 }
            )
          );
        }
      } catch {
        // Invalid URL origin format
      }
    }
  }

  if (!decoded) {

    if (pathname.startsWith('/api/')) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: { code: 'unauthorized', message: 'Sesi tidak valid atau telah berakhir.' } },
          { status: 401 }
        )
      );
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  requestHeaders.set('x-user-id',   String(decoded.sub  ?? ''));
  requestHeaders.set('x-user-role', String(decoded.role ?? ''));

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  return applySecurityHeaders(response);
}


export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.jpeg).*)'],
};
