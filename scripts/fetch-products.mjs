import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const output = args.output ?? 'site/data/products.json';
const manifestOutput = args.manifest ?? 'site/data/manifest.json';
const minimum = Number(args.minimum ?? 40);
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function alreadyCurrent() {
  try { return JSON.parse(await readFile(manifestOutput, 'utf8')).snapshotDate === date; } catch { return false; }
}

if (await alreadyCurrent()) { console.log(`Snapshot already current for ${date}; no API request made.`); process.exit(0); }

const endpoint = new URL('https://world.openfoodfacts.org/api/v2/search');
endpoint.search = new URLSearchParams({ fields: 'code,product_name,image_url', page_size: '100', page: '1', sort_by: 'popularity_key' });
const response = await fetch(endpoint, { headers: { 'User-Agent': 'shopping-list-game/1.0 (GitHub Pages daily snapshot)' } });
if (!response.ok) throw new Error(`Open Food Facts request failed: ${response.status} ${response.statusText}`);
const payload = await response.json();
const seen = new Set();
const products = (payload.products ?? []).flatMap((product) => {
  const id = String(product.code ?? '').trim(); const name = String(product.product_name ?? '').trim(); const imageUrl = String(product.image_url ?? '').trim();
  if (!id || !name || !imageUrl || seen.has(id) || !/^https:\/\//.test(imageUrl)) return [];
  seen.add(id); return [{ id, name, imageUrl }];
});
if (products.length < minimum) throw new Error(`Only ${products.length} usable products returned; need at least ${minimum}.`);
await Promise.all([mkdir(dirname(output), { recursive: true }), mkdir(dirname(manifestOutput), { recursive: true })]);
await writeFile(output, `${JSON.stringify(products, null, 2)}\n`);
await writeFile(manifestOutput, `${JSON.stringify({ snapshotDate: date, source: 'Open Food Facts API v2', productCount: products.length, fetchedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Wrote ${products.length} products for ${date}.`);

