import { test } from 'node:test';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { moveProject } from './project-order';

const items = ['a', 'b', 'c', 'd'].map(id => ({ id }));
test('moves up and down while preserving every other relative position', () => {
  deepStrictEqual(moveProject(items, 'd', 'a').map(p => p.id), ['d', 'a', 'b', 'c']);
  deepStrictEqual(moveProject(items, 'a', 'c').map(p => p.id), ['b', 'c', 'a', 'd']);
  deepStrictEqual(items.map(p => p.id), ['a', 'b', 'c', 'd']);
});
test('same or removed targets do not change the order', () => {
  strictEqual(moveProject(items, 'a', 'a'), items);
  strictEqual(moveProject(items, 'a', 'removed'), items);
  strictEqual(moveProject(items, 'removed', 'a'), items);
});
