/** Letter tile for a workspace: a stable colour from its name, and its first letter. */
const TILE_COLORS = ['#6554C0', '#0052CC', '#36B37E', '#FF7452', '#00A3BF', '#E774BB', '#FF991F', '#5243AA'];

export function workspaceTileColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return TILE_COLORS[Math.abs(hash) % TILE_COLORS.length];
}

export function workspaceInitial(name: string): string {
  const ch = name.trim().match(/[\p{L}\p{N}]/u)?.[0];
  return (ch ?? '?').toUpperCase();
}
