import type { ThreeDSAction } from '@kopru/core';

/**
 * Kullanıcının tarayıcısını taklit eder: 3DS sayfasındaki formu bulur ve bankanın yapacağı
 * gibi mağazanın callback adresine form-post eder. Gerçek bir uygulamada bu adımı tarayıcı
 * yapar; siz yalnızca `action`'ı kullanıcıya iletirsiniz.
 *
 * @returns Mağazanın callback yanıtının HTTP durum kodu
 */
export async function submitThreeDSForm(action: ThreeDSAction): Promise<number> {
  const form = action.type === 'html' ? parseForm(action.html) : action;
  const response = await fetch(form.url, {
    method: 'POST',
    body: new URLSearchParams(form.fields),
  });
  await response.text();
  return response.status;
}

/** Mock server'ın ürettiği 3DS sayfasından form adresini ve gizli alanları okur. */
function parseForm(html: string): { url: string; fields: Record<string, string> } {
  const url = /<form[^>]*\saction="([^"]+)"/.exec(html)?.[1];
  if (url === undefined) throw new Error('3DS page does not contain a form');
  const fields: Record<string, string> = {};
  for (const [, name, value] of html.matchAll(/name="([^"]+)" value="([^"]*)"/g)) {
    if (name !== undefined && value !== undefined) fields[name] = unescapeHtml(value);
  }
  return { url: unescapeHtml(url), fields };
}

function unescapeHtml(text: string): string {
  return text
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}
