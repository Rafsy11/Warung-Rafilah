import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const isHttps = req.headers.get('x-forwarded-proto') === 'https' || new URL(req.url).protocol === 'https:';
  const cookieName = process.env.SESSION_COOKIE_NAME || 'pos_session';
  
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
