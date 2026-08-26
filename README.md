# Shopping List Game

A static daily memory game intended for GitHub Pages. The published site never
calls Open Food Facts from the browser. A GitHub Actions workflow refreshes a
small product snapshot once per Pacific calendar day, commits it, and deploys
the static site.

## Publish it

1. Push this repository to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Run the **Refresh daily products and deploy Pages** workflow once from the
   Actions tab. This creates the first product snapshot and publishes the site.

The workflow runs hourly but only contacts Open Food Facts when its checked-in
manifest is older than the current `America/Los_Angeles` date. Its automatic
commit requires the repository's Actions workflow permissions to allow
read/write access.

## Test a round

Append `?seed=demo` (or any other value) to the site URL. The same seed and
published snapshot always produce the same round.

