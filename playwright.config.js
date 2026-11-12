import { defineConfig } from '@playwright/test'
import { platform } from 'node:os'
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5179', channel: platform() === 'win32' ? 'msedge' : undefined, headless: true },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5179', url: 'http://127.0.0.1:5179/tests/ui-harness.html', reuseExistingServer: false },
})
