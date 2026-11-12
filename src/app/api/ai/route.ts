import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { LIMITS, consume } from '@/lib/rateLimit';

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

/** A trimmed string no longer than `max`, or null when the value isn't a usable string. */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

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

const MODEL = 'llama3-8b-8192';

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

// Escapes characters that could let user-controlled text break out of the
// plain-text slot it's interpolated into and be read as prompt structure/instructions.
function sanitizeUserInput(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
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

  // Every call costs Groq tokens, so cap how often one account can ask
  if (!(await consume(`ai:${session.user.id}`, LIMITS.ai))) {
    return NextResponse.json({ error: 'AI limit reached. Please try again later.' }, { status: 429 });
  }

  try {
    switch (action) {
      case 'subtasks': {
        const cardTitle = text(payload?.cardTitle, 500);
        const cardDescription = text(payload?.cardDescription, 2000);
        if (!cardTitle) return NextResponse.json({ error: 'cardTitle is required' }, { status: 400 });
        const safeTitle = sanitizeUserInput(cardTitle);
        const safeDescription = cardDescription ? sanitizeUserInput(cardDescription) : undefined;
        const system = `You are a task management assistant. Break the given task into clear, actionable subtasks. Respond ONLY with a JSON array of strings, no explanation, no markdown. Example: ["Subtask 1","Subtask 2","Subtask 3"]`;
        const user = `Task: "${safeTitle}"${safeDescription ? `\nDescription: ${safeDescription}` : ''}`;
        const raw = await chat(system, user);
        let subtasks: string[] = [];
        try {
          const match = raw.match(/\[[\s\S]*\]/);
          subtasks = match ? JSON.parse(match[0]) : [];
        } catch {
          subtasks = raw.split('\n').map(s => s.replace(/^[-*\d.]+\s*/, '').trim()).filter(Boolean);
        }
        if (!Array.isArray(subtasks)) subtasks = [];
        return NextResponse.json({ subtasks: subtasks.filter((s) => typeof s === 'string').map((s) => s.slice(0, 200)).slice(0, 8) });
      }

      case 'smart_due_date': {
        const cardTitle = text(payload?.cardTitle, 500);
        const priority = PRIORITIES.includes(payload?.priority) ? payload.priority : 'medium';
        if (!cardTitle) return NextResponse.json({ error: 'cardTitle is required' }, { status: 400 });
        const system = `You are a project planning assistant. Suggest a realistic due date. Priority: urgent=1 day, high=3 days, medium=7 days, low=21 days. Respond ONLY with valid JSON: {"daysFromNow": number, "reasoning": "one short sentence"}`;
        const user = `Task: "${sanitizeUserInput(cardTitle)}"\nPriority: ${priority ?? 'medium'}`;
        const raw = await chat(system, user);
        let result = { daysFromNow: 7, reasoning: 'Based on task complexity' };
        try {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) result = JSON.parse(match[0]);
        } catch { /* use default */ }
        const suggestedDate = new Date();
        // The model's numbers are untrusted: keep them to a sane whole number of days
        const days = Number.isFinite(Number(result.daysFromNow)) ? Math.min(365, Math.max(0, Math.round(Number(result.daysFromNow)))) : 7;
        suggestedDate.setDate(suggestedDate.getDate() + days);
        return NextResponse.json({
          suggestedDate: suggestedDate.toISOString().split('T')[0],
          reasoning: typeof result.reasoning === 'string' ? result.reasoning.slice(0, 300) : '',
        });
      }

      case 'auto_categorize': {
        const cardTitle = text(payload?.cardTitle, 500);
        if (!cardTitle) return NextResponse.json({ error: 'cardTitle is required' }, { status: 400 });
        const system = `You are a task categorization assistant. Given a task title, suggest a priority and up to 3 labels. Priority must be one of: urgent, high, medium, low. Labels should be 1-2 words. Respond ONLY with valid JSON: {"priority": "medium", "labels": ["Design","Frontend"]}`;
        const user = `Task: "${sanitizeUserInput(cardTitle)}"`;
        const raw = await chat(system, user);
        let result = { priority: 'medium', labels: [] as string[] };
        try {
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) result = JSON.parse(match[0]);
        } catch { /* use default */ }
        return NextResponse.json({
          priority: PRIORITIES.includes(result.priority) ? result.priority : 'medium',
          labels: (Array.isArray(result.labels) ? result.labels : []).filter((l) => typeof l === 'string').map((l) => l.slice(0, 30)).slice(0, 3),
        });
      }

      case 'weekly_digest': {
        const boardId = text(payload?.boardId, 64);
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
        const safeBoardTitle = sanitizeUserInput(board?.title ?? 'Board');

        if (activities.length === 0) {
          return NextResponse.json({ digest: `**${safeBoardTitle} — Weekly Digest**\n\nNo activity recorded this week. Time to get moving! 🚀` });
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
        const user = `Board: "${safeBoardTitle}"\nActivity this week:\n${activityText}`;
        const digest = await chat(system, user);
        return NextResponse.json({ digest });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    // Full details go to the server log only; provider errors can reveal configuration
    console.error('[AI route error]', action, getErrorMessage(error));
    return NextResponse.json({ error: 'The AI assistant is unavailable right now. Please try again.' }, { status: 500 });
  }
}
