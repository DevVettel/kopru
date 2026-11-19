import type { TestProject } from 'vitest/node';
import { startMockServer } from '../src/index.js';

declare module 'vitest' {
  export interface ProvidedContext {
    mockServerUrl: string;
  }
}

/**
 * README'de önerilen kullanımın aynısı: sunucu tüm testlerden önce bir kez başlatılır,
 * adresi `inject('mockServerUrl')` ile testlere aktarılır.
 */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = await startMockServer();
  project.provide('mockServerUrl', server.url);
  return () => server.stop();
}
