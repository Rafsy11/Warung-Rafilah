import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface DigitalProduct {
  id: string;
  category: string;
  product_name: string;
  product_code: string;
  admin_fee: string;
  agent_commission: string;
  icon_emoji: string;
  is_active: boolean;
  sort_order: number;
}

interface CategoryGroup {
  category: string;
  icon: string;
  products: DigitalProduct[];
}

/**
 * GET /api/agent/products?grouped=true
 * Daftar semua produk digital aktif, opsional dikelompokkan per kategori.
 */
export async function GET(req: NextRequest) {
  try {
    const grouped = req.nextUrl.searchParams.get('grouped') === 'true';

    const { rows } = await db.query<DigitalProduct>(
      `SELECT id, category, product_name, product_code,
              admin_fee, agent_commission, icon_emoji, is_active, sort_order
       FROM agent.digital_products
       WHERE is_active = true
       ORDER BY sort_order, product_name`
    );

    if (!grouped) {
      return NextResponse.json({ products: rows });
    }

    const categoryMap = new Map<string, CategoryGroup>();
    for (const p of rows) {
      if (!categoryMap.has(p.category)) {
        categoryMap.set(p.category, {
          category: p.category,
          icon: p.icon_emoji,
          products: [],
        });
      }
      categoryMap.get(p.category)!.products.push(p);
    }

    return NextResponse.json({
      categories: Array.from(categoryMap.values()),
    });
  } catch (err) {
    console.error('agent/products GET error:', err);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Database error' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/products
 * Tambah produk digital baru (owner only).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, product_name, product_code, admin_fee, agent_commission, icon_emoji, sort_order } = body;

    if (!category || !product_name || !product_code) {
      return NextResponse.json(
        { error: 'category, product_name, dan product_code wajib diisi' },
        { status: 400 }
      );
    }

    const { rows } = await db.query(
      `INSERT INTO agent.digital_products
         (category, product_name, product_code, admin_fee, agent_commission, icon_emoji, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, product_name, product_code, admin_fee, agent_commission, icon_emoji`,
      [
        category,
        product_name,
        product_code,
        admin_fee ?? 0,
        agent_commission ?? 0,
        icon_emoji ?? '📱',
        sort_order ?? 0,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('agent/products POST error:', err);
    const e = err as { code?: string };
    if (e.code === '23505') {
      return NextResponse.json(
        { error: 'product_code sudah digunakan' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent/products
 * Edit produk digital (admin_fee, commission, status, dll).
 * Body: { id, ...fields_to_update }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi' }, { status: 400 });
    }

    const allowedFields = ['product_name', 'admin_fee', 'agent_commission', 'icon_emoji', 'is_active', 'sort_order', 'category'];
    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, val] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        values.push(val);
        setClauses.push(`${key} = $${values.length}`);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang diupdate' }, { status: 400 });
    }

    values.push(id);
    const { rows } = await db.query(
      `UPDATE agent.digital_products SET ${setClauses.join(', ')} WHERE id = $${values.length}
       RETURNING id, category, product_name, product_code, admin_fee, agent_commission, icon_emoji, is_active`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('agent/products PUT error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
