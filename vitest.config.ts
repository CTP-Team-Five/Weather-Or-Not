// vitest.config.ts
// Resolves the `@/` path alias the same way Next.js does (per tsconfig.json),
// so test files can import modules that use absolute `@/...` paths internally.

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
