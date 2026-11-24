import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Keep node_modules external; bundle our own code + the generated Prisma client.
  noExternal: [/generated\/prisma/],
});
