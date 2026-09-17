import { execFileSync } from "node:child_process"
import { defineConfig, devices } from "@playwright/test"

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4321)

// The business app has a canonical port (4322), but Playwright reuses whatever is
// already listening, so a busy port must never be killed. If another local server
// holds 4322, use the next local port that actually serves the Entregado business
// app. When nothing is running, prefer the first free candidate so the dev server
// Playwright starts does not collide with another project.
type PortProbe = { port: number; responding: boolean; body: string }

function probePort(port: number): PortProbe {
  try {
    const body = execFileSync(
      "curl",
      ["-s", "--max-time", "3", `http://localhost:${port}/register`],
      { encoding: "utf8" }
    )
    return { port, responding: true, body }
  } catch {
    return { port, responding: false, body: "" }
  }
}

// Unique to the business app register page (Spanish UI copy).
const BUSINESS_APP_MARKER = "Crear cuenta"

const BUSINESS_PORT_CANDIDATES = process.env.E2E_BUSINESS_PORT
  ? [Number(process.env.E2E_BUSINESS_PORT)]
  : [4322, 4323, 4324, 4325]

const businessPortProbes = BUSINESS_PORT_CANDIDATES.map(probePort)
const BUSINESS_PORT =
  businessPortProbes.find(
    (probe) => probe.responding && probe.body.includes(BUSINESS_APP_MARKER)
  )?.port ??
  businessPortProbes.find((probe) => !probe.responding)?.port ??
  Number(process.env.E2E_BUSINESS_PORT ?? 4322)

const webURL = `http://localhost:${WEB_PORT}`
const businessURL = `http://localhost:${BUSINESS_PORT}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Dev servers compile routes on first hit, so keep the per-test budget generous.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `pnpm --filter web exec astro dev --port ${WEB_PORT}`,
      url: webURL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter business exec astro dev --port ${BUSINESS_PORT}`,
      url: `${businessURL}/register`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "web",
      testDir: "./e2e/web",
      use: { ...devices["Desktop Chrome"], baseURL: webURL },
    },
    {
      name: "business",
      testDir: "./e2e/business",
      use: { ...devices["Desktop Chrome"], baseURL: businessURL },
    },
  ],
})
