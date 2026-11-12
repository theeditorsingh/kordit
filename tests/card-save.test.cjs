const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the editor's actual save handler with a controlled persistence boundary.
const source = ts.createSourceFile('CardModal.tsx', fs.readFileSync('src/components/CardModal.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'save') handler = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
const code = ts.transpileModule(handler, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
function editor(updateCard, title = 'Edited') {
  const result = {closed: 0, error: '', statuses: []};
  const original = {id: 'card', title: 'Original'};
  const context = {
    data: {...original, title}, originalRef: {current: original},
    card: original, board: {id: 'board', cards: {card: original}},
    savingRef: {current: false}, transferBusy: null,
    titleInputRef: {current: {focus() {}}}, updateCard,
    setSaveStatus: status => result.statuses.push(status),
    setSaveError: error => { result.error = error; },
    onClose: () => { result.closed++; },
  };
  vm.createContext(context); vm.runInContext(code, context);
  return {save: context.save, result};
}

test('editor waits for persistence and prevents duplicate saves', async () => {
  let finish, calls = 0;
  const {save, result} = editor(() => { calls++; return new Promise(resolve => {finish = resolve;}); });
  const pending = save(); await save();
  assert.equal(result.closed, 0); assert.equal(calls, 1);
  finish(true); await pending;
  assert.equal(result.closed, 1);
});

test('failed save retains the editor and can be retried', async () => {
  let succeed = false;
  const {save, result} = editor(async () => succeed);
  await save(); assert.equal(result.closed, 0); assert.match(result.error, /try again/);
  succeed = true; await save(); assert.equal(result.closed, 1); assert.equal(result.error, '');
});

test('blank titles cannot be saved', async () => {
  let called = false;
  const {save, result} = editor(async () => {called = true; return true;}, '  ');
  await save(); assert.equal(called, false); assert.equal(result.closed, 0); assert.match(result.error, /title/);
});

test('unchanged cards close without a write', async () => {
  let called = false;
  const {save, result} = editor(async () => {called = true; return true;}, 'Original');
  await save(); assert.equal(called, false); assert.equal(result.closed, 1);
});
