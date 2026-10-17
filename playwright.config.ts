import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/luxurystay",
      AUTH_SECRET: process.env.AUTH_SECRET || "playwright-only-placeholder-secret",
      AUTH_URL: "http://127.0.0.1:3000",
      HOTEL_TIMEZONE: "Asia/Kolkata"
    }
  }
});
