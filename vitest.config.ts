import { defineConfig } from 'vitest/config';

// Only run the project's own tests. Installed agent skills under .agents/
// ship their own *.test.ts files (written for Bun), which must not be picked up.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
