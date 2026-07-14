import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCss, parseHtml } from '../src/shared/parsers';

test('parseHtml builds an element tree with attributes and comments', () => {
  const document = parseHtml('<!doctype html><main class="app" hidden><!--x--><img src=a.png><p>Olá &amp; tchau</p></main>');
  assert.equal(document.children[0].type, 'doctype');

  const main = document.children[1];
  assert.equal(main.type, 'element');
  if (main.type !== 'element') return;
  assert.equal(main.tagName, 'main');
  assert.deepEqual(main.attributes, [{ name: 'class', value: 'app' }, { name: 'hidden', value: true }]);
  assert.equal(main.children[0].type, 'comment');
  assert.equal(main.children[1].type, 'element');
  assert.equal(main.children[2].type, 'element');

  const paragraph = main.children[2];
  assert.equal(paragraph.type, 'element');
  if (paragraph.type !== 'element') return;
  assert.deepEqual(paragraph.children, [{ type: 'text', value: 'Olá & tchau' }]);
});

test('parseCss builds style rules and nested at-rules', () => {
  const stylesheet = parseCss(`
    .app, main { color: #111 !important; background: rgb(255, 255, 255); }
    @media (min-width: 900px) { .app { display: grid; } }
    @font-face { font-family: "Inter"; src: url(inter.woff2); }
  `);

  assert.equal(stylesheet.rules.length, 3);
  const rule = stylesheet.rules[0];
  assert.equal(rule.type, 'style-rule');
  if (rule.type !== 'style-rule') return;
  assert.equal(rule.selector, '.app, main');
  assert.deepEqual(rule.declarations[0], { property: 'color', value: '#111', important: true });

  const media = stylesheet.rules[1];
  assert.equal(media.type, 'at-rule');
  if (media.type !== 'at-rule') return;
  assert.equal(media.name, 'media');
  assert.equal(media.prelude, '(min-width: 900px)');
  assert.equal(media.rules?.[0].type, 'style-rule');

  const fontFace = stylesheet.rules[2];
  assert.equal(fontFace.type, 'at-rule');
  if (fontFace.type !== 'at-rule') return;
  assert.equal(fontFace.declarations?.[0].property, 'font-family');
});
