import assert from 'node:assert/strict';
import test from 'node:test';
import { brandKeysFor, buildRound, candidateQueue, formatShareText, sharesBrandWith } from '../site/game-logic.js';

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

test('the candidate queue is deterministic and includes every product once', () => {
  const queue = candidateQueue(products, 'daily-seed');
  assert.deepEqual(queue, candidateQueue(products, 'daily-seed'));
  assert.equal(new Set(queue.map((product) => product.id)).size, products.length);
});

test('brand keys normalize punctuation, diacritics, and multi-brand products', () => {
  const product = { id: 'a', brands: ['Coca-Cola', 'Mondelez International', 'Café'] };
  assert.deepEqual(brandKeysFor(product), ['cocacola', 'mondelezinternational', 'cafe']);
  assert.ok(sharesBrandWith({ id: 'b', brands: ['Mondelez-International'] }, new Set(['mondelezinternational'])));
});

test('products without brand metadata are unique by barcode', () => {
  const claimed = new Set(brandKeysFor({ id: 'a' }));
  assert.ok(!sharesBrandWith({ id: 'b' }, claimed));
  assert.ok(sharesBrandWith({ id: 'a' }, claimed));
});

test('share text is spoiler-free and preserves answer outcomes in a five-wide grid', () => {
  const text = formatShareText({
    seed: '2026-08-26',
    elapsedSeconds: 42,
    url: 'https://example.test/',
    answers: [
      { wasListed: true, correct: true }, { wasListed: false, correct: false }, { wasListed: null, correct: false },
      { wasListed: true, correct: true }, { wasListed: false, correct: true }, { wasListed: true, correct: false },
    ],
  });
  assert.equal(text, 'Shopping List 2026-08-26\n3/6 · 0:42\n\n🟩🟥⬜🟩🟩\n🟥\n\nhttps://example.test/');
});

test('a partial round uses a balanced target and decoy split', () => {
  const round = buildRound(products.slice(0, 5), 'partial-seed');
  assert.equal(round.quiz.length, 5);
  assert.equal(round.targets.length, 3);
  assert.equal(round.quiz.filter((product) => round.targetIds.has(product.id)).length, 3);
});

test('fewer than four loaded products are rejected', () => {
  assert.throws(() => buildRound(products.slice(0, 3), 'seed'), /At least four loaded products/);
});
