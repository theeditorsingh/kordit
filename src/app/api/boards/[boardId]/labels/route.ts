import { NextRequest, NextResponse } from 'next/server';
import { getBoardLabelsAction, upsertBoardLabelAction, deleteBoardLabelAction } from '@/actions/boardActions';

/**
 * Maps an action error to a response. The actions throw short, user-facing messages for
 * auth and validation problems; anything else (e.g. a database error) stays in the server
 * log and the client gets a generic message.
 */
function errorResponse(e: unknown, clientErrorStatus: number) {
  const message = e instanceof Error ? e.message : '';
  if (message === 'Unauthorized') return NextResponse.json({ error: message }, { status: 401 });
  if (message === 'Guests have read-only access' || message.startsWith('Requires ')) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  const isDatabaseError = e instanceof Error && e.constructor.name.startsWith('PrismaClient');
  if (message && !isDatabaseError && clientErrorStatus < 500) {
    return NextResponse.json({ error: message }, { status: clientErrorStatus });
  }
  console.error('[labels route]', e);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const labels = await getBoardLabelsAction(boardId);
    return NextResponse.json(labels);
  } catch (e) {
    return errorResponse(e, 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const body = await req.json().catch(() => ({}));
    const label = await upsertBoardLabelAction(boardId, body?.name, body?.color);
    return NextResponse.json(label);
  } catch (e) {
    return errorResponse(e, 400);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const labelId = req.nextUrl.searchParams.get('id');
    if (!labelId) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    await deleteBoardLabelAction(boardId, labelId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, 400);
  }
}
