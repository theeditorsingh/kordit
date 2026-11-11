// Fields of a board member's user that are safe to send to the browser.
// Never widen this to the full User row: it holds the password hash and email.
export const memberUserSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
} as const;

export const memberInclude = {
  include: { user: { select: memberUserSelect } },
} as const;

// Shape of a board as loaded for the client (layout + /api/boards).
export const boardInclude = {
  columns: { orderBy: { order: 'asc' } },
  cards: { orderBy: { order: 'asc' } },
  members: memberInclude,
  owner: { select: { username: true } },
} as const;
