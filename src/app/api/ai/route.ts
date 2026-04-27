import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Lazy client — instantiated at request time so build doesn't fail without GROQ_API_KEY
let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not set in environment variables.');
    _groq = new Groq({ apiKey: key });
  }
  return _groq;
}

const MODEL = 'llama-3.1-8b-instant';

async function chat(systemPrompt: string, userPrompt: string): Promise<string> {
  const completion = await getGroq().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 512,
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as any).message);
  return String(error);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized — please sign in' }, { status: 401 });
  }

  let body: { action?: string; payload?: any };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { action, payload } = body;

  try {
    switch (action) {
      case 'subtasks': {
        const { cardTitle, cardDescription } = payload ?? {};
        if (!cardTitle) return NextResponse.json({ error: 'cardTitle is required' }, { status: 400 });
        const system = `You are a task management assistant. Break the given task into clear, actionable subtasks. Respond ONLY with a JSON array of strings, no explanation, no markdown. Example: ["Subtask 1","Subtask 2","Subtask 3"]`;
        const user = `Task: "${cardTitle}"${cardDescription ? `\nDescription: ${cardDescription}` : ''}`;
        const raw = await chat(system, user);
        let subtasks: string[] = [];
        try {
          const match = raw.match(/\[[\s\S]*\]/);
          subtasks = match ? JSON.parse(match[0]) : [];
        } catch {
          subtasks = raw.split('\n').map(s => s.replace(/^[-*\d.]+\s*/, '').trim()).filter(Boolean);
        }
        return NextResponse.json({ subtasks: subtasks.slice(0, 8) });
      }

      case 'smart_due_date': {
        const { cardTitle, priority } = payload ?? {};
        if (!cardTitle) return NextResponse.json({ error: 'cardTitle is required' }, { status: 400 });
        const system = `You are a project planning assistant. Suggest a realistic due date. Priority: urgent=1 day, high=3 days, medium=7 days, low=21 days. Respond ONLY with valid JSON: {"daysFromNow": number, "reasoning": "one short sentence"}`;
        const user = `Task: "${cardTitle}"\nPriority: ${priority ?? 'medium'}`;
        const raw = await chat(system, user);
        let result = { daysFromNow: 7, reasoning: 'Based on task complexity' };
        try {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) result = JSON.parse(match[0]);
        } catch { /* use default */ }
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + (result.daysFromNow ?? 7));
        return NextResponse.json({
          suggestedDate: suggestedDate.toISOString().split('T')[0],
          reasoning: result.reasoning,
        });
      }

      case 'auto_categorize': {
        const { cardTitle } = payload ?? {};
        if (!cardTitle) return NextResponse.json({ error: 'cardTitle is required' }, { status: 400 });
        const system = `You are a task categorization assistant. Given a task title, suggest a priority and up to 3 labels. Priority must be one of: urgent, high, medium, low. Labels should be 1-2 words. Respond ONLY with valid JSON: {"priority": "medium", "labels": ["Design","Frontend"]}`;
        const user = `Task: "${cardTitle}"`;
        const raw = await chat(system, user);
        let result = { priority: 'medium', labels: [] as string[] };
        try {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) result = JSON.parse(match[0]);
        } catch { /* use default */ }
        return NextResponse.json({
          priority: result.priority ?? 'medium',
          labels: (result.labels ?? []).slice(0, 3),
        });
      }

      case 'weekly_digest': {
        const { boardId } = payload ?? {};
        if (!boardId) return NextResponse.json({ error: 'boardId is required' }, { status: 400 });

        // Verify the user is a member of this board
        const digestMember = await prisma.member.findUnique({
          where: { boardId_userId: { boardId, userId: session.user.id } }
        });
        if (!digestMember) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const since = new Date();
        since.setDate(since.getDate() - 7);
        const activities = await prisma.activity.findMany({
          where: { boardId, createdAt: { gte: since } },
          include: { user: { select: { name: true, username: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        const board = await prisma.board.findUnique({
          where: { id: boardId },
          select: { title: true },
        });

        if (activities.length === 0) {
          return NextResponse.json({ digest: `**${board?.title ?? 'Board'} — Weekly Digest**\n\nNo activity recorded this week. Time to get moving! 🚀` });
        }

        const activityText = activities.map(a => {
          const actor = a.user?.name || a.user?.username || 'Someone';
          const d = a.details as Record<string, string>;
          switch (a.action) {
            case 'card_created': return `${actor} created card "${d.cardTitle}"`;
            case 'card_moved': return `${actor} moved "${d.cardTitle}" from ${d.fromColumn} → ${d.toColumn}`;
            case 'card_updated': return `${actor} updated card "${d.cardTitle}"`;
            case 'card_deleted': return `${actor} deleted card "${d.cardTitle}"`;
            case 'member_invited': return `${actor} invited ${d.email} as ${d.role}`;
            case 'column_created': return `${actor} created column "${d.columnTitle}"`;
            default: return `${actor}: ${a.action}`;
          }
        }).join('\n');

        const system = `You are a project management assistant generating a weekly board digest. Format in clean markdown: ## Summary, ## Key Activities, ## Insights & Suggestions. Be encouraging and concise. Max 250 words.`;
        const user = `Board: "${board?.title}"\nActivity this week:\n${activityText}`;
        const digest = await chat(system, user);
        return NextResponse.json({ digest });
      }

      default:
        return NextResponse.json({ error: `Unknown action: "${action}"` }, { status: 400 });
    }
  } catch (error) {
    // Surface the REAL error message — critical for debugging Groq issues
    const msg = getErrorMessage(error);
    console.error('[AI route error]', action, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
