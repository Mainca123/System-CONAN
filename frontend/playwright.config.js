import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 180000,
  use: {
    baseURL: "http://localhost:8180",
    channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
    headless: true,
  },
  reporter: "list",
});
