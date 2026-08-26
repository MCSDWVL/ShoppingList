import { MAX_ROUND_PRODUCTS, MIN_ROUND_PRODUCTS, brandKeysFor, buildRound, candidateQueue, formatShareText, sharesBrandWith } from './game-logic.js';

const MEMORIZE_SECONDS = 30;
const QUIZ_SECONDS = 60;
const IMAGE_TIMEOUT_MS = 12_000;
const MAX_IMAGE_ATTEMPTS = 50;

// Internal difficulty switch. Set to true to require name-to-image recall.
const HARD_MODE = true;

const elements = {
  announcement: document.querySelector('#announcement'),
  loading: document.querySelector('#loading-screen'), loadingMessage: document.querySelector('#loading-message'),
  start: document.querySelector('#start-screen'), dailyLabel: document.querySelector('#daily-label'), startButton: document.querySelector('#start-button'),
  memorize: document.querySelector('#memorize-screen'), memorizeTimer: document.querySelector('#memorize-timer'), shoppingList: document.querySelector('#shopping-list'), playNow: document.querySelector('#play-now-button'),
  quiz: document.querySelector('#quiz-screen'), quizTimer: document.querySelector('#quiz-timer'), quizProgress: document.querySelector('#quiz-progress'), quizCard: document.querySelector('#quiz-card'), yes: document.querySelector('#yes-button'), no: document.querySelector('#no-button'),
  results: document.querySelector('#results-screen'), score: document.querySelector('#score'), scoreTotal: document.querySelector('#score-total'), timeUsed: document.querySelector('#time-used'), reviewList: document.querySelector('#review-list'), share: document.querySelector('#share-button'), replay: document.querySelector('#replay-button'), daily: document.querySelector('#daily-button'),
  error: document.querySelector('#error-screen'), errorMessage: document.querySelector('#error-message'), retry: document.querySelector('#retry-button'),
};

let products = [];
let manifest;
let round;
let timerId;
let phaseEndsAt;
let answerStartedAt;
let activeSeed;
const preloadedImages = new Map();

const screens = ['loading', 'start', 'memorize', 'quiz', 'results', 'error'];
const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const announce = (message) => { elements.announcement.textContent = message; };
const show = (screen) => screens.forEach((name) => { elements[name].hidden = name !== screen; });
function productImage(product, altText = product.name) {
  const loadedImage = preloadedImages.get(product.id);
  if (loadedImage) {
    const image = loadedImage.cloneNode();
    image.alt = altText;
    image.loading = 'eager';
    return image;
  }
  const image = document.createElement('img');
  image.src = product.imageUrl;
  image.alt = altText;
  image.loading = 'eager';
  image.addEventListener('error', () => { image.hidden = true; });
  return image;
}

function preloadImage(product) {
  return new Promise((resolve) => {
    const image = new Image();
    const fail = () => { window.clearTimeout(timeout); resolve(false); };
    const timeout = window.setTimeout(fail, IMAGE_TIMEOUT_MS);
    image.onload = async () => {
      window.clearTimeout(timeout);
      try { await image.decode?.(); } catch { /* A loaded image can still be displayed without decode support. */ }
      preloadedImages.set(product.id, image);
      resolve(true);
    };
    image.onerror = fail;
    image.src = product.imageUrl;
  });
}

async function preloadRoundProducts() {
  const queue = candidateQueue(products, activeSeed);
  const loaded = [];
  const claimedBrands = new Set();
  let index = 0;
  let attempts = 0;
  while (loaded.length < MAX_ROUND_PRODUCTS && index < queue.length && attempts < MAX_IMAGE_ATTEMPTS) {
    const needed = MAX_ROUND_PRODUCTS - loaded.length;
    const batch = queue.slice(index, index + Math.min(needed, MAX_IMAGE_ATTEMPTS - attempts));
    index += batch.length;
    attempts += batch.length;
    const results = await Promise.all(batch.map(async (product) => ({ product, loaded: await preloadImage(product) })));
    for (const result of results) {
      if (!result.loaded || sharesBrandWith(result.product, claimedBrands)) continue;
      loaded.push(result.product);
      brandKeysFor(result.product).forEach((brand) => claimedBrands.add(brand));
    }
    elements.loadingMessage.textContent = `Preparing products… ${loaded.length} of ${MAX_ROUND_PRODUCTS} images ready.`;
  }
  return loaded;
}

async function prepareRound() {
  preloadedImages.clear();
  show('loading');
  elements.loadingMessage.textContent = 'Preloading product images before the timer starts…';
  const loadedProducts = await preloadRoundProducts();
  if (loadedProducts.length < MIN_ROUND_PRODUCTS) {
    clearInterval(timerId);
    elements.errorMessage.textContent = 'Fewer than four product images could be prepared. No timer was started; please try again.';
    show('error');
    return;
  }
  round = buildRound(loadedProducts, activeSeed);
  beginMemorization();
}

function renderMemorize() {
  elements.shoppingList.replaceChildren(...round.targets.map((product) => {
    const card = document.createElement('article'); card.className = 'product-card';
    const name = document.createElement('p'); name.textContent = product.name;
    if (!HARD_MODE) card.append(productImage(product));
    card.append(name); return card;
  }));
}

function renderQuiz() {
  const product = round.quiz[round.answers.length];
  elements.quizProgress.textContent = `Product ${round.answers.length + 1} of ${round.quiz.length}`;
  elements.quizCard.replaceChildren();
  elements.quizCard.append(productImage(product, HARD_MODE ? 'Product image' : product.name));
  if (!HARD_MODE) {
    const name = document.createElement('h3'); name.textContent = product.name; elements.quizCard.append(name);
  }
}

function startTimer(seconds, target, onExpire) {
  clearInterval(timerId); phaseEndsAt = Date.now() + seconds * 1000;
  const update = () => { const remaining = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000)); target.textContent = formatTime(remaining); if (remaining === 0) { clearInterval(timerId); onExpire(); } };
  update(); timerId = window.setInterval(update, 200);
}

function beginMemorization() {
  renderMemorize(); show('memorize'); announce(`Memorize the ${round.targets.length} products. You have 30 seconds.`);
  startTimer(MEMORIZE_SECONDS, elements.memorizeTimer, beginQuiz);
}

function beginQuiz() {
  answerStartedAt = Date.now(); renderQuiz(); show('quiz'); elements.yes.focus(); announce('Quiz started. Decide whether each product was on your list.');
  startTimer(QUIZ_SECONDS, elements.quizTimer, finishRound);
}

function answer(wasListed) {
  const product = round.quiz[round.answers.length];
  round.answers.push({ product, wasListed, correct: wasListed === round.targetIds.has(product.id) });
  if (round.answers.length === round.quiz.length) finishRound(); else { renderQuiz(); elements.yes.focus(); }
}

function finishRound() {
  clearInterval(timerId);
  const elapsed = Math.min(QUIZ_SECONDS, Math.round((Date.now() - answerStartedAt) / 1000));
  while (round.answers.length < round.quiz.length) { const product = round.quiz[round.answers.length]; round.answers.push({ product, wasListed: null, correct: false }); }
  const score = round.answers.filter((item) => item.correct).length;
  round.elapsedSeconds = elapsed;
  elements.score.textContent = score;
  elements.scoreTotal.textContent = round.quiz.length;
  elements.timeUsed.textContent = `Answered in ${formatTime(elapsed)}.`;
  elements.reviewList.replaceChildren(...round.answers.map((item) => {
    const row = document.createElement('article'); row.className = 'review-item';
    const detail = document.createElement('div'); const title = document.createElement('strong'); title.textContent = item.product.name;
    const result = document.createElement('p'); result.className = item.correct ? 'correct' : 'incorrect';
    const actual = round.targetIds.has(item.product.id) ? 'was on your list' : 'was not on your list';
    result.textContent = item.wasListed === null ? `Not answered — it ${actual}.` : `${item.correct ? 'Correct' : 'Incorrect'} — it ${actual}.`;
    detail.append(title, result); row.append(productImage(item.product), detail); return row;
  }));
  show('results'); elements.replay.focus(); announce(`Round complete. You scored ${score} out of ${round.quiz.length}.`);
}

async function loadGame() {
  clearInterval(timerId); show('loading'); elements.loadingMessage.textContent = 'Loading today’s product snapshot…';
  try {
    const [productResponse, manifestResponse] = await Promise.all([fetch('data/products.json', { cache: 'no-store' }), fetch('data/manifest.json', { cache: 'no-store' })]);
    if (!productResponse.ok || !manifestResponse.ok) throw new Error('Snapshot files are unavailable.');
    const candidateProducts = await productResponse.json(); manifest = await manifestResponse.json();
    products = candidateProducts.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.imageUrl === 'string');
    if (products.length < MIN_ROUND_PRODUCTS || !manifest.snapshotDate) throw new Error('Snapshot does not contain enough usable products.');
    const override = new URLSearchParams(window.location.search).get('seed');
    const pacificDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    activeSeed = override || pacificDate;
    elements.dailyLabel.textContent = override ? `Test seed: ${override}` : `Daily list · ${pacificDate}`;
    show('start'); elements.startButton.focus();
  } catch (error) { elements.errorMessage.textContent = `${error.message} Run the publishing workflow or try again shortly.`; show('error'); }
}

elements.startButton.addEventListener('click', prepareRound);
elements.playNow.addEventListener('click', beginQuiz);
elements.yes.addEventListener('click', () => answer(true)); elements.no.addEventListener('click', () => answer(false));
elements.share.addEventListener('click', () => {
  const text = formatShareText({ seed: activeSeed, answers: round.answers, elapsedSeconds: round.elapsedSeconds, url: window.location.href });
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
});
elements.replay.addEventListener('click', prepareRound);
elements.daily.addEventListener('click', () => { const url = new URL(window.location.href); url.searchParams.delete('seed'); window.location.assign(url); });
elements.retry.addEventListener('click', () => products.length >= MIN_ROUND_PRODUCTS ? prepareRound() : loadGame());
loadGame();
