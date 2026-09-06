import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "web",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4321" },
    },
    {
      name: "business",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4322" },
    },
  ],
})
