import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRound } from '../site/game-logic.js';

const products = Array.from({ length: 20 }, (_, index) => ({ id: `id-${index}`, name: `Product ${index}`, imageUrl: `https://example.test/${index}.jpg` }));

test('a seed produces the same targets and quiz order', () => {
  const first = buildRound(products, 'repeatable-seed');
  const second = buildRound(products, 'repeatable-seed');
  assert.deepEqual(first.targets, second.targets);
  assert.deepEqual(first.quiz, second.quiz);
});

test('a round contains five distinct targets and ten distinct quiz products', () => {
  const round = buildRound(products, 'daily-seed');
  assert.equal(round.targets.length, 5);
  assert.equal(round.quiz.length, 10);
  assert.equal(new Set(round.targets.map((product) => product.id)).size, 5);
  assert.equal(new Set(round.quiz.map((product) => product.id)).size, 10);
  assert.ok(round.targets.every((product) => round.targetIds.has(product.id)));
});

test('a too-small product set is rejected', () => {
  assert.throws(() => buildRound(products.slice(0, 9), 'seed'), /At least ten products/);
});

