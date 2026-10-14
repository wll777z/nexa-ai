import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
    setupFiles: ['src/__tests__/setup.ts'],
    server: {
      deps: {
        external: [/^node:/],
      },
    },
  },
  ssr: {
    external: ['node:sqlite', 'node:fs', 'node:path', 'node:url'],
  },
});
