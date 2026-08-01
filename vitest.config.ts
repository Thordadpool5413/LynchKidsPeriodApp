import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts'],
    exclude: ['node_modules/**', 'node_modules-incomplete/**', 'dist/**'],
    environment: 'node',
  },
});
