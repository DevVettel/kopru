import { ConfigurationError } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import { assertUniquePlugins, findPluginForPath } from '../src/plugin.js';
import { defineMockPlugin, echoPlugin, type MockPlugin } from '../src/index.js';

const plugin = (overrides: Partial<MockPlugin> = {}): MockPlugin => ({
  name: 'sample',
  basePath: '/sample',
  description: 'Örnek eklenti',
  scenarios: [{ id: 'ok', description: 'Başarılı yanıt', trigger: 'GET /sample' }],
  register: () => undefined,
  ...overrides,
});

describe('defineMockPlugin', () => {
  it('geçerli eklentiyi olduğu gibi döner', () => {
    const definition = plugin();
    expect(defineMockPlugin(definition)).toBe(definition);
  });

  it.each([
    ['ad kebab-case değil', { name: 'Sample' }],
    ['yol / ile başlamıyor', { basePath: 'sample' }],
    ['yol sonunda / var', { basePath: '/sample/' }],
    ['ayrılmış yönetim yolu', { basePath: '/__kopru' }],
    ['boş açıklama', { description: '' }],
    ['geçersiz senaryo kimliği', { scenarios: [{ id: 'Bad Id', description: 'x', trigger: 'y' }] }],
  ])('%s → ConfigurationError', (_label, overrides) => {
    expect(() => defineMockPlugin(plugin(overrides))).toThrow(ConfigurationError);
  });
});

describe('assertUniquePlugins', () => {
  it('çakışmayan eklentileri kabul eder', () => {
    expect(() => {
      assertUniquePlugins([echoPlugin, plugin(), plugin({ name: 'other', basePath: '/sample-2' })]);
    }).not.toThrow();
  });

  it('aynı adı reddeder', () => {
    expect(() => {
      assertUniquePlugins([plugin(), plugin({ basePath: '/other' })]);
    }).toThrow(/Duplicate mock plugin name/);
  });

  it.each(['/sample', '/sample/nested'])('iç içe geçen yolu reddeder: %s', (basePath) => {
    expect(() => {
      assertUniquePlugins([plugin(), plugin({ name: 'other', basePath })]);
    }).toThrow(/paths overlap/);
  });
});

describe('findPluginForPath', () => {
  const plugins = [plugin(), plugin({ name: 'other', basePath: '/sample-2' })];

  it('yolu karşılayan eklentiyi bulur', () => {
    expect(findPluginForPath(plugins, '/sample')?.name).toBe('sample');
    expect(findPluginForPath(plugins, '/sample/a/b')?.name).toBe('sample');
    expect(findPluginForPath(plugins, '/sample-2/x')?.name).toBe('other');
  });

  it('ön eki benzeyen ama farklı yolu eşlemez', () => {
    expect(findPluginForPath([plugin()], '/samplex')).toBeUndefined();
  });
});
