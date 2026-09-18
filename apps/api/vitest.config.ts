import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'unit', environment: 'node', include: ['test/unit/**/*.test.ts'] },
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['test/integration/**/*test.ts'],
          globalSetup: ['./test/globalSetup.ts'],
          setupFiles: ['./test/setup-env.ts'],
          fileParallelism: false, // all files share one database
          hookTimeout: 60_000, // first container start pulls the image
          testTimeout: 15_000, // argon2 at 64 MiB is slow-ish
        },
      },
    ],
  },
});
