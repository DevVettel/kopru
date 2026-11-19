import { defineConfig } from 'tsup';
import { defineLibraryConfig } from '@kopru/tsup-config';

export default defineConfig(
  defineLibraryConfig({
    // `cli` girişinin ilk satırındaki shebang esbuild tarafından korunur.
    entry: { index: 'src/index.ts', cli: 'src/cli.ts' },
  }),
);
