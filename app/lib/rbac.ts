import { NextResponse } from 'next/server';

export type UserRole = 'owner' | 'cashier' | 'agent_operator';

export function requireRole(req: Request, allowedRoles: readonly UserRole[]) {
  const userRole = req.headers.get('x-user-role');

  if (!allowedRoles.includes(userRole as UserRole)) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Akses ditolak.' } },
      { status: 403 }
    );
  }

  return null;
}
