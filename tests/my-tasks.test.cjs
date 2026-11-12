const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Load a TypeScript utility module (type-only imports are erased by transpiling)
function load(file) {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', out)(module, module.exports, require);
  return module.exports;
}

const myTasks = load('src/utils/myTasks.ts');
const tiles = load('src/utils/workspaceTile.ts');
const reserved = load('src/utils/reservedUsernames.ts');

function card(id, extra = {}) {
  return { id, title: id, assigneeIds: ['me'], dueDate: null, completedAt: null, ...extra };
}
function board(id, cards, extra = {}) {
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  return { id, title: id, slug: id, isArchived: false, columns: [{ id: `${id}-col`, title: 'To Do', color: '#000', cardIds: cards.map((c) => c.id) }], cards: byId, ...extra };
}

test('getAssignedOpenCards keeps open cards assigned to the user, across boards', () => {
  const boards = [
    board('a', [card('mine'), card('done', { completedAt: '2026-01-01T00:00:00Z' }), card('theirs', { assigneeIds: ['you'] })]),
    board('b', [card('mine-too')]),
    board('archived', [card('hidden')], { isArchived: true }),
  ];
  const ids = myTasks.getAssignedOpenCards(boards, 'me').map((i) => i.card.id);
  assert.deepEqual(ids, ['mine', 'mine-too']);
  assert.deepEqual(myTasks.getAssignedOpenCards(boards, null), []);
});

test('dueGroupOf buckets by local calendar day', () => {
  const now = new Date(2026, 10, 12, 10, 0); // Nov 12, 10:00 local
  const at = (d, h = 0, m = 0) => new Date(2026, 10, d, h, m).toISOString();
  assert.equal(myTasks.dueGroupOf(null, now), 'none');
  assert.equal(myTasks.dueGroupOf(at(11), now), 'overdue');
  assert.equal(myTasks.dueGroupOf(at(12), now), 'today');          // date only, today
  assert.equal(myTasks.dueGroupOf(at(12, 9, 0), now), 'overdue');  // a time today that has passed
  assert.equal(myTasks.dueGroupOf(at(12, 17, 0), now), 'today');
  assert.equal(myTasks.dueGroupOf(at(19), now), 'week');
  assert.equal(myTasks.dueGroupOf(at(20), now), 'later');
});

test('groupByDue sorts dated groups by due date', () => {
  const now = new Date(2026, 10, 12, 10, 0);
  const items = [
    { card: card('late', { dueDate: new Date(2026, 10, 16).toISOString() }) },
    { card: card('soon', { dueDate: new Date(2026, 10, 14).toISOString() }) },
    { card: card('undated') },
  ];
  const groups = myTasks.groupByDue(items, now);
  assert.deepEqual(groups.week.map((i) => i.card.id), ['soon', 'late']);
  assert.deepEqual(groups.none.map((i) => i.card.id), ['undated']);
});

test('boardHref opens a card and falls back to the viewer username', () => {
  assert.equal(myTasks.boardHref({ slug: 'b', ownerUsername: 'owner' }, 'me', 'c 1'), '/owner/b?card=c%201');
  assert.equal(myTasks.boardHref({ slug: 'b', ownerUsername: null }, 'me'), '/me/b');
  assert.equal(myTasks.boardHref({ slug: 'b', ownerUsername: null }, null), null);
});

test('workspace tiles are stable per name', () => {
  assert.equal(tiles.workspaceTileColor('Marketing'), tiles.workspaceTileColor('Marketing'));
  assert.equal(tiles.workspaceInitial('  growth team'), 'G');
  assert.equal(tiles.workspaceInitial('🚀 Product'), 'P');
  assert.equal(tiles.workspaceInitial(''), '?');
});

test('route names are reserved as usernames', () => {
  for (const name of ['workspaces', 'Inbox', 'my-tasks', 'api']) assert.equal(reserved.isReservedUsername(name), true);
  assert.equal(reserved.isReservedUsername('pallavi'), false);
});
