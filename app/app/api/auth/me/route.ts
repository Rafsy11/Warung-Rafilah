import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');
  
  if (!userId) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Not logged in' } }, { status: 401 });
  }

  return NextResponse.json({ id: userId, role: userRole });
}
