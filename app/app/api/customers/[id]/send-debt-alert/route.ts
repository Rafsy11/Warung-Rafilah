import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { type, amount } = await req.json();
    const alertType = type === 'new_debt' ? 'new_debt' : 'reminder';
    const amountNum = Number(amount || 0);

    const { rows } = await db.query(
      `SELECT name, phone, current_debt, credit_limit 
       FROM warung.customers 
       WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan atau tidak aktif.' }, { status: 404 });
    }

    const customer = rows[0];
    if (!customer.phone || customer.phone.trim() === '') {
      return NextResponse.json({ error: 'Pelanggan tidak memiliki nomor telepon terdaftar.' }, { status: 400 });
    }

    // Call n8n webhook
    const n8nRes = await fetch('http://n8n:5678/webhook/BrtxwMY3malrlZKW/webhook/send-debt-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customer.name,
        phone: customer.phone,
        current_debt: customer.current_debt,
        credit_limit: customer.credit_limit,
        amount: amountNum,
        type: alertType
      }),
    });

    if (!n8nRes.ok) {
      console.warn(`n8n webhook returned status ${n8nRes.status}`);
      // Fallback: if n8n is offline or webhook not registered yet
      return NextResponse.json({ 
        success: false, 
        warning: 'Gagal mengirim sinyal ke n8n. Pastikan kontainer n8n aktif dan workflow terpasang.' 
      }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('send-debt-alert POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
