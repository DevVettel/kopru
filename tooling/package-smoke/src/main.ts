/**
 * Paket duman testi: yayımlanacak paketleri `pnpm pack` ile paketler, tarball'ları boş bir
 * projeye npm ile kurar ve ESM ile CommonJS tüketicisi gibi kullanır.
 *
 * Denetlenenler:
 * - Tarball içeriği (`dist`, README, LICENSE) ve `workspace:` bağımlılıklarının sürüme çevrilmesi
 * - `.d.ts` ve `.d.cts` tiplerinin `moduleResolution: nodenext` ile derlenmesi
 * - ESM ve CJS çıktılarının çalışması (mock server'a karşı ödeme ve kargo takibi)
 * - `kopru-mock` CLI'ının kurulumdan sonra çalışması
 *
 * Paketlerin önceden derlenmiş olması gerekir (`pnpm smoke:packages` bunu yapar).
 * Kullanım: `node src/main.ts [--keep]` (`--keep` geçici dizini silmez).
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** Yayımlanan paketler: npm adı ve depo içindeki dizini. */
const PACKAGES = [
  { name: '@kopru/core', dir: 'packages/core' },
  { name: '@kopru/iyzico', dir: 'packages/payment-iyzico' },
  { name: '@kopru/yurtici', dir: 'packages/cargo-yurtici' },
  { name: '@kopru/mock-server', dir: 'packages/mock-server' },
] as const;

/** Her tarball'da bulunması gereken dosyalar. */
const REQUIRED_FILES = [
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  'package/dist/index.js',
  'package/dist/index.cjs',
  'package/dist/index.d.ts',
  'package/dist/index.d.cts',
] as const;

const FIXTURES = ['esm.mts', 'cjs.cts'] as const;

const ROOT = resolve(import.meta.dirname, '../../..');
const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures');

/**
 * Alt süreçlerin ortamı. `pnpm run` kendi `npm_config_*` değişkenlerini ekler; bunlar npm'e
 * geçerse bilinmeyen ayar uyarıları üretir ve tüketici kurulumunu pnpm ayarlarıyla karıştırır.
 */
const CHILD_ENV = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_config_')),
);

/** Komutu çalıştırır ve standart çıktısını döndürür; başarısız olursa hata fırlatır. */
function run(command: string, args: readonly string[], cwd: string): string {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: CHILD_ENV,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (error) {
    // Başarısız komutun standart çıktısı (örn. tsc hataları) okunabilir biçimde gösterilir.
    const stdout = (error as { stdout?: unknown }).stdout;
    if (typeof stdout === 'string' && stdout.length > 0) process.stderr.write(stdout);
    throw new Error(`Command failed: ${command} ${args.join(' ')}`, { cause: error });
  }
}

function step(message: string): void {
  console.log(`\n▸ ${message}`);
}

/** Paketi geçici dizine paketler ve tarball'ın içeriğini denetler. */
function packPackage(pkg: (typeof PACKAGES)[number], destination: string): string {
  const output = run('pnpm', ['pack', '--pack-destination', destination], join(ROOT, pkg.dir));
  const tarball = output.trim().split('\n').at(-1)?.trim();
  if (tarball?.endsWith('.tgz') !== true) {
    throw new Error(`Could not find the tarball path in "pnpm pack" output for ${pkg.name}`);
  }

  const entries = new Set(run('tar', ['-tzf', tarball], destination).split('\n'));
  const missing = REQUIRED_FILES.filter((file) => !entries.has(file));
  if (missing.length > 0) {
    throw new Error(`${pkg.name} tarball is missing: ${missing.join(', ')}`);
  }

  const manifest = run('tar', ['-xzOf', tarball, 'package/package.json'], destination);
  if (manifest.includes('workspace:')) {
    throw new Error(`${pkg.name} tarball still contains a "workspace:" dependency`);
  }
  console.log(`  ${pkg.name}: ${String(entries.size - 1)} files`);
  return tarball;
}

/** Tarball'ları bağımlılık olarak kullanan tüketici projeyi yazar. */
function writeConsumer(dir: string, tarballs: ReadonlyMap<string, string>): void {
  const fileSpecs = Object.fromEntries([...tarballs].map(([name, path]) => [name, `file:${path}`]));
  const manifest = {
    name: 'kopru-package-smoke-consumer',
    private: true,
    dependencies: fileSpecs,
    // @kopru/core henüz npm'de değil; sağlayıcıların core bağımlılığı da yerel tarball'a gider.
    overrides: fileSpecs,
  };
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const tsconfig = {
    compilerOptions: {
      target: 'ES2023',
      lib: ['ES2023'],
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      erasableSyntaxOnly: true,
      // Paketlerin kendi .d.ts dosyaları da denetlensin.
      skipLibCheck: false,
      noEmit: true,
      types: ['node'],
      typeRoots: [join(ROOT, 'node_modules/@types')],
    },
    files: [...FIXTURES],
  };
  writeFileSync(join(dir, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);

  for (const fixture of FIXTURES) copyFileSync(join(FIXTURES_DIR, fixture), join(dir, fixture));
}

function main(): void {
  const keep = process.argv.includes('--keep');
  const workDir = mkdtempSync(join(tmpdir(), 'kopru-package-smoke-'));
  const tarballDir = join(workDir, 'tarballs');
  const consumerDir = join(workDir, 'consumer');
  mkdirSync(tarballDir);
  mkdirSync(consumerDir);

  try {
    step('Packing packages');
    const tarballs = new Map(PACKAGES.map((pkg) => [pkg.name, packPackage(pkg, tarballDir)]));

    step('Installing tarballs into an empty project (npm)');
    writeConsumer(consumerDir, tarballs);
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], consumerDir);

    step('Type-checking ESM and CJS consumers (moduleResolution: nodenext)');
    run(process.execPath, [join(ROOT, 'node_modules/typescript/bin/tsc'), '-p', '.'], consumerDir);

    step('Running consumers');
    for (const fixture of FIXTURES) {
      process.stdout.write(`  ${run(process.execPath, [fixture], consumerDir)}`);
    }

    step('Running the kopru-mock CLI');
    const help = run(join(consumerDir, 'node_modules/.bin/kopru-mock'), ['--help'], consumerDir);
    if (!help.includes('kopru-mock')) throw new Error('Unexpected "kopru-mock --help" output');
    console.log('  kopru-mock --help: ok');

    console.log('\n✔ Package smoke test passed');
  } finally {
    if (keep) console.log(`\nWork directory kept: ${workDir}`);
    else rmSync(workDir, { recursive: true, force: true });
  }
}

main();
