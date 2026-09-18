import { execFileSync } from "node:child_process"
import { defineConfig, devices } from "@playwright/test"

// Both apps have a canonical port, but Playwright reuses whatever is already
// listening, so a busy port must never be killed. Each app probes its candidate
// ports: prefer the one already serving that app, otherwise the first free port,
// and only then the canonical port so a foreign service on it fails loudly
// instead of being tested.
const CONNECTION_REFUSED_EXIT_CODE = 7

type PortState = "serving" | "occupied" | "free"

type PortProbe = { port: number; state: PortState; body: string }

function probePort(port: number, path: string): PortProbe {
  try {
    const body = execFileSync(
      "curl",
      ["-s", "--max-time", "3", `http://localhost:${port}${path}`],
      { encoding: "utf8" }
    )
    return { port, state: "serving", body }
  } catch (error) {
    // Only a refused connection means the port is free; a service that accepts
    // the connection but never answers must not be reused.
    const refused =
      (error as { status?: number }).status === CONNECTION_REFUSED_EXIT_CODE
    return { port, state: refused ? "free" : "occupied", body: "" }
  }
}

function selectPort(
  candidates: number[],
  path: string,
  marker: string,
  canonical: number
): number {
  const probes = candidates.map((port) => probePort(port, path))

  const serving = probes.find(
    (probe) => probe.state === "serving" && probe.body.includes(marker)
  )
  if (serving) {
    return serving.port
  }

  return probes.find((probe) => probe.state === "free")?.port ?? canonical
}

// Unique to each app: the business register page and the web directory copy.
const BUSINESS_APP_MARKER = "Crear cuenta"
const WEB_APP_MARKER = "Una tienda por negocio"

const WEB_PORT_CANONICAL = 4321
const BUSINESS_PORT_CANONICAL = 4322

const WEB_PORT_CANDIDATES = process.env.E2E_WEB_PORT
  ? [Number(process.env.E2E_WEB_PORT)]
  : [WEB_PORT_CANONICAL, 4326, 4327, 4328]

const WEB_PORT = selectPort(
  WEB_PORT_CANDIDATES,
  "/",
  WEB_APP_MARKER,
  Number(process.env.E2E_WEB_PORT ?? WEB_PORT_CANONICAL)
)

const BUSINESS_PORT_CANDIDATES = process.env.E2E_BUSINESS_PORT
  ? [Number(process.env.E2E_BUSINESS_PORT)]
  : [BUSINESS_PORT_CANONICAL, 4323, 4324, 4325].filter(
      (port) => port !== WEB_PORT
    )

const BUSINESS_PORT = selectPort(
  BUSINESS_PORT_CANDIDATES,
  "/register",
  BUSINESS_APP_MARKER,
  Number(process.env.E2E_BUSINESS_PORT ?? BUSINESS_PORT_CANONICAL)
)

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
      command: `PUBLIC_BUSINESS_URL=${businessURL} pnpm --filter web exec astro dev --port ${WEB_PORT}`,
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
