// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

import { basename } from 'node:path';

/**
 * Sağlayıcı paket dizinlerini tanıyan kalıp (örn. `payment-iyzico`, `cargo-yurtici`).
 * Sağlayıcıların import edebileceği tek @kopru paketi core'dur; birbirlerini
 * import edemezler (bkz. ARCHITECTURE.md §2).
 */
const PROVIDER_PACKAGE_DIR = /^(payment|cargo|einvoice)-/;

/**
 * Köprü paketleri için ortak ESLint (flat config) ayarlarını üretir.
 *
 * @param {{ tsconfigRootDir: string }} options - Paket kök dizini (genellikle `import.meta.dirname`)
 */
export function defineConfig({ tsconfigRootDir }) {
  const isProviderPackage = PROVIDER_PACKAGE_DIR.test(basename(tsconfigRootDir));

  return tseslint.config(
    { ignores: ['dist/**', 'coverage/**'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: {
            allowDefaultProject: ['eslint.config.js'],
          },
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/ban-ts-comment': [
          'error',
          { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
        ],
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
        'no-restricted-syntax': [
          'error',
          {
            selector: 'ExportDefaultDeclaration',
            message: 'Varsayılan export kullanılmaz; isimli export kullanın (CLAUDE.md).',
          },
        ],
      },
    },
    {
      // Araç konfigürasyon dosyaları varsayılan export gerektirir.
      files: ['*.config.ts', '*.config.js'],
      rules: { 'no-restricted-syntax': 'off' },
    },
    ...(isProviderPackage
      ? [
          {
            files: ['src/**/*.ts'],
            rules: {
              'no-restricted-imports': [
                'error',
                {
                  patterns: [
                    {
                      regex: '^@kopru/(?!core(/|$))',
                      message: 'Sağlayıcı paketleri yalnızca @kopru/core paketini import edebilir.',
                    },
                  ],
                },
              ],
            },
          },
        ]
      : []),
  );
}
