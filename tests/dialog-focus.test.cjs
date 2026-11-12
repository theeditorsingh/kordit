const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setup() {
  const listeners = new Map();
  const document = {
    activeElement: null,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  function element(children = []) {
    const el = {
      isConnected: true,
      focus() { document.activeElement = el; },
      getClientRects: () => [1],
      closest: () => null,
      querySelectorAll: () => children,
      contains: target => target === el || children.includes(target),
    };
    return el;
  }
  let cleanup;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/hooks/useDialogFocus.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, document, require: () => ({useEffect(fn) { cleanup = fn(); }}) });
  function open(dialog) { exports.useDialogFocus({current: dialog}); return cleanup; }
  function tab(shiftKey = false) {
    const event = {key: 'Tab', shiftKey, preventDefault() { this.prevented = true; }};
    for (const fn of listeners.get('keydown') || []) fn(event);
    return event;
  }
  return { document, element, open, tab, listeners };
}

test('Tab wraps at both ends and closing restores the opener', () => {
  const {document, element, open, tab} = setup();
  const opener = element(); opener.focus();
  const first = element(), last = element(), dialog = element([first, last]);
  const close = open(dialog);
  assert.equal(document.activeElement, dialog);
  tab(); assert.equal(document.activeElement, first);
  assert.equal(tab(true).prevented, true); assert.equal(document.activeElement, last);
  tab(); assert.equal(document.activeElement, first);
  close(); assert.equal(document.activeElement, opener);
});

test('a nested confirmation owns focus and restores the parent control', () => {
  const {document, element, open, tab} = setup();
  const opener = element(); opener.focus();
  const parentControl = element(), parent = element([parentControl]);
  const closeParent = open(parent); parentControl.focus();
  const cancel = element(), confirm = element(), nested = element([cancel, confirm]);
  const closeNested = open(nested);
  tab(); assert.equal(document.activeElement, cancel);
  tab(true); assert.equal(document.activeElement, confirm);
  closeNested(); assert.equal(document.activeElement, parentControl);
  tab(); assert.equal(document.activeElement, parentControl);
  closeParent(); assert.equal(document.activeElement, opener);
});

test('empty dialogs retain focus and remove event listeners on close', () => {
  const {document, element, open, tab, listeners} = setup();
  const dialog = element(); const close = open(dialog);
  assert.equal(tab().prevented, true);
  assert.equal(document.activeElement, dialog);
  close();
  assert.equal(listeners.get('keydown').size, 0);
  assert.equal(listeners.get('focusin').size, 0);
});
