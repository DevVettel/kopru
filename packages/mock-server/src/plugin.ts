import { ConfigurationError, validate } from '@kopru/core';
import type { Hono } from 'hono';
import { z } from 'zod';

/** Yönetim uç noktalarının ön eki; eklentiler bu yolu kullanamaz. */
export const ADMIN_PATH_PREFIX = '/__kopru';

/**
 * Bir eklentinin sunduğu deterministik senaryonun tanımı. Yalnızca
 * dokümantasyon ve keşif (`GET /__kopru/scenarios`) amaçlıdır.
 */
export const ScenarioDescriptorSchema = z.object({
  /** Senaryo kimliği (örn. `charge-success`). */
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be kebab-case'),
  /** Senaryonun Türkçe açıklaması. */
  description: z.string().min(1),
  /** Senaryoyu tetikleyen girdi (örn. test kart numarası, takip numarası). */
  trigger: z.string().min(1),
});

/** Bir eklentinin sunduğu deterministik senaryonun tanımı. */
export type ScenarioDescriptor = z.infer<typeof ScenarioDescriptorSchema>;

/** Eklentiye kayıt sırasında verilen bağlam. */
export interface MockPluginContext {
  /**
   * Sunucunun dışarıdan erişilebilir kök adresi (örn. `http://127.0.0.1:4010`).
   * Sunucu dinlemeye başladıktan sonra anlam kazandığı için fonksiyondur; yalnızca
   * istek işlenirken çağrılmalıdır (3DS yönlendirme adresleri üretmek gibi).
   */
  readonly baseUrl: () => string;
}

/** Mock server'a kaydedilebilen sağlayıcı eklentisi. */
export interface MockPlugin {
  /** Eklentinin benzersiz adı (örn. `iyzico`). İstek kaydında da bu ad kullanılır. */
  readonly name: string;
  /** Eklentinin route'larının bağlanacağı yol (örn. `/iyzico`). */
  readonly basePath: string;
  /** Eklentinin Türkçe açıklaması. */
  readonly description: string;
  /** Eklentinin sunduğu senaryolar. */
  readonly scenarios: readonly ScenarioDescriptor[];
  /**
   * Eklentinin route'larını, `basePath` altına bağlanacak alt uygulamaya kaydeder.
   * Route yolları `basePath`'e göreli yazılır.
   */
  readonly register: (app: Hono, context: MockPluginContext) => void;
}

const PluginMetadataSchema = z.object({
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be kebab-case'),
  basePath: z
    .string()
    .regex(/^(?:\/[a-z0-9-]+)+$/, 'Must start with "/" and contain lowercase path segments')
    .refine(
      (path) => path !== ADMIN_PATH_PREFIX && !path.startsWith(`${ADMIN_PATH_PREFIX}/`),
      `Must not use the reserved "${ADMIN_PATH_PREFIX}" prefix`,
    ),
  description: z.string().min(1),
  scenarios: z.array(ScenarioDescriptorSchema),
});

/**
 * Eklenti tanımını doğrular ve olduğu gibi döner. Tip çıkarımı ve erken hata
 * yakalama için eklentiler bu fonksiyonla tanımlanır.
 *
 * @throws {ConfigurationError} Eklenti meta verisi geçersizse
 */
export function defineMockPlugin(plugin: MockPlugin): MockPlugin {
  const result = validate(PluginMetadataSchema, plugin);
  if (!result.ok) {
    throw new ConfigurationError({
      message: `Invalid mock plugin "${plugin.name}": ${result.error.message}`,
      cause: result.error,
    });
  }
  return plugin;
}

/**
 * Eklenti listesinin ad ve yol çakışması içermediğini doğrular.
 *
 * @throws {ConfigurationError} Aynı ad veya iç içe geçen yollar varsa
 */
export function assertUniquePlugins(plugins: readonly MockPlugin[]): void {
  for (const [index, plugin] of plugins.entries()) {
    defineMockPlugin(plugin);
    for (const other of plugins.slice(index + 1)) {
      if (other.name === plugin.name) {
        throw new ConfigurationError({ message: `Duplicate mock plugin name "${plugin.name}"` });
      }
      if (pathsOverlap(plugin.basePath, other.basePath)) {
        throw new ConfigurationError({
          message: `Mock plugin paths overlap: "${plugin.basePath}" (${plugin.name}) and "${other.basePath}" (${other.name})`,
        });
      }
    }
  }
}

function pathsOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

/**
 * İstek yolunu karşılayan eklentiyi bulur.
 */
export function findPluginForPath(
  plugins: readonly MockPlugin[],
  path: string,
): MockPlugin | undefined {
  return plugins.find(
    (plugin) => path === plugin.basePath || path.startsWith(`${plugin.basePath}/`),
  );
}
