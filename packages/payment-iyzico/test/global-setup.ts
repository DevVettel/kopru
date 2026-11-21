import { iyzicoPlugin, startMockServer } from '@kopru/mock-server';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    mockServerUrl: string;
  }
}

/**
 * Tüm testlerden önce yalnızca iyzico eklentisiyle bir mock server başlatır;
 * adres `inject('mockServerUrl')` ile testlere aktarılır.
 */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = await startMockServer({ plugins: [iyzicoPlugin] });
  project.provide('mockServerUrl', server.url);
  return () => server.stop();
}
