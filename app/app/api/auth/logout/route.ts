import { NextResponse } from 'next/server';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit-logger';

export async function POST(req: Request) {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const cfVisitor = req.headers.get('cf-visitor');
  const isHttps = forwardedProto === 'https' || (cfVisitor && cfVisitor.includes('https')) || new URL(req.url).protocol === 'https:';
  const cookieName = process.env.SESSION_COOKIE_NAME || 'pos_session';
  const userId = req.headers.get('x-user-id');

  if (userId) {
    try {
      await logAudit({
        user_id: userId,
        action: 'logout',
        ip_address: getClientIp(req),
        user_agent: getUserAgent(req),
        status: 'success',
      });
    } catch {
      // Non-blocking audit log
    }
  }
  
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: isHttps || process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
