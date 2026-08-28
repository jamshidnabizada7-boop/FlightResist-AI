import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  let dbStatus: 'connected' | 'error' = 'error';

  try {
    // Simple connectivity check
    await db.$queryRawUnsafe('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  return NextResponse.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    db: dbStatus,
    latency: Date.now() - start,
  }, { status: dbStatus === 'connected' ? 200 : 503 });
}
