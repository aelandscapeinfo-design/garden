import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 180000,
  workers: 1,
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.OWOL_TEST_URL || "http://127.0.0.1:5182",
    viewport: { width: 1440, height: 960 },
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: process.env.OWOL_TEST_URL ? undefined : {
    command: "npm run dev",
    url: "http://127.0.0.1:5182",
    reuseExistingServer: true,
  },
  reporter: "list",
});
