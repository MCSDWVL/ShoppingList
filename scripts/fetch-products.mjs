import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const output = args.output ?? 'site/data/products.json';
const manifestOutput = args.manifest ?? 'site/data/manifest.json';
const target = Number(args.target ?? 950);
const maxPages = Number(args.maxPages ?? 10);
const minimumCatalogProducts = Number(args.minimum ?? 100);
const maxRequestAttempts = Number(args.attempts ?? 20);
const pageSize = 100;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const RETRY_BACKOFF_MS = 5_000;
const SEARCH_REQUEST_LIMIT = 10;
const SEARCH_WINDOW_MS = 60_000;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const repositoryUrl = process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : 'https://github.com/';
const userAgent = `ShoppingListGame/1.0 (+${repositoryUrl}; Search-a-licious weekly catalog refresh)`;

if (!Number.isInteger(target) || target < 1 || !Number.isInteger(maxPages) || maxPages < 1 || !Number.isInteger(minimumCatalogProducts) || minimumCatalogProducts < 1 || !Number.isInteger(maxRequestAttempts) || maxRequestAttempts < 1) throw new Error('target, maxPages, minimum, and attempts must be positive integers.');

const seen = new Set();
const products = [];
let searchRequestTimes = [];

async function waitForSearchSlot() {
  while (true) {
    const now = Date.now();
    searchRequestTimes = searchRequestTimes.filter((time) => now - time < SEARCH_WINDOW_MS);
    if (searchRequestTimes.length < SEARCH_REQUEST_LIMIT) {
      searchRequestTimes.push(now);
      return;
    }
    const waitMs = Math.max(1, searchRequestTimes[0] + SEARCH_WINDOW_MS - now);
    console.log(`Search request limit reached; waiting ${Math.ceil(waitMs / 1_000)} seconds for a slot.`);
    await delay(waitMs);
  }
}

async function fetchPage(page) {
  const endpoint = new URL('https://search.openfoodfacts.org/search');
  endpoint.search = new URLSearchParams({ fields: 'code,product_name,image_url,brands', page_size: String(pageSize), page: String(page), sort_by: '-unique_scans_n' });
  for (let attempt = 1; attempt <= maxRequestAttempts; attempt += 1) {
    try {
      await waitForSearchSlot();
      const response = await fetch(endpoint, { headers: { 'User-Agent': userAgent } });
      if (response.ok) return response.json();
      const retryableStatus = response.status === 401 || response.status === 429 || response.status >= 500;
      if (!retryableStatus) {
        const error = new Error(`Search-a-licious request failed on page ${page}: ${response.status} ${response.statusText}`);
        error.retryable = false;
        throw error;
      }
      if (attempt === maxRequestAttempts) throw new Error(`Search-a-licious request failed on page ${page}: ${response.status} ${response.statusText}`);
      const retryAfter = Number(response.headers.get('retry-after'));
      const backoffMs = attempt * RETRY_BACKOFF_MS;
      const waitMs = Number.isFinite(retryAfter) ? Math.max(backoffMs, retryAfter * 1_000) : backoffMs;
      console.log(`Page ${page} returned ${response.status}; retrying in ${waitMs / 1_000} seconds.`);
      await delay(waitMs);
    } catch (error) {
      if (error.retryable === false || attempt === maxRequestAttempts) throw error;
      console.log(`Page ${page} request failed; retrying in ${attempt * RETRY_BACKOFF_MS / 1_000} seconds.`);
      await delay(attempt * RETRY_BACKOFF_MS);
    }
  }
}

for (let page = 1; page <= maxPages && products.length < target; page += 1) {
  const payload = await fetchPage(page);
  const sourceProducts = payload.hits ?? [];
  for (const product of sourceProducts) {
    const id = String(product.code ?? '').trim();
    const name = String(product.product_name ?? '').trim();
    const imageUrl = String(product.image_url ?? '').trim();
    if (!id || !name || !imageUrl || seen.has(id) || !/^https:\/\//.test(imageUrl)) continue;
    seen.add(id);
    const brands = Array.isArray(product.brands) ? product.brands.filter((brand) => typeof brand === 'string' && brand.trim()).map((brand) => brand.trim()) : [];
    products.push({ id, name, imageUrl, brands });
    if (products.length === target) break;
  }
  console.log(`Page ${page}: ${products.length} usable products collected.`);
  if (sourceProducts.length < pageSize) break;
}

if (products.length < minimumCatalogProducts) throw new Error(`Only ${products.length} usable products returned; need at least ${minimumCatalogProducts} to replace the catalog.`);
await Promise.all([mkdir(dirname(output), { recursive: true }), mkdir(dirname(manifestOutput), { recursive: true })]);
await writeFile(output, `${JSON.stringify(products, null, 2)}\n`);
await writeFile(manifestOutput, `${JSON.stringify({ snapshotDate: today, source: 'Open Food Facts Search-a-licious API', productCount: products.length, fetchedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Wrote ${products.length} products for ${today} after reaching ${products.length >= target ? 'the target' : 'the page limit'}.`);
