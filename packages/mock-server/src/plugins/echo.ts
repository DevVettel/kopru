import { redactHeaders } from '@kopru/core';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { defineMockPlugin } from '../plugin.js';
import { renderAutoPostPage } from '../three-ds.js';

/** `delay` senaryosunda izin verilen en uzun bekleme (ms). */
export const ECHO_MAX_DELAY_MS = 30_000;

/** Gövde taşıyamayan durum kodları; Fetch `Response` bunlarla gövde kabul etmez. */
const NULL_BODY_STATUSES: readonly number[] = [204, 205, 304];

const StatusParamSchema = z.coerce
  .number()
  .int()
  .min(200)
  .max(599)
  .refine((code) => !NULL_BODY_STATUSES.includes(code), 'Status must allow a response body');
const DelayParamSchema = z.coerce.number().int().min(0).max(ECHO_MAX_DELAY_MS);

/**
 * Sağlayıcıdan bağımsız örnek eklenti. Mock server çatısının kendisini test etmek
 * ve yeni eklenti yazarlarına örnek olmak için vardır.
 */
export const echoPlugin = defineMockPlugin({
  name: 'echo',
  basePath: '/echo',
  description:
    'Sağlayıcıdan bağımsız örnek eklenti: isteği yansıtır, durum kodu ve gecikme üretir.',
  scenarios: [
    {
      id: 'echo',
      description:
        'İsteğin metodunu, yolunu, sorgu parametrelerini ve gövdesini JSON olarak geri döner.',
      trigger: 'ANY /echo/*',
    },
    {
      id: 'status',
      description: 'Yoldaki HTTP durum kodu ile yanıt döner (200–599; 204, 205 ve 304 hariç).',
      trigger: 'GET /echo/status/:code',
    },
    {
      id: 'delay',
      description: `Yanıtı verilen milisaniye kadar geciktirir (en fazla ${String(ECHO_MAX_DELAY_MS)}); zaman aşımı testleri için.`,
      trigger: 'GET /echo/delay/:ms',
    },
    {
      id: 'three-ds',
      description:
        '3DS simülasyon sayfası döner; sayfa `status=success` alanını `callbackUrl` adresine otomatik POST eder.',
      trigger: 'GET /echo/3ds?callbackUrl=<url>&status=<success|failure>',
    },
  ],
  register: (app) => {
    app.get('/status/:code', (c) => {
      const parsed = StatusParamSchema.safeParse(c.req.param('code'));
      if (!parsed.success) return c.json({ error: 'INVALID_STATUS' }, 400);
      return c.json({ status: parsed.data }, parsedStatus(parsed.data));
    });

    app.get('/delay/:ms', async (c) => {
      const parsed = DelayParamSchema.safeParse(c.req.param('ms'));
      if (!parsed.success) return c.json({ error: 'INVALID_DELAY' }, 400);
      await new Promise((resolve) => setTimeout(resolve, parsed.data));
      return c.json({ delayedMs: parsed.data });
    });

    app.get('/3ds', (c) => {
      const callbackUrl = c.req.query('callbackUrl');
      if (callbackUrl === undefined || !URL.canParse(callbackUrl)) {
        return c.json({ error: 'INVALID_CALLBACK_URL' }, 400);
      }
      const status = c.req.query('status') === 'failure' ? 'failure' : 'success';
      return c.html(renderAutoPostPage({ action: callbackUrl, fields: { status } }));
    });

    app.all('/*', async (c) => {
      const url = new URL(c.req.url);
      return c.json({
        method: c.req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: redactHeaders(Object.fromEntries(c.req.raw.headers)),
        body: await c.req.text(),
      });
    });
  },
});

/**
 * Şemadan geçmiş sayıyı Hono'nun durum kodu tipine daraltır.
 */
function parsedStatus(code: number): ContentfulStatusCode {
  // Şema 200–599 aralığını ve gövdesiz kodların dışlandığını garanti eder; Hono'nun
  // literal birleşim tipine daraltmak için tip dönüşümü gerekir.
  return code as ContentfulStatusCode;
}
