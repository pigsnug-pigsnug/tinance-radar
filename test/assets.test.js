import assert from 'node:assert/strict';
import test from 'node:test';
import { bustModuleSpecifiers } from '../server/assets.js';

test('relative module imports and re-exports get a version query', () => {
  const source = `
import { esc } from './format.js';
import { render } from "./view.js";
export { grokWriteUrl } from './render-write.js';
const keep = './format.js';
`;
  const out = bustModuleSpecifiers(source, 'ab12');
  assert.match(out, /from '\.\/format\.js\?v=ab12'/);
  assert.match(out, /from "\.\/view\.js\?v=ab12"/);
  assert.match(out, /from '\.\/render-write\.js\?v=ab12'/);
  assert.match(out, /const keep = '\.\/format\.js'/);
});

test('an existing query is left alone', () => {
  const source = `import { x } from './api.js?v=old';`;
  assert.equal(bustModuleSpecifiers(source, 'new'), source);
});
