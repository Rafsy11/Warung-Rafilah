import { NextResponse } from 'next/server';

export type UserRole = 'owner' | 'cashier' | 'agent_operator';

export function requireRole(req: Request, allowedRoles: readonly UserRole[]) {
  const userRole = req.headers.get('x-user-role');

  if (!userRole || !allowedRoles.includes(userRole as UserRole)) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'Akses ditolak.' } },
      { status: 403 }
    );
  }

  return null;
}

export function requireAuth(req: Request) {
  const userId = req.headers.get('x-user-id');
  const userRole = req.headers.get('x-user-role');

  if (!userId || !userRole) {
    return {
      errorResponse: NextResponse.json(
        { error: { code: 'unauthorized', message: 'Akses ditolak. Silakan login terlebih dahulu.' } },
        { status: 401 }
      ),
      userId: null,
      userRole: null
    };
  }

  return { errorResponse: null, userId, userRole: userRole as UserRole };
}

