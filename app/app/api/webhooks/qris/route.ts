import { NextResponse } from 'next/server';

export async function POST() {
  return new NextResponse('Endpoint Disabled', { status: 404 });
}
