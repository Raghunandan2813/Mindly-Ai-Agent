// app/api/insights/route.ts
// Frontend API Endpoint: Handles fetching active insights and marking insights as acknowledged/dismissed.

import { NextResponse } from 'next/server';
import { getActiveInsights, acknowledgeInsight } from '@/lib/proactive/delivery';

/**
 * GET: Retrieves active unexpired insights for a specific user.
 * Query Params: ?userId=xxx
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  try {
    const activeInsights = await getActiveInsights(userId);
    return NextResponse.json({ insights: activeInsights });
  } catch (err: any) {
    console.error('[API Insights] Fetch failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch insights' }, { status: 500 });
  }
}

/**
 * POST: Acknowledges (dismisses) a proactive insight.
 * Body: { userId: string, insightId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, insightId } = body;

    if (!userId || !insightId) {
      return NextResponse.json({ error: 'Missing userId or insightId body parameters' }, { status: 400 });
    }

    const success = await acknowledgeInsight(userId, insightId);
    if (!success) {
      return NextResponse.json({ error: 'Dismissal failed in database layer' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Insight permanently dismissed' });
  } catch (err: any) {
    console.error('[API Insights] Acknowledge failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to dismiss insight' }, { status: 500 });
  }
}
