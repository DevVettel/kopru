import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      // Sözleşme test paketleri test altyapısıdır; hata dalları yalnızca kurallara uymayan sağlayıcılarda çalışır.
      exclude: ['packages/*/src/testing/**'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
