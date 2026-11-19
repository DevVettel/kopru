import { ConfigurationError } from '@kopru/core';
import { describe, expect, it } from 'vitest';
import { escapeHtml, renderAutoPostPage } from '../src/index.js';

describe('renderAutoPostPage', () => {
  it('alanları gizli input olarak callback adresine POST eden form üretir', () => {
    const html = renderAutoPostPage({
      action: 'https://shop.example/callback?order=1&x=2',
      fields: { status: 'success', paymentId: '42' },
    });
    expect(html).toContain(
      '<form id="kopru-3ds-form" method="post" action="https://shop.example/callback?order=1&amp;x=2">',
    );
    expect(html).toContain('<input type="hidden" name="status" value="success">');
    expect(html).toContain('<input type="hidden" name="paymentId" value="42">');
    expect(html).toContain('document.getElementById("kopru-3ds-form").submit();');
    expect(html).toContain('<title>3D Secure Doğrulama (Köprü Mock)</title>');
  });

  it('autoSubmit=false iken betik eklemez', () => {
    const html = renderAutoPostPage({
      action: 'http://localhost/cb',
      fields: {},
      autoSubmit: false,
      title: 'Test',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('<title>Test</title>');
  });

  it('alan değerlerini kaçışlar', () => {
    const html = renderAutoPostPage({
      action: 'http://localhost/cb',
      fields: { 'a"b': '<script>"x"</script>' },
    });
    expect(html).toContain('name="a&quot;b" value="&lt;script&gt;&quot;x&quot;&lt;/script&gt;"');
  });

  it.each(['javascript:alert(1)', 'not a url', 'ftp://host/file'])(
    'geçersiz adresi reddeder: %s',
    (action) => {
      expect(() => renderAutoPostPage({ action, fields: {} })).toThrow(ConfigurationError);
    },
  );
});

describe('escapeHtml', () => {
  it('özel karakterleri kaçışlar', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
