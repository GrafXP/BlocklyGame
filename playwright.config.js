import { defineConfig, devices } from "@playwright/test";

// Browser tests for what node can't check: Blockly and Three.js together in a
// page (PLAN.md §12). They run against the production build, as served by
// `vite preview`. Chromium and WebKit on the desktop, and WebKit as an iPad in
// landscape with touch; a real iPad still needs trying by hand.
//
// The tests build and serve on a port of their own every run, so they never
// meet a stale build left on vite preview's usual port.
const PORT = 4179;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // The game follows the browser's language (PLAN.md §8); the tests choose
    // theirs, whatever this machine's is.
    locale: "en-US",
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
    { name: "ipad", use: { ...devices["iPad Pro 11 landscape"] } },
  ],
});
