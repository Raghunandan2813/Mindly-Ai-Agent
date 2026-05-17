// app/api/graph/route.ts
// GET: Fetch all knowledge graph nodes + edges for a user.
// DELETE: Remove a specific node and its connected edges.
import { NextRequest, NextResponse } from 'next/server';
import { getUserGraph, deleteNode } from '@/lib/graphMemoryService';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ nodes: [], edges: [] });

  const graph = await getUserGraph(userId);
  return NextResponse.json(graph);
}

export async function DELETE(req: NextRequest) {
  const nodeId = req.nextUrl.searchParams.get('nodeId');
  const userId = req.nextUrl.searchParams.get('userId');

  if (!nodeId || !userId) {
    return NextResponse.json({ error: 'Missing nodeId or userId' }, { status: 400 });
  }

  try {
    await deleteNode(userId, nodeId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
