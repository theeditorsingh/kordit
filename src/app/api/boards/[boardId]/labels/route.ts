import { NextRequest, NextResponse } from 'next/server';
import { getBoardLabelsAction, upsertBoardLabelAction } from '@/actions/boardActions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const labels = await getBoardLabelsAction(boardId);
    return NextResponse.json(labels);
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const { name, color } = await req.json();
    const label = await upsertBoardLabelAction(boardId, name, color);
    return NextResponse.json(label);
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : 400;
    return NextResponse.json({ error: e.message }, { status });
  }
}
