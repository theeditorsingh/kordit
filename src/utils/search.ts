import { Card } from '@/types';

/** True when the card matches the search box text: title, description, labels or checklist items. */
export function cardMatchesSearch(card: Card, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    card.title.toLowerCase().includes(q) ||
    (card.description || '').toLowerCase().includes(q) ||
    card.labels.some((l) => l.name.toLowerCase().includes(q)) ||
    card.checklist.some((item) => item.text.toLowerCase().includes(q))
  );
}
