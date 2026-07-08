import { NextRequest, NextResponse } from 'next/server';
import { getJwtSecret } from '@/lib/runtime-env';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'pos_session';
const PUBLIC_PATHS   = ['/login', '/api/auth/login', '/api/health', '/api/webhooks'];
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let decoded = null;
  if (token) {
    decoded = await verifyToken(token);
  }

  if (!decoded) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-user-id',   String(decoded.sub  ?? ''));
  requestHeaders.set('x-user-role', String(decoded.role ?? ''));

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.jpg|.*\\.jpeg).*)'],
};
