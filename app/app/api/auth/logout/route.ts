import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(process.env.SESSION_COOKIE_NAME || 'pos_session');
  return res;
}
