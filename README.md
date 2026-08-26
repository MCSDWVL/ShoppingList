# Shopping List Game

A static daily memory game intended for GitHub Pages. The published site never
calls Open Food Facts from the browser. A GitHub Actions workflow refreshes an
up-to-950-product snapshot weekly from the Search-a-licious API, commits it,
and deploys the static site.

## Publish it

1. Push this repository to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions**.
3. Run the **Refresh weekly products and deploy Pages** workflow once from the
   Actions tab. This creates the first product snapshot and publishes the site.

The workflow runs every Monday at 09:00 UTC and can also be started manually.
Daily variety comes from the current `America/Los_Angeles` date, not from a
daily API call. Its automatic commit requires the repository's Actions workflow
permissions to allow read/write access. The collector spaces search requests by
a process-local maximum of ten in any rolling 60-second window, including
retries. It stops after reaching 950 usable products or completing ten search
pages, whichever comes first.

## Test a round

Append `?seed=demo` (or any other value) to the site URL. The same seed and
published snapshot produce the same candidate order; unavailable external
images are replaced before a round begins.
