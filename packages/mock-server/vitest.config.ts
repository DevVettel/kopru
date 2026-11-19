import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'mock-server',
    include: ['test/**/*.test.ts'],
    // Programatik API'nin Vitest globalSetup içinde kullanımını da doğrular.
    globalSetup: ['test/global-setup.ts'],
  },
});
