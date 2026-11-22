import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'yurtici',
    include: ['test/**/*.test.ts'],
    // Entegrasyon ve sözleşme testleri tek bir mock server örneğine karşı çalışır.
    globalSetup: ['test/global-setup.ts'],
  },
});
