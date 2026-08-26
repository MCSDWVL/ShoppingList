import { QUIZ_PRODUCT_COUNT, buildRound } from './game-logic.js';

const MEMORIZE_SECONDS = 30;
const QUIZ_SECONDS = 60;

// Internal difficulty switch. Set to true to require name-to-image recall.
const HARD_MODE = true;

const elements = {
  announcement: document.querySelector('#announcement'),
  loading: document.querySelector('#loading-screen'), loadingMessage: document.querySelector('#loading-message'),
  start: document.querySelector('#start-screen'), dailyLabel: document.querySelector('#daily-label'), startButton: document.querySelector('#start-button'),
  memorize: document.querySelector('#memorize-screen'), memorizeTimer: document.querySelector('#memorize-timer'), shoppingList: document.querySelector('#shopping-list'), playNow: document.querySelector('#play-now-button'),
  quiz: document.querySelector('#quiz-screen'), quizTimer: document.querySelector('#quiz-timer'), quizProgress: document.querySelector('#quiz-progress'), quizCard: document.querySelector('#quiz-card'), yes: document.querySelector('#yes-button'), no: document.querySelector('#no-button'),
  results: document.querySelector('#results-screen'), score: document.querySelector('#score'), timeUsed: document.querySelector('#time-used'), reviewList: document.querySelector('#review-list'), replay: document.querySelector('#replay-button'), daily: document.querySelector('#daily-button'),
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
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => reject(new Error(`Timed out loading ${product.name}.`)), 20_000);
    image.onload = async () => {
      window.clearTimeout(timeout);
      try { await image.decode?.(); } catch { /* A loaded image can still be displayed without decode support. */ }
      preloadedImages.set(product.id, image);
      resolve();
    };
    image.onerror = () => { window.clearTimeout(timeout); reject(new Error(`Could not load ${product.name}.`)); };
    image.src = product.imageUrl;
  });
}

async function prepareRound() {
  round = buildRound(products, activeSeed);
  preloadedImages.clear();
  show('loading');
  elements.loadingMessage.textContent = 'Preloading all ten product images before the timer starts…';
  try {
    await Promise.all(round.quiz.map(preloadImage));
    beginMemorization();
  } catch (error) {
    clearInterval(timerId);
    elements.errorMessage.textContent = `${error.message} No timer was started; try again to reload the round.`;
    show('error');
  }
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
  elements.quizProgress.textContent = `Product ${round.answers.length + 1} of 10`;
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
  renderMemorize(); show('memorize'); announce('Memorize the five products. You have 30 seconds.');
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
  elements.score.textContent = score;
  elements.timeUsed.textContent = `Answered in ${formatTime(elapsed)}.`;
  elements.reviewList.replaceChildren(...round.answers.map((item) => {
    const row = document.createElement('article'); row.className = 'review-item';
    const detail = document.createElement('div'); const title = document.createElement('strong'); title.textContent = item.product.name;
    const result = document.createElement('p'); result.className = item.correct ? 'correct' : 'incorrect';
    const actual = round.targetIds.has(item.product.id) ? 'was on your list' : 'was not on your list';
    result.textContent = item.wasListed === null ? `Not answered — it ${actual}.` : `${item.correct ? 'Correct' : 'Incorrect'} — it ${actual}.`;
    detail.append(title, result); row.append(productImage(item.product), detail); return row;
  }));
  show('results'); elements.replay.focus(); announce(`Round complete. You scored ${score} out of 10.`);
}

async function loadGame() {
  clearInterval(timerId); show('loading'); elements.loadingMessage.textContent = 'Loading today’s product snapshot…';
  try {
    const [productResponse, manifestResponse] = await Promise.all([fetch('data/products.json', { cache: 'no-store' }), fetch('data/manifest.json', { cache: 'no-store' })]);
    if (!productResponse.ok || !manifestResponse.ok) throw new Error('Snapshot files are unavailable.');
    const candidateProducts = await productResponse.json(); manifest = await manifestResponse.json();
    products = candidateProducts.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.imageUrl === 'string');
    if (products.length < QUIZ_PRODUCT_COUNT || !manifest.snapshotDate) throw new Error('Snapshot does not contain enough usable products.');
    const override = new URLSearchParams(window.location.search).get('seed'); activeSeed = override || manifest.snapshotDate;
    elements.dailyLabel.textContent = override ? `Test seed: ${override}` : `Daily list · ${manifest.snapshotDate}`;
    show('start'); elements.startButton.focus();
  } catch (error) { elements.errorMessage.textContent = `${error.message} Run the publishing workflow or try again shortly.`; show('error'); }
}

elements.startButton.addEventListener('click', prepareRound);
elements.playNow.addEventListener('click', beginQuiz);
elements.yes.addEventListener('click', () => answer(true)); elements.no.addEventListener('click', () => answer(false));
elements.replay.addEventListener('click', prepareRound);
elements.daily.addEventListener('click', () => { const url = new URL(window.location.href); url.searchParams.delete('seed'); window.location.assign(url); });
elements.retry.addEventListener('click', () => products.length >= QUIZ_PRODUCT_COUNT ? prepareRound() : loadGame());
loadGame();
