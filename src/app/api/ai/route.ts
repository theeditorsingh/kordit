import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.1-8b-instant';

async function chat(systemPrompt: string, userPrompt: string): Promise<string> {
  const completion = await groq.chat.completions.create({
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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, payload } = await req.json();

  try {
    switch (action) {
      case 'subtasks': {
        const { cardTitle, cardDescription } = payload;
        const system = `You are a task management assistant. When given a task title and optional description, you break it into clear, actionable subtasks. Respond ONLY with a JSON array of strings, no explanation, no markdown. Example: ["Subtask 1","Subtask 2","Subtask 3"]`;
        const user = `Task: "${cardTitle}"${cardDescription ? `\nDescription: ${cardDescription}` : ''}`;
        const raw = await chat(system, user);
        let subtasks: string[] = [];
        try {
          // Extract JSON array even if model adds text around it
          const match = raw.match(/\[[\s\S]*\]/);
          subtasks = match ? JSON.parse(match[0]) : [];
        } catch {
          subtasks = raw.split('\n').map(s => s.replace(/^[-*\d.]+\s*/, '').trim()).filter(Boolean);
        }
        return NextResponse.json({ subtasks: subtasks.slice(0, 8) });
      }

      case 'smart_due_date': {
        const { cardTitle, priority } = payload;
        const system = `You are a project planning assistant. Suggest a realistic due date for a task based on its title and priority. Priority levels: urgent=today or tomorrow, high=2-5 days, medium=5-14 days, low=14-30 days. Respond ONLY with valid JSON: {"daysFromNow": number, "reasoning": "one short sentence"}`;
        const user = `Task: "${cardTitle}"\nPriority: ${priority}`;
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
        const { cardTitle } = payload;
        const system = `You are a task categorization assistant. Given a task title, suggest the best priority level and up to 3 relevant labels. Priority must be one of: urgent, high, medium, low. Labels should be short (1-2 words). Respond ONLY with valid JSON: {"priority": "medium", "labels": ["Design","Frontend"]}`;
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
        const { boardId } = payload;
        // Fetch last 7 days of activity for this board
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

        const system = `You are a project management assistant generating a concise weekly board activity digest. Format the output in clean markdown with sections: ## Summary, ## Key Activities, ## Insights & Suggestions. Be encouraging but concise. Max 250 words.`;
        const user = `Board: "${board?.title}"\nActivity this week:\n${activityText}`;
        const digest = await chat(system, user);
        return NextResponse.json({ digest });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AI route error:', error);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
