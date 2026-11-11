import type { CSSProperties } from 'react';

export type BackgroundType = 'color' | 'gradient' | 'image';

const HEX = /^#[0-9a-fA-F]{6}$/;
// Only an angle and plain hex stops, so nothing else can be smuggled into the style
const GRADIENT = /^linear-gradient\((\d{1,3})deg, (#[0-9a-fA-F]{6}), (#[0-9a-fA-F]{6})\)$/;

export const DEFAULT_GRADIENT = { angle: 135, from: '#0052CC', to: '#6554C0' };

export const PRESET_GRADIENTS = [
  'linear-gradient(135deg, #0052CC, #6554C0)',
  'linear-gradient(135deg, #36B37E, #00B8D9)',
  'linear-gradient(135deg, #FF5630, #FF991F)',
  'linear-gradient(135deg, #6554C0, #FF7452)',
  'linear-gradient(135deg, #172B4D, #0052CC)',
  'linear-gradient(135deg, #00B8D9, #36B37E)',
];

export const PRESET_COLORS = [
  '#0052CC', '#00B8D9', '#36B37E', '#FFC400', '#FF991F', '#FF5630',
  '#6554C0', '#E774BB', '#172B4D', '#42526E', '#8993A4', '#DFE1E6',
];

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

export function buildGradient(angle: number, from: string, to: string): string {
  const deg = ((Math.round(angle) % 360) + 360) % 360;
  return `linear-gradient(${deg}deg, ${from}, ${to})`;
}

export function parseGradient(value: string): { angle: number; from: string; to: string } | null {
  const m = GRADIENT.exec(value);
  return m ? { angle: Number(m[1]), from: m[2], to: m[3] } : null;
}

/** Used in the picker and again on the server before anything is stored. */
export function isValidBackground(type: unknown, value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 500) return false;
  if (type === 'color') return value === '' || HEX.test(value);
  if (type === 'gradient') {
    const g = parseGradient(value);
    return !!g && g.angle <= 360;
  }
  if (type === 'image') return /^https:\/\/[^\s"'()<>\\]+$/.test(value);
  return false;
}

/** Inline style for a board's background; empty when none is set. */
export function getBoardBackgroundStyle(board: { background?: string; backgroundType?: string }): CSSProperties {
  const { background, backgroundType } = board;
  if (!background || !isValidBackground(backgroundType, background)) return {};
  if (backgroundType === 'image') {
    return { backgroundImage: `url("${background}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background };
}
