/** Due-date helpers shared by cards, My Tasks and Home. */

/** Global class for a due date: 'overdue', 'due-soon' (within 2 days) or ''. */
export function getDueDateClass(date: string | null, now: Date = new Date()) {
  if (!date) return '';
  const diff = (new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return 'overdue';
  if (diff <= 2) return 'due-soon';
  return '';
}

function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** Card footer date: "15th Nov, 26", or "15th Nov, 26 · 3:30 PM" when a time was set. */
export function formatCardDate(date: string) {
  const d = new Date(date);
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const text = `${ordinal(d.getDate())} ${month}, ${String(d.getFullYear()).slice(-2)}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${text} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : text;
}

/** "Nov 14", or "Nov 14 3:30 PM" when a time was set. */
export function formatDate(date: string) {
  const d = new Date(date);
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  if (hasTime) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
