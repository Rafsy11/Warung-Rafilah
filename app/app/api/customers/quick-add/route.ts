import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireRole } from '@/lib/rbac';

const quickAddCustomerSchema = z.object({
  name:         z.string().min(1).max(100),
  phone:        z.string().max(20).optional(),
  credit_limit: z.number().positive().optional(),
});

const DEFAULT_CREDIT_LIMIT = 500_000;

export async function POST(request: NextRequest) {
  const forbidden = requireRole(request, ['owner', 'cashier']);
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const parsed = quickAddCustomerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data tidak valid', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, phone, credit_limit } = parsed.data;
    const limit = credit_limit ?? DEFAULT_CREDIT_LIMIT;

    // Check for duplicate by exact name (case-insensitive)
    const { rows: existing } = await db.query(
      `SELECT id, name, phone, address, credit_limit, current_debt
       FROM warung.customers
       WHERE LOWER(name) = LOWER($1) AND is_active = true`,
      [name.trim()]
    );

    if (existing.length > 0) {
      // Return existing customer instead of creating duplicate
      return NextResponse.json(
        { customer: existing[0], existing: true },
        { status: 200 }
      );
    }

    const { rows } = await db.query(
      `INSERT INTO warung.customers (name, phone, credit_limit)
       VALUES ($1, $2, $3)
       RETURNING id, name, phone, address, credit_limit, current_debt`,
      [name.trim(), phone?.trim() || null, limit]
    );

    return NextResponse.json(
      { customer: rows[0], existing: false },
      { status: 201 }
    );
  } catch (err) {
    console.error('Quick-add customer error:', err);
    return NextResponse.json(
      { error: 'Gagal menyimpan pelanggan.' },
      { status: 500 }
    );
  }
}
