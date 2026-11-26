// @ts-check
import { defineConfig } from '@kopru/eslint-config';

export default [
  // fixtures/ tüketici projeye kopyalanır ve orada tsc ile denetlenir.
  { ignores: ['fixtures/**'] },
  ...defineConfig({ tsconfigRootDir: import.meta.dirname }),
];
