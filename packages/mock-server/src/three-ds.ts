import { ConfigurationError, validate } from '@kopru/core';
import { z } from 'zod';

/** 3DS simülasyon sayfası seçenekleri. */
export const AutoPostPageOptionsSchema = z.object({
  /** Formun gönderileceği callback adresi (üye işyeri dönüş adresi). */
  action: z.url({ protocol: /^https?$/ }),
  /** Callback'e POST edilecek form alanları. */
  fields: z.record(z.string(), z.string()),
  /** Sayfa başlığı. */
  title: z.string().default('3D Secure Doğrulama (Köprü Mock)'),
  /**
   * `true` ise form sayfa yüklenince otomatik gönderilir. `false` ise kullanıcı
   * "Devam et" düğmesine basar (tarayıcıda elle deneme için).
   */
  autoSubmit: z.boolean().default(true),
});

/** 3DS simülasyon sayfası seçenekleri (girdi hali). */
export type AutoPostPageOptions = z.input<typeof AutoPostPageOptionsSchema>;

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Metni HTML içinde güvenle kullanılabilecek şekilde kaçışlar.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Banka 3DS doğrulama ekranını taklit eden, verilen alanları callback adresine
 * form-post ile gönderen basit bir HTML sayfası üretir. Gerçek sağlayıcılar da
 * 3DS sonucunu üye işyerine bu yöntemle (tarayıcı üzerinden POST) iletir.
 *
 * @throws {ConfigurationError} Seçenekler geçersizse (örn. http(s) olmayan adres)
 */
export function renderAutoPostPage(options: AutoPostPageOptions): string {
  const result = validate(AutoPostPageOptionsSchema, options);
  if (!result.ok) {
    throw new ConfigurationError({
      message: `Invalid 3DS page options: ${result.error.message}`,
      cause: result.error,
    });
  }
  const { action, fields, title, autoSubmit } = result.value;

  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join('\n');
  const script = autoSubmit
    ? '\n    <script>document.getElementById("kopru-3ds-form").submit();</script>'
    : '';

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>Bu sayfa Köprü mock server tarafından üretilmiştir; gerçek bir banka doğrulaması değildir.</p>
    <form id="kopru-3ds-form" method="post" action="${escapeHtml(action)}">
${inputs}
      <button type="submit">Devam et</button>
    </form>${script}
  </body>
</html>
`;
}
