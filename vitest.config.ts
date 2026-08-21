import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['packages/**/__tests__/**/*.test.ts'],
    exclude:     ['node_modules', 'dist', 'build'],
    coverage: {
      provider: 'v8',
      include:  ['packages/context-fabric/**/*.ts'],
      exclude:  ['packages/context-fabric/**/__tests__/**', 'packages/context-fabric/**/*.test.ts'],
    },
  },
  resolve: {
    conditions: ['node'],
  },
});
