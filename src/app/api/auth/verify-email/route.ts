import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, dbAvailable } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!dbAvailable()) {
    return NextResponse.json(
      { message: 'Database unavailable. Please try again later.' },
      { status: 503 },
    );
  }

  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ message: 'Missing token parameter.' }, { status: 400 });
  }

  const verificationToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.expires < new Date()) {
    return NextResponse.json(
      { message: 'Invalid or expired verification token.' },
      { status: 400 },
    );
  }

  await db.user.update({
    where: { email: verificationToken.identifier },
    data: { emailVerified: new Date() },
  });

  await db.verificationToken.delete({ where: { token } });

  return NextResponse.json({ message: 'Email verified successfully.' }, { status: 200 });
}

export async function POST(request: NextRequest) {
  if (!dbAvailable()) {
    return NextResponse.json(
      { message: 'Database unavailable. Please try again later.' },
      { status: 503 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
  }

  await db.user.update({
    where: { email: session.user.email.toLowerCase() },
    data: { emailVerified: new Date() },
  });

  return NextResponse.json({ message: 'Email verified successfully.' }, { status: 200 });
}
