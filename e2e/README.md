# End-to-end tests (Playwright)

Smoke suite for the two Astro apps against the shared Convex dev deployment.
Specs live next to the app they exercise:

- `e2e/web/` — runs with the `web` project (`http://localhost:4321`)
- `e2e/business/` — runs with the `business` project (business app, default port `4322`)
- `e2e/helpers.ts` — shared setup (register owner, create business/product/rider)
- `e2e/fixtures.ts` — hides the Astro dev toolbar so it cannot intercept clicks

## Prerequisites

```bash
pnpm install --prefer-offline
pnpm exec playwright install chromium
```

Both apps need their `.env.local` (gitignored). Copy them from an existing
checkout if this worktree does not have them:

```bash
cp /path/to/my-delivery/apps/web/.env.local apps/web/.env.local
cp /path/to/my-delivery/apps/business/.env.local apps/business/.env.local
```

## Run

From the repository root:

```bash
pnpm exec playwright test                 # whole suite
pnpm exec playwright test --project=web   # directory + JSON API only
pnpm exec playwright test --project=business
pnpm exec playwright test --headed        # watch it
```

## Servers and ports

`playwright.config.ts` defines a `webServer` block for both apps with
`reuseExistingServer: true`:

- If a dev server already answers on the port, it is **reused** and never killed.
- If nothing is listening, Playwright starts
  `pnpm --filter web exec astro dev --port <port>` (and the business equivalent).

The business app is still configured for its canonical port `4322`. When another
local process already holds `4322` (for example an unrelated project), the config
probes `4322`–`4325` and uses the first port that actually serves the Entregado
business app, and otherwise the first free one. Override the ports explicitly
with environment variables:

```bash
E2E_WEB_PORT=4321 E2E_BUSINESS_PORT=4323 pnpm exec playwright test
```

## Test data on the shared dev deployment

The suite writes to the **real shared Convex dev deployment**, so test data
accumulates. Every run creates uniquely named data with an `E2E` prefix:

- `E2E Owner <id>` accounts (`e2e.<id>@entregado.test`)
- `E2E Business <id>` businesses (`e2e-<id>` slugs)
- `E2E Product <id>` products and `E2E Rider <id>` rider accounts

IDs combine a base-36 timestamp and random suffix, so runs never collide. Tests
never read, mutate or delete data they did not create. A disposable test
deployment (separate Convex project with its own `.env.local`) is the proper
long-term fix; see the PR description for details.
