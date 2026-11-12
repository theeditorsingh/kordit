/**
 * Small vector illustration for each board template. Drawn in `currentColor`
 * (the template's colour) with translucent fills, so they work in light and dark themes.
 */
import type { ReactNode } from 'react';

const S = { stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
const soft = { fill: 'currentColor', opacity: 0.18 } as const;
const solid = { fill: 'currentColor' } as const;

const ART: Record<string, ReactNode> = {
  // 1-on-1 Meeting Agenda: two speech bubbles
  '1': (
    <>
      <path d="M8 14a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H22l-8 7v-7a6 6 0 0 1-6-6z" {...soft} />
      <path d="M8 14a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H22l-8 7v-7a6 6 0 0 1-6-6z" {...S} />
      <path d="M48 22h6a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6v7l-8-7H34a6 6 0 0 1-5-3" {...S} />
      <path d="M16 17h18M16 24h11" {...S} />
    </>
  ),
  // Agile: sprint loop
  '2': (
    <>
      <circle cx="32" cy="32" r="20" {...soft} />
      <path d="M50 26a19 19 0 1 0 1 10" {...S} />
      <path d="M52 14v12H40" {...S} />
      <path d="M24 32l6 6 11-12" {...S} />
    </>
  ),
  // Company Overview: building
  '3': (
    <>
      <rect x="14" y="10" width="24" height="44" rx="3" {...soft} />
      <rect x="14" y="10" width="24" height="44" rx="3" {...S} />
      <path d="M38 26h10a3 3 0 0 1 3 3v25H38" {...S} />
      <path d="M21 19h4M29 19h3M21 28h4M29 28h3M21 37h4M29 37h3M44 35h1M44 43h1M8 54h48M24 54v-8h5v8" {...S} />
    </>
  ),
  // Design Huddle: pen nib and shapes
  '4': (
    <>
      <circle cx="19" cy="20" r="9" {...soft} />
      <circle cx="19" cy="20" r="9" {...S} />
      <rect x="10" y="38" width="16" height="16" rx="3" {...S} />
      <path d="M44 8l12 12-18 30-12 6 6-12z" {...soft} />
      <path d="M44 8l12 12-18 30-12 6 6-12zM38 18l10 10" {...S} />
    </>
  ),
  // Go To Market: rocket
  '5': (
    <>
      <path d="M32 6c10 7 13 18 11 30H21C19 24 22 13 32 6z" {...soft} />
      <path d="M32 6c10 7 13 18 11 30H21C19 24 22 13 32 6z" {...S} />
      <circle cx="32" cy="22" r="4.5" {...S} />
      <path d="M21 30l-8 9 9 1M43 30l8 9-9 1M27 43c0 5 2 9 5 13 3-4 5-8 5-13" {...S} />
    </>
  ),
  // Personal Productivity: checklist
  '6': (
    <>
      <rect x="13" y="8" width="38" height="48" rx="5" {...soft} />
      <rect x="13" y="8" width="38" height="48" rx="5" {...S} />
      <path d="M20 21l3 3 6-6M20 34l3 3 6-6M35 22h9M35 35h9M21 47h23" {...S} />
    </>
  ),
  // Project Management: timeline bars
  '7': (
    <>
      <path d="M10 8v48h46" {...S} />
      <rect x="16" y="14" width="22" height="8" rx="4" {...solid} opacity={0.9} />
      <rect x="24" y="27" width="26" height="8" rx="4" {...solid} opacity={0.55} />
      <rect x="34" y="40" width="18" height="8" rx="4" {...solid} opacity={0.3} />
    </>
  ),
  // Remote Team Meetings: video tiles
  '8': (
    <>
      <rect x="6" y="12" width="52" height="34" rx="5" {...soft} />
      <rect x="6" y="12" width="52" height="34" rx="5" {...S} />
      <path d="M32 12v34M6 29h52M24 54h16M32 46v8" {...S} />
      <circle cx="19" cy="20" r="2.5" {...solid} />
      <circle cx="45" cy="20" r="2.5" {...solid} />
      <circle cx="19" cy="37" r="2.5" {...solid} />
      <circle cx="45" cy="37" r="2.5" {...solid} />
    </>
  ),
  // Simple Project Board: three columns
  '9': (
    <>
      <rect x="8" y="10" width="14" height="44" rx="4" {...soft} />
      <rect x="25" y="10" width="14" height="32" rx="4" {...soft} />
      <rect x="42" y="10" width="14" height="22" rx="4" {...soft} />
      <rect x="8" y="10" width="14" height="44" rx="4" {...S} />
      <rect x="25" y="10" width="14" height="32" rx="4" {...S} />
      <rect x="42" y="10" width="14" height="22" rx="4" {...S} />
      <path d="M12 18h6M12 26h6M12 34h6M29 18h6M29 26h6M46 18h6" {...S} />
    </>
  ),
  // Teaching: week calendar
  '10': (
    <>
      <rect x="8" y="12" width="48" height="42" rx="6" {...soft} />
      <rect x="8" y="12" width="48" height="42" rx="6" {...S} />
      <path d="M8 24h48M20 6v10M44 6v10" {...S} />
      <path d="M17 33h3M27 33h3M37 33h3M47 33h1M17 43h3M27 43h3" {...S} />
      <path d="M36 43l3 3 6-6" {...S} />
    </>
  ),
};

// Fallback for a template without its own art: a generic board
const GENERIC = ART['9'];

export default function TemplateArt({ templateId, size = 56 }: { templateId: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {ART[templateId] ?? GENERIC}
    </svg>
  );
}
