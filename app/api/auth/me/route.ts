// app/api/auth/me/route.ts
// GET: Check who is currently logged in
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ userId: null });
  }
  return NextResponse.json({ userId: user.id, email: user.email });
}
