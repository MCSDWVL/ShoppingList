export const QUIZ_PRODUCT_COUNT = 10;
export const TARGET_COUNT = 5;

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

export function buildRound(products, seed) {
  if (products.length < QUIZ_PRODUCT_COUNT) throw new Error('At least ten products are required to build a round.');
  const random = makeRandom(seed);
  const chosen = shuffle(products, random).slice(0, QUIZ_PRODUCT_COUNT);
  const targets = chosen.slice(0, TARGET_COUNT);
  const targetIds = new Set(targets.map((product) => product.id));
  return { targets, targetIds, quiz: shuffle(chosen, random), answers: [] };
}

