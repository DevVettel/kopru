import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'examples/*'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      // Sözleşme test paketleri test altyapısıdır; hata dalları yalnızca kurallara uymayan sağlayıcılarda çalışır.
      // `src/cli.ts` yalnızca süreç sinyallerini bağlayan ince giriş noktasıdır; mantığı `src/cli/` altında test edilir.
      exclude: ['packages/*/src/testing/**', 'packages/*/src/cli.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
