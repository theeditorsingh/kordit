const DEFAULT_MEMBER_COLORS = [
  '#0052CC', '#00B8D9', '#36B37E', '#FF5630', '#FF991F',
  '#6554C0', '#00C7E6', '#57D9A3', '#FF7452', '#FFC400',
];

export function getMemberColor(index: number): string {
  return DEFAULT_MEMBER_COLORS[index % DEFAULT_MEMBER_COLORS.length];
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
