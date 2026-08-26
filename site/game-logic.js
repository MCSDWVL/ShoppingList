export const MAX_ROUND_PRODUCTS = 10;
export const MIN_ROUND_PRODUCTS = 4;

export function hashString(value) {
  return [...value].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
}

export function makeRandom(seed) {
  let state = hashString(seed);
  return () => {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function shuffle(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const chosen = Math.floor(random() * (index + 1));
    [copy[index], copy[chosen]] = [copy[chosen], copy[index]];
  }
  return copy;
}

export function candidateQueue(products, seed) {
  return shuffle(products, makeRandom(`${seed}:candidates`));
}

export function brandKeysFor(product) {
  const brands = Array.isArray(product.brands) ? product.brands : [];
  const keys = [...new Set(brands
    .filter((brand) => typeof brand === 'string')
    .map((brand) => brand.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean))];
  return keys.length > 0 ? keys : [`unbranded:${product.id}`];
}

export function sharesBrandWith(product, claimedBrands) {
  return brandKeysFor(product).some((brand) => claimedBrands.has(brand));
}

export function formatShareText({ seed, answers, elapsedSeconds, url }) {
  const score = answers.filter((answer) => answer.correct).length;
  const duration = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const cells = answers.map((answer) => answer.wasListed === null ? '⬜' : answer.correct ? '🟩' : '🟥');
  const grid = Array.from({ length: Math.ceil(cells.length / 5) }, (_, index) => cells.slice(index * 5, index * 5 + 5).join('')).join('\n');
  return `Shopping List ${seed}\n${score}/${answers.length} · ${duration}\n\n${grid}\n\n${url}`;
}

export function buildRound(loadedProducts, seed) {
  if (loadedProducts.length < MIN_ROUND_PRODUCTS) throw new Error('At least four loaded products are required to build a round.');
  const chosen = loadedProducts.slice(0, MAX_ROUND_PRODUCTS);
  const targets = chosen.slice(0, Math.ceil(chosen.length / 2));
  const targetIds = new Set(targets.map((product) => product.id));
  return { targets, targetIds, quiz: shuffle(chosen, makeRandom(`${seed}:quiz`)), answers: [] };
}
