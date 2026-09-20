import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const result = await db.query("SELECT 1 FROM warung.schema_migrations WHERE filename='022_transaction_integrity.sql'");
    if (!result.rows.length) throw new Error('Schema not ready');
    return NextResponse.json({ status: 'ok', uptime_seconds: process.uptime() });
  } catch {
    return NextResponse.json({ status: 'not_ready' }, { status: 503 });
  }
}
